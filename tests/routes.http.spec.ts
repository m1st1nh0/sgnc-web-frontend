import { test, expect } from '@playwright/test';
const paths=['/','/abrir-nc','/nc/1','/nc/1/editar','/usuarios','/insights','/relatorios','/usuarios/00000000-0000-0000-0000-000000000001/dossie','/usuarios/00000000-0000-0000-0000-000000000001/estatisticas','/trocar-senha'];
for(const path of paths) test(`anonymous page ${path} redirects to login`,async({request})=>{
 const r=await request.get(path,{maxRedirects:0});expect(r.status()).toBe(307);expect(r.headers().location).toBe('/login');
});
for(const path of ['/api/nc','/api/nc/1','/api/usuarios','/api/insights','/api/insights/ncs','/api/onboarding/me','/api/relatorios/ncs.csv','/api/relatorios/nc/1.pdf','/api/nc/1/evidencias']) test(`anonymous API ${path} denied`,async({request})=>{
 const r=await request.get(path);expect(r.status()).toBe(401);expect(await r.json()).toEqual({detail:'Sessão inválida ou expirada. Faça login novamente.'});
});
test('mutation without session denied',async({request})=>expect((await request.post('/api/nc',{data:{}})).status()).toBe(401));
test('invalid JSON returns 422',async({request})=>expect((await request.post('/api/nc',{data:'{',headers:{'content-type':'application/json'}})).status()).toBe(422));
test('legacy API uses same secured handler',async({request})=>expect((await request.get('/api/legacy/nc')).status()).toBe(401));
test('unknown API and page are 404',async({request})=>{
 expect((await request.get('/api/not-a-route')).status()).toBe(404);expect((await request.get('/not-a-route')).status()).toBe(404);
});
test('login security headers',async({request})=>{
 const r=await request.get('/login');expect(r.status()).toBe(200);expect(r.headers()['x-frame-options']).toBe('DENY');expect(r.headers()['x-content-type-options']).toBe('nosniff');expect(r.headers()['content-security-policy']).toContain("frame-ancestors 'none'");expect(await r.text()).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
});
