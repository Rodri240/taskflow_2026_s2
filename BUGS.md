# Reporte de bugs — TaskFlow

Bugs encontrados a partir de la suite E2E de Playwright, escrita contra
`taskflow_especificacion_requerimientos.docx` (fuente de verdad). Cada entrada
proviene de un test que falla de forma reproducible; el estado actual del
sistema no cumple el criterio de aceptación o el escenario BDD de la historia
indicada.

- **Cómo reproducir todo:** `npm run test:e2e` (levanta la app con `npm run dev`).
- **Comando por bug:** `npx playwright test <archivo>:<línea>`.
- **Convención de IDs:** BUG-02, BUG-03 y BUG-06 ya existían documentados en los
  specs; este reporte continúa desde BUG-07.
- **Nota:** los tests que corresponden a un bug quedan en rojo a propósito, con
  un comentario `// BUG-XX:` en el código. Los tests verdes confirman que el
  criterio se cumple.

## Índice

| ID | Título | Historia / CA | Severidad | Test que lo detecta |
|----|--------|---------------|-----------|---------------------|
| BUG-07 | Se aceptan contraseñas de 7 caracteres | US-01 CA3 | Media | `e2e/specs/auth.spec.ts:32` |
| BUG-08 | Un miembro sí ve proyectos archivados | US-04 CA2 | Media | `e2e/specs/projects.spec.ts:22` |
| BUG-09 | Se puede forzar el estado inicial al crear una tarea | US-05 CA3 | Alta | `e2e/specs/board.spec.ts:24` |
| BUG-10 | Se permite la transición directa TODO → DONE | US-06 CA2 | Alta | `e2e/specs/board.spec.ts:43` |
| BUG-11 | Las etiquetas no se normalizan a minúsculas | US-15 CA1/CA2 | Media | `e2e/specs/task-detail.spec.ts:102` |
| BUG-13 | Quitar un miembro no libera sus tareas asignadas | US-11 CA6 | Alta | `e2e/specs/members.spec.ts:120` |
| BUG-14 | Un ex-miembro puede editar tareas del proyecto | US-11 CA7 / US-12 CA5 | Crítica | `e2e/specs/members.spec.ts:151` |
| BUG-15 | Un ex-miembro puede eliminar tareas del proyecto | US-11 CA7 / US-13 CA1 | Crítica | `e2e/specs/members.spec.ts:166` |
| BUG-16 | La solicitud de reseteo revela qué emails existen | US-17 CA2 | Alta | `e2e/specs/password-recovery.spec.ts:31` |
| BUG-17 | El token de reseteo es reutilizable / no se invalida | US-17 CA5/CA6 | Alta | `e2e/specs/password-recovery.spec.ts:49` y `:65` |
| BUG-18 | La fecha de vencimiento se desplaza por zona horaria | US-16 CA3 | Alta | `e2e/specs/task-detail.spec.ts:61` |

Además, siguen vigentes los bugs previamente documentados:

| ID | Título | Historia / CA | Test |
|----|--------|---------------|------|
| BUG-02 | Los filtros se pisan entre sí (solo aplica el último) | US-07 CA5 | `e2e/specs/board.spec.ts:85` |
| BUG-03 | La búsqueda por texto ignora el resto de los filtros | US-07 CA4/CA5 | `e2e/specs/board.spec.ts:97` |
| BUG-06 | Crear proyecto no valida el mínimo de 3 caracteres | US-03 CA1 | `e2e/specs/projects.spec.ts:54` y `:64` |

---

## BUG-07 — Se aceptan contraseñas de 7 caracteres

- **Historia:** US-01 (Registro), CA3 — la contraseña debe tener mínimo 8 caracteres.
- **Severidad:** Media.
- **Test:** `e2e/specs/auth.spec.ts` › *registro rechaza una contraseña de menos de 8 caracteres*
- **Reproducir:** `npx playwright test e2e/specs/auth.spec.ts:32`
- **Esperado:** al registrar con `'Abc1234'` (7 caracteres) la API responde 400.
- **Actual:** el registro es aceptado (201) y el usuario queda con sesión iniciada.
- **Evidencia:** el test no encuentra `error-message` y la URL navega a `/projects`.
- **Causa probable:** `server/src/lib/validation.ts:20` valida `password.length >= 7`.
- **Sugerencia:** cambiar a `>= 8` y alinear el mensaje de error con el mínimo real.

---

## BUG-08 — Un miembro sí ve proyectos archivados

