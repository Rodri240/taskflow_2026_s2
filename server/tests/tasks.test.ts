import request from 'supertest';
import { addMember, app, auth, createProject, createTask, registerUser } from './helpers';

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
    const task = (
      await request(app)
        .post(`/api/projects/${project.id}/tasks`)
        .set(auth(token))
        .send({ title: 'Tarea con estados', assigneeId: id })
    ).body;

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
    await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send({ title: 'Primera tarea' });
    await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send({ title: 'Segunda tarea' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?status=TODO`)
      .set(auth(token));

    expect(res.body.items).toHaveLength(2);
  });

  describe('detalle', () => {
    it('devuelve la tarea con sus etiquetas', async () => {
      const { token } = await registerUser('task-detail@test.com');
      const project = await createProject(token, 'Proyecto de detalle');
      const task = await createTask(token, project.id, { title: 'Tarea detallada' });
      await request(app)
        .post(`/api/tasks/${task.id}/tags`)
        .set(auth(token))
        .send({ name: 'backend' });

      const res = await request(app).get(`/api/tasks/${task.id}`).set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.tags).toHaveLength(1);
      expect(res.body.tags[0].name).toBe('backend');
    });

    it('devuelve 404 para una tarea inexistente', async () => {
      const { token } = await registerUser('task-detail-missing@test.com');

      const res = await request(app).get('/api/tasks/task-99999').set(auth(token));

      expect(res.status).toBe(404);
    });

    it('devuelve 404 para un id de tarea inválido', async () => {
      const { token } = await registerUser('task-detail-badid@test.com');

      const res = await request(app).get('/api/tasks/no-es-un-id').set(auth(token));

      expect(res.status).toBe(404);
    });
  });

  describe('actualización de campos', () => {
    it('actualiza título, descripción, prioridad y vencimiento', async () => {
      const { token } = await registerUser('task-upd-fields@test.com');
      const project = await createProject(token, 'Proyecto de actualización');
      const task = await createTask(token, project.id, { title: 'Título original' });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({
          title: 'Título actualizado',
          description: 'Descripción nueva',
          priority: 'LOW',
          dueDate: '2026-12-15',
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Título actualizado');
      expect(res.body.description).toBe('Descripción nueva');
      expect(res.body.priority).toBe('LOW');
      expect(res.body.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('permite borrar la descripción con null', async () => {
      const { token } = await registerUser('task-upd-null@test.com');
      const project = await createProject(token, 'Proyecto de actualización');
      const task = await createTask(token, project.id, {
        title: 'Tarea con descripción',
        description: 'Texto',
      });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(res.body.description).toBeNull();
    });

    it('rechaza una fecha de vencimiento inválida', async () => {
      const { token } = await registerUser('task-upd-baddate@test.com');
      const project = await createProject(token, 'Proyecto de actualización');
      const task = await createTask(token, project.id, { title: 'Tarea con fecha' });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({ dueDate: '15/12/2026' });

      expect(res.status).toBe(400);
    });

    it('asigna y desasigna un miembro del proyecto', async () => {
      const owner = await registerUser('task-upd-owner@test.com');
      const member = await registerUser('task-upd-member@test.com');
      const project = await createProject(owner.token, 'Proyecto de asignaciones');
      await addMember(owner.token, project.id, 'task-upd-member@test.com');
      const task = await createTask(owner.token, project.id, { title: 'Tarea asignable' });

      const assigned = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(owner.token))
        .send({ assigneeId: member.id });

      expect(assigned.status).toBe(200);
      expect(assigned.body.assigneeId).toBe(member.id);

      const cleared = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(owner.token))
        .send({ assigneeId: null });

      expect(cleared.status).toBe(200);
      expect(cleared.body.assigneeId).toBeNull();
    });

    it('rechaza un assignee con id inválido', async () => {
      const { token } = await registerUser('task-upd-badassignee@test.com');
      const project = await createProject(token, 'Proyecto de asignaciones');
      const task = await createTask(token, project.id, { title: 'Tarea asignable' });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({ assigneeId: 'no-es-un-id' });

      expect(res.status).toBe(400);
    });

    it('rechaza asignar a alguien que no es miembro', async () => {
      const { token } = await registerUser('task-upd-owner2@test.com');
      const stranger = await registerUser('task-upd-stranger@test.com');
      const project = await createProject(token, 'Proyecto de asignaciones');
      const task = await createTask(token, project.id, { title: 'Tarea asignable' });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({ assigneeId: stranger.id });

      expect(res.status).toBe(400);
    });

    it('devuelve la tarea sin cambios si el cuerpo está vacío', async () => {
      const { token } = await registerUser('task-upd-empty@test.com');
      const project = await createProject(token, 'Proyecto de actualización');
      const task = await createTask(token, project.id, { title: 'Tarea intacta' });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Tarea intacta');
    });

    it('devuelve 404 al actualizar una tarea inexistente', async () => {
      const { token } = await registerUser('task-upd-missing@test.com');

      const res = await request(app)
        .patch('/api/tasks/task-99999')
        .set(auth(token))
        .send({ title: 'No existe' });

      expect(res.status).toBe(404);
    });
  });

  describe('autorización de estado', () => {
    it('permite al dueño cambiar el estado de una tarea ajena', async () => {
      const owner = await registerUser('task-status-owner@test.com');
      const member = await registerUser('task-status-member@test.com');
      const project = await createProject(owner.token, 'Proyecto de estados');
      await addMember(owner.token, project.id, 'task-status-member@test.com');
      const task = await createTask(owner.token, project.id, {
        title: 'Tarea del miembro',
        assigneeId: member.id,
      });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(owner.token))
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('prohíbe a un miembro que no es assignee cambiar el estado', async () => {
      const owner = await registerUser('task-status-owner2@test.com');
      const member = await registerUser('task-status-member2@test.com');
      const project = await createProject(owner.token, 'Proyecto de estados');
      await addMember(owner.token, project.id, 'task-status-member2@test.com');
      const task = await createTask(owner.token, project.id, {
        title: 'Tarea del dueño',
        assigneeId: owner.id,
      });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(member.token))
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
    });

    it('rechaza una transición inválida', async () => {
      const { token } = await registerUser('task-status-invalid@test.com');
      const project = await createProject(token, 'Proyecto de estados');
      const task = await createTask(token, project.id, { title: 'Tarea terminada' });

      const done = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({ status: 'DONE' });
      expect(done.status).toBe(200);

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({ status: 'TODO' });

      expect(res.status).toBe(422);
    });

    it('ignora el cambio cuando el estado es el mismo', async () => {
      const { token } = await registerUser('task-status-same@test.com');
      const project = await createProject(token, 'Proyecto de estados');
      const task = await createTask(token, project.id, { title: 'Tarea en TODO' });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({ status: 'TODO' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('TODO');
    });
  });

  describe('eliminación', () => {
    it('elimina una tarea', async () => {
      const { token } = await registerUser('task-del-ok@test.com');
      const project = await createProject(token, 'Proyecto de borrado');
      const task = await createTask(token, project.id, { title: 'Tarea a eliminar' });

      const res = await request(app)
        .delete(`/api/tasks/${task.id}`)
        .set(auth(token));

      expect(res.status).toBe(204);

      const detail = await request(app).get(`/api/tasks/${task.id}`).set(auth(token));
      expect(detail.status).toBe(404);
    });

    it('devuelve 404 al eliminar una tarea inexistente', async () => {
      const { token } = await registerUser('task-del-missing@test.com');

      const res = await request(app)
        .delete('/api/tasks/task-99999')
        .set(auth(token));

      expect(res.status).toBe(404);
    });
  });

  describe('etiquetas', () => {
    it('agrega una etiqueta y reutiliza las existentes', async () => {
      const { token } = await registerUser('task-tag-add@test.com');
      const project = await createProject(token, 'Proyecto de etiquetas');
      const first = await createTask(token, project.id, { title: 'Primera tarea' });
      const second = await createTask(token, project.id, { title: 'Segunda tarea' });

      const tag1 = await request(app)
        .post(`/api/tasks/${first.id}/tags`)
        .set(auth(token))
        .send({ name: 'backend' });
      const tag2 = await request(app)
        .post(`/api/tasks/${second.id}/tags`)
        .set(auth(token))
        .send({ name: 'backend' });

      expect(tag1.status).toBe(201);
      expect(tag2.status).toBe(201);
      expect(tag2.body.id).toBe(tag1.body.id);
    });

    it('rechaza etiquetas con nombre inválido', async () => {
      const { token } = await registerUser('task-tag-invalid@test.com');
      const project = await createProject(token, 'Proyecto de etiquetas');
      const task = await createTask(token, project.id, { title: 'Tarea con etiquetas' });

      const empty = await request(app)
        .post(`/api/tasks/${task.id}/tags`)
        .set(auth(token))
        .send({ name: '   ' });
      const tooLong = await request(app)
        .post(`/api/tasks/${task.id}/tags`)
        .set(auth(token))
        .send({ name: 'x'.repeat(31) });
      const missing = await request(app)
        .post(`/api/tasks/${task.id}/tags`)
        .set(auth(token))
        .send({});

      expect(empty.status).toBe(400);
      expect(tooLong.status).toBe(400);
      expect(missing.status).toBe(400);
    });

    it('rechaza más de 10 etiquetas por tarea', async () => {
      const { token } = await registerUser('task-tag-limit@test.com');
      const project = await createProject(token, 'Proyecto de etiquetas');
      const task = await createTask(token, project.id, { title: 'Tarea con muchas etiquetas' });

      for (let i = 0; i < 10; i += 1) {
        const res = await request(app)
          .post(`/api/tasks/${task.id}/tags`)
          .set(auth(token))
          .send({ name: `etiqueta-${i}` });
        expect(res.status).toBe(201);
      }

      const res = await request(app)
        .post(`/api/tasks/${task.id}/tags`)
        .set(auth(token))
        .send({ name: 'etiqueta-10' });

      expect(res.status).toBe(400);
    });

    it('quita una etiqueta de la tarea', async () => {
      const { token } = await registerUser('task-tag-remove@test.com');
      const project = await createProject(token, 'Proyecto de etiquetas');
      const task = await createTask(token, project.id, { title: 'Tarea con etiquetas' });
      const tag = (
        await request(app)
          .post(`/api/tasks/${task.id}/tags`)
          .set(auth(token))
          .send({ name: 'frontend' })
      ).body;

      const res = await request(app)
        .delete(`/api/tasks/${task.id}/tags/${tag.id}`)
        .set(auth(token));

      expect(res.status).toBe(204);

      const detail = await request(app).get(`/api/tasks/${task.id}`).set(auth(token));
      expect(detail.body.tags).toHaveLength(0);
    });

    it('devuelve 404 si la tarea no tiene esa etiqueta', async () => {
      const { token } = await registerUser('task-tag-missing@test.com');
      const project = await createProject(token, 'Proyecto de etiquetas');
      const task = await createTask(token, project.id, { title: 'Tarea sin etiquetas' });

      const res = await request(app)
        .delete(`/api/tasks/${task.id}/tags/tag-99999`)
        .set(auth(token));

      expect(res.status).toBe(404);
    });
  });

  describe('historial', () => {
    it('devuelve el historial de estados', async () => {
      const { token } = await registerUser('task-history@test.com');
      const project = await createProject(token, 'Proyecto con historial');
      const task = await createTask(token, project.id, { title: 'Tarea con historial' });
      await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({ status: 'IN_PROGRESS' });

      const res = await request(app)
        .get(`/api/tasks/${task.id}/history`)
        .set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].taskId).toBe(task.id);
      expect(res.body[1].fromStatus).toBe('TODO');
      expect(res.body[1].toStatus).toBe('IN_PROGRESS');
    });

    it('devuelve 404 para el historial de una tarea inexistente', async () => {
      const { token } = await registerUser('task-history-missing@test.com');

      const res = await request(app)
        .get('/api/tasks/task-99999/history')
        .set(auth(token));

      expect(res.status).toBe(404);
    });
  });

  describe('listado y filtros', () => {
    it('filtra por prioridad, assignee y texto', async () => {
      const { token, id } = await registerUser('task-list@test.com');
      const project = await createProject(token, 'Proyecto de listado');
      await createTask(token, project.id, {
        title: 'Implementar login',
        priority: 'HIGH',
        assigneeId: id,
      });
      await createTask(token, project.id, {
        title: 'Configurar deploy',
        priority: 'LOW',
      });

      const byPriority = await request(app)
        .get(`/api/projects/${project.id}/tasks?priority=HIGH`)
        .set(auth(token));
      const byAssignee = await request(app)
        .get(`/api/projects/${project.id}/tasks?assignedTo=${id}`)
        .set(auth(token));
      const bySearch = await request(app)
        .get(`/api/projects/${project.id}/tasks?search=deploy`)
        .set(auth(token));
      const combined = await request(app)
        .get(`/api/projects/${project.id}/tasks?status=TODO&priority=HIGH`)
        .set(auth(token));

      expect(byPriority.body.items).toHaveLength(1);
      expect(byPriority.body.items[0].title).toBe('Implementar login');
      expect(byAssignee.body.items).toHaveLength(1);
      expect(bySearch.body.items).toHaveLength(1);
      expect(bySearch.body.items[0].title).toBe('Configurar deploy');
      expect(combined.body.items).toHaveLength(1);
    });

    it('trata la búsqueda como texto y no como SQL', async () => {
      const { token } = await registerUser('task-list-inject@test.com');
      const project = await createProject(token, 'Proyecto de listado');
      await createTask(token, project.id, { title: 'Tarea normal' });

      const res = await request(app)
        .get(`/api/projects/${project.id}/tasks?search=${encodeURIComponent("' OR 1=1 --")}`)
        .set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('aplica limit, offset y el máximo de resultados', async () => {
      const { token } = await registerUser('task-list-page@test.com');
      const project = await createProject(token, 'Proyecto paginado');
      for (let i = 0; i < 3; i += 1) {
        await createTask(token, project.id, { title: `Tarea ${i}` });
      }

      const firstPage = await request(app)
        .get(`/api/projects/${project.id}/tasks?limit=2`)
        .set(auth(token));
      const secondPage = await request(app)
        .get(`/api/projects/${project.id}/tasks?limit=2&offset=2`)
        .set(auth(token));
      const capped = await request(app)
        .get(`/api/projects/${project.id}/tasks?limit=999`)
        .set(auth(token));

      expect(firstPage.body.items).toHaveLength(2);
      expect(firstPage.body.limit).toBe(2);
      expect(secondPage.body.items).toHaveLength(1);
      expect(secondPage.body.offset).toBe(2);
      expect(capped.body.limit).toBe(100);
    });

    it('rechaza un id de proyecto inválido', async () => {
      const { token } = await registerUser('task-list-badid@test.com');

      const res = await request(app)
        .get('/api/projects/no-es-un-id/tasks')
        .set(auth(token));

      expect(res.status).toBe(404);
    });

    it('prohíbe listar tareas a un usuario ajeno', async () => {
      const owner = await registerUser('task-list-owner@test.com');
      const stranger = await registerUser('task-list-stranger@test.com');
      const project = await createProject(owner.token, 'Proyecto privado');

      const res = await request(app)
        .get(`/api/projects/${project.id}/tasks`)
        .set(auth(stranger.token));

      expect(res.status).toBe(403);
    });
  });

  describe('validación al crear', () => {
    it('rechaza una tarea sin título', async () => {
      const { token } = await registerUser('task-new-notitle@test.com');
      const project = await createProject(token, 'Proyecto de validación');

      const res = await request(app)
        .post(`/api/projects/${project.id}/tasks`)
        .set(auth(token))
        .send({ priority: 'HIGH' });

      expect(res.status).toBe(400);
    });

    it('rechaza un título demasiado corto', async () => {
      const { token } = await registerUser('task-new-short@test.com');
      const project = await createProject(token, 'Proyecto de validación');

      const res = await request(app)
        .post(`/api/projects/${project.id}/tasks`)
        .set(auth(token))
        .send({ title: 'ab' });

      expect(res.status).toBe(400);
    });

    it('rechaza una prioridad inválida', async () => {
      const { token } = await registerUser('task-new-priority@test.com');
      const project = await createProject(token, 'Proyecto de validación');

      const res = await request(app)
        .post(`/api/projects/${project.id}/tasks`)
        .set(auth(token))
        .send({ title: 'Tarea válida', priority: 'URGENT' });

      expect(res.status).toBe(400);
    });

    it('rechaza una fecha de vencimiento inválida', async () => {
      const { token } = await registerUser('task-new-date@test.com');
      const project = await createProject(token, 'Proyecto de validación');

      const res = await request(app)
        .post(`/api/projects/${project.id}/tasks`)
        .set(auth(token))
        .send({ title: 'Tarea válida', dueDate: 'mañana' });

      expect(res.status).toBe(400);
    });

    it('rechaza un assignee con id inválido', async () => {
      const { token } = await registerUser('task-new-badassignee@test.com');
      const project = await createProject(token, 'Proyecto de validación');

      const res = await request(app)
        .post(`/api/projects/${project.id}/tasks`)
        .set(auth(token))
        .send({ title: 'Tarea válida', assigneeId: 'no-es-un-id' });

      expect(res.status).toBe(400);
    });

    it('rechaza un assignee que no es miembro', async () => {
      const { token } = await registerUser('task-new-owner@test.com');
      const stranger = await registerUser('task-new-stranger@test.com');
      const project = await createProject(token, 'Proyecto de validación');

      const res = await request(app)
        .post(`/api/projects/${project.id}/tasks`)
        .set(auth(token))
        .send({ title: 'Tarea válida', assigneeId: stranger.id });

      expect(res.status).toBe(400);
    });

    it('crea una tarea mínima con assignee y fecha nulos', async () => {
      const { token } = await registerUser('task-new-minimal@test.com');
      const project = await createProject(token, 'Proyecto de validación');

      const res = await request(app)
        .post(`/api/projects/${project.id}/tasks`)
        .set(auth(token))
        .send({ title: 'Tarea mínima', description: null, dueDate: null });

      expect(res.status).toBe(201);
      expect(res.body.assigneeId).toBeNull();
      expect(res.body.dueDate).toBeNull();
      expect(res.body.description).toBeNull();
    });
  });
});
