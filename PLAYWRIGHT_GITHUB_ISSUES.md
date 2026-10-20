# Reporte de ejecución Playwright para GitHub Issues

## Datos de la ejecución

| Dato | Valor |
| --- | --- |
| Fecha | 2026-10-20 |
| Rama | `juan` |
| Commit base | `76bf33b` |
| Comando | `npm run test:e2e` |
| Navegador | Chromium |
| Playwright | 1.64.1 |
| Node.js | v24.3.0 |
| Zona horaria | America/Montevideo |
| Datos | Base SQLite temporal y aislada para la ejecución |
| Duración | 32,9 s |
| Resultado | **4 aprobados / 12 fallidos / 16 totales** |

La aplicación y el servidor iniciaron correctamente. Los 12 fallos son aserciones funcionales reproducibles; no hubo fallos de infraestructura, timeouts de arranque ni tests omitidos. Los tests se ejecutaron en serie para evitar interferencia de datos.

## Resumen ejecutivo

- **Crítico:** un usuario removido del proyecto todavía puede modificar el estado de una tarea mediante la API.
- **Alto:** los tokens de recuperación se pueden reutilizar y el endpoint de recuperación permite enumerar cuentas existentes.
- **Alto:** al remover un miembro, sus tareas continúan asignadas a ese usuario.
- **Alto:** las fechas de vencimiento se desplazan un día en una zona horaria negativa.
- **Medio:** existen incumplimientos en validación, estado inicial, filtros combinados, búsqueda, paginación y mensaje de bloqueo.
- **Bajo:** los comentarios se presentan en orden inverso al requerido.

## Matriz completa de resultados

| # | User story | Caso automatizado | Canal | Resultado |
| ---: | --- | --- | --- | --- |
| 1 | US-01, US-02 | Registra, normaliza el email y vuelve a iniciar sesión | UI + API | ✅ Aprobado |
| 2 | US-02 | Bloquea la cuenta exactamente al quinto intento fallido | API | ❌ Falló |
| 3 | US-17 | Solicitar recuperación no revela si la cuenta existe | API | ❌ Falló |
| 4 | US-17 | Un token de recuperación es de un solo uso | API | ❌ Falló |
| 5 | US-03, US-04 | Crea un proyecto y lo muestra con sus datos exactos | UI + API | ✅ Aprobado |
| 6 | US-03 | Rechaza un nombre de proyecto de menos de tres caracteres | UI + API | ❌ Falló |
| 7 | US-05, US-14, US-16 | Crea una tarea asignada, priorizada y con vencimiento | UI + API | ❌ Falló |
| 8 | US-05 | No permite forzar el estado inicial al crear una tarea | API | ❌ Falló |
| 9 | US-06 | Aplica transiciones válidas, rechaza reabrir `DONE` y registra historial | UI + API | ✅ Aprobado |
| 10 | US-08 | Publica comentarios y los muestra del más antiguo al más reciente | UI + API | ❌ Falló |
| 11 | US-08 | Permite borrar un comentario propio | UI + API | ✅ Aprobado |
| 12 | US-07 | Combina prioridad y asignado sin incluir resultados parciales | API | ❌ Falló |
| 13 | US-07 | Busca sin distinguir mayúsculas de minúsculas | API | ❌ Falló |
| 14 | US-07 | Pagina a veinte tareas por defecto e informa el total | API | ❌ Falló |
| 15 | US-11 | El owner agrega y quita un miembro; sus tareas quedan sin asignar | UI + API | ❌ Falló |
| 16 | US-11 | Un exmiembro no puede operar sobre tareas aunque haya sido asignado | API | ❌ Falló |

## Issues propuestos

Cada bloque siguiente está listo para copiar como un issue independiente.

---

### 1. [US-11] Un exmiembro puede modificar tareas del proyecto

**Etiquetas sugeridas:** `bug`, `security`, `authorization`, `playwright`, `US-11`, `priority:critical`

**Descripción**

