import { test, expect } from '@playwright/test';
test('login and deep-link redirect without hydration error',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/nc/1/editar');await expect(page).toHaveURL(/\/login$/);
 await expect(page.locator('input[type=email]')).toBeVisible();await expect(page.locator('input[type=password]')).toBeVisible();
 await expect(page.getByRole('button',{name:/entrar/i})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);expect(errors).toEqual([]);
});
