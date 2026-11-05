import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import {
  ErroTextoRico, LIMITE_TEXTO_RICO,
  analisarTextoRico, comoTextoSimples, escaparTexto, evidenciasDoTextoRico, evidenciasPendentes,
  marcarEvidenciasPendentes, removerEvidenciasPendentes, textoRicoDeTextoSimples, textoRicoTemConteudo,
  textoRicoValido, textoSimplesDoRico, trocarEvidencias,
} from "../src/lib/nc/texto-rico.js";

const RELATO = '<p>Durante o chamado 123:</p><img data-evidencia="7" alt="print.png"><p>O cadastro saiu <strong>sem</strong> o documento.</p>';

test("texto rico: aceita só a marcação da lista de permissão", () => {
  expect(textoRicoValido(RELATO)).toBe(true);
  expect(textoRicoValido("<p>texto</p><ul><li>um</li><li>dois</li></ul>")).toBe(true);
  expect(textoRicoValido("<p><em>a</em><u>b</u><br></p>")).toBe(true);
  expect(textoRicoValido("")).toBe(true);
});

test("texto rico: recusa, em vez de limpar, tudo que sai da regra", () => {
  const recusados = [
    '<script>alert(1)</script>',
    '<p onclick="alert(1)">oi</p>',
    '<img data-evidencia="7" onerror="alert(1)">',
    '<a href="javascript:alert(1)">link</a>',
    '<iframe src="https://exemplo"></iframe>',
    '<p style="position:fixed">oi</p>',
    '<svg><use href="#x"></use></svg>',
    '<img src="https://exemplo/x.png">',
    '<img data-evidencia="0">',
    '<img data-evidencia="abc">',
    '<p class=aberto>oi</p>',
    '<!-- comentário -->',
    '<p><strong>fora de ordem</p></strong>',
    '<p>aberto',
    '<li>item solto</li>',
  ];
  for (const bruto of recusados) {
    expect(textoRicoValido(bruto), `deveria recusar: ${bruto}`).toBe(false);
    expect(() => analisarTextoRico(bruto)).toThrow(ErroTextoRico);
  }
  // A mensagem explica o que recusou, para a tela mostrar algo útil.
  expect(() => analisarTextoRico("<script>x</script>")).toThrow(/marcação <script> não é aceita/);
  expect(() => analisarTextoRico('<p onclick="x">a</p>')).toThrow(/atributo "onclick" não é aceito/);
});

test("texto rico: texto do usuário com < e > não vira marcação", () => {
  expect(escaparTexto('a < b & c > d "x"')).toBe("a &lt; b &amp; c &gt; d &quot;x&quot;");
  const html = `<p>${escaparTexto('<script>alert(1)</script>')}</p>`;
  expect(textoRicoValido(html)).toBe(true);
  expect(textoSimplesDoRico(html)).toBe("<script>alert(1)</script>");
  // O sinal cru, fora de uma tag conhecida, é recusado.
  expect(textoRicoValido("<p>a < b</p>")).toBe(false);
});

test("texto rico: limite de tamanho", () => {
  const grande = `<p>${"a".repeat(LIMITE_TEXTO_RICO)}</p>`;
  expect(() => analisarTextoRico(grande)).toThrow(/grande demais/);
});

test("texto rico: imagens são evidências, nunca endereços", () => {
  expect(evidenciasDoTextoRico(RELATO)).toEqual([7]);
  expect(evidenciasDoTextoRico('<p>sem imagem</p>')).toEqual([]);
  // Ids temporários (negativos) não passam: têm de virar evidência antes de gravar.
  const pendente = '<p>a</p><img data-evidencia="-1"><img data-evidencia="-2">';
  expect(textoRicoValido(pendente)).toBe(false);
  expect(evidenciasPendentes(pendente)).toEqual([-1, -2]);
  const trocado = trocarEvidencias(pendente, new Map([[-1, 10], [-2, 11]]));
  expect(textoRicoValido(trocado)).toBe(true);
  expect(evidenciasDoTextoRico(trocado)).toEqual([10, 11]);
  // O que não subiu sai do texto, para a NC não ficar com imagem quebrada.
  expect(removerEvidenciasPendentes(trocarEvidencias(pendente, new Map([[-1, 10]])))).toBe('<p>a</p><img data-evidencia="10">');
});

test("texto rico: versão em texto simples para busca e relatórios", () => {
  expect(textoSimplesDoRico(RELATO)).toBe("Durante o chamado 123:\n[imagem]O cadastro saiu sem o documento.");
  expect(textoSimplesDoRico("<ul><li>um</li><li>dois</li></ul>")).toBe("- um\n- dois");
  expect(textoSimplesDoRico("<p>a<br>b</p>")).toBe("a\nb");
  // Registro antigo (texto puro) continua como está.
  expect(comoTextoSimples("relato antigo", "texto")).toBe("relato antigo");
  expect(comoTextoSimples(RELATO, "html")).toContain("[imagem]");
  // Conteúdo fora da regra que por algum motivo esteja gravado: sai sem marcação.
  expect(comoTextoSimples('<p>oi</p><script>alert(1)</script>', "html")).toBe("oi alert(1)");
});

test("texto rico: conteúdo vazio, só espaços ou só imagem", () => {
  expect(textoRicoTemConteudo("<p></p>")).toBe(false);
  expect(textoRicoTemConteudo("<p>   </p><p><br></p>")).toBe(false);
  expect(textoRicoTemConteudo('<p></p><img data-evidencia="3">')).toBe(true);
  expect(textoRicoTemConteudo("<p>a</p>")).toBe(true);
  expect(textoRicoTemConteudo("<script>x</script>")).toBe(false);
});

