# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs\password-recovery.spec.ts >> Recuperar contraseña (US-17) >> la respuesta es la misma exista o no el email en el sistema
- Location: e2e\specs\password-recovery.spec.ts:28:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Test source

```ts
  1   | import { expect, test } from '../fixtures';
  2   | import { NEW_USER_PASSWORD, uniqueEmail } from '../support/data';
  3   | 
  4   | const NEW_PASSWORD = 'NuevaClave1';
  5   | 
  6   | test.describe('Recuperar contraseña (US-17)', () => {
  7   |   test('flujo completo: solicitar reseteo, cambiar la contraseña y volver a entrar', async ({
  8   |     api,
  9   |   }) => {
  10  |     const email = uniqueEmail('reset');
  11  |     await api.register(email, NEW_USER_PASSWORD);
  12  | 
  13  |     const forgot = await api.rawPost('/auth/forgot-password', { email });
  14  |     expect(forgot.status()).toBe(200);
  15  |     const { token } = await forgot.json();
  16  |     expect(token).toBeTruthy();
  17  | 
  18  |     const reset = await api.rawPost('/auth/reset-password', { token, newPassword: NEW_PASSWORD });
  19  |     expect(reset.status()).toBe(200);
  20  | 
  21  |     const login = await api.login(email, NEW_PASSWORD);
  22  |     expect(login.user.email).toBe(email);
  23  |   });
  24  | 
  25  |   // BUG-16: el server responde 404 si el email no existe; US-17 CA2 exige
  26  |   // una respuesta idéntica (200 y mensaje genérico) para no revelar qué
  27  |   // direcciones están registradas.
  28  |   test('la respuesta es la misma exista o no el email en el sistema', async ({ api }) => {
  29  |     const email = uniqueEmail('reset-privado');
  30  |     await api.register(email, NEW_USER_PASSWORD);
  31  | 
  32  |     const known = await api.rawPost('/auth/forgot-password', { email });
  33  |     const unknown = await api.rawPost('/auth/forgot-password', {
  34  |       email: uniqueEmail('nadie'),
  35  |     });
  36  | 
  37  |     expect(known.status()).toBe(200);
> 38  |     expect(unknown.status()).toBe(200);
      |                              ^ Error: expect(received).toBe(expected) // Object.is equality
  39  |     const knownBody = await known.json();
  40  |     const unknownBody = await unknown.json();
  41  |     expect(unknownBody.message).toBe(knownBody.message);
  42  |   });
  43  | 
  44  |   // BUG-17: reset-password nunca marca el token como usado ni valida usedAt;
  45  |   // US-17 CA5 exige 400 para un token ya utilizado.
  46  |   test('un token ya utilizado no se puede reutilizar', async ({ api }) => {
  47  |     const email = uniqueEmail('reset-reuso');
  48  |     await api.register(email, NEW_USER_PASSWORD);
  49  | 
  50  |     const forgot = await api.rawPost('/auth/forgot-password', { email });
  51  |     const { token } = await forgot.json();
  52  | 
  53  |     const first = await api.rawPost('/auth/reset-password', { token, newPassword: NEW_PASSWORD });
  54  |     expect(first.status()).toBe(200);
  55  | 
  56  |     const second = await api.rawPost('/auth/reset-password', { token, newPassword: NEW_PASSWORD });
  57  |     expect(second.status()).toBe(400);
  58  |   });
  59  | 
  60  |   // BUG-17 (misma raíz): como usedAt nunca se valida, un token anterior a
  61  |   // uno nuevo sigue siendo válido; US-17 CA6 exige invalidarlo.
  62  |   test('generar un token nuevo invalida los anteriores', async ({ api }) => {
  63  |     const email = uniqueEmail('reset-invalida');
  64  |     await api.register(email, NEW_USER_PASSWORD);
  65  | 
  66  |     const first = await api.rawPost('/auth/forgot-password', { email });
  67  |     const { token: oldToken } = await first.json();
  68  |     await api.rawPost('/auth/forgot-password', { email });
  69  | 
  70  |     const res = await api.rawPost('/auth/reset-password', {
  71  |       token: oldToken,
  72  |       newPassword: NEW_PASSWORD,
  73  |     });
  74  |     expect(res.status()).toBe(400);
  75  |   });
  76  | 
  77  |   test('rechaza una contraseña nueva que no cumple las reglas', async ({ api }) => {
  78  |     const email = uniqueEmail('reset-debil');
  79  |     await api.register(email, NEW_USER_PASSWORD);
  80  | 
  81  |     const forgot = await api.rawPost('/auth/forgot-password', { email });
  82  |     const { token } = await forgot.json();
  83  | 
  84  |     const res = await api.rawPost('/auth/reset-password', { token, newPassword: 'abc' });
  85  |     expect(res.status()).toBe(400);
  86  |   });
  87  | 
  88  |   test('un reseteo exitoso desbloquea la cuenta bloqueada por intentos fallidos', async ({
  89  |     api,
  90  |   }) => {
  91  |     const email = uniqueEmail('reset-desbloqueo');
  92  |     await api.register(email, NEW_USER_PASSWORD);
  93  | 
  94  |     for (let attempt = 0; attempt < 5; attempt += 1) {
  95  |       await api.rawPost('/auth/login', { email, password: 'WrongPass1' });
  96  |     }
  97  |     const locked = await api.rawPost('/auth/login', { email, password: NEW_USER_PASSWORD });
  98  |     expect(locked.status()).toBe(401);
  99  | 
  100 |     const forgot = await api.rawPost('/auth/forgot-password', { email });
  101 |     const { token } = await forgot.json();
  102 |     const reset = await api.rawPost('/auth/reset-password', { token, newPassword: NEW_PASSWORD });
  103 |     expect(reset.status()).toBe(200);
  104 | 
  105 |     const login = await api.login(email, NEW_PASSWORD);
  106 |     expect(login.user.email).toBe(email);
  107 |   });
  108 | });
  109 | 
```