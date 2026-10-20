import { type Locator, type Page } from '@playwright/test';
import { Feedback } from '../components/feedback';
import { BoardColumn } from '../components/board';
import { TaskCard } from '../components/taskCard';
import { TaskCreateForm, type NewTask } from '../components/taskCreateForm';
import { TaskFilterForm, type TaskFilters } from '../components/taskFilterForm';

export class BoardPage {
  readonly feedback: Feedback;
  readonly createForm: TaskCreateForm;
  readonly filterForm: TaskFilterForm;

  constructor(private readonly page: Page) {
    this.feedback = new Feedback(page);
    this.createForm = new TaskCreateForm(page);
    this.filterForm = new TaskFilterForm(page);
  }

  get root(): Locator {
    return this.page.getByTestId('board-page');
  }

  get name(): Locator {
    return this.page.getByTestId('board-project-name');
  }

  get membersLink(): Locator {
    return this.page.getByTestId('board-members-link');
  }

  get total(): Locator {
    return this.page.getByTestId('board-total');
  }

  get cards(): Locator {
    return this.page.getByTestId('task-card');
  }

  column(status: string): BoardColumn {
    return new BoardColumn(this.page, status);
  }

  card(title: string): TaskCard {
    return new TaskCard(this.page, this.cards.filter({ hasText: title }));
  }

  async goto(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}`);
  }

  async createTask(task: NewTask): Promise<void> {
    await this.createForm.create(task);
  }

  async filter(filters: TaskFilters): Promise<void> {
    await this.filterForm.apply(filters);
  }
}
