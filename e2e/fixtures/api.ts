import type { APIRequestContext, APIResponse } from '@playwright/test';

export const API_BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export interface ApiUser {
  id: string;
  email: string;
  name: string | null;
  createdAt?: string;
}

export interface AuthSession {
  token: string;
  user: ApiUser;
}

export interface ApiProject {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  archived: boolean;
  createdAt: string;
}

export interface ApiTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: string; email: string } | null;
  commentCount?: number;
}

export interface ApiTaskList {
  items: ApiTask[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export type Credentials = { email: string; password: string };

/**
 * Cliente mínimo contra la API real. Se usa para preparar el estado de cada
 * test (App Actions / fixtures) sin depender de la UI para el setup.
 */
export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseURL: string = API_BASE_URL,
  ) {}

  private url(path: string): string {
    return `${this.baseURL}/api${path}`;
  }

  private headers(token?: string): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async parse<T>(res: APIResponse, context: string): Promise<T> {
    if (!res.ok()) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${context} falló: ${res.status()} ${body}`);
    }
    if (res.status() === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async register(email: string, password: string, name?: string): Promise<AuthSession> {
    const res = await this.request.post(this.url('/auth/register'), {
      data: name ? { email, password, name } : { email, password },
    });
    return this.parse<AuthSession>(res, 'POST /auth/register');
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const res = await this.request.post(this.url('/auth/login'), { data: { email, password } });
    return this.parse<AuthSession>(res, 'POST /auth/login');
  }

  async createProject(
    token: string,
    body: { name: string; description?: string | null },
  ): Promise<ApiProject> {
    const res = await this.request.post(this.url('/projects'), {
      headers: this.headers(token),
      data: body,
    });
    return this.parse<ApiProject>(res, 'POST /projects');
  }

  async listProjects(token: string): Promise<ApiProject[]> {
    const res = await this.request.get(this.url('/projects'), { headers: this.headers(token) });
    return this.parse<ApiProject[]>(res, 'GET /projects');
  }

  async createTask(
    token: string,
    projectId: string,
    body: Record<string, unknown>,
  ): Promise<ApiTask> {
    const res = await this.request.post(this.url(`/projects/${projectId}/tasks`), {
      headers: this.headers(token),
      data: body,
    });
    return this.parse<ApiTask>(res, 'POST /projects/:id/tasks');
  }

  async listTasks(
    token: string,
    projectId: string,
    query: Record<string, string | number> = {},
  ): Promise<ApiTaskList> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) params.set(key, String(value));
    const suffix = params.toString() ? `?${params}` : '';
    const res = await this.request.get(this.url(`/projects/${projectId}/tasks${suffix}`), {
      headers: this.headers(token),
    });
    return this.parse<ApiTaskList>(res, 'GET /projects/:id/tasks');
  }

  async getTask(token: string, taskId: string): Promise<ApiTask> {
    const res = await this.request.get(this.url(`/tasks/${taskId}`), {
      headers: this.headers(token),
    });
    return this.parse<ApiTask>(res, 'GET /tasks/:id');
  }

  async addMember(token: string, projectId: string, email: string): Promise<unknown> {
    const res = await this.request.post(this.url(`/projects/${projectId}/members`), {
      headers: this.headers(token),
      data: { email },
    });
    return this.parse(res, 'POST /projects/:id/members');
  }

  async addComment(token: string, taskId: string, body: string): Promise<ApiComment> {
    const res = await this.request.post(this.url(`/tasks/${taskId}/comments`), {
      headers: this.headers(token),
      data: { body },
    });
    return this.parse<ApiComment>(res, 'POST /tasks/:id/comments');
  }

  async rawPost(path: string, data: unknown, token?: string): Promise<APIResponse> {
    return this.request.post(this.url(path), { headers: this.headers(token), data });
  }

  async rawGet(path: string, token?: string): Promise<APIResponse> {
    return this.request.get(this.url(path), { headers: this.headers(token) });
  }

  async rawPatch(path: string, data: unknown, token?: string): Promise<APIResponse> {
    return this.request.patch(this.url(path), { headers: this.headers(token), data });
  }

  async rawDelete(path: string, token?: string): Promise<APIResponse> {
    return this.request.delete(this.url(path), { headers: this.headers(token) });
  }
}
