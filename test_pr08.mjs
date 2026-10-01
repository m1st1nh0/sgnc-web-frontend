import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AJUDA_SENHA_FORTE,
  erroSenhaForte,
} from "./src/legacy/services/senhaPolicy.js";

assert.equal(erroSenhaForte("SenhaForte1!"), "");
assert.match(erroSenhaForte("fraca"), /10 caracteres/);
assert.match(erroSenhaForte("senhaforte1!"), /maiúscula/);
assert.match(erroSenhaForte("SENHAFORTE1!"), /minúscula/);
assert.match(erroSenhaForte("SenhaForte!!"), /número/);
assert.match(erroSenhaForte("SenhaForte12"), /símbolo/);
assert.match(AJUDA_SENHA_FORTE, /10\+ caracteres/);

const proxy = readFileSync("proxy.ts", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");
assert.match(proxy, /default-src 'self'/);
assert.match(proxy, /script-src 'self'/);
assert.match(proxy, /object-src 'none'/);
assert.match(proxy, /frame-ancestors 'none'/);
assert.match(proxy, /https:\/\/bxnuslxrlmqzytryxzvv\.supabase\.co/);
assert.doesNotMatch(proxy, /sgnc-web-api\.onrender\.com/);
assert.match(nextConfig, /X-Content-Type-Options/);
assert.match(nextConfig, /X-Frame-Options/);
assert.match(nextConfig, /Strict-Transport-Security/);
assert.match(nextConfig, /Permissions-Policy/);

const adminClient = readFileSync("src/lib/supabase/admin.ts", "utf8");
assert.match(adminClient, /import "server-only"/);
assert.match(adminClient, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(adminClient, /process\.env\.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);

const trocar = readFileSync("src/legacy/pages/TrocarSenhaPage.jsx", "utf8");
const usuarios = readFileSync("src/legacy/pages/UsuariosPage.jsx", "utf8");
const srcFiles = [trocar, usuarios];
assert(srcFiles.every((fonte) => fonte.includes("erroSenhaForte")));
assert(srcFiles.every((fonte) => !fonte.includes("ao menos 6 caracteres")));
assert.match(trocar, /autoComplete="new-password"/);
assert.match(usuarios, /type="password"/);

const arquivosCriticos = [
  "src/legacy/pages/HomePage.jsx",
  "src/legacy/pages/DetalhesNcPage.jsx",
  "src/legacy/pages/UsuariosPage.jsx",
  "src/legacy/pages/TrocarSenhaPage.jsx",
];
for (const caminho of arquivosCriticos) {
  const fonte = readFileSync(caminho, "utf8");
  assert.doesNotMatch(fonte, /dangerouslySetInnerHTML/);
}

const authLayout = readFileSync("src/legacy/components/ui/AuthLayout.jsx", "utf8");
assert.doesNotMatch(
  authLayout,
  /\\n/,
  "AuthLayout não deve renderizar sequências de quebra de linha como texto"
);

console.log("PR08 FRONTEND SECURITY TESTS PASSED");
