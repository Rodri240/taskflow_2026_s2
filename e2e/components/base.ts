import type { Locator, Page } from '@playwright/test';

/**
 * Raíz común del Component Object Model: cada componente queda anclado a un
 * `Locator` (normalmente un `data-testid`) y expone solo lo que necesita.
 */
export abstract class Component {
  protected constructor(
    readonly page: Page,
    readonly root: Locator,
  ) {}
}
