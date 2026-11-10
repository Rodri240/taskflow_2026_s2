import request from 'supertest';
import { addMember, app, auth, createProject, createTask, registerUser } from './helpers';

describe('Proyectos', () => {
  it('crea un proyecto', async () => {
    const { token } = await registerUser('proj1@test.com');

    const res = await request(app)
      .post('/api/projects')
      .set(auth(token))
      .send({ name: 'Mi Proyecto', description: 'Descripción' });

    expect(res.status).toBe(201);
  });

  it('lista los proyectos del usuario', async () => {
    const { token } = await registerUser('proj2@test.com');
    await request(app).post('/api/projects').set(auth(token)).send({ name: 'Proyecto A' });
    await request(app).post('/api/projects').set(auth(token)).send({ name: 'Proyecto B' });

    const res = await request(app).get('/api/projects').set(auth(token));

    expect(res.body).toHaveLength(2);
  });

  it('rechaza crear un proyecto sin autenticación', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'Sin token' });

    expect(res.status).toBe(401);
  });

  describe('validación al crear', () => {
    it('rechaza un nombre de menos de 3 caracteres', async () => {
      const { token } = await registerUser('proj-short@test.com');

      const res = await request(app)
        .post('/api/projects')
        .set(auth(token))
        .send({ name: 'ab' });

      expect(res.status).toBe(400);
    });

    it('rechaza un nombre de más de 100 caracteres', async () => {
      const { token } = await registerUser('proj-long@test.com');

      const res = await request(app)
        .post('/api/projects')
        .set(auth(token))
        .send({ name: 'x'.repeat(101) });

      expect(res.status).toBe(400);
    });

    it('rechaza un nombre duplicado del mismo dueño', async () => {
      const { token } = await registerUser('proj-dup@test.com');
      await createProject(token, 'Proyecto repetido');

      const res = await request(app)
        .post('/api/projects')
        .set(auth(token))
        .send({ name: 'Proyecto repetido' });

      expect(res.status).toBe(409);
    });

    it('rechaza una descripción que no es texto', async () => {
      const { token } = await registerUser('proj-desc@test.com');

      const res = await request(app)
        .post('/api/projects')
        .set(auth(token))
        .send({ name: 'Proyecto válido', description: 123 });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/projects/:projectId', () => {
    it('actualiza nombre y descripción del dueño', async () => {
      const { token } = await registerUser('proj-upd-ok@test.com');
      const project = await createProject(token, 'Nombre original');

      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set(auth(token))
        .send({ name: 'Nombre nuevo', description: 'Descripción nueva' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Nombre nuevo');
      expect(res.body.description).toBe('Descripción nueva');
    });

    it('permite borrar la descripción con null', async () => {
      const { token } = await registerUser('proj-upd-null@test.com');
      const project = await createProject(token, 'Proyecto con descripción');

      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set(auth(token))
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(res.body.description).toBeNull();
    });

    it('rechaza un id de proyecto inválido', async () => {
      const { token } = await registerUser('proj-upd-badid@test.com');

      const res = await request(app)
        .patch('/api/projects/no-es-un-id')
        .set(auth(token))
        .send({ name: 'Nombre nuevo' });

      expect(res.status).toBe(404);
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const { token } = await registerUser('proj-upd-missing@test.com');

      const res = await request(app)
        .patch('/api/projects/proj-99999')
        .set(auth(token))
        .send({ name: 'Nombre nuevo' });

      expect(res.status).toBe(404);
    });

    it('prohíbe editar a un miembro que no es dueño', async () => {
      const owner = await registerUser('proj-upd-owner@test.com');
      const member = await registerUser('proj-upd-member@test.com');
      const project = await createProject(owner.token, 'Proyecto compartido');
      await addMember(owner.token, project.id, 'proj-upd-member@test.com');

      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set(auth(member.token))
        .send({ name: 'Nombre ajeno' });

      expect(res.status).toBe(403);
    });

    it('devuelve 404 a un usuario que no es miembro', async () => {
      const owner = await registerUser('proj-upd-owner2@test.com');
      const stranger = await registerUser('proj-upd-stranger@test.com');
      const project = await createProject(owner.token, 'Proyecto privado');

      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set(auth(stranger.token))
        .send({ name: 'Nombre ajeno' });

      expect(res.status).toBe(404);
    });

    it('rechaza un nombre demasiado corto', async () => {
      const { token } = await registerUser('proj-upd-short@test.com');
      const project = await createProject(token, 'Proyecto válido');

      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set(auth(token))
        .send({ name: 'ab' });

      expect(res.status).toBe(400);
    });

    it('rechaza un nombre duplicado', async () => {
      const { token } = await registerUser('proj-upd-dup@test.com');
      await createProject(token, 'Primer proyecto');
      const second = await createProject(token, 'Segundo proyecto');

      const res = await request(app)
        .patch(`/api/projects/${second.id}`)
        .set(auth(token))
        .send({ name: 'Primer proyecto' });

      expect(res.status).toBe(409);
    });

    it('rechaza una descripción que no es texto', async () => {
      const { token } = await registerUser('proj-upd-desc@test.com');
      const project = await createProject(token, 'Proyecto con descripción');

      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set(auth(token))
        .send({ description: 42 });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:projectId', () => {
    it('elimina el proyecto del dueño', async () => {
      const { token } = await registerUser('proj-del-ok@test.com');
      const project = await createProject(token, 'Proyecto a eliminar');

      const res = await request(app)
        .delete(`/api/projects/${project.id}`)
        .set(auth(token));

      expect(res.status).toBe(204);

      const list = await request(app).get('/api/projects').set(auth(token));
      expect(list.body).toHaveLength(0);
    });

    it('prohíbe eliminar a un miembro que no es dueño', async () => {
      const owner = await registerUser('proj-del-owner@test.com');
      const member = await registerUser('proj-del-member@test.com');
      const project = await createProject(owner.token, 'Proyecto compartido');
      await addMember(owner.token, project.id, 'proj-del-member@test.com');

      const res = await request(app)
        .delete(`/api/projects/${project.id}`)
        .set(auth(member.token));

      expect(res.status).toBe(403);
    });

    it('devuelve 404 a un usuario que no es miembro', async () => {
      const owner = await registerUser('proj-del-owner2@test.com');
      const stranger = await registerUser('proj-del-stranger@test.com');
      const project = await createProject(owner.token, 'Proyecto privado');

      const res = await request(app)
        .delete(`/api/projects/${project.id}`)
        .set(auth(stranger.token));

      expect(res.status).toBe(404);
    });

    it('rechaza un id de proyecto inválido', async () => {
      const { token } = await registerUser('proj-del-badid@test.com');

      const res = await request(app)
        .delete('/api/projects/no-es-un-id')
        .set(auth(token));

      expect(res.status).toBe(404);
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const { token } = await registerUser('proj-del-missing@test.com');

      const res = await request(app)
        .delete('/api/projects/proj-99999')
        .set(auth(token));

      expect(res.status).toBe(404);
    });
  });

  describe('miembros del proyecto', () => {
    it('agrega un miembro por email y normaliza el valor', async () => {
      const owner = await registerUser('proj-add-owner@test.com');
      const member = await registerUser('proj-add-member@test.com');
      const project = await createProject(owner.token, 'Proyecto con miembros');

      const res = await addMember(owner.token, project.id, 'PROJ-ADD-MEMBER@TEST.COM');

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('proj-add-member@test.com');
      expect(res.body.role).toBe('MEMBER');
      expect(res.body.userId).toBe(member.id);
    });

    it('rechaza un email inválido', async () => {
      const { token } = await registerUser('proj-add-bademail@test.com');
      const project = await createProject(token, 'Proyecto con miembros');

      const res = await addMember(token, project.id, 'no-es-un-email');

      expect(res.status).toBe(400);
    });

    it('devuelve 404 si el email no pertenece a ningún usuario', async () => {
      const { token } = await registerUser('proj-add-unknown@test.com');
      const project = await createProject(token, 'Proyecto con miembros');

      const res = await addMember(token, project.id, 'nadie@test.com');

      expect(res.status).toBe(404);
    });

    it('rechaza un miembro duplicado', async () => {
      const { token } = await registerUser('proj-add-dup-owner@test.com');
      await registerUser('proj-add-dup-member@test.com');
      const project = await createProject(token, 'Proyecto con miembros');
      await addMember(token, project.id, 'proj-add-dup-member@test.com');

      const res = await addMember(token, project.id, 'proj-add-dup-member@test.com');

      expect(res.status).toBe(409);
    });

    it('prohíbe agregar miembros a quien no es dueño', async () => {
      const owner = await registerUser('proj-add-nonowner-owner@test.com');
      const member = await registerUser('proj-add-nonowner-member@test.com');
      await registerUser('proj-add-nonowner-third@test.com');
      const project = await createProject(owner.token, 'Proyecto compartido');
      await addMember(owner.token, project.id, 'proj-add-nonowner-member@test.com');

      const res = await addMember(member.token, project.id, 'proj-add-nonowner-third@test.com');

      expect(res.status).toBe(403);
    });

    it('rechaza un id de proyecto inválido al agregar', async () => {
      const { token } = await registerUser('proj-add-badid@test.com');

      const res = await addMember(token, 'no-es-un-id', 'alguien@test.com');

      expect(res.status).toBe(404);
    });

    it('devuelve 404 si el proyecto no existe al agregar', async () => {
      const { token } = await registerUser('proj-add-missing@test.com');

      const res = await addMember(token, 'proj-99999', 'alguien@test.com');

      expect(res.status).toBe(404);
    });

    it('quita un miembro y desasigna sus tareas', async () => {
      const owner = await registerUser('proj-rm-owner@test.com');
      const member = await registerUser('proj-rm-member@test.com');
      const project = await createProject(owner.token, 'Proyecto con miembros');
      await addMember(owner.token, project.id, 'proj-rm-member@test.com');
      const task = await createTask(owner.token, project.id, {
        title: 'Tarea asignada',
        assigneeId: member.id,
      });

      const res = await request(app)
        .delete(`/api/projects/${project.id}/members/${member.id}`)
        .set(auth(owner.token));

      expect(res.status).toBe(204);

      const detail = await request(app).get(`/api/tasks/${task.id}`).set(auth(owner.token));
      expect(detail.body.assigneeId).toBeNull();
    });

    it('prohíbe quitar al dueño del proyecto', async () => {
      const owner = await registerUser('proj-rm-owner2@test.com');
      const project = await createProject(owner.token, 'Proyecto propio');

      const res = await request(app)
        .delete(`/api/projects/${project.id}/members/${owner.id}`)
        .set(auth(owner.token));

      expect(res.status).toBe(400);
    });

    it('devuelve 404 si el usuario no es miembro', async () => {
      const owner = await registerUser('proj-rm-owner3@test.com');
      const stranger = await registerUser('proj-rm-stranger@test.com');
      const project = await createProject(owner.token, 'Proyecto propio');

      const res = await request(app)
        .delete(`/api/projects/${project.id}/members/${stranger.id}`)
        .set(auth(owner.token));

      expect(res.status).toBe(404);
    });

    it('prohíbe quitar miembros a quien no es dueño', async () => {
      const owner = await registerUser('proj-rm-nonowner-owner@test.com');
      const member = await registerUser('proj-rm-nonowner-member@test.com');
      const third = await registerUser('proj-rm-nonowner-third@test.com');
      const project = await createProject(owner.token, 'Proyecto compartido');
      await addMember(owner.token, project.id, 'proj-rm-nonowner-member@test.com');
      await addMember(owner.token, project.id, 'proj-rm-nonowner-third@test.com');

      const res = await request(app)
        .delete(`/api/projects/${project.id}/members/${third.id}`)
        .set(auth(member.token));

      expect(res.status).toBe(403);
    });

    it('rechaza ids inválidos al quitar un miembro', async () => {
      const { token } = await registerUser('proj-rm-badid@test.com');

      const res = await request(app)
        .delete('/api/projects/no-es-un-id/members/user-1')
        .set(auth(token));

      expect(res.status).toBe(404);
    });

    it('devuelve 404 si el proyecto no existe al quitar', async () => {
      const { token } = await registerUser('proj-rm-missing@test.com');

      const res = await request(app)
        .delete('/api/projects/proj-99999/members/user-1')
        .set(auth(token));

      expect(res.status).toBe(404);
    });
  });
});