test("texto rico: relato antigo em texto puro vira parágrafos na edição", () => {
  expect(textoRicoDeTextoSimples("linha um\nlinha dois")).toBe("<p>linha um</p><p>linha dois</p>");
  expect(textoRicoDeTextoSimples("a < b")).toBe("<p>a &lt; b</p>");
  expect(textoRicoValido(textoRicoDeTextoSimples("<script>x</script>"))).toBe(true);
});

test("texto rico: a tela nunca injeta o conteúdo como HTML", () => {
  const renderizador = readFileSync("src/components/ui/TextoRico.jsx", "utf8");
  expect(renderizador).not.toContain("dangerouslySetInnerHTML");
  // A imagem vai pela rota que checa permissão, não por URL assinada no texto.
  expect(renderizador).toContain("/api/nc/${ncId}/evidencias/${evidenciaId}/arquivo");
  const editor = readFileSync("src/components/ui/EditorTextoRico.jsx", "utf8");
  expect(editor).not.toContain("dangerouslySetInnerHTML");
  // O que o editor devolve é serializado por ele, não o HTML que o navegador montou.
  expect(editor).toContain("export function serializar");
  expect(editor).toContain("Object.hasOwn(TAGS_PERMITIDAS, tag)");
});

test("texto rico: a API valida antes de gravar e confere a dona da imagem", () => {
  const service = readFileSync("src/lib/nc/service.ts", "utf8");
  expect(service).toContain("function parseDescricao");
  expect(service).toContain("analisarTextoRico(html)");
  expect(service).toContain("O relato aponta para uma imagem que não é evidência desta NC.");
  // Só quem abriu completa o relato, e só enquanto a NC está em "aberta".
  expect(service).toContain("Somente quem abriu a NC pode completar o relato.");
  expect(service).toContain('nc.status !== "aberta"');
});


test("texto rico: imagem colada não bloqueia o envio do formulário (regressão)", () => {
  // Bug em produção: a tela usava a validação estrita da API, que recusa a
  // imagem ainda sem evidência. Resultado: qualquer print colado no relato
  // travava a abertura da NC pedindo "Descreva o que aconteceu".
  const comPrint = '<p>Direcionamento de fila errada.</p><img data-evidencia="-1" alt="print.png"><p>Impacto: rastreabilidade.</p>';
  expect(textoRicoTemConteudo(comPrint, { pendentes: true })).toBe(true);
  // Relato só com a imagem também vale como preenchido.
  expect(textoRicoTemConteudo('<img data-evidencia="-2">', { pendentes: true })).toBe(true);
  // A API continua estrita: imagem sem evidência não é gravada.
  expect(textoRicoTemConteudo(comPrint)).toBe(false);
  expect(textoRicoValido(comPrint)).toBe(false);
  expect(() => analisarTextoRico(comPrint)).toThrow(/Imagem sem evidência/);
  // Nem com `pendentes` entra id zero ou texto no lugar do id.
  expect(textoRicoValido('<img data-evidencia="0">', { pendentes: true })).toBe(false);
  expect(() => analisarTextoRico('<img data-evidencia="0">', { pendentes: true })).toThrow(/Imagem sem evidência/);
  expect(() => analisarTextoRico('<img data-evidencia="abc">', { pendentes: true })).toThrow(/Imagem sem evidência/);
  // E o resto da lista de permissão continua valendo com a opção ligada.
  expect(() => analisarTextoRico('<script>alert(1)</script>', { pendentes: true })).toThrow(/não é aceita/);
});

test("texto rico: a NC nasce com [imagem] no lugar da que ainda não subiu", () => {
  const comPrint = '<p>Fila errada.</p><img data-evidencia="-1"><p>Fim.</p>';
  const inicial = marcarEvidenciasPendentes(comPrint);
  expect(inicial).toBe('<p>Fila errada.</p>[imagem]<p>Fim.</p>');
  // O texto com que a NC é criada passa na validação estrita da API.
  expect(textoRicoValido(inicial)).toBe(true);
  expect(textoRicoTemConteudo(inicial)).toBe(true);
  // Relato só com print não nasce vazio, que a API recusaria.
  expect(textoRicoTemConteudo(marcarEvidenciasPendentes('<img data-evidencia="-1">'))).toBe(true);
  expect(textoRicoTemConteudo(removerEvidenciasPendentes('<img data-evidencia="-1">'))).toBe(false);
  // Imagem já enviada não é tocada.
  expect(marcarEvidenciasPendentes('<img data-evidencia="7">')).toBe('<img data-evidencia="7">');
});

test("texto rico: as telas validam com pendentes e a API sem", () => {
  const abrir = readFileSync("src/features/nc/components/AbrirNcPage.jsx", "utf8");
  const editar = readFileSync("src/features/nc/components/EditarNcPage.jsx", "utf8");
  expect(abrir).toContain("textoRicoTemConteudo(descricao, { pendentes: true })");
  expect(editar).toContain("textoRicoTemConteudo(descricao, { pendentes: true })");
  expect(abrir).toContain("descricao: marcarEvidenciasPendentes(descricao)");
  // Rascunho restaurado perde os arquivos: a imagem órfã vira marcador.
  expect(abrir).toContain("evidenciasPendentes(descricao).some((id) => !imagensDoRelato.current.has(id))");
  // A API nunca liga a opção: ela valida sempre no modo estrito.
  const service = readFileSync("src/lib/nc/service.ts", "utf8");
  expect(service).not.toMatch(/\{\s*pendentes/);
  expect(service).toContain("analisarTextoRico(html)");
});
