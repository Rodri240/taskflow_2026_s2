import request from 'supertest';
import { app, auth, createProject, registerUser } from './helpers';

describe('Proyectos', () => {
  it('crea un proyecto', async () => {
    const { token } = await registerUser('proj1@test.com');

    const res = await request(app)
      .post('/api/projects')
      .set(auth(token))
      .send({ name: 'Mi Proyecto', description: 'Descripción' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Mi Proyecto');
    expect(res.body.description).toBe('Descripción');
  });

  it('rechaza nombre muy largo al crear', async () => {
    const { token } = await registerUser('projname@test.com');
    const longName = 'a'.repeat(101);

    const res = await request(app)
      .post('/api/projects')
      .set(auth(token))
      .send({ name: longName });

    expect(res.status).toBe(400);
  });

  it('rechaza descripción inválida al crear', async () => {
    const { token } = await registerUser('projdesc@test.com');

    const res = await request(app)
      .post('/api/projects')
      .set(auth(token))
      .send({ name: 'Proyecto', description: 123 });

    expect(res.status).toBe(400);
  });

  it('rechaza nombre duplicado para el mismo dueño', async () => {
    const { token } = await registerUser('dup@test.com');
    await createProject(token, 'Duplicado');

    const res = await request(app)
      .post('/api/projects')
      .set(auth(token))
      .send({ name: 'Duplicado' });

    expect(res.status).toBe(409);
  });

  it('lista los proyectos del usuario', async () => {
    const { token } = await registerUser('proj2@test.com');
    await createProject(token, 'Proyecto A');
    await createProject(token, 'Proyecto B');

    const res = await request(app).get('/api/projects').set(auth(token));

    expect(res.body).toHaveLength(2);
  });

  it('lista proyectos donde el usuario es miembro', async () => {
    const owner = await registerUser('ownerlist@test.com');
    const member = await registerUser('memberlist@test.com');

    const project = await createProject(owner.token, 'Proyecto Compartido');

    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'memberlist@test.com' });

    const res = await request(app).get('/api/projects').set(auth(member.token));

    expect(res.body.length).toBeGreaterThan(0);
  });

  it('rechaza crear un proyecto sin autenticación', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'Sin token' });

    expect(res.status).toBe(401);
  });

  it('actualiza un proyecto', async () => {
    const { token } = await registerUser('update@test.com');
    const proj = await createProject(token, 'Original');

    const res = await request(app)
      .patch(`/api/projects/${proj.id}`)
      .set(auth(token))
      .send({ name: 'Actualizado', description: 'Nueva desc' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Actualizado');
  });

  it('rechaza actualizar con id inválido', async () => {
    const { token } = await registerUser('updatebadid@test.com');

    const res = await request(app)
      .patch('/api/projects/invalid')
      .set(auth(token))
      .send({ name: 'Test' });

    expect(res.status).toBe(404);
  });

  it('rechaza actualizar proyecto inexistente', async () => {
    const { token } = await registerUser('updatenotfound@test.com');

    const res = await request(app)
      .patch('/api/projects/proj_9999999999')
      .set(auth(token))
      .send({ name: 'Test' });

    expect(res.status).toBe(404);
  });

  it('rechaza actualizar si no es dueño (es miembro)', async () => {
    const owner = await registerUser('ownerm@test.com');
    const member = await registerUser('memberm@test.com');
    const proj = await createProject(owner.token, 'P');

    await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'memberm@test.com' });

    const res = await request(app)
      .patch(`/api/projects/${proj.id}`)
      .set(auth(member.token))
      .send({ name: 'Hack' });

    expect(res.status).toBe(403);
  });

  it('rechaza actualizar si no es dueño ni miembro', async () => {
    const owner = await registerUser('ownerother@test.com');
    const other = await registerUser('other@test.com');
    const proj = await createProject(owner.token, 'P2');

    const res = await request(app)
      .patch(`/api/projects/${proj.id}`)
      .set(auth(other.token))
      .send({ name: 'Hack' });

    expect(res.status).toBe(404);
  });

  it('rechaza nombre corto al actualizar', async () => {
    const { token } = await registerUser('short@test.com');
    const proj = await createProject(token, 'Bueno');

    const res = await request(app)
      .patch(`/api/projects/${proj.id}`)
      .set(auth(token))
      .send({ name: 'ab' });

    expect(res.status).toBe(400);
  });

  it('rechaza nombre largo al actualizar', async () => {
    const { token } = await registerUser('long@test.com');
    const proj = await createProject(token, 'Bueno');
    const longName = 'a'.repeat(101);

    const res = await request(app)
      .patch(`/api/projects/${proj.id}`)
      .set(auth(token))
      .send({ name: longName });

    expect(res.status).toBe(400);
  });

  it('rechaza nombre duplicado al actualizar', async () => {
    const { token } = await registerUser('dupupdate@test.com');
    await createProject(token, 'Proyecto A');
    const proj = await createProject(token, 'Proyecto B');

    const res = await request(app)
      .patch(`/api/projects/${proj.id}`)
      .set(auth(token))
      .send({ name: 'Proyecto A' });

    expect(res.status).toBe(409);
  });

  it('actualiza solo descripción', async () => {
    const { token } = await registerUser('desc@test.com');
    const proj = await createProject(token, 'Pdesc');

    const res = await request(app)
      .patch(`/api/projects/${proj.id}`)
      .set(auth(token))
      .send({ description: null });

    expect(res.status).toBe(200);
  });

  it('elimina un proyecto', async () => {
    const { token } = await registerUser('del@test.com');
    const proj = await createProject(token, 'AEliminar');

    const res = await request(app).delete(`/api/projects/${proj.id}`).set(auth(token));

    expect(res.status).toBe(204);
  });

  it('rechaza eliminar con id inválido', async () => {
    const { token } = await registerUser('delbad@test.com');

    const res = await request(app).delete('/api/projects/bad').set(auth(token));

    expect(res.status).toBe(404);
  });

  it('rechaza eliminar proyecto inexistente', async () => {
    const { token } = await registerUser('delnotfound@test.com');

    const res = await request(app).delete('/api/projects/proj_9999999999').set(auth(token));

    expect(res.status).toBe(404);
  });

  it('rechaza eliminar si no es dueño', async () => {
    const owner = await registerUser('delowner@test.com');
    const other = await registerUser('delother@test.com');
    const proj = await createProject(owner.token, 'P');

    const res = await request(app).delete(`/api/projects/${proj.id}`).set(auth(other.token));

    expect(res.status).toBe(404);
  });

  it('rechaza eliminar si es miembro pero no dueño', async () => {
    const owner = await registerUser('delownerm@test.com');
    const member = await registerUser('delmember@test.com');
    const proj = await createProject(owner.token, 'P');

    await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'delmember@test.com' });

    const res = await request(app).delete(`/api/projects/${proj.id}`).set(auth(member.token));

    expect(res.status).toBe(403);
  });

  it('agrega un miembro', async () => {
    const owner = await registerUser('addowner@test.com');
    const member = await registerUser('addmember@test.com');
    const proj = await createProject(owner.token, 'P');

    const res = await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'addmember@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('MEMBER');
  });

  it('rechaza agregar miembro con id inválido', async () => {
    const owner = await registerUser('addbad@test.com');

    const res = await request(app)
      .post('/api/projects/invalid/members')
      .set(auth(owner.token))
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(404);
  });

  it('rechaza agregar miembro si no es dueño', async () => {
    const owner = await registerUser('addnoowner@test.com');
    const other = await registerUser('addnoowner2@test.com');
    const proj = await createProject(owner.token, 'P');

    const res = await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(other.token))
      .send({ email: 'addnoowner2@test.com' });

    expect(res.status).toBe(403);
  });

  it('rechaza agregar miembro con email inválido', async () => {
    const owner = await registerUser('bademail@test.com');
    const proj = await createProject(owner.token, 'P');

    const res = await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('rechaza agregar miembro si usuario no existe', async () => {
    const owner = await registerUser('nouser@test.com');
    const proj = await createProject(owner.token, 'P');

    const res = await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'noexiste@test.com' });

    expect(res.status).toBe(404);
  });

  it('rechaza agregar miembro ya existente', async () => {
    const owner = await registerUser('existowner@test.com');
    const member = await registerUser('existmember@test.com');
    const proj = await createProject(owner.token, 'P');

    await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'existmember@test.com' });

    const res = await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'existmember@test.com' });

    expect(res.status).toBe(409);
  });

  it('rechaza agregar miembro a proyecto inexistente', async () => {
    const owner = await registerUser('addpnot@test.com');

    const res = await request(app)
      .post('/api/projects/proj_9999999999/members')
      .set(auth(owner.token))
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(404);
  });

  it('elimina un miembro', async () => {
    const owner = await registerUser('remowner@test.com');
    const member = await registerUser('remmember@test.com');
    const proj = await createProject(owner.token, 'P');

    await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'remmember@test.com' });

    const res = await request(app)
      .delete(`/api/projects/${proj.id}/members/${member.id}`)
      .set(auth(owner.token));

    expect(res.status).toBe(204);
  });

  it('rechaza eliminar miembro con ids inválidos', async () => {
    const owner = await registerUser('rembad@test.com');

    const res = await request(app)
      .delete('/api/projects/bad/members/bad')
      .set(auth(owner.token));

    expect(res.status).toBe(404);
  });

  it('rechaza eliminar miembro de proyecto inexistente', async () => {
    const owner = await registerUser('rempnot@test.com');
    const member = await registerUser('rempnotm@test.com');

    const res = await request(app)
      .delete(`/api/projects/proj_9999999999/members/${member.id}`)
      .set(auth(owner.token));

    expect(res.status).toBe(404);
  });

  it('rechaza eliminar miembro si no es dueño', async () => {
    const owner = await registerUser('remnoowner@test.com');
    const member = await registerUser('remnoownerm@test.com');
    const other = await registerUser('remnoowner2@test.com');
    const proj = await createProject(owner.token, 'P');

    await request(app)
      .post(`/api/projects/${proj.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'remnoownerm@test.com' });

    const res = await request(app)
      .delete(`/api/projects/${proj.id}/members/${member.id}`)
      .set(auth(other.token));

    expect(res.status).toBe(403);
  });

  it('rechaza eliminar al dueño del proyecto', async () => {
    const owner = await registerUser('remownerbad@test.com');
    const proj = await createProject(owner.token, 'P');

    const res = await request(app)
      .delete(`/api/projects/${proj.id}/members/${owner.id}`)
      .set(auth(owner.token));

    expect(res.status).toBe(400);
  });

  it('rechaza eliminar miembro que no existe', async () => {
    const owner = await registerUser('remnomem@test.com');
    const nomem = await registerUser('remnomem2@test.com');
    const proj = await createProject(owner.token, 'P');

    const res = await request(app)
      .delete(`/api/projects/${proj.id}/members/${nomem.id}`)
      .set(auth(owner.token));

    expect(res.status).toBe(404);
  });
});
