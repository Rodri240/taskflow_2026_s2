import { expect, test } from '../fixtures';
import { NEW_USER_PASSWORD, uniqueEmail } from '../support/data';

const NEW_PASSWORD = 'NuevaClave1';

test.describe('Recuperar contraseña (US-17)', () => {
  test('flujo completo: solicitar reseteo, cambiar la contraseña y volver a entrar', async ({
    api,
  }) => {
    const email = uniqueEmail('reset');
    await api.register(email, NEW_USER_PASSWORD);

    const forgot = await api.rawPost('/auth/forgot-password', { email });
    expect(forgot.status()).toBe(200);
    const { token } = await forgot.json();
    expect(token).toBeTruthy();

    const reset = await api.rawPost('/auth/reset-password', { token, newPassword: NEW_PASSWORD });
    expect(reset.status()).toBe(200);

    const login = await api.login(email, NEW_PASSWORD);
    expect(login.user.email).toBe(email);
  });

  // BUG-16: el server responde 404 si el email no existe; US-17 CA2 exige
  // una respuesta idéntica (200 y mensaje genérico) para no revelar qué
  // direcciones están registradas.
  test('la respuesta es la misma exista o no el email en el sistema', async ({ api }) => {
    const email = uniqueEmail('reset-privado');
    await api.register(email, NEW_USER_PASSWORD);

    const known = await api.rawPost('/auth/forgot-password', { email });
    const unknown = await api.rawPost('/auth/forgot-password', {
      email: uniqueEmail('nadie'),
    });

    expect(known.status()).toBe(200);
    expect(unknown.status()).toBe(200);
    const knownBody = await known.json();
    const unknownBody = await unknown.json();
    expect(unknownBody.message).toBe(knownBody.message);
  });

  // BUG-17: reset-password nunca marca el token como usado ni valida usedAt;
  // US-17 CA5 exige 400 para un token ya utilizado.
  test('un token ya utilizado no se puede reutilizar', async ({ api }) => {
    const email = uniqueEmail('reset-reuso');
    await api.register(email, NEW_USER_PASSWORD);

    const forgot = await api.rawPost('/auth/forgot-password', { email });
    const { token } = await forgot.json();

    const first = await api.rawPost('/auth/reset-password', { token, newPassword: NEW_PASSWORD });
    expect(first.status()).toBe(200);

    const second = await api.rawPost('/auth/reset-password', { token, newPassword: NEW_PASSWORD });
    expect(second.status()).toBe(400);
  });

  // BUG-17 (misma raíz): como usedAt nunca se valida, un token anterior a
  // uno nuevo sigue siendo válido; US-17 CA6 exige invalidarlo.
  test('generar un token nuevo invalida los anteriores', async ({ api }) => {
    const email = uniqueEmail('reset-invalida');
    await api.register(email, NEW_USER_PASSWORD);

    const first = await api.rawPost('/auth/forgot-password', { email });
    const { token: oldToken } = await first.json();
    await api.rawPost('/auth/forgot-password', { email });

    const res = await api.rawPost('/auth/reset-password', {
      token: oldToken,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status()).toBe(400);
  });

  test('rechaza una contraseña nueva que no cumple las reglas', async ({ api }) => {
    const email = uniqueEmail('reset-debil');
    await api.register(email, NEW_USER_PASSWORD);

    const forgot = await api.rawPost('/auth/forgot-password', { email });
    const { token } = await forgot.json();

    const res = await api.rawPost('/auth/reset-password', { token, newPassword: 'abc' });
    expect(res.status()).toBe(400);
  });

  test('un reseteo exitoso desbloquea la cuenta bloqueada por intentos fallidos', async ({
    api,
  }) => {
    const email = uniqueEmail('reset-desbloqueo');
    await api.register(email, NEW_USER_PASSWORD);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await api.rawPost('/auth/login', { email, password: 'WrongPass1' });
    }
    const locked = await api.rawPost('/auth/login', { email, password: NEW_USER_PASSWORD });
    expect(locked.status()).toBe(401);

    const forgot = await api.rawPost('/auth/forgot-password', { email });
    const { token } = await forgot.json();
    const reset = await api.rawPost('/auth/reset-password', { token, newPassword: NEW_PASSWORD });
    expect(reset.status()).toBe(200);

    const login = await api.login(email, NEW_PASSWORD);
    expect(login.user.email).toBe(email);
  });
});
