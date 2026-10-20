import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';

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

  it('registra autor y timestamp del comentario (US-08 CA3)', async () => {
    const { token, id } = await registerUser(`com-ca3-${Date.now()}@test.com`);
    const project = await createProject(token, 'Proyecto autor');
    const task = await createTask(token, project.id, { title: 'Tarea autor' });

    const res = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'Con autor y fecha' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.stringMatching(/^comment-\d+$/),
      taskId: task.id,
      authorId: id,
      body: 'Con autor y fecha',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('acepta comentarios de 1 y de 1000 caracteres (US-08 CA1)', async () => {
    const { token } = await registerUser(`com-ca1-ok-${Date.now()}@test.com`);
    const project = await createProject(token, 'Proyecto largos');
    const task = await createTask(token, project.id, { title: 'Tarea largos' });

    const short = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'a' });
    const long = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'x'.repeat(1000) });

    expect(short.status).toBe(201);
    expect(long.status).toBe(201);
  });

  it('rechaza comentarios de 0 y de 1001 caracteres (US-08 CA1/CA2)', async () => {
    const { token } = await registerUser(`com-ca1-bad-${Date.now()}@test.com`);
    const project = await createProject(token, 'Proyecto largos mal');
    const task = await createTask(token, project.id, { title: 'Tarea largos mal' });

    const empty = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: '' });
    const tooLong = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'x'.repeat(1001) });

    expect(empty.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
  });

  // BUG-19: el repositorio ordena por createdAt 'desc'; US-08 CA4 pide el
  // orden cronolÃ³gico ascendente, del mÃ¡s antiguo al mÃ¡s reciente.
  it('devuelve los comentarios en orden cronolÃ³gico ascendente (US-08 CA4)', async () => {
    const { token } = await registerUser(`com-ca4-${Date.now()}@test.com`);
    const project = await createProject(token, 'Proyecto orden');
    const task = await createTask(token, project.id, { title: 'Tarea orden' });

    for (const body of ['Primero', 'Segundo', 'Tercero']) {
      await request(app)
        .post(`/api/tasks/${task.id}/comments`)
        .set(auth(token))
        .send({ body });
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const res = await request(app).get(`/api/tasks/${task.id}/comments`).set(auth(token));

    expect(res.body.map((c: { body: string }) => c.body)).toEqual(['Primero', 'Segundo', 'Tercero']);
  });

  it('un usuario que no es miembro no puede comentar (US-08 CA5)', async () => {
    const owner = await registerUser(`com-ca5-owner-${Date.now()}@test.com`);
    const outsider = await registerUser(`com-ca5-out-${Date.now()}@test.com`);
    const project = await createProject(owner.token, 'Proyecto cerrado');
    const task = await createTask(owner.token, project.id, { title: 'Tarea cerrada' });

    const res = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(outsider.token))
      .send({ body: 'Intruso' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('no puedo eliminar el comentario de otro usuario (US-08 CA6)', async () => {
    const stamp = Date.now();
    const ownerEmail = `com-ca6-owner-${stamp}@test.com`;
    const otherEmail = `com-ca6-other-${stamp}@test.com`;
    const owner = await registerUser(ownerEmail);
    const other = await registerUser(otherEmail);
    const project = await createProject(owner.token, 'Proyecto ajeno');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: otherEmail });
    const task = await createTask(owner.token, project.id, { title: 'Tarea compartida' });
    const comment = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(other.token))
      .send({ body: 'Comentario de other' });

    const res = await request(app)
      .delete(`/api/comments/${comment.body.id}`)
      .set(auth(owner.token));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    const list = await request(app).get(`/api/tasks/${task.id}/comments`).set(auth(owner.token));
    expect(list.body).toHaveLength(1);
  });

  it('puedo eliminar mi propio comentario (US-08 CA6)', async () => {
    const { token } = await registerUser(`com-ca6-self-${Date.now()}@test.com`);
    const project = await createProject(token, 'Proyecto propio');
    const task = await createTask(token, project.id, { title: 'Tarea propia' });
    const comment = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'MÃ­o' });

    const res = await request(app)
      .delete(`/api/comments/${comment.body.id}`)
      .set(auth(token));

    expect(res.status).toBe(204);

    const list = await request(app).get(`/api/tasks/${task.id}/comments`).set(auth(token));
    expect(list.body).toEqual([]);
  });

  it('eliminar un comentario inexistente devuelve 404 (US-08)', async () => {
    const { token } = await registerUser(`com404-${Date.now()}@test.com`);

    const res = await request(app)
      .delete('/api/comments/comment_9999999999')
      .set(auth(token));

    expect(res.status).toBe(404);
  });
});
