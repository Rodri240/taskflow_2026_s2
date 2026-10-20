import { expect, test } from '../fixtures';
import { AppActions } from '../actions/app';
import { PROJECTS, USERS, uniqueName } from '../support/data';

test.describe('Proyectos', () => {
  test('lista los proyectos del usuario según el seed', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await app.openProjects();

    await expect(app.projects.card(PROJECTS.site).name).toBeVisible();
    // "Migración legacy" está archivado: ana es owner pero no debe listarse.
    await expect(app.projects.card(PROJECTS.legacy).name).toHaveCount(0);
  });

  // BUG-08: bob es miembro (no owner) del proyecto archivado "Migración
  // legacy" y aun así aparece en su listado; US-04 CA2 excluye archivados
  // sin importar el rol.
  test('un miembro no ve proyectos archivados en su listado', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.bob);
    await app.openProjects();

    // Esperar a que la lista termine de cargar antes de asentar la ausencia.
    await expect(app.projects.card(PROJECTS.mobile).name).toBeVisible();
    await expect(app.projects.card(PROJECTS.legacy).name).toHaveCount(0);
  });

  test('crea un proyecto nuevo y lo muestra en la lista', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);

    const name = uniqueName('Proyecto');
    await app.createProject(name, 'Descripción de prueba');
    await expect(app.projects.card(name).name).toBeVisible();
  });

  test('rechaza un nombre de proyecto duplicado para el mismo owner', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);

    const name = uniqueName('Duplicado');
    await app.createProject(name);
    await app.projects.createProject(name);

    await expect(app.projects.createError).toBeVisible();
    await expect(app.projects.createError).toContainText('already have a project');
  });

  // BUG-06: la creación no valida el mínimo de 3 caracteres, no muestra error.
  test('rechaza un nombre de proyecto vacío', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await app.projects.goto();
    await app.projects.createProject('');

    await expect(app.projects.createError).toBeVisible();
  });

  // BUG-06: 'ab' (2 caracteres) se acepta al crear aunque el update lo rechaza.
  test('rechaza un nombre de proyecto demasiado corto', async ({ page }) => {
    const app = new AppActions(page);
    await app.loginAs(USERS.ana);
    await app.projects.goto();
    await app.projects.createProject('ab');

    await expect(app.projects.createError).toBeVisible();
  });
});
