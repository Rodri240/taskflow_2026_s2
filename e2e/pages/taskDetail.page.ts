import { type Locator, type Page } from '@playwright/test';
import { Feedback } from '../components/feedback';
import { TaskDetail } from '../components/taskDetail';

export class TaskDetailPage {
  readonly feedback: Feedback;
  readonly detail: TaskDetail;

  constructor(private readonly page: Page) {
    this.feedback = new Feedback(page);
    this.detail = new TaskDetail(page);
  }

  get root(): Locator {
    return this.page.getByTestId('task-detail-page');
  }

  async goto(projectId: string, taskId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}/tasks/${taskId}`);
  }
}
