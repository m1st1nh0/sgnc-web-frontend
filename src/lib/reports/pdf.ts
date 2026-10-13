/** Montagem dos PDFs de relatório: cabeçalho ARQUEM, seções, cartões, barras, tabelas e rodapé com autoria e paginação. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

import { dataHoraBr } from "./formato";

const A4: [number, number] = [595.28, 841.89];
export const MARGEM = 42;
const LARGURA = A4[0] - MARGEM * 2;
const RODAPE = 56;
export const COR = {
  navy: rgb(0.09, 0.2, 0.3), green: rgb(0.1, 0.66, 0.54), text: rgb(0.13, 0.21, 0.29), muted: rgb(0.4, 0.46, 0.54),
  line: rgb(0.87, 0.89, 0.92), soft: rgb(0.953, 0.965, 0.973), white: rgb(1, 1, 1),
  warn: rgb(0.65, 0.33, 0), warnBg: rgb(1, 0.953, 0.89), crit: rgb(0.66, 0.15, 0.11), critBg: rgb(0.992, 0.922, 0.914),
};

const caracteres = new WeakMap<PDFFont, Set<number>>();
/** Troca o que a fonte padrão (WinAnsi) não desenha por "?", para que emoji ou seta digitados não derrubem o PDF. */
export function textoDaFonte(font: PDFFont, texto: string) {
  let suportados = caracteres.get(font);
  if (!suportados) { suportados = new Set(font.getCharacterSet()); caracteres.set(font, suportados); }
  return Array.from(texto.replace(/\t/g, " "), (char) => suportados.has(char.codePointAt(0)!) ? char : "?").join("");
}

/** Corta uma palavra maior que a largura disponível em pedaços que cabem. */
function quebrarPalavra(word: string, font: PDFFont, size: number, maxWidth: number) {
  const partes: string[] = [];
  let atual = "";
  for (const char of word) {
    if (atual && font.widthOfTextAtSize(atual + char, size) > maxWidth) { partes.push(atual); atual = char; } else atual += char;
  }
  if (atual) partes.push(atual);
  return partes;
}

