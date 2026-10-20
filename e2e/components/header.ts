import type { Locator, Page } from '@playwright/test';
import { Component } from './base';

export class AppHeader extends Component {
  constructor(page: Page) {
    super(page, page.getByTestId('app-header'));
  }

  get userEmail(): Locator {
    return this.root.getByTestId('header-user-email');
  }

  get homeLink(): Locator {
    return this.root.getByTestId('header-home-link');
  }

  get logoutButton(): Locator {
    return this.root.getByTestId('logout-button');
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
