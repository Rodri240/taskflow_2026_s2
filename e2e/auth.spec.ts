import { expect, test } from '@playwright/test';
import { expectStatus, registerUser, uniqueEmail, VALID_PASSWORD } from './support/api';

test.describe('Autenticación y acceso', () => {
  test('[US-01, US-02] registra, normaliza el email y vuelve a iniciar sesión', async ({
    page,
    request,
  }) => {
    const normalizedEmail = uniqueEmail('registro');
    const enteredEmail = normalizedEmail.toUpperCase();

    await page.goto('/login');
    await page.getByTestId('login-mode-toggle').click();
    await page.getByTestId('login-name-input').fill('Usuario Playwright');
    await page.getByTestId('login-email-input').fill(enteredEmail);
    await page.getByTestId('login-password-input').fill(VALID_PASSWORD);

    const registrationPromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST',
    );
    await page.getByTestId('login-submit').click();
    const registration = await registrationPromise;
    const registrationBody = await expectStatus<{ token: string; user: { email: string } }>(
      registration,
      201,
    );

    expect(registrationBody.token).toEqual(expect.any(String));
    expect(registrationBody.user.email).toBe(normalizedEmail);
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByTestId('header-user-email')).toHaveText(normalizedEmail);

    const duplicate = await request.post('/api/auth/register', {
      data: { email: normalizedEmail, password: VALID_PASSWORD },
    });
    const duplicateBody = await expectStatus<{ error: { code: string; message: string } }>(
      duplicate,
      409,
    );
    expect(duplicateBody.error).toMatchObject({
      code: 'CONFLICT',
      message: 'Email already registered',
    });

    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByTestId('login-email-input').fill(normalizedEmail);
    await page.getByTestId('login-password-input').fill('Incorrecta9');
    const rejectedPromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
    );
    await page.getByTestId('login-submit').click();
    await expectStatus(await rejectedPromise, 401);
    await expect(page.getByRole('alert')).toHaveText('Invalid credentials');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByTestId('login-password-input').fill(VALID_PASSWORD);
    const loginPromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
    );
    await page.getByTestId('login-submit').click();
    const loginBody = await expectStatus<{ token: string }>(await loginPromise, 200);
    expect(loginBody.token).toEqual(expect.any(String));
    await expect(page).toHaveURL(/\/projects$/);
  });

  test('[US-02] bloquea la cuenta exactamente al quinto intento fallido', async ({ request }) => {
    const account = await registerUser(request, 'bloqueo');

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await request.post('/api/auth/login', {
        data: { email: account.email, password: 'Incorrecta9' },
      });
      const body = await expectStatus<{ error: { code: string; message: string } }>(response, 401);
      expect(body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const fifth = await request.post('/api/auth/login', {
      data: { email: account.email, password: 'Incorrecta9' },
    });
    const fifthBody = await expectStatus<{ error: { message: string } }>(fifth, 401);
    expect.soft(fifthBody.error.message.toLowerCase()).toContain('locked');

    const validWhileLocked = await request.post('/api/auth/login', {
      data: { email: account.email, password: VALID_PASSWORD },
    });
    const lockedBody = await expectStatus<{ error: { message: string } }>(validWhileLocked, 401);
    expect(lockedBody.error.message.toLowerCase()).toContain('locked');
  });

  test('[US-17] solicitar recuperación no revela si la cuenta existe', async ({ request }) => {
    const account = await registerUser(request, 'recuperacion-privacidad');

    const knownResponse = await request.post('/api/auth/forgot-password', {
      data: { email: account.email },
    });
    const unknownResponse = await request.post('/api/auth/forgot-password', {
      data: { email: uniqueEmail('inexistente') },
    });

    const knownBody = await expectStatus<Record<string, unknown>>(knownResponse, 200);
    const unknownBody = await expectStatus<Record<string, unknown>>(unknownResponse, 200);
    expect(unknownBody).toEqual(knownBody);
  });

  test('[US-17] un token de recuperación es de un solo uso', async ({ request }) => {
    const account = await registerUser(request, 'recuperacion-token');
    const forgot = await request.post('/api/auth/forgot-password', {
      data: { email: account.email },
    });
    const forgotBody = await expectStatus<{ token: string }>(forgot, 200);
    expect(forgotBody.token).toEqual(expect.any(String));

    const firstReset = await request.post('/api/auth/reset-password', {
      data: { token: forgotBody.token, newPassword: 'NuevaClave1' },
    });
    await expectStatus(firstReset, 200);

    const reused = await request.post('/api/auth/reset-password', {
      data: { token: forgotBody.token, newPassword: 'OtraClave2' },
    });
    const reusedBody = await expectStatus<{ error: { code: string } }>(reused, 400);
    expect(reusedBody.error.code).toBe('VALIDATION_ERROR');
  });
});
