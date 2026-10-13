/** Montagem dos PDFs de relatório: cabeçalho ARQUEM, seções "Rótulo: valor" e rodapé com autoria e paginação. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { dataHoraBr } from "./formato";

const A4: [number, number] = [595.28, 841.89];
export const MARGEM = 42;
const NAVY = rgb(0.09, 0.2, 0.3), GREEN = rgb(0.1, 0.66, 0.54), TEXT = rgb(0.13, 0.21, 0.29), MUTED = rgb(0.4, 0.46, 0.54), LINE = rgb(0.87, 0.89, 0.92);

/** Troca o que a fonte padrão (WinAnsi) não desenha por "?", para que emoji ou seta digitados não derrubem o PDF. */
export function textoDaFonte(font: PDFFont, texto: string) {
  const suportados = new Set(font.getCharacterSet());
  return Array.from(texto.replace(/\t/g, " "), (char) => suportados.has(char.codePointAt(0)!) ? char : "?").join("");
}

/** Quebra o texto em linhas; a primeira linha pode ser mais curta (quando divide espaço com o rótulo). */
function splitText(text: string, font: PDFFont, size: number, maxWidth: number, firstWidth = maxWidth) {
  const lines: string[] = [];
  for (const paragraph of textoDaFonte(font, String(text || "-")).split(/\r?\n/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      const limit = lines.length ? maxWidth : firstWidth;
      if (font.widthOfTextAtSize(candidate, size) <= limit || !current) current = candidate;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : ["-"];
}

export async function pdfWriter(title: string, subtitle: string) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const largura = A4[0] - MARGEM * 2;
  let page: PDFPage, y = 0;
  const addPage = () => {
    page = doc.addPage(A4);
    page.drawRectangle({ x: 0, y: A4[1] - 48, width: A4[0], height: 48, color: NAVY });
    page.drawText("ARQUEM", { x: MARGEM, y: A4[1] - 29, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText("AUTOMAÇÃO CORPORATIVA", { x: MARGEM, y: A4[1] - 41, size: 6, font: regular, color: GREEN });
    page.drawText(textoDaFonte(bold, title), { x: MARGEM, y: A4[1] - 78, size: 18, font: bold, color: NAVY });
    page.drawText(textoDaFonte(regular, subtitle), { x: MARGEM, y: A4[1] - 94, size: 9, font: regular, color: MUTED });
    y = A4[1] - 120;
  };
  const ensure = (height: number) => { if (y - height < 56) addPage(); };
  const heading = (text: string) => { ensure(28); y -= 8; page.drawText(textoDaFonte(bold, text.toLocaleUpperCase("pt-BR")), { x: MARGEM, y, size: 10, font: bold, color: NAVY }); y -= 18; };
  /** "Rótulo: valor", com o rótulo em negrito e o valor quebrando na largura da página. */
  const line = (label: string, value: unknown) => {
    const rotulo = textoDaFonte(bold, `${label}: `);
    const larguraRotulo = bold.widthOfTextAtSize(rotulo, 9);
    const texto = value == null || value === "" ? "-" : String(value);
    const cabe = larguraRotulo < largura * 0.6;
    const lines = cabe ? splitText(texto, regular, 9, largura, largura - larguraRotulo) : splitText(`${label}: ${texto}`, regular, 9, largura);
    ensure(lines.length * 13 + 4);
    lines.forEach((item, index) => {
      if (cabe && index === 0) {
        page.drawText(rotulo, { x: MARGEM, y, size: 9, font: bold, color: TEXT });
        page.drawText(item, { x: MARGEM + larguraRotulo, y, size: 9, font: regular, color: TEXT });
      } else page.drawText(item, { x: MARGEM, y, size: 9, font: regular, color: TEXT });
      y -= 13;
    });
    y -= 3;
  };
  /** Rodapé em todas as páginas: quem gerou, quando e "Página X de Y". */
  const finish = async (geradoPor: string) => {
    const pages = doc.getPages();
    const rodape = textoDaFonte(regular, `Gerado por ${geradoPor || "-"} em ${dataHoraBr(new Date().toISOString())} (horário de Brasília)`);
    pages.forEach((item, index) => {
      item.drawLine({ start: { x: MARGEM, y: 38 }, end: { x: A4[0] - MARGEM, y: 38 }, thickness: 0.5, color: LINE });
      item.drawText(rodape, { x: MARGEM, y: 26, size: 7.5, font: regular, color: MUTED });
      const numero = `Página ${index + 1} de ${pages.length}`;
      item.drawText(numero, { x: A4[0] - MARGEM - regular.widthOfTextAtSize(numero, 7.5), y: 26, size: 7.5, font: regular, color: MUTED });
    });
    return doc.save();
  };
  addPage();
  return { doc, regular, bold, get page() { return page; }, get y() { return y; }, set y(value: number) { y = value; }, addPage, ensure, heading, line, finish };
}
