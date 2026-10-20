# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs\auth.spec.ts >> Autenticación >> registro rechaza una contraseña de menos de 8 caracteres
- Location: e2e\specs\auth.spec.ts:29:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('error-message')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByTestId('error-message') with timeout 5000ms
  - waiting for getByTestId('error-message')

```

```yaml
- banner:
  - link "TaskFlow":
    - /url: /projects
  - text: debil-1792534686367-2@test.com
  - button "Salir"
- main:
  - heading "Proyectos" [level=1]
  - text: Nombre
  - textbox "Nombre"
  - text: Descripción
  - textbox "Descripción"
  - button "Crear proyecto"
  - list
  - paragraph: Todavía no hay proyectos.
```

# Test source

```ts
  1  | import { expect, test } from '../fixtures';
  2  | import { AppActions } from '../actions/app';
  3  | import { NEW_USER_PASSWORD, USERS, uniqueEmail } from '../support/data';
  4  | 
  5  | test.describe('Autenticación', () => {
  6  |   test('login con credenciales válidas redirige al listado de proyectos', async ({ page }) => {
  7  |     const app = new AppActions(page);
  8  |     await app.loginAs(USERS.ana);
  9  |     await expect(app.header.userEmail).toHaveText(USERS.ana.email);
  10 |   });
  11 | 
  12 |   test('login con contraseña incorrecta muestra error y no navega', async ({ page }) => {
  13 |     const app = new AppActions(page);
  14 |     await app.openLogin();
  15 |     await app.login.login(USERS.ana.email, 'Incorrecta1');
  16 |     await expect(app.login.error).toBeVisible();
  17 |     await expect(page).toHaveURL(/\/login$/);
  18 |   });
  19 | 
  20 |   test('registro de un usuario nuevo deja la sesión iniciada', async ({ page }) => {
  21 |     const app = new AppActions(page);
  22 |     const email = uniqueEmail('registro');
  23 |     await app.register('Usuario E2E', email, NEW_USER_PASSWORD);
  24 |     await expect(app.header.userEmail).toHaveText(email);
  25 |   });
  26 | 
  27 |   // BUG-07: el server acepta contraseñas de 7 caracteres ('Abc1234' tiene
  28 |   // mayúscula y número); el criterio US-01 CA3 exige mínimo 8.
  29 |   test('registro rechaza una contraseña de menos de 8 caracteres', async ({ page }) => {
  30 |     const app = new AppActions(page);
  31 |     await app.openLogin();
  32 |     await app.login.register('Usuario Débil', uniqueEmail('debil'), 'Abc1234');
  33 | 
> 34 |     await expect(app.login.error).toBeVisible();
     |                                   ^ Error: expect(locator).toBeVisible() failed
  35 |     await expect(page).toHaveURL(/\/login$/);
  36 |   });
  37 | 
  38 |   test('logout limpia la sesión y vuelve al login', async ({ page }) => {
  39 |     const app = new AppActions(page);
  40 |     await app.loginAs(USERS.ana);
  41 |     await app.logout();
  42 |     await page.goto('/projects');
  43 |     await expect(page).toHaveURL(/\/login$/);
  44 |     await expect(app.header.root).toHaveCount(0);
  45 |   });
  46 | 
  47 |   test('bloquea la cuenta tras cinco intentos fallidos', async ({ page, api }) => {
  48 |     const email = uniqueEmail('lock');
  49 |     await api.register(email, NEW_USER_PASSWORD);
  50 | 
  51 |     const app = new AppActions(page);
  52 |     await app.openLogin();
  53 |     for (let attempt = 0; attempt < 5; attempt += 1) {
  54 |       await app.login.login(email, 'WrongPass1');
  55 |       await expect(app.login.error).toBeVisible();
  56 |     }
  57 | 
  58 |     await page.reload();
  59 |     await app.login.login(email, NEW_USER_PASSWORD);
  60 |     await expect(app.login.error).toBeVisible();
  61 |     await expect(page).toHaveURL(/\/login$/);
  62 |   });
  63 | });
  64 | 
```