- **Historia:** US-04 (Listar proyectos), CA2 — los proyectos archivados no aparecen, sea el usuario owner o miembro.
- **Severidad:** Media.
- **Test:** `e2e/specs/projects.spec.ts` › *un miembro no ve proyectos archivados en su listado*
- **Reproducir:** `npx playwright test e2e/specs/projects.spec.ts:22`
- **Esperado:** `bob` (miembro de "Migración legacy", archivado) NO ve ese proyecto.
- **Actual:** "Migración legacy" aparece en la lista de `bob` (la API lo devuelve y la UI lo muestra con la etiqueta "Archivado").
- **Evidencia:** la card del proyecto archivado es visible; `GET /api/projects` con token de bob devuelve `proj-3` (`archived=true`).
- **Causa probable:** `server/src/modules/projects/projects.controller.ts:55-63`, la rama de miembros no filtra `archived: false`.
- **Sugerencia:** aplicar `archived: false` a ambas ramas de la consulta.

---

## BUG-09 — Se puede forzar el estado inicial al crear una tarea

- **Historia:** US-05 (Crear tarea), CA3 — el estado inicial de toda tarea es siempre `TODO`.
- **Severidad:** Alta.
- **Test:** `e2e/specs/board.spec.ts` › *una tarea creada por API nace en TODO aunque se pida otro estado*
- **Reproducir:** `npx playwright test e2e/specs/board.spec.ts:24`
- **Esperado:** `POST /projects/:id/tasks` con `status: 'DONE'` crea la tarea en `TODO`.
- **Actual:** la tarea nace con `status: 'DONE'` (y su historial inicial registra `DONE`).
- **Evidencia:** la respuesta devuelve `status: "DONE"`.
- **Causa probable:** `server/src/modules/tasks/tasks.service.ts:63-73` hace `...body` (spread) al crear, por lo que el `status` entrante sobreescribe el default.
- **Sugerencia:** no propagar `status` del body en `createTask`; fijarlo siempre en `'TODO'`.

---

## BUG-10 — Se permite la transición directa TODO → DONE

- **Historia:** US-06 (Cambiar estado), CA1/CA2 — las transiciones válidas son `TODO→IN_PROGRESS`, `IN_PROGRESS→DONE` e `IN_PROGRESS→TODO`; `TODO→DONE` no está permitido.
- **Severidad:** Alta.
- **Test:** `e2e/specs/board.spec.ts` › *rechaza la transición directa de TODO a DONE*
- **Reproducir:** `npx playwright test e2e/specs/board.spec.ts:43`
- **Esperado:** `PATCH /tasks/:id` con `status: 'DONE'` desde `TODO` responde 422.
- **Actual:** responde 200 y la tarea pasa a `DONE`.
- **Evidencia:** el test recibe `200` en vez de `422`.
- **Causa probable:** `server/src/modules/tasks/transitions.ts:8-11` solo bloquea transiciones desde `DONE` (`DONE→TODO`, `DONE→IN_PROGRESS`); no implementa una lista blanca que prohíba `TODO→DONE`.
- **Sugerencia:** modelar las transiciones válidas explícitamente (lista blanca) en lugar de solo bloquear las que salen de `DONE`.

---

## BUG-11 — Las etiquetas no se normalizan a minúsculas

- **Historia:** US-15 (Etiquetar tareas), CA1/CA2 — las etiquetas se guardan en minúsculas y no distinguen mayúsculas/minúsculas (`'Bug'`, `'BUG'` y `'bug'` son la misma).
- **Severidad:** Media.
- **Test:** `e2e/specs/task-detail.spec.ts` › *normaliza las etiquetas a minúsculas*
- **Reproducir:** `npx playwright test e2e/specs/task-detail.spec.ts:102`
- **Esperado:** agregar la etiqueta `'BUG'` la guarda como `'bug'`.
- **Actual:** se guarda como `'BUG'`.
- **Evidencia:** el chip visible es `BUG`, no `bug`.
- **Causa probable:** `server/src/modules/tasks/tasks.service.ts:196` usa `rawName.trim()` sin `toLowerCase()`.
- **Sugerencia:** normalizar `name = rawName.trim().toLowerCase()` en `addTag`. (Relacionado: BUG-12, no cubierto por un test rojo porque la deduplicación depende de esta normalización y del `findFirst` sin filtro de duplicado; al corregir la normalización, repetir una etiqueta en distinto caso debe devolver 200 sin duplicar.)

---

## BUG-13 — Quitar un miembro no libera sus tareas asignadas