Un usuario removido de un proyecto conserva la posibilidad de actualizar por API una tarea de ese proyecto si continúa asignado a ella. Esto permite modificar recursos sin una membresía vigente.

**Precondiciones**

1. Un owner crea un proyecto.
2. Agrega otro usuario como miembro.
3. Crea una tarea asignada a ese miembro.
4. Remueve al miembro del proyecto.

**Pasos para reproducir**

1. Autenticarse como el usuario removido.
2. Ejecutar `PATCH /api/tasks/{taskId}` con `{ "status": "IN_PROGRESS" }`.

**Resultado esperado**

La API responde `403 Forbidden` y la tarea no cambia.

**Resultado actual**

La API responde `200 OK` y cambia el estado de `TODO` a `IN_PROGRESS`.

**Prioridad:** Crítica. Es una falla de control de acceso y permite escrituras fuera del proyecto autorizado.

**Evidencia automatizada:** `e2e/members.spec.ts:67`, aserción en la línea 88. Trace local: `test-results/members-Miembros-y-autoriz-3e5e8-s-aunque-haya-sido-asignado-chromium/trace.zip`.

**Ubicación técnica probable:** `server/src/modules/tasks/tasks.routes.ts:14`; la ruta `PATCH /:taskId` no aplica `requireTaskProjectMember`.

---

### 2. [US-17] Los tokens de recuperación de contraseña se pueden reutilizar

**Etiquetas sugeridas:** `bug`, `security`, `authentication`, `playwright`, `US-17`, `priority:high`

**Descripción**

Un token de recuperación que ya cambió correctamente la contraseña puede enviarse nuevamente y vuelve a ser aceptado.

**Pasos para reproducir**

1. Solicitar recuperación para una cuenta existente y guardar el token.
2. Ejecutar `POST /api/auth/reset-password` con el token y una contraseña nueva.
3. Repetir la solicitud con el mismo token.

**Resultado esperado**

La primera solicitud responde `200`; la segunda responde `400` porque el token ya fue consumido.

**Resultado actual**

Ambas solicitudes responden `200` con `{ "message": "Password updated" }`.

**Prioridad:** Alta. Un token filtrado mantiene capacidad de cambiar la contraseña después de su primer uso.

**Evidencia automatizada:** `e2e/auth.spec.ts:107`, aserción en la línea 123. Trace local: `test-results/auth-Autenticación-y-acces-4f1b8-uperación-es-de-un-solo-uso-chromium/trace.zip`.

**Ubicación técnica probable:** `server/src/modules/auth/auth.service.ts`; `resetPassword` no valida expiración/`usedAt` ni marca el token como usado.

---

### 3. [US-17] Recuperar contraseña permite enumerar cuentas registradas

**Etiquetas sugeridas:** `bug`, `security`, `privacy`, `authentication`, `playwright`, `US-17`, `priority:high`

**Descripción**

El endpoint de recuperación devuelve respuestas diferentes para correos existentes e inexistentes, revelando si una persona tiene una cuenta.

**Pasos para reproducir**

1. Enviar `POST /api/auth/forgot-password` con un correo existente.
2. Repetir con un correo inexistente.

**Resultado esperado**

Ambas solicitudes devuelven el mismo status y mensaje genérico, sin revelar la existencia de la cuenta.

**Resultado actual**

- Correo existente: `200 OK`.
- Correo inexistente: `404 NOT_FOUND` con `No account found for that email`.

**Prioridad:** Alta. Facilita la enumeración de usuarios.

**Evidencia automatizada:** `e2e/auth.spec.ts:92`, aserción en la línea 103. Trace local: `test-results/auth-Autenticación-y-acces-aedd6--revela-si-la-cuenta-existe-chromium/trace.zip`.

**Ubicación técnica probable:** `server/src/modules/auth/auth.service.ts`; `forgotPassword` lanza `notFound` cuando no existe el usuario.

---

### 4. [US-11] Remover un miembro no desasigna sus tareas

**Etiquetas sugeridas:** `bug`, `data-integrity`, `members`, `playwright`, `US-11`, `priority:high`

**Descripción**

