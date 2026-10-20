import bcrypt from 'bcryptjs';
import { Verifier } from '@pact-foundation/pact';
import type { NextFunction, Request, Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import { createApp } from '../../src/app';
import { db } from '../../src/lib/db';

const pactFile = path.resolve(__dirname, '../../../client/pacts/taskflow-web-taskflow-api.json');
const contractToken = 'token-de-prueba';

async function prepareProjectsState(): Promise<void> {
  await db.projectMember.deleteMany();
  await db.task.deleteMany();
  await db.project.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password1', 10);
  await db.user.create({
    data: {
      id: 1,
      email: 'ana@test.com',
      name: 'Ana',
      passwordHash,
    },
  });
  await db.project.create({
    data: { id: 1, name: 'Proyecto 1', ownerId: 1 },
  });
  await db.projectMember.create({
    data: { projectId: 1, userId: 1, role: 'OWNER' },
  });
}

async function getRealToken(providerBaseUrl: string): Promise<string> {
  const response = await fetch(`${providerBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ana@test.com', password: 'Password1' }),
  });
  if (!response.ok) {
    throw new Error(`Could not obtain provider token: ${response.status}`);
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new Error('Provider login did not return a token');
  }
  return body.token;
}

describe('taskflow-api Pact verification', () => {
  let server: http.Server;
  let providerBaseUrl: string;

  beforeAll(async () => {
    await prepareProjectsState();
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not determine Pact verifier server address');
    }
    providerBaseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('matches the projects contract', async () => {
    const realToken = await getRealToken(providerBaseUrl);

    await new Verifier({
      provider: 'taskflow-api',
      providerBaseUrl,
      pactUrls: [pactFile],
      requestFilter: (req: Request, _res: Response, next: NextFunction) => {
        if (req.header('authorization') === `Bearer ${contractToken}`) {
          req.headers.authorization = `Bearer ${realToken}`;
        }
        next();
      },
      stateHandlers: {
        'el usuario ana tiene proyectos': prepareProjectsState,
      },
    }).verifyProvider();
  }, 30000);
});
