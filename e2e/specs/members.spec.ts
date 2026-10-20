import { expect, test } from '../fixtures';
import type { ApiClient, AuthSession } from '../fixtures';
import { AppActions } from '../actions/app';
import { USERS, uniqueName } from '../support/data';

async function setupProject(api: ApiClient, auth: AuthSession) {
  const project = await api.createProject(auth.token, { name: uniqueName('Miembros') });
  await api.addMember(auth.token, project.id, USERS.bob.email);
  return project;
}

test.describe('Miembros del proyecto (US-11)', () => {
  test('el owner agrega un miembro por email y aparece en la lista', async ({
    page,
    api,
    session,
  }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, { name: uniqueName('Alta miembro') });

    const app = new AppActions(page);
    await app.openMembers(project.name);
    await app.members.add(USERS.bob.email);

    await expect(app.members.list.item(USERS.bob.email)).toBeVisible();
    await expect(app.members.list.role(USERS.bob.email)).toHaveText('MEMBER');
  });

  test('agregar un email inexistente muestra un error', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, { name: uniqueName('Email malo') });

    const app = new AppActions(page);
    await app.openMembers(project.name);
    await app.members.add('noexiste@test.com');

    await expect(app.members.feedback.errorWith('No user found')).toBeVisible();
  });

  test('agregar un miembro que ya es miembro muestra un error de conflicto', async ({
    page,
    api,
    session,
  }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, { name: uniqueName('Duplicado') });
    await api.addMember(auth.token, project.id, USERS.bob.email);

    const app = new AppActions(page);
    await app.openMembers(project.name);
    await app.members.add(USERS.bob.email);

    await expect(app.members.feedback.errorWith('already a member')).toBeVisible();
  });

  test('un miembro no-owner ve la página en solo lectura', async ({ page, api, session }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const project = await setupProject(api, ana);

    await session(USERS.bob);
    const app = new AppActions(page);
    await app.openMembers(project.name);

    await expect(app.members.readonlyNote).toBeVisible();
    await expect(app.members.addForm).toHaveCount(0);
  });

  test('solo el owner puede agregar miembros', async ({ api }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const project = await setupProject(api, ana);
    const bob = await api.login(USERS.bob.email, USERS.bob.password);

    const res = await api.rawPost(
      `/projects/${project.id}/members`,
      { email: USERS.caro.email },
      bob.token,
    );

    expect(res.status()).toBe(403);
  });

  test('el owner quita a un miembro y el proyecto deja de verse para él', async ({
    page,
    api,
    session,
  }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, { name: uniqueName('Baja miembro') });

    const app = new AppActions(page);
    await app.openMembers(project.name);
    await app.members.add(USERS.bob.email);
    await expect(app.members.list.item(USERS.bob.email)).toBeVisible();

    await app.members.list.removeButton(USERS.bob.email).click();
    await expect(app.members.list.item(USERS.bob.email)).toHaveCount(0);

    const bob = await api.login(USERS.bob.email, USERS.bob.password);
    const bobProjects = await api.listProjects(bob.token);
    expect(bobProjects.some((p) => p.id === project.id)).toBe(false);
  });

  test('el owner no puede quitarse a sí mismo del proyecto', async ({ api }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const project = await api.createProject(ana.token, { name: uniqueName('Owner solo') });

    const res = await api.rawDelete(
      `/projects/${project.id}/members/${ana.user.id}`,
      ana.token,
    );

    expect(res.status()).toBe(400);
  });

  // BUG-13: el server solo borra la membresía; US-11 CA6 exige que las
  // tareas asignadas al miembro quitado queden sin asignar.
  test('al quitar un miembro sus tareas quedan sin asignar', async ({ api }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const bob = await api.login(USERS.bob.email, USERS.bob.password);
    const project = await api.createProject(ana.token, { name: uniqueName('Tarea asignada') });
    await api.addMember(ana.token, project.id, USERS.bob.email);
    const task = await api.createTask(ana.token, project.id, {
      title: 'Tarea de bob',
      assigneeId: bob.user.id,
    });

    await api.rawDelete(`/projects/${project.id}/members/${bob.user.id}`, ana.token);

    const updated = await api.getTask(ana.token, task.id);
    expect(updated.assigneeId).toBeNull();
  });

  test('un ex-miembro no puede cambiar el estado de una tarea del proyecto', async ({ api }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const bob = await api.login(USERS.bob.email, USERS.bob.password);
    const project = await api.createProject(ana.token, { name: uniqueName('Ex estado') });
    await api.addMember(ana.token, project.id, USERS.bob.email);
    const task = await api.createTask(ana.token, project.id, { title: 'Tarea protegida' });

    await api.rawDelete(`/projects/${project.id}/members/${bob.user.id}`, ana.token);

    const res = await api.rawPatch(`/tasks/${task.id}`, { status: 'IN_PROGRESS' }, bob.token);
    expect(res.status()).toBe(403);
  });

  // BUG-14: PATCH /tasks/:id no verifica membresía para campos distintos del
  // estado; US-11 CA7 (y US-12 CA5) exigen 403 para usuarios no miembros.
  test('un ex-miembro no puede editar el título de una tarea del proyecto', async ({ api }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const bob = await api.login(USERS.bob.email, USERS.bob.password);
    const project = await api.createProject(ana.token, { name: uniqueName('Ex edición') });
    await api.addMember(ana.token, project.id, USERS.bob.email);
    const task = await api.createTask(ana.token, project.id, { title: 'Tarea editable' });

    await api.rawDelete(`/projects/${project.id}/members/${bob.user.id}`, ana.token);

    const res = await api.rawPatch(`/tasks/${task.id}`, { title: 'Titulo tomado' }, bob.token);
    expect(res.status()).toBe(403);
  });

  // BUG-15: DELETE /tasks/:id no verifica membresía; US-11 CA7 (y US-13
  // CA1) exigen 403 para usuarios no miembros.
  test('un ex-miembro no puede eliminar una tarea del proyecto', async ({ api }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const bob = await api.login(USERS.bob.email, USERS.bob.password);
    const project = await api.createProject(ana.token, { name: uniqueName('Ex borrado') });
    await api.addMember(ana.token, project.id, USERS.bob.email);
    const task = await api.createTask(ana.token, project.id, { title: 'Tarea borrable' });

    await api.rawDelete(`/projects/${project.id}/members/${bob.user.id}`, ana.token);

    const res = await api.rawDelete(`/tasks/${task.id}`, bob.token);
    expect(res.status()).toBe(403);
  });
});
