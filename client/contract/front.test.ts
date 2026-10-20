import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PactV4 } from '@pact-foundation/pact';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setToken } from '../src/lib/api';

const contractToken = 'token-de-prueba';
const pactDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../pacts');
const provider = new PactV4({
  consumer: 'taskflow-web',
  provider: 'taskflow-api',
  dir: pactDirectory,
});

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
    fs.rmSync(pactDirectory, { recursive: true, force: true });
  });

  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    setToken(contractToken);
  });

  it('lists the projects for a user', async () => {
    await provider
      .addInteraction()
      .given('el usuario ana tiene proyectos')
      .uponReceiving('un GET a /api/projects')
      .withRequest('GET', '/api/projects', (request) => {
        request.headers({ Authorization: `Bearer ${contractToken}` });
      })
      .willRespondWith(200, (response) => {
        response.jsonBody([
          {
            id: 'proj-1',
            name: 'Proyecto 1',
          },
        ]);
      })
      .executeTest(async (mockServer) => {
        apuntarFetchA(mockServer.url);

        await expect(api<Array<{ id: string; name: string }>>('/projects')).resolves.toEqual([
          { id: 'proj-1', name: 'Proyecto 1' },
        ]);
      });
  });
});