- **Historia:** US-11 (Agregar/quitar miembros), CA6 — al quitar un miembro, las tareas que tenía asignadas quedan sin asignado.
- **Severidad:** Alta.
- **Test:** `e2e/specs/members.spec.ts` › *al quitar un miembro sus tareas quedan sin asignar*
- **Reproducir:** `npx playwright test e2e/specs/members.spec.ts:120`
- **Esperado:** la tarea del miembro quitado queda con `assigneeId: null`.
- **Actual:** la tarea sigue con `assigneeId: "user-2"`.
- **Evidencia:** `GET /tasks/:id` devuelve `assigneeId: "user-2"` tras el `DELETE` de la membresía.
- **Causa probable:** `server/src/modules/projects/projects.controller.ts:166-191` (`removeMember`) solo elimina `ProjectMember`; no limpia `Task.assigneeId`.
- **Sugerencia:** al quitar la membresía, ejecutar `updateMany` sobre las tareas del proyecto asignadas a ese usuario poniendo `assigneeId = null`.

---

## BUG-14 — Un ex-miembro puede editar tareas del proyecto

- **Historia:** US-11 CA7 y US-12 CA5 — un usuario que ya no es miembro no puede realizar ninguna acción sobre las tareas del proyecto (403).
- **Severidad:** Crítica (control de acceso roto).
- **Test:** `e2e/specs/members.spec.ts` › *un ex-miembro no puede editar el título de una tarea del proyecto*
- **Reproducir:** `npx playwright test e2e/specs/members.spec.ts:151`
- **Esperado:** `PATCH /tasks/:id` de un ex-miembro responde 403.
- **Actual:** responde 200 y el título cambia.
- **Evidencia:** el test recibe `200` en vez de `403`.
- **Causa probable:** `server/src/modules/tasks/tasks.routes.ts:14` registra `PATCH /:taskId` sin el middleware `requireTaskProjectMember`; `updateTask` solo verifica membresía al cambiar el **estado**, no para el resto de los campos.
- **Sugerencia:** exigir membresía en las rutas `PATCH` y `DELETE` de `/tasks/:id` (aplicar `requireTaskProjectMember('taskId')`).

---

## BUG-15 — Un ex-miembro puede eliminar tareas del proyecto

- **Historia:** US-11 CA7 y US-13 CA1 — solo los miembros del proyecto pueden eliminar sus tareas (403).
- **Severidad:** Crítica (control de acceso roto, destrucción de datos).
- **Test:** `e2e/specs/members.spec.ts` › *un ex-miembro no puede eliminar una tarea del proyecto*
- **Reproducir:** `npx playwright test e2e/specs/members.spec.ts:166`
- **Esperado:** `DELETE /tasks/:id` de un ex-miembro responde 403.
- **Actual:** responde 204 y la tarea se elimina.
- **Evidencia:** el test recibe `204` en vez de `403`.
- **Causa probable:** `server/src/modules/tasks/tasks.routes.ts:15` registra `DELETE /:taskId` sin `requireTaskProjectMember`, y `deleteTask` no verifica membresía.
- **Sugerencia:** misma corrección que BUG-14.

---

## BUG-16 — La solicitud de reseteo revela qué emails existen

- **Historia:** US-17 (Recuperar contraseña), CA2 — la respuesta es idéntica exista o no el usuario, para no revelar qué direcciones están registradas.
- **Severidad:** Alta (fuga de información / enumeración de cuentas).
- **Test:** `e2e/specs/password-recovery.spec.ts` › *la respuesta es la misma exista o no el email en el sistema*
- **Reproducir:** `npx playwright test e2e/specs/password-recovery.spec.ts:31`
- **Esperado:** `POST /auth/forgot-password` responde 200 con el mismo mensaje genérico para un email registrado y uno inexistente.
- **Actual:** para un email inexistente responde 404 (`No account found for that email`), revelando que la cuenta no existe.
- **Evidencia:** el test recibe `404` en vez de `200`.
- **Causa probable:** `server/src/modules/auth/auth.service.ts:92-93` lanza `notFound` cuando el usuario no existe.
- **Sugerencia:** devolver siempre 200 con un mensaje genérico; generar el token solo si el usuario existe.

---

## BUG-17 — El token de reseteo es reutilizable y no se invalida

- **Historia:** US-17 CA5/CA6 — un token ya utilizado devuelve 400, y generar un token nuevo invalida los anteriores.
- **Severidad:** Alta (permite reusar un token para volver a cambiar la contraseña).
- **Tests:**
  - `e2e/specs/password-recovery.spec.ts` › *un token ya utilizado no se puede reutilizar* (`:49`)
  - `e2e/specs/password-recovery.spec.ts` › *generar un token nuevo invalida los anteriores* (`:65`)
