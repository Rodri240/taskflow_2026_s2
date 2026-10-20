import { type Locator, type Page } from '@playwright/test';
import { Feedback } from '../components/feedback';
import { MemberList } from '../components/memberList';

export class MembersPage {
  readonly feedback: Feedback;
  readonly list: MemberList;

  constructor(private readonly page: Page) {
    this.feedback = new Feedback(page);
    this.list = new MemberList(page);
  }

  get root(): Locator {
    return this.page.getByTestId('members-page');
  }

  get addForm(): Locator {
    return this.page.getByTestId('member-add-form');
  }

  get emailInput(): Locator {
    return this.page.getByTestId('member-email-input');
  }

  get addButton(): Locator {
    return this.page.getByTestId('member-add-button');
  }

  get readonlyNote(): Locator {
    return this.page.getByTestId('members-readonly-note');
  }

  async goto(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}/members`);
  }

  async add(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.addButton.click();
  }
}