Al quitar un miembro del proyecto, las tareas del proyecto que estaban asignadas a esa persona conservan su `assigneeId`.

**Pasos para reproducir**

1. Crear un proyecto y agregar un miembro.
2. Crear una tarea asignada a ese miembro.
3. Como owner, remover al miembro.
4. Consultar la tarea.

**Resultado esperado**

La tarea queda sin responsable: `assigneeId: null`.

**Resultado actual**

La tarea sigue mostrando el identificador del usuario removido, por ejemplo `user-16`.

**Prioridad:** Alta. Deja referencias funcionalmente inválidas y contribuye a la falla de autorización del issue 1.

**Evidencia automatizada:** `e2e/members.spec.ts:13`, aserción en la línea 64. Screenshot, video y trace disponibles bajo `test-results/members-Miembros-y-autoriz-9b3dd-s-tareas-quedan-sin-asignar-chromium/`.

**Ubicación técnica probable:** `server/src/modules/projects/projects.controller.ts:166`; `removeMember` elimina la membresía sin actualizar las tareas asignadas.

---

### 5. [US-16] La fecha de vencimiento se desplaza un día

**Etiquetas sugeridas:** `bug`, `date-time`, `tasks`, `playwright`, `US-16`, `priority:high`

**Descripción**

Una fecha calendario enviada como `2030-06-15` se almacena o serializa como `2030-06-14` en la zona horaria America/Montevideo.

**Pasos para reproducir**

1. Crear una tarea con `dueDate: "2030-06-15"`.
2. Revisar la respuesta de creación y la tarjeta en el tablero.

**Resultado esperado**

La API y la UI muestran `2030-06-15`.

**Resultado actual**

La API y la UI muestran `2030-06-14`.

**Prioridad:** Alta. Cambia el vencimiento funcional de la tarea.

**Evidencia automatizada:** `e2e/core-workflows.spec.ts:68`, aserciones en las líneas 99 y 111. Screenshot, video y trace disponibles bajo `test-results/core-workflows-Flujos-prin-5ccdb-riorizada-y-con-vencimiento-chromium/`.

**Ubicación técnica probable:** `server/src/lib/ids.ts`; `parseDueDate` interpreta `YYYY-MM-DD` como UTC y `formatDueDate` usa getters de hora local.

---

### 6. [US-05] Es posible crear una tarea directamente en estado DONE

**Etiquetas sugeridas:** `bug`, `business-rule`, `tasks`, `playwright`, `US-05`, `priority:medium`

**Descripción**

El endpoint de creación acepta el campo `status` proporcionado por el cliente y permite omitir el flujo de estados requerido.

**Pasos para reproducir**

1. Ejecutar `POST /api/projects/{projectId}/tasks` con un título válido y `status: "DONE"`.

**Resultado esperado**

La tarea se crea siempre con estado inicial `TODO`, independientemente del valor enviado por el cliente.

**Resultado actual**

La tarea se crea con estado `DONE`.

**Prioridad:** Media. Permite saltar reglas de transición e historial del flujo normal.

**Evidencia automatizada:** `e2e/core-workflows.spec.ts:115`, aserción en la línea 123. Trace local: `test-results/core-workflows-Flujos-prin-4b2de--inicial-al-crear-una-tarea-chromium/trace.zip`.

**Ubicación técnica probable:** `server/src/modules/tasks/tasks.service.ts`; `createTask` expande el body completo en `data`, permitiendo que `status` llegue a Prisma.

---

### 7. [US-07] Los filtros de tareas no se combinan

**Etiquetas sugeridas:** `bug`, `filters`, `tasks`, `playwright`, `US-07`, `priority:medium`

**Descripción**

Al aplicar simultáneamente filtros de prioridad y asignado, la API devuelve coincidencias parciales en lugar de la intersección de ambos criterios.

**Pasos para reproducir**

1. Crear una tarea `HIGH` asignada al usuario A.
2. Crear otra tarea `LOW` asignada al usuario A.
3. Crear otra tarea `HIGH` sin asignar.
4. Consultar las tareas con `priority=HIGH&assignedTo={usuarioA}`.

