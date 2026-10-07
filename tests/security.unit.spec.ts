import { test, expect } from '@playwright/test';
import { assertApiUser, assertRole } from '../src/lib/auth/policy';
import type { UsuarioAutenticado } from '../src/lib/auth/types';
import { filterSensitive } from '../src/lib/permissions/nc';
import { csvCell } from '../src/lib/reports/csv';
import { readJson } from '../src/lib/api/request';
import { ApiError, apiErrorResponse } from '../src/lib/api/error';
import { chamarApi } from '../src/lib/api/client/api.js';
const user: UsuarioAutenticado = { id:'author', nome:'Teste', email:'test@example.invalid', papel:'funcionario', ativo:true, senha_provisoria:false };
for (const [label,invalid] of [['missing',null],['inactive',{...user,ativo:false}],['unknown role',{...user,papel:'other'}]] as const) {
 test(`invalid session denied: ${label}`,()=>{
  expect(()=>assertApiUser(invalid as UsuarioAutenticado)).toThrow(ApiError);
  try { assertApiUser(invalid as UsuarioAutenticado); } catch(e) { expect((e as ApiError).status).toBe(401); }
 });
}
test('temporary password blocked except password operation',()=>{
 expect(()=>assertApiUser({...user,senha_provisoria:true})).toThrow();
 expect(assertApiUser({...user,senha_provisoria:true},{allowTemporaryPassword:true}).id).toBe(user.id);
});
for (const role of ['adm','supervisor','funcionario'] as const) {
 test(`admin operation authorization: ${role}`,()=>{
  const actor={...user,papel:role};
  if(role==='adm') expect(assertRole(actor,['adm'])).toBe(actor);
  else expect(()=>assertRole(actor,['adm'])).toThrow();
 });
}
test('author-only NC hides feedback and decision without mutating original',()=>{
 const nc={id:1,aberto_por:user.id,colaborador_id:'other',responsavel_id:'admin',feedback:'private',motivo_invalidacao:'private',texto_aceite:'private',descricao:'visible'};
 const result=filterSensitive(nc,user);
 expect(result.feedback).toBeNull();expect(result.motivo_invalidacao).toBeNull();expect(result.texto_aceite).toBeNull();expect(result.descricao).toBe('visible');expect(nc.feedback).toBe('private');
 expect(filterSensitive(nc,{...user,papel:'adm'}).feedback).toBe('private');
 expect(filterSensitive(nc,{...user,id:'other'}).feedback).toBe('private');
});
for(const value of ['=1+1','+SUM(A1)','-1+1','@SUM(A1)',' \t=1','\tcommand']) {
 test(`CSV neutralizes formula ${JSON.stringify(value)}`,()=>expect(csvCell(value)).toBe(`"'${value}"`));
}
test('CSV quotes text and escapes quotes',()=>expect(csvCell('Olá "Lucas";')).toBe('"Olá ""Lucas"";"'));
for(const body of ['{','null','[]','"text"']) {
 test(`reject malformed JSON ${body}`,async()=>{
  await expect(readJson(new Request('http://localhost',{method:'POST',body}))).rejects.toMatchObject({status:422});
 });
}
test('API error exposes only safe messages',async()=>{
 expect((await apiErrorResponse(new ApiError('Conflito',409)).json()).detail).toBe('Conflito');
 const response=apiErrorResponse(new Error('secret token'));
 const body=await response.json();
 expect(response.status).toBe(500);
 expect(body.detail).toBe('Serviço temporariamente indisponível.');
 expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/i);
 expect(JSON.stringify(body)).not.toContain('secret token');
});
test('client shows a support reference for internal API failures',async()=>{
 const originalFetch=globalThis.fetch;
 const requestId='a2f5e268-0b22-4e62-9634-4698bd74f004';
 globalThis.fetch=async()=>new Response(JSON.stringify({detail:'Serviço temporariamente indisponível.',request_id:requestId}),{status:500,headers:{'content-type':'application/json'}});
 try {
  await expect(chamarApi('/falha')).rejects.toMatchObject({status:500,message:`Serviço temporariamente indisponível. Referência de suporte: ${requestId}.`});
 } finally {
  globalThis.fetch=originalFetch;
 }
});
