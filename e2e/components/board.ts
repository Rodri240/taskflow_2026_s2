import type { Locator, Page } from '@playwright/test';
import { Component } from './base';
import { TaskCard } from './taskCard';

/** Una columna del tablero (TODO / IN_PROGRESS / DONE). */
export class BoardColumn extends Component {
  constructor(
    page: Page,
    readonly status: string,
  ) {
    super(page, page.getByTestId(`board-column-${status}`));
  }

  get title(): Locator {
    return this.root.locator('.board-column-title');
  }

  get count(): Locator {
    return this.root.getByTestId(`board-column-count-${this.status}`);
  }

  get list(): Locator {
    return this.root.getByTestId(`board-column-list-${this.status}`);
  }

  get cards(): Locator {
    return this.list.getByTestId('task-card');
  }

  card(title: string): TaskCard {
    return new TaskCard(this.page, this.cards.filter({ hasText: title }));
  }

  async countValue(): Promise<number> {
    const text = (await this.count.innerText()).replace(/[^0-9]/g, '');
    return Number(text);
  }
}
