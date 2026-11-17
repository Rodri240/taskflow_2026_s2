import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';

describe('Infraestructura HTTP', () => {
  it('responde el healthcheck', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('devuelve 404 para una ruta desconocida', async () => {
    const res = await request(app).get('/api/ruta-inexistente');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('devuelve 500 ante un JSON malformado', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');

    consoleError.mockRestore();
  });

  describe('autenticación', () => {
    it('rechaza una petición sin token', async () => {
      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(401);
    });

    it('rechaza un token inválido', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set({ Authorization: 'Bearer token-invalido' });

      expect(res.status).toBe(401);
    });

    it('rechaza un esquema de autorización distinto a Bearer', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set({ Authorization: 'Basic abc123' });

      expect(res.status).toBe(401);
    });
  });

  describe('membresía de proyecto', () => {
    it('devuelve 404 con un id de proyecto inválido', async () => {
      const { token } = await registerUser('plumb-proj-badid@test.com');

      const res = await request(app)
        .get('/api/projects/no-es-un-id/tasks')
        .set(auth(token));

      expect(res.status).toBe(404);
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const { token } = await registerUser('plumb-proj-missing@test.com');

      const res = await request(app)
        .get('/api/projects/proj-99999/tasks')
        .set(auth(token));

      expect(res.status).toBe(404);
    });

    it('prohíbe el acceso a un usuario que no es miembro', async () => {
      const owner = await registerUser('plumb-proj-owner@test.com');
      const stranger = await registerUser('plumb-proj-stranger@test.com');
      const project = await createProject(owner.token, 'Proyecto privado');

      const res = await request(app)
        .get(`/api/projects/${project.id}/tasks`)
        .set(auth(stranger.token));

      expect(res.status).toBe(403);
    });
  });

  describe('membresía de tarea', () => {
    it('devuelve 404 con un id de tarea inválido', async () => {
      const { token } = await registerUser('plumb-task-badid@test.com');

      const res = await request(app)
        .get('/api/tasks/no-es-un-id')
        .set(auth(token));

      expect(res.status).toBe(404);
    });

    it('devuelve 404 si la tarea no existe', async () => {
      const { token } = await registerUser('plumb-task-missing@test.com');

      const res = await request(app)
        .get('/api/tasks/task-99999')
        .set(auth(token));

      expect(res.status).toBe(404);
    });

    it('prohíbe el acceso a un usuario que no es miembro', async () => {
      const owner = await registerUser('plumb-task-owner@test.com');
      const stranger = await registerUser('plumb-task-stranger@test.com');
      const project = await createProject(owner.token, 'Proyecto privado');
      const task = await createTask(owner.token, project.id, { title: 'Tarea privada' });

      const res = await request(app)
        .get(`/api/tasks/${task.id}`)
        .set(auth(stranger.token));

      expect(res.status).toBe(403);
    });
  });
});
