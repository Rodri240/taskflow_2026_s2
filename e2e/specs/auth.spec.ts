import { expect, test } from '../fixtures';
import { AppActions } from '../actions/app';
import { NEW_USER_PASSWORD, USERS, uniqueEmail } from '../support/data';

test.describe('Autenticación', () => {
  test('login con credenciales válidas redirige al listado de proyectos', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await expect(app.header.userEmail).toHaveText(USERS.ana.email);
  });

  test('login con contraseña incorrecta muestra error y no navega', async ({ page }) => {
    const app = new AppActions(page);
    await app.openLogin();
    await app.login.login(USERS.ana.email, 'Incorrecta1');
    await expect(app.login.error).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('registro de un usuario nuevo deja la sesión iniciada', async ({ page }) => {
    const app = new AppActions(page);
    const email = uniqueEmail('registro');
    await app.register('Usuario E2E', email, NEW_USER_PASSWORD);
    await expect(app.header.userEmail).toHaveText(email);
  });

  // BUG-07: el server acepta contraseñas de 7 caracteres ('Abc1234' tiene
  // mayúscula y número); el criterio US-01 CA3 exige mínimo 8.
  test('registro rechaza una contraseña de menos de 8 caracteres', async ({ page }) => {
    const app = new AppActions(page);
    await app.openLogin();
    await app.login.register('Usuario Débil', uniqueEmail('debil'), 'Abc1234');

    await expect(app.login.error).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('logout limpia la sesión y vuelve al login', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await app.logout();
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login$/);
    await expect(app.header.root).toHaveCount(0);
  });

  test('bloquea la cuenta tras cinco intentos fallidos', async ({ page, api }) => {
    const email = uniqueEmail('lock');
    await api.register(email, NEW_USER_PASSWORD);

    const app = new AppActions(page);
    await app.openLogin();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await app.login.login(email, 'WrongPass1');
      await expect(app.login.error).toBeVisible();
    }

    await page.reload();
    await app.login.login(email, NEW_USER_PASSWORD);
    await expect(app.login.error).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
