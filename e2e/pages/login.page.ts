import { type Locator, type Page } from '@playwright/test';
import { Feedback } from '../components/feedback';

export class LoginPage {
  readonly feedback: Feedback;

  constructor(private readonly page: Page) {
    this.feedback = new Feedback(page);
  }

  get form(): Locator {
    return this.page.getByTestId('login-form');
  }

  get nameInput(): Locator {
    return this.page.getByTestId('login-name-input');
  }

  get emailInput(): Locator {
    return this.page.getByTestId('login-email-input');
  }

  get passwordInput(): Locator {
    return this.page.getByTestId('login-password-input');
  }

  get submitButton(): Locator {
    return this.page.getByTestId('login-submit');
  }

  get modeToggle(): Locator {
    return this.page.getByTestId('login-mode-toggle');
  }

  get error(): Locator {
    return this.feedback.error;
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async register(name: string, email: string, password: string): Promise<void> {
    if (await this.modeToggle.innerText().then((t) => t.includes('No tengo cuenta'))) {
      await this.modeToggle.click();
    }
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
