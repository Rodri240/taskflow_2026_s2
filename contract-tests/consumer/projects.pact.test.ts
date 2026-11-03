import path from 'node:path';
import { MatchersV3, PactV3 } from '@pact-foundation/pact';
import { describe, expect, it } from 'vitest';
import { getProjects } from '../../client/src/api/projects';

const { eachLike, like, regex } = MatchersV3;

const pact = new PactV3({
  consumer: 'TaskFlowWeb',
  provider: 'TaskFlowAPI',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('contrato de TaskFlowWeb con GET /api/projects', () => {
  it('obtiene los proyectos del usuario autenticado', async () => {
    pact
      .given('el usuario ana tiene proyectos')
      .uponReceiving('un GET a /api/projects')
      .withRequest({
        method: 'GET',
        path: '/api/projects',
        headers: {
          Authorization: like('Bearer token-de-prueba'),
        },
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': regex('^application/json(?:;\\s*charset=utf-8)?$', 'application/json'),
        },
        body: eachLike({
          id: like('proj-1'),
          name: like('Rediseño del sitio'),
        }),
      });

    await pact.executeTest(async (mockServer) => {
      const projects = await getProjects(mockServer.url, 'token-de-prueba');

      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0]).toHaveProperty('name');
    });
  });
});
