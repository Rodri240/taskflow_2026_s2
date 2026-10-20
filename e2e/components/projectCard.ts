import type { Locator, Page } from '@playwright/test';
import { Component } from './base';

export class ProjectCard extends Component {
  constructor(page: Page, root: Locator) {
    super(page, root);
  }

  get name(): Locator {
    return this.root.getByTestId('project-card-name');
  }

  get description(): Locator {
    return this.root.getByTestId('project-card-description');
  }

  get archivedBadge(): Locator {
    return this.root.getByTestId('project-card-archived');
  }

  get membersLink(): Locator {
    return this.root.getByTestId('project-card-members-link');
  }

  async open(): Promise<void> {
    await this.name.click();
  }

  async openMembers(): Promise<void> {
    await this.membersLink.click();
  }
}
