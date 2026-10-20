import type { Locator, Page } from '@playwright/test';
import { Component } from './base';

export interface TaskEditFields {
  title?: string;
  description?: string;
  priority?: string;
  /** email del asignado; se elige por label en el <select> */
  assignee?: string;
  dueDate?: string;
}

/** Detalle de tarea: edición, estado, etiquetas, comentarios e historial. */
export class TaskDetail extends Component {
  constructor(page: Page) {
    super(page, page.getByTestId('task-detail-page'));
  }

  get id(): Locator {
    return this.root.getByTestId('task-detail-id');
  }

  get backLink(): Locator {
    return this.root.getByTestId('task-detail-back-link');
  }

  // --- Edición ---
  get titleInput(): Locator {
    return this.root.getByTestId('task-title-input');
  }

  get descriptionInput(): Locator {
    return this.root.getByTestId('task-description-input');
  }

  get prioritySelect(): Locator {
    return this.root.getByTestId('task-priority-select');
  }

  get assigneeSelect(): Locator {
    return this.root.getByTestId('task-assignee-select');
  }

  get dueDateInput(): Locator {
    return this.root.getByTestId('task-duedate-input');
  }

  get dueDateValue(): Locator {
    return this.root.getByTestId('task-duedate-value');
  }

  get saveButton(): Locator {
    return this.root.getByTestId('task-save-button');
  }

  get deleteButton(): Locator {
    return this.root.getByTestId('task-delete-button');
  }

  // --- Estado ---
  get statusSelect(): Locator {
    return this.root.getByTestId('task-status-select');
  }

  get statusSubmit(): Locator {
    return this.root.getByTestId('task-status-submit');
  }

  get currentStatus(): Locator {
    return this.root.getByTestId('task-current-status');
  }

  // --- Etiquetas ---
  get tagAddInput(): Locator {
    return this.root.getByTestId('tag-add-input');
  }

  get tagAddButton(): Locator {
    return this.root.getByTestId('tag-add-button');
  }

  get tagChips(): Locator {
    return this.root.getByTestId('tag-chip');
  }

  get commentInput(): Locator {
    return this.root.getByTestId('comment-add-input');
  }

  get commentAddButton(): Locator {
    return this.root.getByTestId('comment-add-button');
  }

  get comments(): Locator {
    return this.root.getByTestId('comment-item');
  }

  get history(): Locator {
    return this.root.getByTestId('history-item');
  }

  async edit(fields: TaskEditFields): Promise<void> {
    if (fields.title !== undefined) await this.titleInput.fill(fields.title);
    if (fields.description !== undefined) await this.descriptionInput.fill(fields.description);
    if (fields.priority !== undefined) await this.prioritySelect.selectOption(fields.priority);
    if (fields.assignee !== undefined) {
      await this.assigneeSelect
        .locator('option', { hasText: fields.assignee })
        .first()
        .waitFor({ state: 'attached' });
      await this.assigneeSelect.selectOption({ label: fields.assignee });
    }
    if (fields.dueDate !== undefined) await this.dueDateInput.fill(fields.dueDate);
    await this.saveButton.click();
  }

  async clearAssignee(): Promise<void> {
    await this.assigneeSelect.selectOption('');
    await this.saveButton.click();
  }

  async changeStatus(status: string): Promise<void> {
    await this.statusSelect.selectOption(status);
    await this.statusSubmit.click();
  }

  async addTag(name: string): Promise<void> {
    await this.tagAddInput.fill(name);
    await this.tagAddButton.click();
  }

  tag(name: string): Locator {
    return this.tagChips.filter({ hasText: name });
  }

  async removeTag(name: string): Promise<void> {
    await this.tag(name).getByTestId('tag-remove-button').click();
  }

  async addComment(body: string): Promise<void> {
    await this.commentInput.fill(body);
    await this.commentAddButton.click();
  }

  comment(body: string): Locator {
    return this.comments.filter({ hasText: body });
  }

  async deleteComment(body: string): Promise<void> {
    await this.comment(body).getByTestId('comment-delete-button').click();
  }

  async deleteTask(): Promise<void> {
    await this.deleteButton.click();
  }
}
