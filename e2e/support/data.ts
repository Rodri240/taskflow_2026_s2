export interface SeedUser {
  email: string;
  password: string;
}

export const PASSWORD = 'Password1';
export const NEW_USER_PASSWORD = 'E2ePass123';

export const USERS = {
  ana: { email: 'ana@test.com', password: PASSWORD },
  bob: { email: 'bob@test.com', password: PASSWORD },
  caro: { email: 'caro@test.com', password: PASSWORD },
} as const satisfies Record<string, SeedUser>;

export const PROJECTS = {
  site: 'Rediseño del sitio',
  mobile: 'App móvil',
  legacy: 'Migración legacy',
} as const;

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Hecho',
};

let counter = 0;

export function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${uniqueSuffix()}`;
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${uniqueSuffix()}@test.com`;
}
