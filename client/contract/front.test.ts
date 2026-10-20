import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchersV3, PactV4 } from '@pact-foundation/pact';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setToken } from '../src/lib/api';

const provider = new PactV4({
  consumer: 'taskflow-web',
  provider: 'taskflow-api',
  dir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../pacts'),
});
const { regex } = MatchersV3;

function createContractToken(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ userId: 1, email: 'ana@test.com', exp: 4102444800 }),
  ).toString('base64url');
  const content = `${header}.${payload}`;
  const signature = createHmac('sha256', 'test-secret').update(content).digest('base64url');
  return `${content}.${signature}`;
}

const realFetch = globalThis.fetch;

function apuntarFetchA(baseUrl: string): void {
  vi.stubGlobal('fetch', (url: string | URL | Request, init?: RequestInit) =>
    realFetch(
      typeof url === 'string' && url.startsWith('http') ? url : `${baseUrl}${url}`,
      init,
    ),
  );
}

describe('taskflow-web contract', () => {
  beforeAll(() => {
    fs.rmSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../pacts'), {
      recursive: true,
      force: true,
    });
  });

  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    setToken(createContractToken());
  });

  it('logs in a user', async () => {
    await provider
      .addInteraction()
      .uponReceiving('a login request')
      .withRequest('POST', '/api/auth/login', (request) => {
        request.headers({ 'Content-Type': 'application/json' });
        request.jsonBody({ email: 'ana@test.com', password: 'Password1' });
      })
      .willRespondWith(200, (response) => {
        response.jsonBody({
          user: {
            id: 'user-1',
            email: 'ana@test.com',
            name: 'Ana',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          token: regex(/^.+$/, createContractToken()),
        });
      })
      .executeTest(async (mockServer) => {
        apuntarFetchA(mockServer.url);
        await expect(
          api<{ user: { id: string; email: string }; token: string }>('/auth/login', {
            method: 'POST',
            body: { email: 'ana@test.com', password: 'Password1' },
          }),
        ).resolves.toMatchObject({
          user: { id: 'user-1', email: 'ana@test.com' },
          token: expect.any(String),
        });
      });
  });

  it('lists comments for a task', async () => {
    await provider
      .addInteraction()
      .given('ana es miembro de proj-1 y task-1 tiene comentarios')
      .uponReceiving('a task comments request')
      .withRequest('GET', '/api/tasks/task-1/comments', (request) => {
        request.headers({ Authorization: `Bearer ${createContractToken()}` });
      })
      .willRespondWith(200, (response) => {
        response.jsonBody([
          {
            id: 'comment-1',
            taskId: 'task-1',
            authorId: 'user-1',
            body: 'Comentario de prueba',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
      })
      .executeTest(async (mockServer) => {
        apuntarFetchA(mockServer.url);
        await expect(
          api<Array<{ id: string; taskId: string; body: string; createdAt: string }>>(
            '/tasks/task-1/comments',
          ),
        ).resolves.toEqual([
          {
            id: 'comment-1',
            taskId: 'task-1',
            authorId: 'user-1',
            body: 'Comentario de prueba',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
      });
  });
});
