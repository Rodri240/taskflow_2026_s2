import type { Locator, Page } from '@playwright/test';
import { Component } from './base';

export class MemberList extends Component {
  constructor(page: Page) {
    super(page, page.getByTestId('member-list'));
  }

  get items(): Locator {
    return this.root.getByTestId('member-item');
  }

  get emails(): Locator {
    return this.root.getByTestId('member-item-email');
  }

  item(email: string): Locator {
    return this.items.filter({ hasText: email });
  }

  role(email: string): Locator {
    return this.item(email).getByTestId('member-item-role');
  }

  removeButton(email: string): Locator {
    return this.item(email).getByTestId('member-remove-button');
  }
}
