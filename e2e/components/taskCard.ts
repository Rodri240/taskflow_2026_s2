import type { Locator, Page } from '@playwright/test';
import { Component } from './base';

export class TaskCard extends Component {
  constructor(page: Page, root: Locator) {
    super(page, root);
  }

  get title(): Locator {
    return this.root.getByTestId('task-card-title');
  }

  get priority(): Locator {
    return this.root.getByTestId('task-card-priority');
  }

  get assignee(): Locator {
    return this.root.getByTestId('task-card-assignee');
  }

  get dueDate(): Locator {
    return this.root.getByTestId('task-card-duedate');
  }

  get commentCount(): Locator {
    return this.root.getByTestId('task-card-comment-count');
  }

  get statusSelect(): Locator {
    return this.root.getByTestId('task-card-status-select');
  }

  async open(): Promise<void> {
    await this.title.click();
  }

  async changeStatus(status: string): Promise<void> {
    await this.statusSelect.selectOption(status);
  }
}
