import { expect, type Page } from '@playwright/test';
import { AppHeader } from '../components/header';
import { Feedback } from '../components/feedback';
import { LoginPage } from '../pages/login.page';
import { ProjectsPage } from '../pages/projects.page';
import { BoardPage } from '../pages/board.page';
import { TaskDetailPage } from '../pages/taskDetail.page';
import { MembersPage } from '../pages/members.page';
import { USERS, type Status } from '../support/data';
import type { Credentials } from '../fixtures/api';
import type { NewTask } from '../components/taskCreateForm';
import type { TaskFilters } from '../components/taskFilterForm';

/**
 * App Actions: verbos de negocio sobre los page objects. Los specs describen
 * qué hace el usuario, no cómo se seleccionan los elementos.
 */
export class AppActions {
  readonly login: LoginPage;
  readonly projects: ProjectsPage;
  readonly board: BoardPage;
  readonly taskDetail: TaskDetailPage;
  readonly members: MembersPage;
  readonly header: AppHeader;
  readonly feedback: Feedback;

  constructor(readonly page: Page) {
    this.login = new LoginPage(page);
    this.projects = new ProjectsPage(page);
    this.board = new BoardPage(page);
    this.taskDetail = new TaskDetailPage(page);
    this.members = new MembersPage(page);
    this.header = new AppHeader(page);
    this.feedback = new Feedback(page);
  }

  async openLogin(): Promise<void> {
    await this.login.goto();
  }

  async loginAs(creds: Credentials = USERS.ana): Promise<void> {
    await this.login.goto();
    await this.login.login(creds.email, creds.password);
    await expect(this.page).toHaveURL(/\/projects$/);
  }

  async register(name: string, email: string, password: string): Promise<void> {
    await this.login.goto();
    await this.login.register(name, email, password);
    await expect(this.page).toHaveURL(/\/projects$/);
  }

  async logout(): Promise<void> {
    await this.header.logout();
    await expect(this.page).toHaveURL(/\/login$/);
  }

  async openProjects(): Promise<void> {
    await this.projects.goto();
  }

  async createProject(name: string, description?: string): Promise<void> {
    await this.projects.createProject(name, description);
    await expect(this.projects.card(name).name).toBeVisible();
  }

  async openBoard(projectName: string): Promise<void> {
    await this.projects.goto();
    await this.projects.card(projectName).open();
    await expect(this.board.root).toBeVisible();
  }

  async createTask(task: NewTask): Promise<void> {
    await this.board.createTask(task);
    await expect(this.board.card(task.title).title).toBeVisible();
  }

  async openTask(title: string): Promise<void> {
    await this.board.card(title).open();
    await expect(this.taskDetail.root).toBeVisible();
  }

  async filterTasks(filters: TaskFilters): Promise<void> {
    await this.board.filter(filters);
  }

  async changeTaskStatusOnBoard(title: string, status: Status): Promise<void> {
    await this.board.card(title).changeStatus(status);
  }

  async openMembers(projectName: string): Promise<void> {
    await this.projects.goto();
    await this.projects.card(projectName).openMembers();
    await expect(this.members.root).toBeVisible();
  }
}
