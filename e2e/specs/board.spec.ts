import { expect, test } from '../fixtures';
import { AppActions } from '../actions/app';
import { PROJECTS, USERS, uniqueName } from '../support/data';

test.describe('Tablero', () => {
  test('crea una tarea y aparece en la columna TODO', async ({ page, session }) => {
    await session(USERS.ana);
    const app = new AppActions(page);
    const project = uniqueName('Tablero UI');

    await app.openProjects();
    await app.createProject(project);
    await app.openBoard(project);
    await app.createTask({ title: 'Tarea nueva', description: 'desc', priority: 'HIGH' });

    await expect(app.board.column('TODO').card('Tarea nueva').title).toBeVisible();
  });

  // BUG-09: el campo status del body se cuela al crear la tarea; US-05 CA3
  // exige que el estado inicial sea siempre TODO.
  test('una tarea creada por API nace en TODO aunque se pida otro estado', async ({
    api,
    session,
  }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, {
      name: uniqueName('Estado inicial'),
    });

    const task = await api.createTask(auth.token, project.id, {
      title: 'Tarea forzada',
      status: 'DONE',
    });

    expect(task.status).toBe('TODO');
  });

  // BUG-10: solo se bloquean las transiciones desde DONE; US-06 CA2 prohíbe
  // ir de TODO directamente a DONE.
  test('rechaza la transición directa de TODO a DONE', async ({ api, session }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, { name: uniqueName('Transicion') });
    const task = await api.createTask(auth.token, project.id, { title: 'Saltar etapas' });

    const res = await api.rawPatch(`/tasks/${task.id}`, { status: 'DONE' }, auth.token);

    expect(res.status()).toBe(422);
  });

  test('filtra las tareas por prioridad', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await app.openBoard(PROJECTS.site);

    await app.filterTasks({ priority: 'HIGH' });

    await expect(app.board.total).toHaveText('Total: 2');
  });

  test('filtra las tareas por asignado', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await app.openBoard(PROJECTS.site);

    await app.filterTasks({ assignedTo: USERS.bob.email });

    await expect(app.board.total).toHaveText('Total: 2');
  });

  test('busca tareas por texto', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await app.openBoard(PROJECTS.site);

    await app.filterTasks({ search: 'dominio' });

    await expect(app.board.total).toHaveText('Total: 1');
  });

  // BUG-02: los filtros se pisan entre sí; solo se aplica el último (asignado).
  // Con prioridad HIGH + asignado bob debería quedar 1 tarea ("Ajustar accesibilidad").
  test('combina el filtro de prioridad y de asignado', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await app.openBoard(PROJECTS.site);

    await app.filterTasks({ priority: 'HIGH', assignedTo: USERS.bob.email });

    await expect(app.board.total).toHaveText('Total: 1');
  });

  // BUG-03: la búsqueda por texto ignora el resto de los filtros.
  // Con prioridad HIGH + "diseño" no debería devolver tareas (esa tarea es MEDIUM).
  test('combina la búsqueda con el filtro de prioridad', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await app.openBoard(PROJECTS.site);

    await app.filterTasks({ priority: 'HIGH', search: 'diseño' });

    await expect(app.board.total).toHaveText('Total: 0');
  });

  test('cambia el estado de una tarea desde el tablero', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, { name: uniqueName('Estado') });
    await api.createTask(auth.token, project.id, { title: 'Mover tarea' });

    const app = new AppActions(page);
    await app.board.goto(project.id);
    await app.changeTaskStatusOnBoard('Mover tarea', 'IN_PROGRESS');

    await expect(app.board.column('IN_PROGRESS').card('Mover tarea').title).toBeVisible();
  });

  test('rechaza una transición inválida de DONE a TODO', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, { name: uniqueName('Transicion') });
    await api.createTask(auth.token, project.id, {
      title: 'Tarea terminal',
      assigneeId: auth.user.id,
    });

    const app = new AppActions(page);
    await app.board.goto(project.id);

    await app.board.card('Tarea terminal').changeStatus('IN_PROGRESS');
    await expect(app.board.column('IN_PROGRESS').card('Tarea terminal').title).toBeVisible();

    await app.board.column('IN_PROGRESS').card('Tarea terminal').changeStatus('DONE');
    await expect(app.board.column('DONE').card('Tarea terminal').title).toBeVisible();

    await app.board.column('DONE').card('Tarea terminal').changeStatus('TODO');
    await expect(app.board.feedback.errorWith('Cannot move')).toBeVisible();
    await expect(app.board.column('DONE').card('Tarea terminal').title).toBeVisible();
  });
});
