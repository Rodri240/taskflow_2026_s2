import bcrypt from 'bcryptjs';
import { Verifier } from '@pact-foundation/pact';
import http from 'node:http';
import path from 'node:path';
import { createApp } from '../../src/app';
import { db } from '../../src/lib/db';

const pactFile = path.resolve(__dirname, '../../../client/pacts/taskflow-web-taskflow-api.json');

async function prepareCommentsState(): Promise<void> {
  await db.comment.deleteMany();
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
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
  await db.project.create({
    data: { id: 1, name: 'Proyecto de prueba', ownerId: 1 },
  });
  await db.projectMember.create({
    data: { projectId: 1, userId: 1, role: 'OWNER' },
  });
  await db.task.create({
    data: {
      id: 1,
      projectId: 1,
      title: 'Implementar login',
      priority: 'HIGH',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
  await db.comment.create({
    data: {
      id: 1,
      taskId: 1,
      authorId: 1,
      body: 'Comentario de prueba',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
}

describe('taskflow-api Pact verification', () => {
  let server: http.Server;
  let providerBaseUrl: string;

  beforeAll(async () => {
    await prepareCommentsState();
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

  it('matches the frontend contract', async () => {
    await new Verifier({
      provider: 'taskflow-api',
      providerBaseUrl,
      pactUrls: [pactFile],
      stateHandlers: {
        'ana es miembro de proj-1 y task-1 tiene comentarios': prepareCommentsState,
      },
    }).verifyProvider();
  });
});
