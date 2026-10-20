import { expect, test } from '@playwright/test';
import {
  authenticatePage,
  authorization,
  createProject,
  createTask,
  expectStatus,
  registerUser,
  uniqueValue,
} from './support/api';

test.describe('Flujos principales de proyectos y tareas', () => {
  test('[US-03, US-04] crea un proyecto y lo muestra con sus datos exactos', async ({
    page,
    request,
  }) => {
    const owner = await registerUser(request, 'proyecto-owner');
    const name = uniqueValue('Proyecto interfaz');
    const description = 'Creado desde la interfaz de usuario';
    await authenticatePage(page, owner);
    await page.goto('/projects');

    await page.getByTestId('project-name-input').fill(name);
    await page.getByTestId('project-description-input').fill(description);
    const createPromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/projects') && response.request().method() === 'POST',
    );
    await page.getByTestId('project-create-submit').click();
    const project = await expectStatus<{ id: string; name: string; description: string }>(
      await createPromise,
      201,
    );
    expect(project).toMatchObject({
      id: expect.stringMatching(/^proj-\d+$/),
      name,
      description,
    });

    const card = page.getByTestId('project-card').filter({ hasText: name });
    await expect(card).toHaveCount(1);
    await expect(card.getByTestId('project-card-name')).toHaveText(name);
    await expect(card.getByTestId('project-card-description')).toHaveText(description);
  });

  test('[US-03] rechaza un nombre de proyecto de menos de tres caracteres', async ({
    page,
    request,
  }) => {
    const owner = await registerUser(request, 'proyecto-validacion');
    await authenticatePage(page, owner);
    await page.goto('/projects');

    await page.getByTestId('project-name-input').fill('ab');
    const createPromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/projects') && response.request().method() === 'POST',
    );
    await page.getByTestId('project-create-submit').click();
    const body = await expectStatus<{ error: { code: string; message: string } }>(
      await createPromise,
      400,
    );
    expect(body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(body.error.message).toContain('3');
    await expect(page.getByRole('alert')).toContainText('3');
    await expect(page.getByTestId('project-card')).toHaveCount(0);
  });

  test('[US-05, US-14, US-16] crea una tarea asignada, priorizada y con vencimiento', async ({
    page,
    request,
  }) => {
    const owner = await registerUser(request, 'tarea-owner');
    const project = await createProject(request, owner);
    const title = uniqueValue('Implementar login');
    const dueDate = '2030-06-15';
    await authenticatePage(page, owner);
    await page.goto(`/projects/${project.id}`);
    await expect(page.getByTestId('board-page')).toBeVisible();

    await page.getByTestId('task-create-title-input').fill(title);
    await page.getByTestId('task-create-description-input').fill('Flujo crítico de acceso');
    await page.getByTestId('task-create-priority-select').selectOption('HIGH');
    await page.getByTestId('task-create-assignee-select').selectOption(owner.id);
    await page.getByTestId('task-create-duedate-input').fill(dueDate);

    const createPromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/projects/${project.id}/tasks`) &&
        response.request().method() === 'POST',
    );
    await page.getByTestId('task-create-submit').click();
    const task = await expectStatus<{
      id: string;
      status: string;
      priority: string;
      assigneeId: string;
      dueDate: string;
    }>(await createPromise, 201);
    expect.soft(task).toMatchObject({
      id: expect.stringMatching(/^task-\d+$/),
      status: 'TODO',
      priority: 'HIGH',
      assigneeId: owner.id,
      dueDate,
    });

    const card = page.getByTestId('task-card').filter({ hasText: title });
    await expect(card).toHaveCount(1);
    await expect(card.getByTestId('task-card-priority')).toHaveText('HIGH');
    await expect(card.getByTestId('task-card-assignee')).toHaveText(owner.email);
    await expect(card.getByTestId('task-card-duedate')).toHaveText(dueDate);
    await expect(page.getByTestId('board-column-TODO').getByText(title, { exact: true })).toBeVisible();
  });

  test('[US-05] no permite forzar el estado inicial al crear una tarea', async ({ request }) => {
    const owner = await registerUser(request, 'estado-inicial');
    const project = await createProject(request, owner);
    const task = await createTask(request, owner, project, {
      title: 'La tarea debe empezar pendiente',
      status: 'DONE',
    });

    expect(task.status).toBe('TODO');
  });

  test('[US-06] aplica transiciones válidas, rechaza reabrir DONE y registra historial', async ({
    page,
    request,
  }) => {
    const owner = await registerUser(request, 'transiciones');
    const project = await createProject(request, owner);
    const task = await createTask(request, owner, project, {
      title: 'Tarea con flujo de estados',
      assigneeId: owner.id,
    });
    await authenticatePage(page, owner);
    await page.goto(`/projects/${project.id}/tasks/${task.id}`);
    await expect(page.getByTestId('task-current-status')).toHaveText('TODO');

    await page.getByTestId('task-status-select').selectOption('IN_PROGRESS');
    const progressPromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/tasks/${task.id}`) && response.request().method() === 'PATCH',
    );
    await page.getByTestId('task-status-submit').click();
    await expectStatus(await progressPromise, 200);
    await expect(page.getByTestId('task-current-status')).toHaveText('IN_PROGRESS');
    await expect(page.getByTestId('history-list')).toContainText('TODO → IN_PROGRESS');

    await page.getByTestId('task-status-select').selectOption('DONE');
    const donePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/tasks/${task.id}`) && response.request().method() === 'PATCH',
    );
    await page.getByTestId('task-status-submit').click();
    await expectStatus(await donePromise, 200);
    await expect(page.getByTestId('task-current-status')).toHaveText('DONE');
    await expect(page.getByTestId('history-list')).toContainText('IN_PROGRESS → DONE');

    await page.getByTestId('task-status-select').selectOption('TODO');
    const reopenPromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/tasks/${task.id}`) && response.request().method() === 'PATCH',
    );
    await page.getByTestId('task-status-submit').click();
    const rejected = await expectStatus<{ error: { code: string; message: string } }>(
      await reopenPromise,
      422,
    );
    expect(rejected.error.code).toBe('INVALID_TRANSITION');
    await expect(page.getByRole('alert')).toHaveText(rejected.error.message);
    await expect(page.getByTestId('task-current-status')).toHaveText('DONE');
  });

  test('[US-08] publica comentarios y los muestra del más antiguo al más reciente', async ({
    page,
    request,
  }) => {
    const owner = await registerUser(request, 'comentarios');
    const project = await createProject(request, owner);
    const task = await createTask(request, owner, project, { title: 'Revisar propuesta' });
    await authenticatePage(page, owner);
    await page.goto(`/projects/${project.id}/tasks/${task.id}`);

    for (const message of ['Primera observación', 'Revisado y aprobado']) {
      await page.getByTestId('comment-add-input').fill(message);
      const commentPromise = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/tasks/${task.id}/comments`) &&
          response.request().method() === 'POST',
      );
      await page.getByTestId('comment-add-button').click();
      const comment = await expectStatus<{ body: string; authorId: string }>(
        await commentPromise,
        201,
      );
      expect(comment).toMatchObject({ body: message, authorId: owner.id });
    }

    const comments = page.getByTestId('comment-item');
    await expect(comments).toHaveCount(2);
    await expect(comments.nth(0).getByTestId('comment-item-body')).toHaveText('Primera observación');
    await expect(comments.nth(1).getByTestId('comment-item-body')).toHaveText('Revisado y aprobado');
    await expect(comments.nth(1).getByTestId('comment-item-author')).toHaveText(owner.id);
  });

  test('[US-08] permite borrar un comentario propio', async ({ page, request }) => {
    const owner = await registerUser(request, 'borrar-comentario');
    const project = await createProject(request, owner);
    const task = await createTask(request, owner, project, { title: 'Comentario descartable' });
    await authenticatePage(page, owner);
    await page.goto(`/projects/${project.id}/tasks/${task.id}`);

    await page.getByTestId('comment-add-input').fill('Comentario temporal');
    const createPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/tasks/${task.id}/comments`) &&
        response.request().method() === 'POST',
    );
    await page.getByTestId('comment-add-button').click();
    await expectStatus(await createPromise, 201);
    const comments = page.getByTestId('comment-item');
    await expect(comments).toHaveCount(1);

    const deletePromise = page.waitForResponse(
      (response) => response.url().includes('/api/comments/') && response.request().method() === 'DELETE',
    );
    await comments.getByTestId('comment-delete-button').click();
    await expectStatus(await deletePromise, 204);
    await expect(comments).toHaveCount(0);
  });

  test('[US-07] combina prioridad y asignado sin incluir resultados parciales', async ({ request }) => {
    const owner = await registerUser(request, 'filtros');
    const project = await createProject(request, owner);
    const expected = await createTask(request, owner, project, {
      title: 'Alta asignada',
      priority: 'HIGH',
      assigneeId: owner.id,
    });
    await createTask(request, owner, project, {
      title: 'Baja asignada',
      priority: 'LOW',
      assigneeId: owner.id,
    });
    await createTask(request, owner, project, {
      title: 'Alta sin asignar',
      priority: 'HIGH',
    });

    const response = await request.get(
      `/api/projects/${project.id}/tasks?priority=HIGH&assignedTo=${owner.id}`,
      { headers: authorization(owner.token) },
    );
    const body = await expectStatus<{ items: Array<{ id: string; priority: string; assigneeId: string }>; total: number }>(
      response,
      200,
    );
    expect(body.total).toBe(1);
    expect(body.items).toEqual([
      expect.objectContaining({ id: expected.id, priority: 'HIGH', assigneeId: owner.id }),
    ]);
  });

  test('[US-07] busca sin distinguir mayúsculas de minúsculas', async ({ request }) => {
    const owner = await registerUser(request, 'busqueda');
    const project = await createProject(request, owner);
    const matching = await createTask(request, owner, project, { title: 'Implementar Login Seguro' });

    const searchResponse = await request.get(`/api/projects/${project.id}/tasks?search=login`, {
      headers: authorization(owner.token),
    });
    const search = await expectStatus<{ items: Array<{ id: string }>; total: number }>(
      searchResponse,
      200,
    );
    expect(search.total).toBe(1);
    expect(search.items.map((item) => item.id)).toEqual([matching.id]);
  });

  test('[US-07] pagina a veinte tareas por defecto e informa el total', async ({ request }) => {
    const owner = await registerUser(request, 'paginacion');
    const project = await createProject(request, owner);
    for (let index = 0; index < 21; index += 1) {
      await createTask(request, owner, project, {
        title: `Tarea paginada ${String(index).padStart(2, '0')}`,
      });
    }

    const pageResponse = await request.get(`/api/projects/${project.id}/tasks`, {
      headers: authorization(owner.token),
    });
    const page = await expectStatus<{ items: unknown[]; total: number; limit: number; offset: number }>(
      pageResponse,
      200,
    );
    expect(page).toMatchObject({ total: 21, limit: 20, offset: 0 });
    expect(page.items).toHaveLength(20);
  });
});
