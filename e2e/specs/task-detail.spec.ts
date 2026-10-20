import { expect, test } from '../fixtures';
import type { ApiClient, AuthSession } from '../fixtures';
import { AppActions } from '../actions/app';
import { USERS, uniqueName } from '../support/data';

async function setupTask(api: ApiClient, auth: AuthSession) {
  const project = await api.createProject(auth.token, { name: uniqueName('Detalle') });
  const task = await api.createTask(auth.token, project.id, { title: 'Tarea editable' });
  return { project, task };
}

test.describe('Detalle de tarea', () => {
  test('edita título, descripción y prioridad', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const { project, task } = await setupTask(api, auth);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.edit({
      title: 'Título actualizado',
      description: 'Nueva descripción',
      priority: 'CRITICAL',
    });

    await page.reload();
    await expect(app.taskDetail.detail.titleInput).toHaveValue('Título actualizado');
    await expect(app.taskDetail.detail.descriptionInput).toHaveValue('Nueva descripción');
    await expect(app.taskDetail.detail.prioritySelect).toHaveValue('CRITICAL');
  });

  test('asigna la tarea a un miembro y luego la desasigna', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, { name: uniqueName('Asignar') });
    await api.addMember(auth.token, project.id, USERS.bob.email);
    // Tarea "señuelo" para que bob aparezca en la lista de miembros del cliente.
    await api.createTask(auth.token, project.id, {
      title: 'Tarea de bob',
      assigneeId: 'user-2',
    });
    const task = await api.createTask(auth.token, project.id, { title: 'Tarea sin asignar' });

    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);
    await app.taskDetail.detail.edit({ assignee: USERS.bob.email });
    await expect(app.taskDetail.detail.assigneeSelect.locator('option:checked')).toHaveText(
      USERS.bob.email,
    );

    await app.taskDetail.detail.clearAssignee();
    await expect(app.taskDetail.detail.assigneeSelect.locator('option:checked')).toHaveText(
      'Sin asignar',
    );
  });

  // BUG-18: el server parsea la fecha como medianoche UTC y la formatea con
  // la zona horaria local; en UTC-3 '2030-05-19' se devuelve '2030-05-18'.
  // US-16 CA3 exige que la fecha devuelta sea siempre la misma que se cargó.
  test('establece la fecha de vencimiento', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const { project, task } = await setupTask(api, auth);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.edit({ dueDate: '2030-05-19' });

    await expect(app.taskDetail.detail.dueDateValue).toHaveText('2030-05-19');
  });

  test('registra el historial al cambiar de estado', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const project = await api.createProject(auth.token, { name: uniqueName('Historial') });
    const task = await api.createTask(auth.token, project.id, {
      title: 'Tarea con historial',
      assigneeId: auth.user.id,
    });
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.changeStatus('IN_PROGRESS');

    await expect(app.taskDetail.detail.currentStatus).toHaveText('IN_PROGRESS');
    await expect(
      page.getByTestId('history-item').filter({ hasText: 'TODO → IN_PROGRESS' }),
    ).toBeVisible();
  });

  test('agrega y quita etiquetas', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const { project, task } = await setupTask(api, auth);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.addTag('frontend');
    await expect(app.taskDetail.detail.tag('frontend')).toBeVisible();

    await app.taskDetail.detail.removeTag('frontend');
    await expect(app.taskDetail.detail.tag('frontend')).toHaveCount(0);
  });

  // BUG-11: la etiqueta se guarda tal cual se envía; US-15 CA1/CA2 exige
  // normalizar a minúsculas y tratar 'BUG' y 'bug' como la misma etiqueta.
  test('normaliza las etiquetas a minúsculas', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const { project, task } = await setupTask(api, auth);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.addTag('BUG');

    await expect(app.taskDetail.detail.tag('bug')).toBeVisible();
  });

  // BUG-12: no se detectan duplicados; US-15 CA3 exige que repetir una
  // etiqueta devuelva 200 sin generar un duplicado.
  test('agregar dos veces la misma etiqueta no la duplica', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const { project, task } = await setupTask(api, auth);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.addTag('bug');
    await app.taskDetail.detail.addTag('bug');

    await expect(app.taskDetail.detail.tagChips).toHaveCount(1);
  });

  test('rechaza una etiqueta vacía', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const { project, task } = await setupTask(api, auth);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.addTag('');

    await expect(app.taskDetail.feedback.errorWith('Tag name')).toBeVisible();
  });

  test('agrega un comentario y borra el propio', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const { project, task } = await setupTask(api, auth);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.addComment('Comentario de prueba');
    await expect(app.taskDetail.detail.comment('Comentario de prueba')).toBeVisible();

    await app.taskDetail.detail.deleteComment('Comentario de prueba');
    await expect(app.taskDetail.detail.comment('Comentario de prueba')).toHaveCount(0);
  });

  test('rechaza un comentario vacío', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const { project, task } = await setupTask(api, auth);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.addComment('');

    await expect(app.taskDetail.feedback.errorWith('Comment body')).toBeVisible();
  });

  test('elimina la tarea y vuelve al tablero', async ({ page, api, session }) => {
    const auth = await session(USERS.ana);
    const { project, task } = await setupTask(api, auth);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await app.taskDetail.detail.deleteTask();

    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
    await expect(app.board.root).toBeVisible();
    await expect(app.board.card('Tarea editable').root).toHaveCount(0);
  });

  test('un usuario no-miembro no puede abrir una tarea ajena', async ({ page, api, session }) => {
    const ana = await api.login(USERS.ana.email, USERS.ana.password);
    const project = await api.createProject(ana.token, { name: uniqueName('Privado') });
    const task = await api.createTask(ana.token, project.id, { title: 'Tarea privada' });

    await session(USERS.caro);
    const app = new AppActions(page);
    await app.taskDetail.goto(project.id, task.id);

    await expect(app.taskDetail.root).toHaveCount(0);
    await expect(app.taskDetail.feedback.error).toBeVisible();
  });
});
