import { existsSync } from 'node:fs';
import path from 'node:path';
import { Verifier } from '@pact-foundation/pact';
import { beforeAll, describe, expect, it } from 'vitest';

const providerBaseUrl = process.env.PACT_PROVIDER_BASE_URL ?? 'http://127.0.0.1:3001';
const pactFile = path.resolve(process.cwd(), 'pacts/TaskFlowWeb-TaskFlowAPI.json');

let token: string;

async function login(): Promise<string> {
  const response = await fetch(`${providerBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ana@test.com',
      password: 'Password1',
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo iniciar sesión en el provider: HTTP ${response.status}`);
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error('El login del provider no devolvió un token');
  return body.token;
}

async function ensureAnaHasProjects(): Promise<void> {
  const response = await fetch(`${providerBaseUrl}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`No se pudo preparar el estado del provider: HTTP ${response.status}`);
  }

  const projects = (await response.json()) as unknown[];
  if (projects.length === 0) {
    const createResponse = await fetch(`${providerBaseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Proyecto preparado por Pact' }),
    });

    if (!createResponse.ok) {
      throw new Error(`No se pudo crear el proyecto del estado Pact: HTTP ${createResponse.status}`);
    }
  }
}

describe('verificación del provider TaskFlowAPI', () => {
  beforeAll(async () => {
    if (!existsSync(pactFile)) {
      throw new Error('No existe el contrato. Ejecutá primero: npm run test:contract:consumer');
    }

    const health = await fetch(`${providerBaseUrl}/api/health`);
    expect(health.ok, 'La API de test no está disponible en el puerto 3001').toBe(true);
    token = await login();
  });

  it('cumple el contrato generado por TaskFlowWeb', async () => {
    await new Verifier({
      provider: 'TaskFlowAPI',
      providerBaseUrl,
      pactUrls: [pactFile],
      requestFilter: (request, _response, next) => {
        request.headers.authorization = `Bearer ${token}`;
        next();
      },
      stateHandlers: {
        'el usuario ana tiene proyectos': ensureAnaHasProjects,
      },
    }).verifyProvider();
  });
});
