import { api } from '../lib/api';
import type { Project } from '../types';

/**
 * Obtiene los proyectos visibles para el usuario autenticado.
 *
 * `baseUrl` y `token` permiten apuntar el mismo cliente de producción al
 * servidor falso de Pact. En la aplicación se omiten y se usan la URL
 * relativa y el token guardado en el navegador.
 */
export function getProjects(baseUrl?: string, token?: string): Promise<Project[]> {
  return api<Project[]>('/projects', { baseUrl, token });
}
