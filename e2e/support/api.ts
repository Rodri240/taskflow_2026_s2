import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
  type Response,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';

export const VALID_PASSWORD = 'Password1';

export interface UserAccount {
  id: string;
  email: string;
  name: string | null;
  token: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
}

export function uniqueValue(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function uniqueEmail(prefix: string): string {
  return `${uniqueValue(prefix)}@e2e.test`.toLowerCase();
}

export function authorization(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

type PlaywrightResponse = APIResponse | Response;

async function responseBody(response: PlaywrightResponse): Promise<unknown> {
  if (response.status() === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function expectStatus<T = unknown>(
  response: PlaywrightResponse,
  status: number,
): Promise<T> {
  const body = await responseBody(response);
  const method = 'request' in response ? response.request().method() : 'HTTP';
  expect(
    response.status(),
    `${method} ${response.url()}\n${JSON.stringify(body, null, 2)}`,
  ).toBe(status);
  return body as T;
}

export async function registerUser(
  request: APIRequestContext,
  prefix = 'user',
): Promise<UserAccount> {
  const email = uniqueEmail(prefix);
  const response = await request.post('/api/auth/register', {
    data: { email, password: VALID_PASSWORD, name: prefix },
  });
  const body = await expectStatus<{ user: Omit<UserAccount, 'token'>; token: string }>(
    response,
    201,
  );
  expect(body.token).toEqual(expect.any(String));
  expect(body.user).toMatchObject({
    id: expect.stringMatching(/^user-\d+$/),
    email,
  });
  return { ...body.user, token: body.token };
}

export async function createProject(
  request: APIRequestContext,
  owner: UserAccount,
  overrides: Partial<{ name: string; description: string }> = {},
): Promise<ProjectRecord> {
  const data = {
    name: overrides.name ?? uniqueValue('Proyecto E2E'),
    description: overrides.description ?? 'Proyecto aislado para Playwright',
  };
  const response = await request.post('/api/projects', {
    headers: authorization(owner.token),
    data,
  });
  const project = await expectStatus<ProjectRecord>(response, 201);
  expect(project).toMatchObject({
    id: expect.stringMatching(/^proj-\d+$/),
    name: data.name,
    description: data.description,
    ownerId: owner.id,
  });
  return project;
}

export async function addProjectMember(
  request: APIRequestContext,
  owner: UserAccount,
  project: ProjectRecord,
  member: UserAccount,
): Promise<void> {
  const response = await request.post(`/api/projects/${project.id}/members`, {
    headers: authorization(owner.token),
    data: { email: member.email },
  });
  const body = await expectStatus<{ userId: string; email: string; role: string }>(response, 201);
  expect(body).toMatchObject({ userId: member.id, email: member.email, role: 'MEMBER' });
}

export async function createTask(
  request: APIRequestContext,
  actor: UserAccount,
  project: ProjectRecord,
  overrides: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    dueDate: string | null;
  }> = {},
): Promise<TaskRecord> {
  const data = {
    title: overrides.title ?? uniqueValue('Tarea E2E'),
    description: overrides.description,
    status: overrides.status,
    priority: overrides.priority ?? 'MEDIUM',
    assigneeId: overrides.assigneeId,
    dueDate: overrides.dueDate,
  };
  const response = await request.post(`/api/projects/${project.id}/tasks`, {
    headers: authorization(actor.token),
    data: Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
  });
  const task = await expectStatus<TaskRecord>(response, 201);
  expect(task.id).toMatch(/^task-\d+$/);
  return task;
}

export async function authenticatePage(page: Page, account: UserAccount): Promise<void> {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('taskflow_token', token);
      localStorage.setItem('taskflow_user', JSON.stringify(user));
    },
    {
      token: account.token,
      user: { id: account.id, email: account.email, name: account.name },
    },
  );
}
