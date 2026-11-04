import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { aplicarRota, escoposDeRascunho, fecharAba, moduloDaRota, normalizarAbas, normalizarUrl } from "../src/lib/utils/abas.js";

const modulos = [
  { href: "/", label: "Gestão de NCs", icon: "home" },
  { href: "/minhas-ncs", label: "Minhas NCs", icon: "eye" },
  { href: "/abrir-nc", label: "Abrir NC", icon: "add" },
  { href: "/relatorios", label: "Relatórios", icon: "report" },
  { href: "/equipe", label: "Pessoas e equipes", icon: "people" },
];
const abrir = (url: string, abas: any[] = [], ativaAtual: string | null = null) => aplicarRota(abas, { url, modulos, ativaAtual });

test("abas: acessar um módulo cria uma única aba, mesmo voltando a ele", () => {
  let { abas, ativa } = abrir("/relatorios");
  expect(abas.map((aba) => aba.href)).toEqual(["/relatorios"]);
  expect(ativa).toBe("/relatorios");
  ({ abas } = abrir("/minhas-ncs", abas));
  ({ abas, ativa } = abrir("/relatorios?inicio=2026-10-01&pagina=2", abas));
  expect(abas.map((aba) => aba.href)).toEqual(["/relatorios", "/minhas-ncs"]);
  expect(ativa).toBe("/relatorios");
  // A aba volta para a rota exata: filtros e paginação vivem na URL.
  expect(abas[0].url).toBe("/relatorios?inicio=2026-10-01&pagina=2");
});

test("abas: tela de detalhe não abre aba própria e mantém a aba de onde o usuário veio", () => {
  const inicio = abrir("/");
  const detalhe = abrir("/nc/12", inicio.abas, inicio.ativa);
  expect(detalhe.abas.map((aba) => aba.href)).toEqual(["/"]);
  // A aba de origem segue ativa; a rota fora de módulo não cria nem troca aba.
  expect(detalhe.ativa).toBe("/");
  expect(abrir("/trocar-senha", detalhe.abas, null).ativa).toBeNull();
  // Rota dentro de um módulo (ex.: /equipe/123) pertence à aba daquele módulo.
  const equipe = abrir("/equipe/abc", detalhe.abas);
  expect(equipe.ativa).toBe("/equipe");
  expect(equipe.abas.find((aba) => aba.href === "/equipe")?.url).toBe("/equipe/abc");
  expect(moduloDaRota("/equipe/abc", modulos)?.href).toBe("/equipe");
  // "/" não captura tudo: só o caminho exato.
  expect(moduloDaRota("/medidas", modulos)).toBeNull();
});

test("abas: restauração descarta aba inválida, sem permissão ou com URL de outro módulo", () => {
  const salvas = [
    { href: "/relatorios", label: "Relatórios", icon: "report", url: "/relatorios?status=aberta" },
    { href: "/medidas", label: "Medidas disciplinares", icon: "shield", url: "/medidas" },
    { href: "/relatorios", label: "Relatórios", icon: "report", url: "/relatorios" },
    { href: "/minhas-ncs", label: "Minhas NCs", icon: "eye", url: "/causas" },
  ];
  const abas = normalizarAbas(salvas, modulos);
  expect(abas.map((aba) => aba.href)).toEqual(["/relatorios", "/minhas-ncs"]);
  expect(abas[0].url).toBe("/relatorios?status=aberta");
  expect(abas[1].url).toBe("/minhas-ncs");
  expect(normalizarAbas(null as any, modulos)).toEqual([]);
  expect(normalizarUrl("relatorios")).toBe("/");
  expect(normalizarUrl("/relatorios?a=1#topo")).toBe("/relatorios?a=1");
});

test("abas: fechar a ativa leva para a aba seguinte e, sem abas, para uma rota válida", () => {
  const abas = normalizarAbas([
    { href: "/", label: "Gestão de NCs", icon: "home", url: "/" },
    { href: "/abrir-nc", label: "Abrir NC", icon: "add", url: "/abrir-nc" },
    { href: "/relatorios", label: "Relatórios", icon: "report", url: "/relatorios?pagina=3" },
  ], modulos);
  const meio = fecharAba(abas, "/abrir-nc", "/abrir-nc");
  expect(meio.abas.map((aba) => aba.href)).toEqual(["/", "/relatorios"]);
  expect(meio.destino).toBe("/relatorios?pagina=3");
  // Fechar a última ativa volta para a anterior.
  expect(fecharAba(abas, "/relatorios", "/relatorios").destino).toBe("/abrir-nc");
  // Fechar uma aba inativa não navega.
  expect(fecharAba(abas, "/", "/relatorios").destino).toBeNull();
  expect(fecharAba([abas[0]], "/", "/").destino).toBe("/");
  expect(fecharAba(abas, "/causas", "/").abas).toHaveLength(3);
});

test("abas: fechamento de formulário com rascunho é confirmado pelos escopos certos", () => {
  expect(escoposDeRascunho("/abrir-nc")).toEqual(["abrir-nc"]);
  expect(escoposDeRascunho("/nc/12/editar")).toEqual(["editar-nc:12"]);
  expect(escoposDeRascunho("/nc/12")).toEqual(["feedback-nc:12"]);
  expect(escoposDeRascunho("/relatorios?pagina=2")).toEqual([]);
  const barra = readFileSync("src/components/navigation/BarraAbas.jsx", "utf8");
  expect(barra).toContain("escoposDeRascunho(aba.url).some((escopo) => existeRascunho(escopo))");
  expect(barra).toContain("ModalConfirmacao");
});

