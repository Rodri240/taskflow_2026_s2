import { expect, test } from '../fixtures';
import type { ApiClient, AuthSession } from '../fixtures';
import { USERS, uniqueName } from '../support/data';

async function setupProject(api: ApiClient, auth: AuthSession) {
  return api.createProject(auth.token, { name: uniqueName('Gestion') });
}

test.describe('Gestión de proyectos (US-09 y US-10)', () => {
  test('el owner renombra un proyecto y el cambio se refleja en el listado', async ({ api }) => {
    const auth = await api.login(USERS.ana.email, USERS.ana.password);
    const project = await setupProject(api, auth);
    const newName = uniqueName('Renombrado');

    const res = await api.rawPatch(`/projects/${project.id}`, { name: newName }, auth.token);

    expect(res.status()).toBe(200);
    expect((await res.json()).name).toBe(newName);

    const list = await api.listProjects(auth.token);
    expect(list.some((p) => p.id === project.id && p.name === newName)).toBe(true);
  });

  test('renombrar a un nombre ya usado por el mismo owner devuelve 409', async ({ api }) => {
    const auth = await api.login(USERS.ana.email, USERS.ana.password);
    const alfa = await api.createProject(auth.token, { name: uniqueName('Alfa') });
    const beta = await api.createProject(auth.token, { name: uniqueName('Beta') });

    const res = await api.rawPatch(`/projects/${beta.id}`, { name: alfa.name }, auth.token);

    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe('CONFLICT');
  });

  test('un miembro no-owner no puede editar el proyecto', async ({ api }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const bob = await api.login(USERS.bob.email, USERS.bob.password);
    const project = await setupProject(api, ana);
    await api.addMember(ana.token, project.id, USERS.bob.email);

    const res = await api.rawPatch(
      `/projects/${project.id}`,
      { name: uniqueName('Prohibido') },
      bob.token,
    );

    expect(res.status()).toBe(403);
  });

  test('editar con un nombre demasiado corto devuelve 400', async ({ api }) => {
    const auth = await api.login(USERS.ana.email, USERS.ana.password);
    const project = await setupProject(api, auth);

    const res = await api.rawPatch(`/projects/${project.id}`, { name: 'ab' }, auth.token);

    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  test('un update parcial conserva los campos no enviados', async ({ api }) => {
    const auth = await api.login(USERS.ana.email, USERS.ana.password);
    const project = await api.createProject(auth.token, {
      name: uniqueName('Parcial'),
      description: 'Descripción original',
    });

    const res = await api.rawPatch(
      `/projects/${project.id}`,
      { description: 'Descripción nueva' },
      auth.token,
    );

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe(project.name);
    expect(body.description).toBe('Descripción nueva');
  });

  test('el owner elimina un proyecto y desaparece del listado', async ({ api }) => {
    const auth = await api.login(USERS.ana.email, USERS.ana.password);
    const project = await setupProject(api, auth);

    const res = await api.rawDelete(`/projects/${project.id}`, auth.token);

    expect(res.status()).toBe(204);
    const list = await api.listProjects(auth.token);
    expect(list.some((p) => p.id === project.id)).toBe(false);
  });

  test('eliminar un proyecto también elimina sus tareas', async ({ api }) => {
    const auth = await api.login(USERS.ana.email, USERS.ana.password);
    const project = await setupProject(api, auth);
    const task = await api.createTask(auth.token, project.id, { title: 'Tarea huérfana' });
    await api.addComment(auth.token, task.id, 'Comentario de la tarea');

    await api.rawDelete(`/projects/${project.id}`, auth.token);

    const taskRes = await api.rawGet(`/tasks/${task.id}`, auth.token);
    expect(taskRes.status()).toBe(404);
  });

  test('un miembro no-owner no puede eliminar el proyecto', async ({ api }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const bob = await api.login(USERS.bob.email, USERS.bob.password);
    const project = await setupProject(api, ana);
    await api.addMember(ana.token, project.id, USERS.bob.email);

    const res = await api.rawDelete(`/projects/${project.id}`, bob.token);

    expect(res.status()).toBe(403);
  });

  test('eliminar un proyecto inexistente devuelve 404', async ({ api }) => {
    const auth = await api.login(USERS.ana.email, USERS.ana.password);

    const res = await api.rawDelete('/projects/proj-999999', auth.token);

    expect(res.status()).toBe(404);
  });
});
