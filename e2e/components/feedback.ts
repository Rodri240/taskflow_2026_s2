import type { Locator, Page } from '@playwright/test';

/** Mapea los estados globales de UI definidos en `client/src/lib/ui.tsx`. */
export class Feedback {
  readonly loading: Locator;
  readonly error: Locator;
  readonly empty: Locator;

  constructor(private readonly page: Page) {
    this.loading = page.getByTestId('loading');
    this.error = page.getByTestId('error-message');
    this.empty = page.getByTestId('empty-state');
  }

  errorWith(text: string | RegExp): Locator {
    return this.error.filter({ hasText: text });
  }
}
