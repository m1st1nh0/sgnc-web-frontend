import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import {
  ErroTextoRico, LIMITE_TEXTO_RICO,
  analisarTextoRico, comoTextoSimples, escaparTexto, evidenciasDoTextoRico, evidenciasPendentes,
  removerEvidenciasPendentes, textoRicoDeTextoSimples, textoRicoTemConteudo, textoRicoValido,
  textoSimplesDoRico, trocarEvidencias,
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
