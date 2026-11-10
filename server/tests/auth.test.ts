import request from 'supertest';
import { db } from '../src/lib/db';
import { app } from './helpers';

const PASSWORD = 'Password1';

async function register(email: string, password = PASSWORD) {
  return request(app).post('/api/auth/register').send({ email, password });
}

async function login(email: string, password = PASSWORD) {
  return request(app).post('/api/auth/login').send({ email, password });
}

describe('Auth', () => {
  it('registra un usuario nuevo', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ana@test.com', password: 'Password1' });

    expect(res.status).toBe(201);
  });

  it('inicia sesión con credenciales válidas', async () => {
    await register('login@test.com');

    const res = await login('login@test.com');

    expect(res.status).toBe(200);
  });

  it('rechaza el login con contraseña incorrecta', async () => {
    await register('wrong@test.com');

    const res = await login('wrong@test.com', 'Otracosa9');

    expect(res.status).toBe(401);
  });

  describe('registro', () => {
    it('rechaza un email duplicado', async () => {
      await register('duplicate@test.com');

      const res = await register('duplicate@test.com');

      expect(res.status).toBe(409);
    });

    it('rechaza un email inválido', async () => {
      const res = await register('no-es-un-email');

      expect(res.status).toBe(400);
    });

    it('rechaza una contraseña débil', async () => {
      const res = await register('weak@test.com', 'corta');

      expect(res.status).toBe(400);
    });
  });

  describe('login', () => {
    it('rechaza un email inexistente', async () => {
      const res = await login('nadie@test.com');

      expect(res.status).toBe(401);
    });

    it('bloquea la cuenta tras cinco intentos fallidos', async () => {
      await register('lock@test.com');

      for (let i = 0; i < 5; i += 1) {
        const res = await login('lock@test.com', 'Incorrecta9');
        expect(res.status).toBe(401);
      }

      const locked = await login('lock@test.com');
      expect(locked.status).toBe(401);
      expect(locked.body.error.message).toMatch(/locked/i);
    });

    it('vuelve a permitir el login cuando el bloqueo expiró', async () => {
      await register('unlock@test.com');
      const user = await db.user.findUnique({ where: { email: 'unlock@test.com' } });
      await db.user.update({
        where: { id: user!.id },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });

      const res = await login('unlock@test.com');

      expect(res.status).toBe(200);
      const after = await db.user.findUnique({ where: { email: 'unlock@test.com' } });
      expect(after!.lockedUntil).toBeNull();
    });
  });

  describe('recuperación de contraseña', () => {
    it('responde de forma neutra a un email desconocido', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'desconocido@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeUndefined();
    });

    it('rechaza un email inválido', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'no-es-un-email' });

      expect(res.status).toBe(400);
    });

    it('permite resetear la contraseña y invalida el token', async () => {
      await register('reset@test.com');

      const forgot = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset@test.com' });
      expect(forgot.status).toBe(200);
      expect(typeof forgot.body.token).toBe('string');

      const reset = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: forgot.body.token, newPassword: 'NuevaClave9' });
      expect(reset.status).toBe(200);

      const oldLogin = await login('reset@test.com', PASSWORD);
      expect(oldLogin.status).toBe(401);

      const newLogin = await login('reset@test.com', 'NuevaClave9');
      expect(newLogin.status).toBe(200);

      const reuse = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: forgot.body.token, newPassword: 'OtraClave9' });
      expect(reuse.status).toBe(400);
    });

    it('rechaza un token inválido', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'token-invalido', newPassword: 'NuevaClave9' });

      expect(res.status).toBe(400);
    });

    it('rechaza una contraseña nueva débil', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'token-invalido', newPassword: 'corta' });

      expect(res.status).toBe(400);
    });
  });
});
