#!/usr/bin/env node
// Mede p50/p95 das rotas principais (Fases 0 e 2 do plano de retorno da diretoria).
// Só faz leituras (GET); nunca cria NC. Credenciais e token vêm do ambiente e nunca são impressos.
//
// Uso:
//   MEDIR_BASE_URL=https://<preview>.vercel.app \
//   VERCEL_BYPASS_TOKEN=... \
//   MEDIR_EMAIL=... MEDIR_SENHA=... \          (ou MEDIR_COOKIE="sb-...=...; ..." copiado do navegador)
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
//   [MEDIR_NC_ID=123] [MEDIR_REPETICOES=10] node scripts/medir-rotas.mjs
import { createServerClient } from "@supabase/ssr";

const env = process.env;
const baseUrl = (env.MEDIR_BASE_URL ?? "").replace(/\/$/, "");
const repeticoes = Number(env.MEDIR_REPETICOES ?? 10);
if (!baseUrl) {
  console.error("Defina MEDIR_BASE_URL.");
  process.exit(1);
}

async function cookieDeSessao() {
  if (env.MEDIR_COOKIE) return env.MEDIR_COOKIE;
  const { MEDIR_EMAIL: email, MEDIR_SENHA: senha } = env;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!email || !senha || !url || !chave) {
    throw new Error("Defina MEDIR_COOKIE ou MEDIR_EMAIL, MEDIR_SENHA, NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  // Usa o próprio @supabase/ssr para gerar os cookies no formato que o app lê (inclusive divididos em partes).
  const jar = new Map();
  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (lista) => lista.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha no login de medição: ${error.message}`);
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function percentil(valores, p) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[Math.max(0, indice)];
}

async function main() {
  const cookie = await cookieDeSessao();
  const headers = { cookie, accept: "application/json" };
  if (env.VERCEL_BYPASS_TOKEN) headers["x-vercel-protection-bypass"] = env.VERCEL_BYPASS_TOKEN;

  async function chamar(caminho) {
    const inicio = performance.now();
    const resposta = await fetch(`${baseUrl}${caminho}`, { headers, redirect: "manual" });
    const corpo = await resposta.text();
    const ms = performance.now() - inicio;
    if (!resposta.ok) throw new Error(`${caminho} respondeu ${resposta.status}`);
    return { ms, corpo, vercelId: resposta.headers.get("x-vercel-id") };
  }

  let ncId = env.MEDIR_NC_ID;
  if (!ncId) {
    const lista = JSON.parse((await chamar("/api/nc")).corpo);
    ncId = Array.isArray(lista) && lista[0]?.id;
    if (!ncId) throw new Error("Nenhuma NC visível para medir; informe MEDIR_NC_ID.");
  }

  const rotas = ["/api/nc", `/api/nc/${ncId}`, `/api/nc/${ncId}/evidencias`];
  console.log(`Base: ${baseUrl} | repetições: ${repeticoes} | NC: ${ncId}`);
  for (const rota of rotas) {
    await chamar(rota); // aquecimento (cold start fora da amostra)
    const tempos = [];
    let vercelId = null;
    for (let i = 0; i < repeticoes; i += 1) {
      const resultado = await chamar(rota);
      tempos.push(resultado.ms);
      vercelId = resultado.vercelId;
    }
    // x-vercel-id: "<borda>::<região da função>::<id>" — confirma a região (ex.: gru1).
    const regiao = vercelId?.split("::").slice(0, -1).join(" → ") ?? "desconhecida";
    console.log(`${rota.replace(String(ncId), "[id]")}\tp50 ${percentil(tempos, 50).toFixed(0)} ms\tp95 ${percentil(tempos, 95).toFixed(0)} ms\tregião ${regiao}`);
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