**Resultado esperado**

Se devuelve solamente la tarea que cumple los dos filtros (`total: 1`).

**Resultado actual**

Se devuelven dos tareas (`total: 2`); uno de los filtros queda ignorado.

**Prioridad:** Media. La vista filtrada presenta resultados incorrectos.

**Evidencia automatizada:** `e2e/core-workflows.spec.ts:230`, aserción en la línea 256. Trace local: `test-results/core-workflows-Flujos-prin-ff641-ncluir-resultados-parciales-chromium/trace.zip`.

**Ubicación técnica probable:** `server/src/modules/tasks/tasks.repository.ts:12`; `buildFilters` reemplaza el objeto `where` en cada filtro en vez de acumular condiciones.

---

### 8. [US-07] La búsqueda de tareas distingue mayúsculas y minúsculas

**Etiquetas sugeridas:** `bug`, `search`, `tasks`, `playwright`, `US-07`, `priority:medium`

**Descripción**

La búsqueda no encuentra títulos cuando cambia la capitalización del término.

**Pasos para reproducir**

1. Crear una tarea titulada `Implementar Login Seguro`.
2. Buscar con `search=login`.

**Resultado esperado**

La tarea aparece en el resultado (`total: 1`).

**Resultado actual**

La respuesta no contiene resultados (`total: 0`).

**Prioridad:** Media. La búsqueda omite coincidencias válidas.

**Evidencia automatizada:** `e2e/core-workflows.spec.ts:262`, aserción en la línea 274. Trace local: `test-results/core-workflows-Flujos-prin-4e229-ir-mayúsculas-de-minúsculas-chromium/trace.zip`.

**Ubicación técnica probable:** `server/src/modules/tasks/tasks.repository.ts`; la consulta usa `instr` sin normalizar término y columnas a una misma capitalización.

---

### 9. [US-07] La API informa límite 20 pero devuelve 21 tareas

**Etiquetas sugeridas:** `bug`, `pagination`, `tasks`, `playwright`, `US-07`, `priority:medium`

**Descripción**

La metadata indica un límite predeterminado de 20 elementos, pero la colección no se pagina.

**Pasos para reproducir**

1. Crear 21 tareas en un proyecto.
2. Consultar el listado sin especificar `limit` ni `offset`.

**Resultado esperado**

La respuesta informa `total: 21`, `limit: 20`, `offset: 0` y contiene 20 elementos.

**Resultado actual**

La metadata es correcta, pero `items` contiene 21 elementos.

**Prioridad:** Media. Puede provocar respuestas crecientes y rompe la navegación por páginas.

**Evidencia automatizada:** `e2e/core-workflows.spec.ts:278`, aserción en la línea 295. Trace local: `test-results/core-workflows-Flujos-prin-5f62f--defecto-e-informa-el-total-chromium/trace.zip`.

**Ubicación técnica probable:** `server/src/modules/tasks/tasks.controller.ts:27` y `server/src/modules/tasks/tasks.repository.ts`; se calcula la metadata, pero `findTasks` no aplica `skip`/`take` o `LIMIT`/`OFFSET`.

---

### 10. [US-03] Se aceptan nombres de proyecto de menos de tres caracteres

**Etiquetas sugeridas:** `bug`, `validation`, `projects`, `playwright`, `US-03`, `priority:medium`

**Descripción**

La creación de proyectos acepta un nombre de dos caracteres pese al mínimo requerido de tres.

**Pasos para reproducir**

1. Crear un proyecto con `name: "ab"`.

**Resultado esperado**

La API responde `400 Bad Request` y no crea el proyecto.

**Resultado actual**

La API responde `201 Created` y crea el proyecto con nombre `ab`.

**Prioridad:** Media. Permite datos que incumplen la especificación.

**Evidencia automatizada:** `e2e/core-workflows.spec.ts:45`, aserción en la línea 58. Screenshot, video y trace disponibles bajo `test-results/core-workflows-Flujos-prin-ae7f8-de-menos-de-tres-caracteres-chromium/`.

