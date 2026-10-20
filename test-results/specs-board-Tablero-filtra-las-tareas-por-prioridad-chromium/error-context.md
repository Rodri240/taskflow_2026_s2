# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs\board.spec.ts >> Tablero >> filtra las tareas por prioridad
- Location: e2e\specs\board.spec.ts:50:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/projects$/
Received string:  "http://127.0.0.1:5173/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × locator resolved to <html lang="es">…</html>
       - unexpected value "http://127.0.0.1:5173/login"

```

```yaml
- main:
  - heading "Ingresar" [level=1]
  - text: Email
  - textbox "Email": ana@test.com
  - text: Contraseña
  - textbox "Contraseña": Password1
  - alert: Account temporarily locked. Try again later.
  - button "Ingresar"
  - button "No tengo cuenta"
```

# Test source

```ts
  1  | import { expect, type Page } from '@playwright/test';
  2  | import { AppHeader } from '../components/header';
  3  | import { Feedback } from '../components/feedback';
  4  | import { LoginPage } from '../pages/login.page';
  5  | import { ProjectsPage } from '../pages/projects.page';
  6  | import { BoardPage } from '../pages/board.page';
  7  | import { TaskDetailPage } from '../pages/taskDetail.page';
  8  | import { MembersPage } from '../pages/members.page';
  9  | import { USERS, type Status } from '../support/data';
  10 | import type { Credentials } from '../fixtures/api';
  11 | import type { NewTask } from '../components/taskCreateForm';
  12 | import type { TaskFilters } from '../components/taskFilterForm';
  13 | 
  14 | /**
  15 |  * App Actions: verbos de negocio sobre los page objects. Los specs describen
  16 |  * qué hace el usuario, no cómo se seleccionan los elementos.
  17 |  */
  18 | export class AppActions {
  19 |   readonly login: LoginPage;
  20 |   readonly projects: ProjectsPage;
  21 |   readonly board: BoardPage;
  22 |   readonly taskDetail: TaskDetailPage;
  23 |   readonly members: MembersPage;
  24 |   readonly header: AppHeader;
  25 |   readonly feedback: Feedback;
  26 | 
  27 |   constructor(readonly page: Page) {
  28 |     this.login = new LoginPage(page);
  29 |     this.projects = new ProjectsPage(page);
  30 |     this.board = new BoardPage(page);
  31 |     this.taskDetail = new TaskDetailPage(page);
  32 |     this.members = new MembersPage(page);
  33 |     this.header = new AppHeader(page);
  34 |     this.feedback = new Feedback(page);
  35 |   }
  36 | 
  37 |   async openLogin(): Promise<void> {
  38 |     await this.login.goto();
  39 |   }
  40 | 
  41 |   async loginAs(creds: Credentials = USERS.ana): Promise<void> {
  42 |     await this.login.goto();
  43 |     await this.login.login(creds.email, creds.password);
> 44 |     await expect(this.page).toHaveURL(/\/projects$/);
     |                             ^ Error: expect(page).toHaveURL(expected) failed
  45 |   }
  46 | 
  47 |   async register(name: string, email: string, password: string): Promise<void> {
  48 |     await this.login.goto();
  49 |     await this.login.register(name, email, password);
  50 |     await expect(this.page).toHaveURL(/\/projects$/);
  51 |   }
  52 | 
  53 |   async logout(): Promise<void> {
  54 |     await this.header.logout();
  55 |     await expect(this.page).toHaveURL(/\/login$/);
  56 |   }
  57 | 
  58 |   async openProjects(): Promise<void> {
  59 |     await this.projects.goto();
  60 |   }
  61 | 
  62 |   async createProject(name: string, description?: string): Promise<void> {
  63 |     await this.projects.createProject(name, description);
  64 |     await expect(this.projects.card(name).name).toBeVisible();
  65 |   }
  66 | 
  67 |   async openBoard(projectName: string): Promise<void> {
  68 |     await this.projects.goto();
  69 |     await this.projects.card(projectName).open();
  70 |     await expect(this.board.root).toBeVisible();
  71 |   }
  72 | 
  73 |   async createTask(task: NewTask): Promise<void> {
  74 |     await this.board.createTask(task);
  75 |     await expect(this.board.card(task.title).title).toBeVisible();
  76 |   }
  77 | 
  78 |   async openTask(title: string): Promise<void> {
  79 |     await this.board.card(title).open();
  80 |     await expect(this.taskDetail.root).toBeVisible();
  81 |   }
  82 | 
  83 |   async filterTasks(filters: TaskFilters): Promise<void> {
  84 |     await this.board.filter(filters);
  85 |   }
  86 | 
  87 |   async changeTaskStatusOnBoard(title: string, status: Status): Promise<void> {
  88 |     await this.board.card(title).changeStatus(status);
  89 |   }
  90 | 
  91 |   async openMembers(projectName: string): Promise<void> {
  92 |     await this.projects.goto();
  93 |     await this.projects.card(projectName).openMembers();
  94 |     await expect(this.members.root).toBeVisible();
  95 |   }
  96 | }
  97 | 
```