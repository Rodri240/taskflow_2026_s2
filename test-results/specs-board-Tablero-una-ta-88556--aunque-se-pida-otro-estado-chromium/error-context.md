# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs\board.spec.ts >> Tablero >> una tarea creada por API nace en TODO aunque se pida otro estado
- Location: e2e\specs\board.spec.ts:21:7

# Error details

```
Error: API POST /auth/login falló: 401 {"error":{"code":"UNAUTHORIZED","message":"Account temporarily locked. Try again later.","details":[]}}
```

# Test source

```ts
  1   | import type { APIRequestContext, APIResponse } from '@playwright/test';
  2   | 
  3   | export const API_BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
  4   | 
  5   | export interface ApiUser {
  6   |   id: string;
  7   |   email: string;
  8   |   name: string | null;
  9   |   createdAt?: string;
  10  | }
  11  | 
  12  | export interface AuthSession {
  13  |   token: string;
  14  |   user: ApiUser;
  15  | }
  16  | 
  17  | export interface ApiProject {
  18  |   id: string;
  19  |   name: string;
  20  |   description: string | null;
  21  |   ownerId: string;
  22  |   archived: boolean;
  23  |   createdAt: string;
  24  | }
  25  | 
  26  | export interface ApiTask {
  27  |   id: string;
  28  |   projectId: string;
  29  |   title: string;
  30  |   description: string | null;
  31  |   status: string;
  32  |   priority: string;
  33  |   assigneeId: string | null;
  34  |   dueDate: string | null;
  35  |   createdAt: string;
  36  |   updatedAt: string;
  37  |   assignee?: { id: string; email: string } | null;
  38  |   commentCount?: number;
  39  | }
  40  | 
  41  | export interface ApiTaskList {
  42  |   items: ApiTask[];
  43  |   total: number;
  44  |   limit: number;
  45  |   offset: number;
  46  | }
  47  | 
  48  | export interface ApiComment {
  49  |   id: string;
  50  |   taskId: string;
  51  |   authorId: string;
  52  |   body: string;
  53  |   createdAt: string;
  54  | }
  55  | 
  56  | export type Credentials = { email: string; password: string };
  57  | 
  58  | /**
  59  |  * Cliente mínimo contra la API real. Se usa para preparar el estado de cada
  60  |  * test (App Actions / fixtures) sin depender de la UI para el setup.
  61  |  */
  62  | export class ApiClient {
  63  |   constructor(
  64  |     private readonly request: APIRequestContext,
  65  |     private readonly baseURL: string = API_BASE_URL,
  66  |   ) {}
  67  | 
  68  |   private url(path: string): string {
  69  |     return `${this.baseURL}/api${path}`;
  70  |   }
  71  | 
  72  |   private headers(token?: string): Record<string, string> {
  73  |     return token ? { Authorization: `Bearer ${token}` } : {};
  74  |   }
  75  | 
  76  |   private async parse<T>(res: APIResponse, context: string): Promise<T> {
  77  |     if (!res.ok()) {
  78  |       const body = await res.text().catch(() => '');
> 79  |       throw new Error(`API ${context} falló: ${res.status()} ${body}`);
      |             ^ Error: API POST /auth/login falló: 401 {"error":{"code":"UNAUTHORIZED","message":"Account temporarily locked. Try again later.","details":[]}}
  80  |     }
  81  |     if (res.status() === 204) return undefined as T;
  82  |     return (await res.json()) as T;
  83  |   }
  84  | 
  85  |   async register(email: string, password: string, name?: string): Promise<AuthSession> {
  86  |     const res = await this.request.post(this.url('/auth/register'), {
  87  |       data: name ? { email, password, name } : { email, password },
  88  |     });
  89  |     return this.parse<AuthSession>(res, 'POST /auth/register');
  90  |   }
  91  | 
  92  |   async login(email: string, password: string): Promise<AuthSession> {
  93  |     const res = await this.request.post(this.url('/auth/login'), { data: { email, password } });
  94  |     return this.parse<AuthSession>(res, 'POST /auth/login');
  95  |   }
  96  | 
  97  |   async createProject(
  98  |     token: string,
  99  |     body: { name: string; description?: string | null },
  100 |   ): Promise<ApiProject> {
  101 |     const res = await this.request.post(this.url('/projects'), {
  102 |       headers: this.headers(token),
  103 |       data: body,
  104 |     });
  105 |     return this.parse<ApiProject>(res, 'POST /projects');
  106 |   }
  107 | 
  108 |   async listProjects(token: string): Promise<ApiProject[]> {
  109 |     const res = await this.request.get(this.url('/projects'), { headers: this.headers(token) });
  110 |     return this.parse<ApiProject[]>(res, 'GET /projects');
  111 |   }
  112 | 
  113 |   async createTask(
  114 |     token: string,
  115 |     projectId: string,
  116 |     body: Record<string, unknown>,
  117 |   ): Promise<ApiTask> {
  118 |     const res = await this.request.post(this.url(`/projects/${projectId}/tasks`), {
  119 |       headers: this.headers(token),
  120 |       data: body,
  121 |     });
  122 |     return this.parse<ApiTask>(res, 'POST /projects/:id/tasks');
  123 |   }
  124 | 
  125 |   async listTasks(
  126 |     token: string,
  127 |     projectId: string,
  128 |     query: Record<string, string | number> = {},
  129 |   ): Promise<ApiTaskList> {
  130 |     const params = new URLSearchParams();
  131 |     for (const [key, value] of Object.entries(query)) params.set(key, String(value));
  132 |     const suffix = params.toString() ? `?${params}` : '';
  133 |     const res = await this.request.get(this.url(`/projects/${projectId}/tasks${suffix}`), {
  134 |       headers: this.headers(token),
  135 |     });
  136 |     return this.parse<ApiTaskList>(res, 'GET /projects/:id/tasks');
  137 |   }
  138 | 
  139 |   async getTask(token: string, taskId: string): Promise<ApiTask> {
  140 |     const res = await this.request.get(this.url(`/tasks/${taskId}`), {
  141 |       headers: this.headers(token),
  142 |     });
  143 |     return this.parse<ApiTask>(res, 'GET /tasks/:id');
  144 |   }
  145 | 
  146 |   async addMember(token: string, projectId: string, email: string): Promise<unknown> {
  147 |     const res = await this.request.post(this.url(`/projects/${projectId}/members`), {
  148 |       headers: this.headers(token),
  149 |       data: { email },
  150 |     });
  151 |     return this.parse(res, 'POST /projects/:id/members');
  152 |   }
  153 | 
  154 |   async addComment(token: string, taskId: string, body: string): Promise<ApiComment> {
  155 |     const res = await this.request.post(this.url(`/tasks/${taskId}/comments`), {
  156 |       headers: this.headers(token),
  157 |       data: { body },
  158 |     });
  159 |     return this.parse<ApiComment>(res, 'POST /tasks/:id/comments');
  160 |   }
  161 | 
  162 |   async rawPost(path: string, data: unknown, token?: string): Promise<APIResponse> {
  163 |     return this.request.post(this.url(path), { headers: this.headers(token), data });
  164 |   }
  165 | 
  166 |   async rawGet(path: string, token?: string): Promise<APIResponse> {
  167 |     return this.request.get(this.url(path), { headers: this.headers(token) });
  168 |   }
  169 | 
  170 |   async rawPatch(path: string, data: unknown, token?: string): Promise<APIResponse> {
  171 |     return this.request.patch(this.url(path), { headers: this.headers(token), data });
  172 |   }
  173 | 
  174 |   async rawDelete(path: string, token?: string): Promise<APIResponse> {
  175 |     return this.request.delete(this.url(path), { headers: this.headers(token) });
  176 |   }
  177 | }
  178 | 
```