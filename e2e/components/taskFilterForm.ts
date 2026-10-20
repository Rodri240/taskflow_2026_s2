import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { Component } from './base';

export interface TaskFilters {
  priority?: string;
  /** email del asignado; se elige por label en el <select> */
  assignedTo?: string;
  search?: string;
}

export class TaskFilterForm extends Component {
  constructor(page: Page) {
    super(page, page.getByTestId('filter-form'));
  }

  get prioritySelect(): Locator {
    return this.root.getByTestId('filter-priority-select');
  }

  get assigneeSelect(): Locator {
    return this.root.getByTestId('filter-assignee-select');
  }

  get searchInput(): Locator {
    return this.root.getByTestId('filter-search-input');
  }

  get applyButton(): Locator {
    return this.root.getByTestId('filter-apply-button');
  }

  get clearButton(): Locator {
    return this.root.getByTestId('filter-clear-button');
  }

  async apply(filters: TaskFilters): Promise<void> {
    // El tablero parte mostrando "Total: 0" mientras carga; esperar a que la
    // carga inicial termine evita aplicar filtros sobre una lista vacía.
    const total = this.page.getByTestId('board-total');
    if (await total.isVisible().catch(() => false)) {
      await expect(total).not.toHaveText('Total: 0').catch(() => undefined);
    }
    if (filters.priority !== undefined) {
      await this.prioritySelect.selectOption(filters.priority || '');
    }
    if (filters.assignedTo !== undefined) {
      await this.assigneeSelect
        .locator('option', { hasText: filters.assignedTo })
        .first()
        .waitFor({ state: 'attached' });
      await this.assigneeSelect.selectOption({ label: filters.assignedTo });
    }
    if (filters.search !== undefined) {
      await this.searchInput.fill(filters.search);
    }
    await this.applyButton.click();
  }

  async clear(): Promise<void> {
    await this.clearButton.click();
  }
}
