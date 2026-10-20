import { type Locator, type Page } from '@playwright/test';
import { Feedback } from '../components/feedback';
import { ProjectCard } from '../components/projectCard';

export class ProjectsPage {
  readonly feedback: Feedback;

  constructor(private readonly page: Page) {
    this.feedback = new Feedback(page);
  }

  get root(): Locator {
    return this.page.getByTestId('projects-page');
  }

  get nameInput(): Locator {
    return this.page.getByTestId('project-name-input');
  }

  get descriptionInput(): Locator {
    return this.page.getByTestId('project-description-input');
  }

  get submitButton(): Locator {
    return this.page.getByTestId('project-create-submit');
  }

  get list(): Locator {
    return this.page.getByTestId('project-list');
  }

  get cards(): Locator {
    return this.page.getByTestId('project-card');
  }

  get createError(): Locator {
    return this.feedback.error.first();
  }

  card(name: string): ProjectCard {
    return new ProjectCard(this.page, this.cards.filter({ hasText: name }));
  }

  async goto(): Promise<void> {
    await this.page.goto('/projects');
  }

  async createProject(name: string, description?: string): Promise<void> {
    await this.nameInput.fill(name);
    if (description !== undefined) await this.descriptionInput.fill(description);
    await this.submitButton.click();
  }
}
