import type { Locator, Page } from '@playwright/test';
import { Component } from './base';

export interface NewTask {
  title: string;
  description?: string;
  priority?: string;
  /** email del asignado; se elige por label en el <select> */
  assignee?: string;
  dueDate?: string;
}

export class TaskCreateForm extends Component {
  constructor(page: Page) {
    super(page, page.getByTestId('task-create-form'));
  }

  get titleInput(): Locator {
    return this.root.getByTestId('task-create-title-input');
  }

  get descriptionInput(): Locator {
    return this.root.getByTestId('task-create-description-input');
  }

  get prioritySelect(): Locator {
    return this.root.getByTestId('task-create-priority-select');
  }

  get assigneeSelect(): Locator {
    return this.root.getByTestId('task-create-assignee-select');
  }

  get dueDateInput(): Locator {
    return this.root.getByTestId('task-create-duedate-input');
  }

  get submitButton(): Locator {
    return this.root.getByTestId('task-create-submit');
  }

  async fill(task: NewTask): Promise<void> {
    await this.titleInput.fill(task.title);
    if (task.description !== undefined) await this.descriptionInput.fill(task.description);
    if (task.priority !== undefined) await this.prioritySelect.selectOption(task.priority);
    if (task.assignee !== undefined) {
      await this.assigneeSelect
        .locator('option', { hasText: task.assignee })
        .first()
        .waitFor({ state: 'attached' });
      await this.assigneeSelect.selectOption({ label: task.assignee });
    }
    if (task.dueDate !== undefined) await this.dueDateInput.fill(task.dueDate);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async create(task: NewTask): Promise<void> {
    await this.fill(task);
    await this.submit();
  }
}
