import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { ApiError } from "../src/lib/api/error";
import { listaFiltroIn, chaveCatalogoCausa, resolverCausasDoCatalogo } from "../src/lib/nc/causasCatalogo";

const read = (path: string) => readFileSync(path, "utf8");
const service = read("src/lib/nc/service.ts");
const causeIdsBody = service.slice(service.indexOf("async function causeIds"), service.indexOf("async function collaborator"));
const catalogo = [
  { id: 1, ativo: true, descricao_normalizada: "falha de comunicação" },
  { id: 2, ativo: false, descricao_normalizada: "procedimento antigo" },
  { id: 3, ativo: true, descricao_normalizada: "erro de digitação, sistema (legado)" },
];

test("2.1: funções na mesma região do banco (gru1, São Paulo)", () => {
  expect(JSON.parse(read("vercel.json")).regions).toEqual(["gru1"]);
});

test("2.2: sessão memorizada nas páginas e usuário repassado nas rotas", () => {
  const session = read("src/lib/auth/session.ts");
  expect(session).toMatch(/import \{ cache \} from "react"/);
  expect(session).toMatch(/export const getUser = cache\(/);
  expect(service).toMatch(/export async function buscarNc\(id: number, usuario\?: UsuarioAutenticado\)/);
  expect(service).toContain("usuario ?? await requireUser()");
  // Rotas que já carregaram o usuário não repetem sessão + leitura de usuário.
  expect(service).toContain("return buscarNc(Number(result.nc_id), user);");
  expect(service).not.toMatch(/return buscarNc\(id\);/);
  const evidence = read("src/lib/nc/evidence.ts");
  expect(evidence).not.toMatch(/await requireUser\(\);\s*await buscarNc/);
  expect(evidence.match(/buscarNc\(ncId, user\)/g)).toHaveLength(2);
  expect(read("src/lib/nc/plano-acao.ts")).toContain("buscarNc(ncId, user)");
});

test("2.3: causas validadas numa única consulta ao catálogo", () => {
  expect(causeIdsBody).not.toMatch(/for \(const/);
  expect(causeIdsBody).toContain('.filter("descricao_normalizada", "in", listaFiltroIn(');
  expect(causeIdsBody).not.toContain(".insert(");
});

test("2.3: resolve na ordem informada, normalizando espaços e caixa", () => {
  expect(resolverCausasDoCatalogo(["  Falha   de COMUNICAÇÃO ", "Erro de digitação, sistema (legado)"], catalogo)).toEqual([1, 3]);
  expect(chaveCatalogoCausa("  Falha   de COMUNICAÇÃO ")).toBe("falha de comunicação");
});

test("2.3: causa fora do catálogo ou arquivada continua recusada com erro no campo", () => {
  const fora = () => resolverCausasDoCatalogo(["Falha de comunicação", "inventada"], catalogo);
  expect(fora).toThrow(ApiError);
  try { fora(); } catch (error) {
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).campo).toBe("causas");
    expect((error as ApiError).message).toContain("“inventada” não está no catálogo");
  }
  expect(() => resolverCausasDoCatalogo(["Procedimento antigo"], catalogo)).toThrow(/arquivada/);
  // A edição mantém causas arquivadas de NCs antigas.
  expect(resolverCausasDoCatalogo(["Procedimento antigo"], catalogo, { allowInactive: true })).toEqual([2]);
});

test("2.3: lista do filtro in escapa vírgulas, parênteses, aspas e barras", () => {
  expect(listaFiltroIn(["a", "b, c (d)"])).toBe('("a","b, c (d)")');
  expect(listaFiltroIn(['diz "x"', "barra \\ fim"])).toBe('("diz \\"x\\"","barra \\\\ fim")');
});

test("2.4: painel e detalhe não esperam o onboarding; detalhe carrega NC e evidências juntos", () => {
  const home = read("src/features/nc/components/HomePage.jsx");
  const detalhe = read("src/features/nc/components/DetalhesNcPage.jsx");
  for (const fonte of [home, detalhe]) {
    const carregamento = fonte.slice(fonte.indexOf("async function carregar"), fonte.indexOf("} catch (e)", fonte.indexOf("async function carregar")));
    expect(carregamento).toContain("void (async () => {");
    expect(carregamento).not.toMatch(/^\s{6}await concluirEtapa/m);
  }
  expect(detalhe).toContain("Promise.all([carregarNc(), carregarEvidencias()])");
});
