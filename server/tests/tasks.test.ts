import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';

describe('Tareas', () => {
  it('crea una tarea en un proyecto', async () => {
    const { token } = await registerUser('task1@test.com');
    const project = await createProject(token, 'Proyecto de tareas');

    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send({ title: 'Implementar login', priority: 'HIGH' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('TODO');
  });

  it('avanza una tarea de TODO a IN_PROGRESS', async () => {
    const { token, id } = await registerUser('task2@test.com');
    const project = await createProject(token, 'Proyecto de estados');
    const task = await createTask(token, project.id, { title: 'Tarea con estados', assigneeId: id });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('filtra las tareas por estado', async () => {
    const { token } = await registerUser('task3@test.com');
    const project = await createProject(token, 'Proyecto de filtros');
    await createTask(token, project.id, { title: 'Primera tarea' });
    await createTask(token, project.id, { title: 'Segunda tarea' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?status=TODO`)
      .set(auth(token));

    expect(res.body.items).toHaveLength(2);
  });

  it('obtiene una tarea por id', async () => {
    const { token } = await registerUser('task4@test.com');
    const project = await createProject(token, 'Proyecto get');
    const task = await createTask(token, project.id, { title: 'Tarea a obtener' });

    const res = await request(app).get(`/api/tasks/${task.id}`).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(task.id);
    expect(res.body.title).toBe('Tarea a obtener');
  });

  it('rechaza obtener tarea con id inválido', async () => {
    const { token } = await registerUser('task5@test.com');

    const res = await request(app).get('/api/tasks/invalid').set(auth(token));

    expect(res.status).toBe(404);
  });

  it('rechaza obtener tarea inexistente', async () => {
    const { token } = await registerUser('task6@test.com');

    const res = await request(app).get('/api/tasks/task_9999999999').set(auth(token));

    expect(res.status).toBe(404);
  });

  it('crea una tarea con todos sus campos', async () => {
    const owner = await registerUser('task7@test.com');
    const assignee = await registerUser('task7-assignee@test.com');
    const project = await createProject(owner.token, 'Proyecto completo');

    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'task7-assignee@test.com' });

    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(owner.token))
      .send({
        title: 'Tarea completa',
        description: 'Descripción',
        priority: 'CRITICAL',
        assigneeId: assignee.id,
        dueDate: '2030-05-19',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      description: 'Descripción',
      priority: 'CRITICAL',
      assigneeId: assignee.id,
      dueDate: expect.stringMatching(/^2030-05-/),
    });
  });

  it.each([
    { body: { title: 'ab' }, label: 'short title' },
    { body: { title: 'Valid title', priority: 'INVALID' }, label: 'invalid priority' },
    { body: { title: 'Valid title', dueDate: 'tomorrow' }, label: 'invalid due date' },
    { body: { title: 'Valid title', assigneeId: 'user-invalid' }, label: 'invalid assignee' },
  ])('rejects invalid task input: $label', async ({ body }) => {
    const { token } = await registerUser(`task-invalid-${Date.now()}-${Math.random()}@test.com`);
    const project = await createProject(token, 'Proyecto inválido');

    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send(body);

    expect(res.status).toBe(400);
  });

  it('rejects assigning a non-member', async () => {
    const owner = await registerUser('task8@test.com');
    const other = await registerUser('task8-other@test.com');
    const project = await createProject(owner.token, 'Proyecto de asignación');

    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(owner.token))
      .send({ title: 'Tarea sin miembro', assigneeId: other.id });

    expect(res.status).toBe(400);
  });

  it('updates task fields and clears the assignee', async () => {
    const owner = await registerUser('task9@test.com');
    const project = await createProject(owner.token, 'Proyecto actualización');
    const task = await createTask(owner.token, project.id, { title: 'Tarea editable' });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(owner.token))
      .send({
        title: 'Tarea actualizada',
        description: null,
        priority: 'LOW',
        dueDate: null,
        assigneeId: null,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Tarea actualizada',
      description: null,
      priority: 'LOW',
      dueDate: null,
      assigneeId: null,
    });
  });

  it('returns unchanged task when update has no fields', async () => {
    const { token } = await registerUser('task10@test.com');
    const project = await createProject(token, 'Proyecto sin cambios');
    const task = await createTask(token, project.id, { title: 'Sin cambios' });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(task.id);
  });

  it('allows the owner to transition a task and records history', async () => {
    const { token } = await registerUser('task11@test.com');
    const project = await createProject(token, 'Proyecto historial');
    const task = await createTask(token, project.id, { title: 'Tarea con historial' });

    const update = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'IN_PROGRESS' });
    const history = await request(app).get(`/api/tasks/${task.id}/history`).set(auth(token));

    expect(update.status).toBe(200);
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(2);
    expect(history.body[1]).toMatchObject({ fromStatus: 'TODO', toStatus: 'IN_PROGRESS' });
  });

  it('rejects an invalid status transition', async () => {
    const { token } = await registerUser('task12@test.com');
    const project = await createProject(token, 'Proyecto transición');
    const task = await createTask(token, project.id, { title: 'Tarea terminada' });

    await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'IN_PROGRESS' });
    await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'DONE' });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'TODO' });

    expect(res.status).toBe(422);
  });

  it('rejects status change by a regular project member', async () => {
    const owner = await registerUser('task13-owner@test.com');
    const member = await registerUser('task13-member@test.com');
    const project = await createProject(owner.token, 'Proyecto miembros');
    const task = await createTask(owner.token, project.id, { title: 'Tarea protegida' });

    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'task13-member@test.com' });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(member.token))
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(403);
  });

  it('adds, lists, and removes tags', async () => {
    const { token } = await registerUser('task14@test.com');
    const project = await createProject(token, 'Proyecto etiquetas');
    const task = await createTask(token, project.id, { title: 'Tarea etiquetada' });

    const added = await request(app)
      .post(`/api/tasks/${task.id}/tags`)
      .set(auth(token))
      .send({ name: ' frontend ' });
    const fetched = await request(app).get(`/api/tasks/${task.id}`).set(auth(token));
    const removed = await request(app)
      .delete(`/api/tasks/${task.id}/tags/${added.body.id}`)
      .set(auth(token));

    expect(added.status).toBe(201);
    expect(added.body.name).toBe('frontend');
    expect(fetched.body.tags).toEqual([{ id: added.body.id, name: 'frontend' }]);
    expect(removed.status).toBe(204);
  });

  it('rejects invalid and excessive tags', async () => {
    const { token } = await registerUser('task15@test.com');
    const project = await createProject(token, 'Proyecto muchas etiquetas');
    const task = await createTask(token, project.id, { title: 'Tarea con etiquetas' });

    const invalid = await request(app)
      .post(`/api/tasks/${task.id}/tags`)
      .set(auth(token))
      .send({ name: '' });
    expect(invalid.status).toBe(400);

    for (let index = 0; index < 10; index += 1) {
      await request(app)
        .post(`/api/tasks/${task.id}/tags`)
        .set(auth(token))
        .send({ name: `tag-${index}` });
    }
    const excessive = await request(app)
      .post(`/api/tasks/${task.id}/tags`)
      .set(auth(token))
      .send({ name: 'eleventh' });

    expect(excessive.status).toBe(400);
  });

  it('rejects removing a tag that is not attached', async () => {
    const { token } = await registerUser('task16@test.com');
    const project = await createProject(token, 'Proyecto sin etiqueta');
    const task = await createTask(token, project.id, { title: 'Tarea sin etiqueta' });

    const res = await request(app)
      .delete(`/api/tasks/${task.id}/tags/tag-9999999999`)
      .set(auth(token));

    expect(res.status).toBe(404);
  });

  it('filters tasks by priority, assignee, search, limit, and offset', async () => {
    const owner = await registerUser('task17@test.com');
    const project = await createProject(owner.token, 'Proyecto filtros avanzados');
    await createTask(owner.token, project.id, {
      title: 'Buscar esta tarea',
      description: 'Texto localizado',
      priority: 'HIGH',
    });
    await createTask(owner.token, project.id, { title: 'Otra tarea', priority: 'LOW' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks`)
      .query({ priority: 'HIGH', search: 'localizado', limit: 1, offset: 2 })
      .set(auth(owner.token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, limit: 1, offset: 2 });
  });

  it('deletes a task and rejects invalid task routes', async () => {
    const { token } = await registerUser('task18@test.com');
    const project = await createProject(token, 'Proyecto eliminar tarea');
    const task = await createTask(token, project.id, { title: 'Tarea eliminable' });

    const deleted = await request(app).delete(`/api/tasks/${task.id}`).set(auth(token));
    const invalid = await request(app).delete('/api/tasks/invalid').set(auth(token));
    const invalidProject = await request(app)
      .get('/api/projects/invalid/tasks')
      .set(auth(token));

    expect(deleted.status).toBe(204);
    expect(invalid.status).toBe(404);
    expect(invalidProject.status).toBe(404);
  });

  it('supports each project task filter', async () => {
    const owner = await registerUser('task19-owner@test.com');
    const assignee = await registerUser('task19-assignee@test.com');
    const project = await createProject(owner.token, 'Proyecto filtros individuales');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'task19-assignee@test.com' });
    await createTask(owner.token, project.id, {
      title: 'Tarea filtrable',
      priority: 'HIGH',
      assigneeId: assignee.id,
    });

    const byPriority = await request(app)
      .get(`/api/projects/${project.id}/tasks`)
      .query({ priority: 'HIGH' })
      .set(auth(owner.token));
    const byAssignee = await request(app)
      .get(`/api/projects/${project.id}/tasks`)
      .query({ assignedTo: assignee.id })
      .set(auth(owner.token));
    const invalidAssignee = await request(app)
      .get(`/api/projects/${project.id}/tasks`)
      .query({ assignedTo: 'invalid' })
      .set(auth(owner.token));

    expect(byPriority.body.items).toHaveLength(1);
    expect(byAssignee.body.items).toHaveLength(1);
    expect(invalidAssignee.status).toBe(200);
  });

  it('covers task validation and controller not-found paths', async () => {
    const { token } = await registerUser('task20@test.com');
    const project = await createProject(token, 'Proyecto errores');
    const task = await createTask(token, project.id, { title: 'Tarea errores' });

    const invalidUpdate = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ dueDate: 'invalid' });
    const invalidAssignee = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ assigneeId: 'user-invalid' });
    const invalidTaskId = await request(app)
      .patch('/api/tasks/invalid')
      .set(auth(token))
      .send({ title: 'Invalid id' });
    const missingTask = await request(app)
      .patch('/api/tasks/task-9999999999')
      .set(auth(token))
      .send({ title: 'Missing' });
    const invalidTag = await request(app)
      .post('/api/tasks/invalid/tags')
      .set(auth(token))
      .send({ name: 'tag' });
    const invalidRemoveTag = await request(app)
      .delete('/api/tasks/invalid/tags/invalid')
      .set(auth(token));
    const invalidHistory = await request(app)
      .get('/api/tasks/invalid/history')
      .set(auth(token));

    expect(invalidUpdate.status).toBe(400);
    expect(invalidAssignee.status).toBe(400);
    expect(invalidTaskId.status).toBe(404);
    expect(missingTask.status).toBe(404);
    expect(invalidTag.status).toBe(404);
    expect(invalidRemoveTag.status).toBe(404);
    expect(invalidHistory.status).toBe(404);
  });

  it('updates an assignee to another project member', async () => {
    const owner = await registerUser('task22-owner@test.com');
    const member = await registerUser('task22-member@test.com');
    const project = await createProject(owner.token, 'Proyecto reasignación');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'task22-member@test.com' });
    const task = await createTask(owner.token, project.id, { title: 'Tarea reasignable' });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(owner.token))
      .send({ assigneeId: member.id });

    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBe(member.id);
  });

  it('allows an assignee to transition and keeps the same status', async () => {
    const assignee = await registerUser('task21-assignee@test.com');
    const owner = await registerUser('task21-owner@test.com');
    const project = await createProject(owner.token, 'Proyecto asignado');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'task21-assignee@test.com' });
    const task = await createTask(owner.token, project.id, {
      title: 'Tarea asignada',
      assigneeId: assignee.id,
    });

    const same = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(assignee.token))
      .send({ status: 'TODO' });
    const moved = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(assignee.token))
      .send({ status: 'IN_PROGRESS' });

    expect(same.status).toBe(200);
    expect(moved.status).toBe(200);
  });
});
