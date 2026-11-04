import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  authenticatePage,
  createProject,
  createTask,
  registerUser,
  uniqueValue,
} from './support/api';

const VERIFICAR: { regla: string | null; vistas: string[] } = {
  regla: 'label',
  vistas: ['Login', 'Registro', 'Proyectos', 'Detalle de tarea'],
};

function printReport(view: string, violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  console.log(`\n=== ${view}: ${violations.length} regla(s) violada(s) ===`);
  for (const violation of violations) {
    const successCriteria = violation.tags
      .filter((tag) => /^wcag\d+$/.test(tag) || /^wcag\d{3,4}$/.test(tag))
      .join(', ');
    console.log(`[${(violation.impact ?? 'unknown').toUpperCase()}] ${violation.id} — ${violation.help}`);
    console.log(`   SC WCAG: ${successCriteria || 'no especificado'}`);
    console.log(`   Elementos afectados: ${violation.nodes.length}`);
    for (const node of violation.nodes) console.log(`   · ${node.target.join(', ')}`);
    console.log(`   Más info: ${violation.helpUrl}`);
  }
}

async function audit(view: string, page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  printReport(view, result.violations);
  return result.violations;
}

async function verifyRule(view: string, violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  if (VERIFICAR.regla && VERIFICAR.vistas.includes(view)) {
    expect(
      violations.some((violation) => violation.id === VERIFICAR.regla),
      `La regla "${VERIFICAR.regla}" todavía viola ${view}`,
    ).toBe(false);
  }
}

test.describe('Auditoría de accesibilidad WCAG 2.1', () => {
  test('Login', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-form').waitFor();
    await verifyRule('Login', await audit('Login', page));
  });

  test('Registro', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-mode-toggle').click();
    await page.getByTestId('login-name-input').waitFor();
    await verifyRule('Registro', await audit('Registro', page));
  });

  test('Proyectos', async ({ page, request }) => {
    const account = await registerUser(request, 'a11y-projects');
    await authenticatePage(page, account);
    await page.goto('/projects');
    await page.getByTestId('projects-page').waitFor();
    await verifyRule('Proyectos', await audit('Proyectos', page));
  });

  test('Detalle de tarea', async ({ page, request }) => {
    const account = await registerUser(request, 'a11y-detail');
    const project = await createProject(request, account, { name: uniqueValue('A11y') });
    const task = await createTask(request, account, project);
    await authenticatePage(page, account);
    await page.goto(`/projects/${project.id}/tasks/${task.id}`);
    await page.getByTestId('task-detail-page').waitFor();
    await verifyRule('Detalle de tarea', await audit('Detalle de tarea', page));
  });
});
