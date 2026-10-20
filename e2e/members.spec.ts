import { expect, test } from '@playwright/test';
import {
  addProjectMember,
  authenticatePage,
  authorization,
  createProject,
  createTask,
  expectStatus,
  registerUser,
} from './support/api';

test.describe('Miembros y autorización', () => {
  test('[US-11] el owner agrega y quita un miembro; sus tareas quedan sin asignar', async ({
    page,
    request,
  }) => {
    const owner = await registerUser(request, 'miembros-owner');
    const member = await registerUser(request, 'miembros-colaborador');
    const project = await createProject(request, owner);
    await authenticatePage(page, owner);
    await page.goto(`/projects/${project.id}/members`);

    await page.getByTestId('member-email-input').fill(member.email);
    const addPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/projects/${project.id}/members`) &&
        response.request().method() === 'POST',
    );
    await page.getByTestId('member-add-button').click();
    await expectStatus(await addPromise, 201);
    const memberRow = page.getByTestId('member-item').filter({ hasText: member.email });
    await expect(memberRow).toHaveCount(1);
    await expect(memberRow.getByTestId('member-item-role')).toHaveText('MEMBER');

    const task = await createTask(request, owner, project, {
      title: 'Trabajo del colaborador',
      assigneeId: member.id,
    });
    const visibleBefore = await request.get('/api/projects', {
      headers: authorization(member.token),
    });
    const projectsBefore = await expectStatus<Array<{ id: string }>>(visibleBefore, 200);
    expect(projectsBefore.map((candidate) => candidate.id)).toContain(project.id);

    const removePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/projects/${project.id}/members/${member.id}`) &&
        response.request().method() === 'DELETE',
    );
    await memberRow.getByTestId('member-remove-button').click();
    await expectStatus(await removePromise, 204);
    await expect(memberRow).toHaveCount(0);

    const visibleAfter = await request.get('/api/projects', {
      headers: authorization(member.token),
    });
    const projectsAfter = await expectStatus<Array<{ id: string }>>(visibleAfter, 200);
    expect(projectsAfter.map((candidate) => candidate.id)).not.toContain(project.id);

    const taskResponse = await request.get(`/api/tasks/${task.id}`, {
      headers: authorization(owner.token),
    });
    const taskAfterRemoval = await expectStatus<{ assigneeId: string | null }>(taskResponse, 200);
    expect(taskAfterRemoval.assigneeId).toBeNull();
  });

  test('[US-11] un exmiembro no puede operar sobre tareas aunque haya sido asignado', async ({
    request,
  }) => {
    const owner = await registerUser(request, 'exmiembro-owner');
    const member = await registerUser(request, 'exmiembro-colaborador');
    const project = await createProject(request, owner);
    await addProjectMember(request, owner, project, member);
    const task = await createTask(request, owner, project, {
      title: 'Tarea restringida',
      assigneeId: member.id,
    });

    const removal = await request.delete(`/api/projects/${project.id}/members/${member.id}`, {
      headers: authorization(owner.token),
    });
    await expectStatus(removal, 204);

    const forbiddenUpdate = await request.patch(`/api/tasks/${task.id}`, {
      headers: authorization(member.token),
      data: { status: 'IN_PROGRESS' },
    });
    const body = await expectStatus<{ error: { code: string } }>(forbiddenUpdate, 403);
    expect(body.error.code).toBe('FORBIDDEN');

    const persisted = await request.get(`/api/tasks/${task.id}`, {
      headers: authorization(owner.token),
    });
    const persistedTask = await expectStatus<{ status: string }>(persisted, 200);
    expect(persistedTask.status).toBe('TODO');
  });
});
