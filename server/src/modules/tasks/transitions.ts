import { invalidTransition } from '../../lib/http';
import type { Status } from '../../lib/validation';

/**
 * Reglas de transición de estado de una tarea.
 * Válidas: TODO -> IN_PROGRESS, IN_PROGRESS -> DONE, IN_PROGRESS -> TODO.
 */
const ALLOWED_TRANSITIONS: Array<[Status, Status]> = [
  ['TODO', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'TODO'],
  ['IN_PROGRESS', 'DONE'],
];

export function assertTransition(from: Status, to: Status): void {
  if (from === to) return;

  const allowed = ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to);
  if (!allowed) {
    throw invalidTransition(`Cannot move a task from ${from} to ${to}`);
  }
}