- **Reproducir:** `npx playwright test e2e/specs/password-recovery.spec.ts:49` y `:65`
- **Esperado:** reutilizar un token (o uno anterior a un token nuevo) responde 400.
- **Actual:** el mismo token se puede usar dos veces (200) y un token anterior a uno nuevo sigue siendo válido (200).
- **Evidencia:** ambos tests reciben `200` en vez de `400`.
- **Causa probable:** `server/src/modules/auth/auth.service.ts:113-129` (`resetPassword`) no verifica `usedAt` ni `expiresAt`, y nunca marca el token como usado. `forgotPassword` (líneas 95-98) sí marca `usedAt` de los anteriores, pero como `resetPassword` no lo comprueba, la invalidación no tiene efecto.
- **Sugerencia:** en `resetPassword`, rechazar si `record.usedAt !== null` o `record.expiresAt < now`, y marcar `usedAt` al aplicarlo.

---

## BUG-18 — La fecha de vencimiento se desplaza por zona horaria

- **Historia:** US-16 (Fecha de vencimiento), CA3 — la fecha devuelta es siempre la misma que se cargó, sin importar la zona horaria.
- **Severidad:** Alta.
- **Test:** `e2e/specs/task-detail.spec.ts` › *establece la fecha de vencimiento*
- **Reproducir:** `npx playwright test e2e/specs/task-detail.spec.ts:61`
- **Esperado:** cargar `'2030-05-19'` y leer la tarea devuelve `'2030-05-19'`.
- **Actual:** devuelve `'2030-05-18'` (un día menos en la zona UTC-3 del entorno).
- **Evidencia:** `task-duedate-value` muestra `2030-05-18`.
- **Causa probable:** `server/src/lib/ids.ts:38` parsea la fecha con `new Date('2030-05-19')` (medianoche **UTC**) y `formatDueDate` (líneas 44-46) la formatea con `getFullYear/getMonth/getDate` (hora **local**), desplazando un día en zonas negativas.
- **Sugerencia:** guardar/devolver la fecha como string de día calendario (sin `Date`) o formatear siempre en UTC.

---

## Bugs previamente documentados (vigentes)

### BUG-02 — Los filtros se pisan entre sí

- **Historia:** US-07 CA5 — los filtros son combinables y se aplican todos a la vez.
- **Test:** `e2e/specs/board.spec.ts:85` (falla: espera `Total: 1`, obtiene `Total: 2`).
- **Causa probable:** `server/src/modules/tasks/tasks.repository.ts:12-26` (`buildFilters`) reasigna `where` en cada `if`, en lugar de acumular condiciones; solo sobrevive la última (`assigneeId`).
- **Nota adicional de seguridad:** el mismo archivo (`tasks.repository.ts:33-51`) construye la búsqueda con `$queryRawUnsafe` e interpola `term` directamente en el SQL (`instr(title, '${term}')`), lo que además de ignorar los demás filtros es una **vulnerabilidad de inyección SQL** (viola los requerimientos no funcionales de seguridad). Recomiendo parametrizar o usar `db.task.findMany`.

### BUG-03 — La búsqueda por texto ignora el resto de los filtros

- **Historia:** US-07 CA4/CA5.
- **Test:** `e2e/specs/board.spec.ts:97` (falla: espera `Total: 0`, obtiene `Total: 1`).
- **Causa probable:** `tasks.repository.ts:29-52`: cuando hay `search` se ignora por completo `buildFilters` y solo se filtra por texto.

### BUG-06 — Crear proyecto no valida el mínimo de 3 caracteres

- **Historia:** US-03 CA1 — el nombre del proyecto tiene entre 3 y 100 caracteres.
- **Tests:** `e2e/specs/projects.spec.ts:54` (*nombre vacío*) y `:64` (*nombre demasiado corto*, `'ab'`).
- **Esperado:** la UI/API rechaza el nombre y se muestra un error.
- **Actual:** se crean proyectos con nombre `''` y `'ab'` sin error.
- **Causa probable:** `server/src/modules/projects/projects.controller.ts:31-33` solo valida `name.length > 100` en la creación (el update sí valida el mínimo).

---

## Fuera de alcance / pendientes de cobertura

- **Token de reseteo vencido (US-17 CA4):** no se puede verificar en un test sin manipular el reloj o la DB (el token dura 60 minutos). Recomiendo un test unitario del server con tiempo simulado.
- **Límites y roles no cubiertos por UI:** acciones como asignar tareas (US-14), editar/eliminar proyecto (US-09/US-10) y reseteo de contraseña (US-17) no tienen interfaz web, por lo que se prueban a nivel API con el cliente de fixtures. Sería deseable exponerlas en la UI para poder cubrirlas de punta a punta.