**Ubicación técnica probable:** `server/src/modules/projects/projects.controller.ts`; la validación comprueba el máximo de 100, pero no el mínimo de 3.

---

### 11. [US-02] El quinto intento fallido no informa que la cuenta quedó bloqueada

**Etiquetas sugeridas:** `bug`, `authentication`, `ux`, `playwright`, `US-02`, `priority:medium`

**Descripción**

La cuenta queda bloqueada en el quinto intento fallido, pero esa misma respuesta continúa informando únicamente credenciales inválidas.

**Pasos para reproducir**

1. Registrar una cuenta.
2. Intentar iniciar sesión cinco veces con una contraseña incorrecta.

**Resultado esperado**

El quinto intento responde `401` con un mensaje que informa el bloqueo temporal. Un intento posterior con la contraseña correcta también debe permanecer bloqueado.

**Resultado actual**

El quinto intento responde `401` con `Invalid credentials`. La comprobación posterior confirma que el bloqueo sí quedó aplicado.

**Prioridad:** Media. La regla se aplica, pero el usuario no recibe el estado correcto en el momento del bloqueo.

**Evidencia automatizada:** `e2e/auth.spec.ts:68`, aserción en la línea 83. Trace local: `test-results/auth-Autenticación-y-acces-f7cdb-e-al-quinto-intento-fallido-chromium/trace.zip`.

**Ubicación técnica probable:** `server/src/modules/auth/auth.service.ts`; después de establecer `lockedUntil`, el flujo lanza siempre `Invalid credentials`.

---

### 12. [US-08] Los comentarios se muestran del más reciente al más antiguo

**Etiquetas sugeridas:** `bug`, `comments`, `ordering`, `playwright`, `US-08`, `priority:low`

**Descripción**

El orden visual de los comentarios es inverso al criterio requerido.

**Pasos para reproducir**

1. Publicar `Primera observación`.
2. Publicar `Revisado y aprobado`.
3. Consultar la lista de comentarios de la tarea.

**Resultado esperado**

El primer elemento es `Primera observación` y el segundo es `Revisado y aprobado`.

**Resultado actual**

El primer elemento es `Revisado y aprobado`.

**Prioridad:** Baja. No hay pérdida de datos, pero el orden contradice el criterio de aceptación.

**Evidencia automatizada:** `e2e/core-workflows.spec.ts:172`, aserción en la línea 199. Screenshot, video y trace disponibles bajo `test-results/core-workflows-Flujos-prin-c7eb0-más-antiguo-al-más-reciente-chromium/`.

**Ubicación técnica probable:** `server/src/modules/comments/comments.repository.ts`; `listByTask` ordena `createdAt: 'desc'`.

## Funcionalidades verificadas correctamente

- **US-01 / US-02:** registro, normalización del correo, persistencia de sesión y nuevo inicio de sesión.
- **US-03 / US-04:** creación y presentación exacta de un proyecto válido.
- **US-06:** transición `TODO → IN_PROGRESS → DONE`, rechazo de `DONE → TODO` e historial de estados.
- **US-08:** eliminación de un comentario propio.

## Evidencias y reproducción

Playwright generó traces para los 12 fallos y screenshots/videos para los cinco fallos que recorren UI. Los artefactos están en `test-results/` y el reporte navegable en `playwright-report/`; ambos son locales y deben adjuntarse al issue o publicarse como artefactos de CI si se necesita compartirlos.

```bash
npm install
npx playwright install chromium
npm run test:e2e:typecheck
npm run test:e2e
npm run test:e2e:report
```

Para abrir un trace individual:

```bash
npx playwright show-trace test-results/<caso>/trace.zip
```

## Criterio de cierre recomendado

Cada issue debe considerarse cerrado únicamente cuando su test específico pasa sin relajar la aserción. Después de corregirlos individualmente, se debe ejecutar la suite completa y exigir **16/16 aprobados** para detectar regresiones o interacciones entre correcciones.