/** Quebra o texto em linhas; a primeira linha pode ser mais curta (quando divide espaço com o rótulo). */
export function splitText(text: string, font: PDFFont, size: number, maxWidth: number, firstWidth = maxWidth) {
  const lines: string[] = [];
  for (const paragraph of textoDaFonte(font, String(text || "-")).split(/\r?\n/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const limit = () => lines.length ? maxWidth : firstWidth;
      const pedacos = font.widthOfTextAtSize(word, size) > maxWidth ? quebrarPalavra(word, font, size, maxWidth) : [word];
      for (const pedaco of pedacos) {
        const candidate = current ? `${current} ${pedaco}` : pedaco;
        if (font.widthOfTextAtSize(candidate, size) <= limit() || !current) current = candidate;
        else { lines.push(current); current = pedaco; }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : ["-"];
}

export type Coluna = { titulo: string; largura: number; alinhar?: "esquerda" | "direita" };
export type Cartao = { rotulo: string; valor: string; detalhe?: string; comparacao?: string };
export type Barra = { rotulo: string; valor: number; cor?: RGB };
export type LinhaAtencao = { nivel: "critico" | "atencao" | "info"; rotulo: string; texto: string; referencia?: string };

export async function pdfWriter(title: string, subtitle: string) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage, y = 0;
  const desenhar = (texto: string, x: number, yy: number, size: number, font = regular, color = COR.text) =>
    page.drawText(textoDaFonte(font, texto), { x, y: yy, size, font, color });
  const addPage = () => {
    const primeira = doc.getPageCount() === 0;
    page = doc.addPage(A4);
    page.drawRectangle({ x: 0, y: A4[1] - 48, width: A4[0], height: 48, color: COR.navy });
    desenhar("ARQUEM", MARGEM, A4[1] - 29, 12, bold, COR.white);
    desenhar("AUTOMAÇÃO CORPORATIVA", MARGEM, A4[1] - 41, 6, regular, COR.green);
    if (primeira) {
      desenhar(title, MARGEM, A4[1] - 78, 18, bold, COR.navy);
      desenhar(subtitle, MARGEM, A4[1] - 94, 9, regular, COR.muted);
      y = A4[1] - 120;
    } else {
      // Páginas seguintes: título curto à direita da faixa, mais espaço para o conteúdo.
      const continuacao = textoDaFonte(regular, `${title} · ${subtitle}`);
      page.drawText(continuacao, { x: A4[0] - MARGEM - regular.widthOfTextAtSize(continuacao, 8), y: A4[1] - 29, size: 8, font: regular, color: COR.white });
      y = A4[1] - 72;
    }
  };
  const ensure = (height: number) => { if (y - height < RODAPE) addPage(); };
  const heading = (text: string) => {
    ensure(34); y -= 8;
    const texto = textoDaFonte(bold, text.toLocaleUpperCase("pt-BR"));
    page.drawText(texto, { x: MARGEM, y, size: 10, font: bold, color: COR.navy });
    const fim = MARGEM + bold.widthOfTextAtSize(texto, 10) + 8;
    page.drawLine({ start: { x: fim, y: y + 3 }, end: { x: A4[0] - MARGEM, y: y + 3 }, thickness: 0.5, color: COR.line });
    y -= 18;
  };
  /** Começa uma seção grande em página nova, com título e uma linha de apoio. */
  const secao = (titulo: string, apoio?: string) => {
    if (y < A4[1] - 130) addPage();
    desenhar(titulo, MARGEM, y, 15, bold, COR.navy); y -= 16;
    if (apoio) { for (const item of splitText(apoio, regular, 9, LARGURA)) { desenhar(item, MARGEM, y, 9, regular, COR.muted); y -= 12; } }
    y -= 6;
  };
  /** "Rótulo: valor", com o rótulo em negrito e o valor quebrando na largura da página. */
  const line = (label: string, value: unknown) => {
    const rotulo = textoDaFonte(bold, `${label}: `);
    const larguraRotulo = bold.widthOfTextAtSize(rotulo, 9);
    const texto = value == null || value === "" ? "-" : String(value);
    const cabe = larguraRotulo < LARGURA * 0.6;
    const lines = cabe ? splitText(texto, regular, 9, LARGURA, LARGURA - larguraRotulo) : splitText(`${label}: ${texto}`, regular, 9, LARGURA);
    ensure(lines.length * 13 + 4);
    lines.forEach((item, index) => {
      if (cabe && index === 0) {
        page.drawText(rotulo, { x: MARGEM, y, size: 9, font: bold, color: COR.text });
        page.drawText(item, { x: MARGEM + larguraRotulo, y, size: 9, font: regular, color: COR.text });
      } else page.drawText(item, { x: MARGEM, y, size: 9, font: regular, color: COR.text });
      y -= 13;
    });
    y -= 3;
  };
  const paragrafo = (texto: string, opcoes: { size?: number; cor?: RGB } = {}) => {
    const size = opcoes.size ?? 9;
    const lines = splitText(texto, regular, size, LARGURA);
    ensure(lines.length * (size + 4) + 4);
    for (const item of lines) { page.drawText(item, { x: MARGEM, y, size, font: regular, color: opcoes.cor ?? COR.text }); y -= size + 4; }
    y -= 4;
  };
  /** Cartões de número lado a lado (até 4 por linha). */
  const cartoes = (itens: Cartao[]) => {
    const gap = 10, colunas = Math.min(4, itens.length), largura = (LARGURA - gap * (colunas - 1)) / colunas, altura = 72;
    ensure(altura + 12);
    itens.slice(0, 4).forEach((item, index) => {
      const x = MARGEM + index * (largura + gap), topo = y + 8;
      page.drawRectangle({ x, y: topo - altura, width: largura, height: altura, borderColor: COR.line, borderWidth: 0.8 });
      desenhar(item.rotulo.toLocaleUpperCase("pt-BR"), x + 9, topo - 15, 7, bold, COR.text);
      desenhar(item.valor, x + 9, topo - 40, 22, bold, COR.navy);
      if (item.detalhe) desenhar(splitText(item.detalhe, regular, 7.5, largura - 18)[0], x + 9, topo - 53, 7.5, regular, COR.muted);
      if (item.comparacao) desenhar(splitText(item.comparacao, regular, 7.5, largura - 18)[0], x + 9, topo - 64, 7.5, regular, COR.muted);
    });
    y -= altura + 12;
  };
  /** Linhas do bloco "Pede atenção": selo colorido pelo nível, texto e NCs de referência. */
  const atencao = (itens: LinhaAtencao[]) => {
    for (const item of itens) {
      const ref = item.referencia ? textoDaFonte(regular, item.referencia) : "";
      const larguraRef = ref ? regular.widthOfTextAtSize(ref, 8) + 10 : 0;
      const lines = splitText(item.texto, regular, 8.5, LARGURA - 92 - larguraRef);
      const altura = Math.max(20, lines.length * 11 + 9);
      ensure(altura + 5);
      const fundo = item.nivel === "critico" ? COR.critBg : item.nivel === "atencao" ? COR.warnBg : COR.soft;
      const selo = item.nivel === "critico" ? COR.crit : item.nivel === "atencao" ? COR.warn : COR.muted;
      page.drawRectangle({ x: MARGEM, y: y - altura + 12, width: LARGURA, height: altura, color: fundo });
      page.drawRectangle({ x: MARGEM + 6, y: y - 3, width: 72, height: 11, color: selo });
      const rotulo = textoDaFonte(bold, item.rotulo.toLocaleUpperCase("pt-BR"));
      page.drawText(rotulo, { x: MARGEM + 6 + (72 - bold.widthOfTextAtSize(rotulo, 6.5)) / 2, y: y, size: 6.5, font: bold, color: COR.white });
      lines.forEach((linha, index) => page.drawText(linha, { x: MARGEM + 86, y: y - index * 11, size: 8.5, font: regular, color: COR.text }));
      if (ref) page.drawText(ref, { x: A4[0] - MARGEM - larguraRef + 4, y, size: 8, font: regular, color: COR.muted });
      y -= altura + 5;
    }
  };
  /** Barras horizontais na mesma escala, com rótulo à esquerda e valor à direita. */
  const barras = (itens: Barra[], opcoes: { larguraRotulo?: number; formatar?: (valor: number) => string } = {}) => {
    const larguraRotulo = opcoes.larguraRotulo ?? 150, maximo = Math.max(1, ...itens.map((item) => item.valor));
    const trilho = LARGURA - larguraRotulo - 40;
    for (const item of itens) {
      ensure(16);
      const rotulo = splitText(item.rotulo, regular, 8.5, larguraRotulo - 8)[0];
      desenhar(rotulo, MARGEM, y, 8.5);
      page.drawRectangle({ x: MARGEM + larguraRotulo, y: y - 1.5, width: trilho, height: 9, color: COR.soft });
      if (item.valor > 0) page.drawRectangle({ x: MARGEM + larguraRotulo, y: y - 1.5, width: Math.max(2, trilho * item.valor / maximo), height: 9, color: item.cor ?? COR.navy });
      const valor = textoDaFonte(bold, opcoes.formatar ? opcoes.formatar(item.valor) : String(item.valor));
      page.drawText(valor, { x: A4[0] - MARGEM - bold.widthOfTextAtSize(valor, 8.5), y, size: 8.5, font: bold, color: COR.text });
      y -= 15;
    }
    y -= 4;
  };
  /** Tabela com cabeçalho repetido a cada página; células quebram em várias linhas. */
  const tabela = (colunas: Coluna[], linhas: string[][], opcoes: { vazio?: string } = {}) => {
    const total = colunas.reduce((soma, coluna) => soma + coluna.largura, 0);
    const larguras = colunas.map((coluna) => LARGURA * coluna.largura / total);
    const size = 8, pad = 4;
    const cabecalho = () => {
      ensure(30);
      let x = MARGEM;
      colunas.forEach((coluna, index) => {
        const texto = textoDaFonte(bold, coluna.titulo.toLocaleUpperCase("pt-BR"));
        const tx = coluna.alinhar === "direita" ? x + larguras[index] - pad - bold.widthOfTextAtSize(texto, 6.5) : x + pad;
        page.drawText(texto, { x: tx, y, size: 6.5, font: bold, color: COR.muted });
        x += larguras[index];
      });
      page.drawLine({ start: { x: MARGEM, y: y - 4 }, end: { x: A4[0] - MARGEM, y: y - 4 }, thickness: 0.8, color: COR.navy });
      y -= 15;
    };
    cabecalho();
    if (!linhas.length) { desenhar(opcoes.vazio ?? "Nada no período.", MARGEM + pad, y, size, regular, COR.muted); y -= 16; return; }
    for (const linha of linhas) {
      const celulas = linha.map((valor, index) => splitText(valor || "-", regular, size, larguras[index] - pad * 2));
      const altura = Math.max(...celulas.map((celula) => celula.length)) * 10 + 5;
      if (y - altura < RODAPE) { addPage(); cabecalho(); }
      let x = MARGEM;
      celulas.forEach((celula, index) => {
        celula.forEach((texto, i) => {
          const tx = colunas[index].alinhar === "direita" ? x + larguras[index] - pad - regular.widthOfTextAtSize(texto, size) : x + pad;
          page.drawText(texto, { x: tx, y: y - i * 10, size, font: regular, color: COR.text });
        });
        x += larguras[index];
      });
      page.drawLine({ start: { x: MARGEM, y: y - altura + 7 }, end: { x: A4[0] - MARGEM, y: y - altura + 7 }, thickness: 0.4, color: COR.line });
      y -= altura;
    }
    y -= 8;
  };
  /** Rodapé em todas as páginas: quem gerou, quando e "Página X de Y". */
  const finish = async (geradoPor: string) => {
    const pages = doc.getPages();
    const rodape = textoDaFonte(regular, `Gerado por ${geradoPor || "-"} em ${dataHoraBr(new Date().toISOString())} (horário de Brasília)`);
    pages.forEach((item, index) => {
      item.drawLine({ start: { x: MARGEM, y: 38 }, end: { x: A4[0] - MARGEM, y: 38 }, thickness: 0.5, color: COR.line });
      item.drawText(rodape, { x: MARGEM, y: 26, size: 7.5, font: regular, color: COR.muted });
      const numero = `Página ${index + 1} de ${pages.length}`;
      item.drawText(numero, { x: A4[0] - MARGEM - regular.widthOfTextAtSize(numero, 7.5), y: 26, size: 7.5, font: regular, color: COR.muted });
    });
    return doc.save();
  };
  addPage();
  return {
    doc, regular, bold, get page() { return page; }, get y() { return y; }, set y(value: number) { y = value; },
    addPage, ensure, heading, secao, line, paragrafo, cartoes, atencao, barras, tabela, finish,
  };
}
