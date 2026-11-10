import request from 'supertest';
import { addMember, app, auth, createProject, createTask, registerUser } from './helpers';

describe('Comentarios', () => {
  it('agrega un comentario a una tarea', async () => {
    const { token } = await registerUser('com1@test.com');
    const project = await createProject(token, 'Proyecto con comentarios');
    const task = await createTask(token, project.id, { title: 'Tarea comentada' });

    const res = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'Revisado y aprobado' });

    expect(res.status).toBe(201);
  });

  it('devuelve los comentarios de una tarea', async () => {
    const { token } = await registerUser('com2@test.com');
    const project = await createProject(token, 'Proyecto con listado');
    const task = await createTask(token, project.id, { title: 'Otra tarea' });
    await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'Primer comentario' });

    const res = await request(app).get(`/api/tasks/${task.id}/comments`).set(auth(token));

    expect(res.body).toHaveLength(1);
  });

  describe('validación', () => {
    it('rechaza un comentario vacío', async () => {
      const { token } = await registerUser('com-empty@test.com');
      const project = await createProject(token, 'Proyecto con comentarios');
      const task = await createTask(token, project.id, { title: 'Tarea comentada' });

      const res = await request(app)
        .post(`/api/tasks/${task.id}/comments`)
        .set(auth(token))
        .send({ body: '   ' });

      expect(res.status).toBe(400);
    });

    it('rechaza un comentario demasiado largo', async () => {
      const { token } = await registerUser('com-long@test.com');
      const project = await createProject(token, 'Proyecto con comentarios');
      const task = await createTask(token, project.id, { title: 'Tarea comentada' });

      const res = await request(app)
        .post(`/api/tasks/${task.id}/comments`)
        .set(auth(token))
        .send({ body: 'x'.repeat(1001) });

      expect(res.status).toBe(400);
    });
  });

  describe('eliminación', () => {
    it('elimina un comentario propio', async () => {
      const { token } = await registerUser('com-del@test.com');
      const project = await createProject(token, 'Proyecto con comentarios');
      const task = await createTask(token, project.id, { title: 'Tarea comentada' });
      const comment = (
        await request(app)
          .post(`/api/tasks/${task.id}/comments`)
          .set(auth(token))
          .send({ body: 'Comentario propio' })
      ).body;

      const res = await request(app)
        .delete(`/api/comments/${comment.id}`)
        .set(auth(token));

      expect(res.status).toBe(204);

      const list = await request(app).get(`/api/tasks/${task.id}/comments`).set(auth(token));
      expect(list.body).toHaveLength(0);
    });

    it('prohíbe eliminar un comentario ajeno', async () => {
      const owner = await registerUser('com-del-owner@test.com');
      const member = await registerUser('com-del-member@test.com');
      const project = await createProject(owner.token, 'Proyecto compartido');
      await addMember(owner.token, project.id, 'com-del-member@test.com');
      const task = await createTask(owner.token, project.id, { title: 'Tarea comentada' });
      const comment = (
        await request(app)
          .post(`/api/tasks/${task.id}/comments`)
          .set(auth(member.token))
          .send({ body: 'Comentario del miembro' })
      ).body;

      const res = await request(app)
        .delete(`/api/comments/${comment.id}`)
        .set(auth(owner.token));

      expect(res.status).toBe(403);
    });

    it('devuelve 404 para un comentario inexistente', async () => {
      const { token } = await registerUser('com-del-missing@test.com');

      const res = await request(app)
        .delete('/api/comments/comment-99999')
        .set(auth(token));

      expect(res.status).toBe(404);
    });

    it('devuelve 404 para un id de comentario inválido', async () => {
      const { token } = await registerUser('com-del-badid@test.com');

      const res = await request(app)
        .delete('/api/comments/no-es-un-id')
        .set(auth(token));

      expect(res.status).toBe(404);
    });
  });

  describe('acceso', () => {
    it('prohíbe comentar en una tarea de un proyecto ajeno', async () => {
      const owner = await registerUser('com-foreign-owner@test.com');
      const stranger = await registerUser('com-foreign-stranger@test.com');
      const project = await createProject(owner.token, 'Proyecto privado');
      const task = await createTask(owner.token, project.id, { title: 'Tarea privada' });

      const res = await request(app)
        .post(`/api/tasks/${task.id}/comments`)
        .set(auth(stranger.token))
        .send({ body: 'Intento ajeno' });

      expect(res.status).toBe(403);
    });

    it('devuelve 404 al listar comentarios de una tarea inexistente', async () => {
      const { token } = await registerUser('com-missing@test.com');

      const res = await request(app)
        .get('/api/tasks/task-99999/comments')
        .set(auth(token));

      expect(res.status).toBe(404);
    });
  });
});