test("abas: excesso de abas tem contador e setas, só quando não cabem", () => {
  const barra = readFileSync("src/components/navigation/BarraAbas.jsx", "utf8");
  expect(barra).toContain("medirTransbordo");
  expect(barra).toContain("ResizeObserver");
  expect(barra).toContain("{(transbordo.inicio || transbordo.fim) &&");
  expect(barra).toContain('aria-label="Mostrar abas anteriores"');
  expect(barra).toContain('aria-label="Mostrar próximas abas"');
  expect(barra).toContain("disabled={!transbordo.inicio}");
  const css = readFileSync("src/redesign.css", "utf8");
  expect(css).toContain(".sg-barra-abas__rolar:disabled");
  expect(css).toContain(".sg-barra-abas__rolar:focus-visible");
});

test("abas: barra acessível, com aba atual anunciada e navegação por teclado", () => {
  const barra = readFileSync("src/components/navigation/BarraAbas.jsx", "utf8");
  expect(barra).toContain('aria-label="Abas abertas"');
  expect(barra).toContain('aria-current={atual ? "page" : undefined}');
  expect(barra).toContain("ArrowRight");
  expect(barra).toContain("aria-label={`Fechar aba ${aba.label}`}");
  // Só os módulos que o menu mostra para o perfil podem virar aba.
  const menu = readFileSync("src/components/navigation/AppNavigation.jsx", "utf8");
  expect(menu).toContain("grupos.flatMap((grupo) => grupo.links");
  expect(menu).toContain("<BarraAbas modulos={modulos}");
});

test("abas: a barra tem estilo próprio, foco visível e cabe no celular", () => {
  const css = readFileSync("src/redesign.css", "utf8");
  // Prefixo próprio: .sg-abas já é das pílulas de sub-abas das telas e não pode ser redefinida aqui.
  expect(css).not.toMatch(/\n\.sg-abas \{ position: sticky/);
  // Fica no topo do conteúdo e rola na horizontal quando há muitas abas.
  expect(css).toContain(".sg-barra-abas {");
  expect(css).toMatch(/\.sg-barra-abas\s*\{[^}]*position: sticky/);
  expect(css).toMatch(/\.sg-barra-abas__lista\s*\{[^}]*overflow-x: auto/);
  // Altura da faixa e indicação da aba ativa.
  expect(css).toMatch(/\.sg-barra-abas\s*\{[^}]*height: var\(--abas-altura\)/);
  expect(css).toMatch(/\.sg-barra-abas__aba\.is-active\s*\{[^}]*box-shadow: inset 0 2px 0/);
  // A ativa encosta na borda de baixo em vez de flutuar como caixa.
  expect(css).toMatch(/\.sg-barra-abas__aba\.is-active\s*\{[^}]*margin-bottom: -1px/);
  // Inativa sem caixa: só um fio entre vizinhas, que some em volta da ativa.
  expect(css).toContain(".sg-barra-abas__aba + .sg-barra-abas__aba::before");
  expect(css).toContain(".sg-barra-abas__aba.is-active + .sg-barra-abas__aba::before");
  // O fechar aparece na ativa, no hover e com foco de teclado.
  expect(css).toContain(".sg-barra-abas__fechar:focus-visible { opacity: 1; }");
  expect(css).toContain(".sg-barra-abas__link:focus-visible, .sg-barra-abas__fechar:focus-visible");
  // No celular a barra desce para baixo da barra fixa e as abas estreitam.
  expect(css).toMatch(/@media \(max-width: 600px\) \{\s*\.sg-barra-abas \{ top: 56px; \}/);
});

test("abas: painéis grudados se apoiam na altura da barra, sem ficar atrás dela", () => {
  const css = readFileSync("src/redesign.css", "utf8");
  // A altura da barra é um token, usado por ela e por quem gruda abaixo dela.
  expect(css).toContain("--abas-altura: 39px;");
  expect(css).toMatch(/\.sg-barra-abas\s*\{[^}]*height: var\(--abas-altura\)/);
  // O painel da NC acompanha a rolagem e rola por dentro quando é mais alto que a tela.
  expect(css).toMatch(/@media \(min-width: 1100px\) \{\s*\.sg-gestao__painel \{\s*position: sticky;\s*top: calc\(var\(--abas-altura\) \+ 16px\);\s*max-height: calc\(100vh - var\(--abas-altura\) - 32px\);\s*overflow: hidden auto;/);
  // Os outros grudados (resumo da abertura, filtros de relatórios, âncoras) também.
  expect(css).toContain(".sg-form-nc__resumo { position: sticky; top: calc(var(--abas-altura) + 16px);");
  expect(css).toContain(".sg-relatorio__filtros { position: sticky; top: calc(var(--abas-altura) + 16px);");
  expect(css).toContain(".sg-ancoras { position: sticky; z-index: 5; top: var(--abas-altura);");
});
