import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AJUDA_SENHA_FORTE,
  erroSenhaForte,
} from "./src/services/senhaPolicy.js";

assert.equal(erroSenhaForte("SenhaForte1!"), "");
assert.match(erroSenhaForte("fraca"), /10 caracteres/);
assert.match(erroSenhaForte("senhaforte1!"), /maiúscula/);
assert.match(erroSenhaForte("SENHAFORTE1!"), /minúscula/);
assert.match(erroSenhaForte("SenhaForte!!"), /número/);
assert.match(erroSenhaForte("SenhaForte12"), /símbolo/);
assert.match(AJUDA_SENHA_FORTE, /10\+ caracteres/);

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const headers = Object.fromEntries(
  vercel.headers[0].headers.map((item) => [item.key, item.value])
);

assert.match(headers["Content-Security-Policy"], /default-src 'self'/);
assert.match(headers["Content-Security-Policy"], /script-src 'self'/);
assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
assert.match(headers["Content-Security-Policy"], /https:\/\/sgnc-web-api\.onrender\.com/);
assert.match(headers["Content-Security-Policy"], /https:\/\/bxnuslxrlmqzytryxzvv\.supabase\.co/);
assert.equal(headers["X-Content-Type-Options"], "nosniff");
assert.equal(headers["X-Frame-Options"], "DENY");
assert.match(headers["Strict-Transport-Security"], /max-age=31536000/);
assert.match(headers["Permissions-Policy"], /camera=\(\)/);

const trocar = readFileSync("src/pages/TrocarSenhaPage.jsx", "utf8");
const usuarios = readFileSync("src/pages/UsuariosPage.jsx", "utf8");
const srcFiles = [trocar, usuarios];
assert(srcFiles.every((fonte) => fonte.includes("erroSenhaForte")));
assert(srcFiles.every((fonte) => !fonte.includes("ao menos 6 caracteres")));
assert.match(trocar, /autoComplete="new-password"/);
assert.match(usuarios, /type="password"/);

const arquivosCriticos = [
  "src/pages/HomePage.jsx",
  "src/pages/DetalhesNcPage.jsx",
  "src/pages/UsuariosPage.jsx",
  "src/pages/TrocarSenhaPage.jsx",
];
for (const caminho of arquivosCriticos) {
  const fonte = readFileSync(caminho, "utf8");
  assert.doesNotMatch(fonte, /dangerouslySetInnerHTML/);
}

console.log("PR08 FRONTEND SECURITY TESTS PASSED");
