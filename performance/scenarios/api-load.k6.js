import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3000';
const EMAIL = __ENV.USER_EMAIL || 'ana@test.com';
const PASSWORD = __ENV.USER_PASSWORD || 'Password1';
const PROJECT_NAME = __ENV.PROJECT_NAME || '';

const listDuration = new Trend('task_list_duration', true);
const listErrors = new Rate('task_list_errors');

export const options = {
  scenarios: {
    task_listing: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || '30s',
      gracefulStop: '5s',
    },
  },
  thresholds: {
    task_list_duration: ['p(95)<500'],
    task_list_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'login responde 200': (response) => response.status === 200 });
  if (login.status !== 200) throw new Error(`No se pudo iniciar sesión: ${login.status}`);

  const token = login.json('token');
  const headers = { Authorization: `Bearer ${token}` };
  const projects = http.get(`${BASE_URL}/api/projects`, { headers });
  check(projects, { 'proyectos responde 200': (response) => response.status === 200 });
  if (projects.status !== 200) throw new Error(`No se pudo listar proyectos: ${projects.status}`);

  const items = projects.json();
  const selected = PROJECT_NAME
    ? items.find((project) => project.name === PROJECT_NAME)
    : items[0];
  if (!selected) throw new Error(`No se encontró el proyecto "${PROJECT_NAME}"`);

  const firstPage = http.get(`${BASE_URL}/api/projects/${selected.id}/tasks?limit=20&offset=0`, {
    headers,
  });
  check(firstPage, { 'primera página responde 200': (response) => response.status === 200 });
  if (firstPage.status !== 200) throw new Error(`No se pudo leer la primera página: ${firstPage.status}`);

  return { headers, projectId: selected.id, total: Number(firstPage.json('total') || 0) };
}

export default function (data) {
  const lastOffset = Math.max(0, data.total - 20);
  const offset = lastOffset === 0 ? 0 : Math.floor(Math.random() * (lastOffset + 1));
  const response = http.get(
    `${BASE_URL}/api/projects/${data.projectId}/tasks?limit=20&offset=${offset}`,
    { headers: data.headers, tags: { endpoint: 'task-list' } },
  );

  const ok = check(response, {
    'listado responde 200': (result) => result.status === 200,
    'listado mantiene paginación': (result) => result.json('items').length <= 20,
  });
  listDuration.add(response.timings.duration);
  listErrors.add(!ok);
  sleep(0.1);
}
