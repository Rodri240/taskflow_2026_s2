import request from 'supertest';
import { app } from './helpers';

describe('Auth', () => {
  it('registra un usuario nuevo', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ana@test.com', password: 'Password1' });

    expect(res.status).toBe(201);
  });

  it('inicia sesiÃ³n con credenciales vÃ¡lidas', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'Password1' });

    expect(res.status).toBe(200);
  });

  it('rechaza el login con contraseÃ±a incorrecta', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'wrong@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'Otracosa9' });

    expect(res.status).toBe(401);
  });

  it('rechaza el registro con email invÃ¡lido (US-01 CA1)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'no-es-email', password: 'Password1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 409 al registrar un email ya existente (US-01 CA4)', async () => {
    const email = `us01-ca4-${Date.now()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password1' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toBe('Email already registered');
  });

  it('normaliza el email a minÃºsculas al registrarse (US-01 CA2)', async () => {
    const email = `us01-ca2-${Date.now()}@test.com`;

    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password: 'Password1' });

    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe(email);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: email.toUpperCase(), password: 'Password1' });
    expect(login.status).toBe(200);

    const repeated = await request(app)
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password: 'Password1' });
    expect(repeated.status).toBe(409);
  });

  it('no devuelve la contraseÃ±a en ninguna respuesta (US-01 CA7)', async () => {
    const email = `us01-ca7-${Date.now()}@test.com`;

    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password1' });

    expect(reg.status).toBe(201);
    expect(reg.body.user).not.toHaveProperty('password');
    expect(reg.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(reg.body)).not.toContain('Password1');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password1' });

    expect(login.status).toBe(200);
    expect(login.body.user).not.toHaveProperty('password');
    expect(login.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(login.body)).not.toContain('Password1');
  });

  it('usa el mismo mensaje de error para email inexistente y contraseÃ±a incorrecta (US-02 CA3)', async () => {
    const email = `us02-ca3-${Date.now()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Password1' });

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: `nadie-${Date.now()}@test.com`, password: 'Password1' });
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Otracosa9' });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  // BUG-07: assertPassword valida length >= 7 en lugar del mÃ­nimo 8 de
  // US-01 CA3; la contraseÃ±a 'Abc1234' (7 caracteres) hoy se acepta.
  it('rechaza una contraseÃ±a de exactamente 7 caracteres (US-01 CA3)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `us01-ca3-${Date.now()}@test.com`, password: 'Abc1234' });

    expect(res.status).toBe(400);
  });

  // BUG-20: el login exitoso nunca pone failedAttempts en 0, asÃ­ que el
  // contador acumula fallos aunque haya logins exitosos intercalados y la
  // cuenta se bloquea antes de los 5 fallos consecutivos que exige US-02 CA5.
  it('el contador de intentos se reinicia tras un login exitoso (US-02 CA5)', async () => {
    const email = `us02-ca5-${Date.now()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Password1' });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app).post('/api/auth/login').send({ email, password: 'WrongPass1' });
    }

    const ok = await request(app).post('/api/auth/login').send({ email, password: 'Password1' });
    expect(ok.status).toBe(200);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app).post('/api/auth/login').send({ email, password: 'WrongPass1' });
    }

    const stillOk = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password1' });
    expect(stillOk.status).toBe(200);
  });
});
