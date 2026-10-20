import { test as base, expect, type Page } from '@playwright/test';
import { ApiClient, type AuthSession, type Credentials } from './api';
import { USERS } from '../support/data';

export type SessionFn = (creds?: Credentials) => Promise<AuthSession>;

interface AuthFixtures {
  api: ApiClient;
  session: SessionFn;
}

/**
 * Planta el token y el usuario en localStorage antes de que cargue la SPA.
 * Debe invocarse antes de la primera navegación del test.
 */
export async function plantSession(page: Page, auth: AuthSession): Promise<void> {
  await page.addInitScript(
    ([token, user]) => {
      window.localStorage.setItem('taskflow_token', token);
      window.localStorage.setItem('taskflow_user', JSON.stringify(user));
    },
    [auth.token, auth.user] as [string, unknown],
  );
}

export const test = base.extend<AuthFixtures>({
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },

  session: async ({ api, page }, use) => {
    const signIn: SessionFn = async (creds = USERS.ana) => {
      const auth = await api.login(creds.email, creds.password);
      await plantSession(page, auth);
      return auth;
    };
    await use(signIn);
  },
});

export { expect };
