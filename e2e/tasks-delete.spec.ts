import { expect, test } from '@playwright/test';

test('permite borrar una tarea desde su detalle', async ({ page }) => {
  const uniqueId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `e2e-${uniqueId}@test.com`;
  const password = 'E2ePass123!';
  const projectName = `Proyecto E2E ${uniqueId}`;
  const taskTitle = `Tarea eliminable ${uniqueId}`;

  await page.goto('/login');

  await page.getByTestId('login-mode-toggle').click();

  await page.getByTestId('login-name-input').fill('Usuario E2E');
  await page.getByTestId('login-email-input').fill(email);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/projects$/);

  
  await page.getByTestId('project-name-input').fill(projectName);
  await page.getByTestId('project-create-submit').click();

  const projectCard = page
    .getByTestId('project-card')
    .filter({ hasText: projectName });

  await expect(projectCard).toBeVisible();
  await projectCard.getByTestId('project-card-name').click();

  await expect(page).toHaveURL(/\/projects\/[^/]+$/);

  await page.getByTestId('task-create-title-input').fill(taskTitle);
  await page.getByTestId('task-create-submit').click();

  const taskLink = page
    .getByTestId('task-card-title')
    .filter({ hasText: taskTitle });

  await expect(taskLink).toBeVisible();

  await taskLink.click();

  await expect(page).toHaveURL(/\/projects\/[^/]+\/tasks\/[^/]+$/);
  await expect(page.getByTestId('task-detail-page')).toBeVisible();

  
  await page.getByTestId('task-delete-button').click();

  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(page.getByTestId('board-page')).toBeVisible();

  await expect(
    page.getByTestId('task-card-title').filter({ hasText: taskTitle }),
  ).toHaveCount(0);
});