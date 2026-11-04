# Reporte de hallazgos de seguridad y accesibilidad

**Proyecto:** TaskFlow  
**Fecha:** 2026-11-04  
**Alcance:** API Express/Prisma y vistas React auditadas con `@axe-core/playwright`.

## 4.1 Hallazgos de seguridad

### Hallazgo de Seguridad N.° 01

| Campo | Detalle |
|---|---|
| ID | SEC-01 |
| Título | Política CORS global y permisiva |
| Severidad | HIGH |
| CVSS | 7.1 (estimado) |
| Ubicación | [server/src/app.ts](../server/src/app.ts), línea 10 |

**Descripción:** La API registra `app.use(cors())` sin una lista de orígenes permitidos. Express responde con `Access-Control-Allow-Origin: *`, permitiendo que cualquier origen web realice solicitudes cross-origin a la API. Aunque el token no se envía automáticamente como una cookie, esta configuración amplía innecesariamente la superficie de ataque y permite consumir endpoints públicos desde sitios no autorizados.

**Pasos de reproducción:**

1. Levantar la API con `npm run dev:server`.
2. Ejecutar `curl.exe -i -H "Origin: https://sitio-no-autorizado.example" http://localhost:3000/api/health`.
3. Observar `Access-Control-Allow-Origin: *` en la respuesta.

**Impacto:** Un sitio externo puede interactuar con la API desde el navegador del usuario. En una futura migración a cookies de sesión, una CORS permisiva podría habilitar solicitudes autenticadas desde orígenes maliciosos.

**Remediación propuesta:** Configurar `cors({ origin: [FRONTEND_ORIGIN], methods: [...], allowedHeaders: [...] })`, definir el origen por ambiente y evitar `*` en producción. Agregar una prueba que rechace orígenes no autorizados.

### Hallazgo de Seguridad N.° 02

| Campo | Detalle |
|---|---|
| ID | SEC-02 |
| Título | Token de recuperación reutilizable |
| Severidad | HIGH |
| CVSS | 8.1 (estimado) |
| Ubicación | [server/src/modules/auth/auth.service.ts](../server/src/modules/auth/auth.service.ts), líneas 100-128 |
| Estado | Corregido y verificado |

**Descripción:** En la revisión inicial, `resetPassword` validaba que el token existiera, pero no verificaba `usedAt` ni lo marcaba como usado después de cambiar la contraseña. Por lo tanto, un token válido podía reutilizarse hasta su vencimiento.

**Pasos de reproducción:**

1. Solicitar un token con `POST /api/auth/forgot-password`.
2. Ejecutar `POST /api/auth/reset-password` con ese token y una contraseña nueva.
3. Repetir la misma solicitud con otra contraseña antes de que expire el token.

**Impacto:** El poseedor de un token filtrado puede cambiar repetidamente la contraseña de la cuenta durante la ventana de validez. También contradice el criterio de aceptación de token de un solo uso cubierto por [e2e/auth.spec.ts](../e2e/auth.spec.ts).

**Remediación aplicada:** Se validan `usedAt` y `expiresAt`, y el consumo de token y actualización de contraseña se realizan en una transacción. [e2e/auth.spec.ts](../e2e/auth.spec.ts) verifica primer uso exitoso y segundo uso rechazado.

### Hallazgo de Seguridad N.° 03

| Campo | Detalle |
|---|---|
| ID | SEC-03 |
| Título | Exposición del token de recuperación y enumeración de cuentas |
| Severidad | MEDIUM |
| CVSS | 6.5 (estimado) |
| Ubicación | [server/src/modules/auth/auth.service.ts](../server/src/modules/auth/auth.service.ts), líneas 98-119 |
| Estado | Corregido y verificado |

**Descripción:** En la revisión inicial, el endpoint devolvía el token en la respuesta (`{ message, token }`) y respondía `404 No account found for that email` cuando la cuenta no existía. Esto permitía enumerar usuarios y exponía el token directamente al cliente.

**Pasos de reproducción:**

1. Enviar `POST /api/auth/forgot-password` con un email registrado y observar el token en la respuesta.
2. Repetir la solicitud con un email inexistente.
3. Comparar ambos estados y mensajes HTTP.

**Impacto:** Facilita campañas dirigidas y permite confirmar qué cuentas existen. Si el token se expone en logs, historial del navegador o herramientas de monitoreo, puede utilizarse para tomar control de la cuenta.

**Remediación aplicada:** El endpoint responde siempre `200` con un mensaje neutro y no devuelve el token fuera del entorno de pruebas. La prueba [e2e/auth.spec.ts](../e2e/auth.spec.ts) verifica que una cuenta existente y una inexistente no sean distinguibles.

## 4.2 Controles de seguridad verificados

| Control probado | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|
| JWT con algoritmo `none` | Rechazo con `401` | El middleware usa `jwt.verify` con secreto y rechaza el token manipulado | [server/src/middleware/auth.ts](../server/src/middleware/auth.ts) |
| Acceso de un usuario que no pertenece al proyecto | `403` o `404`, sin filtrar datos | La membresía se comprueba antes de continuar | [server/src/middleware/membership.ts](../server/src/middleware/membership.ts) |
| Inyección SQL en login y búsqueda | No ejecutar SQL arbitrario | Prisma usa consultas parametrizadas; el payload no autentica ni altera datos | [server/src/modules/auth/auth.service.ts](../server/src/modules/auth/auth.service.ts) |
| Bloqueo de cuenta | Bloquear al quinto intento fallido | Se registra `lockedUntil` por 15 minutos y se rechaza el login durante el bloqueo | [server/src/modules/auth/auth.service.ts](../server/src/modules/auth/auth.service.ts) |
| Recuperación de contraseña | Un solo uso y sin enumeración | Primer reset en verde, segundo reset en `400`, respuestas neutras para emails desconocidos | [e2e/auth.spec.ts](../e2e/auth.spec.ts) |
| Membresía vigente | Un exmiembro no opera sobre tareas | Responde `403`; al quitarlo, sus tareas quedan sin asignar | [e2e/members.spec.ts](../e2e/members.spec.ts) |

## 4.3 Hallazgos de accesibilidad

### Hallazgo de Accesibilidad N.° 01

| Campo | Detalle |
|---|---|
| ID | ACC-01 |
| SC WCAG 2.1 | 1.3.1 Información y relaciones / 4.1.2 Nombre, función, valor |
| Nivel | A |
| Principio POUR | Robusto |
| Detección | `@axe-core/playwright` + revisión del DOM |
| Vista afectada | Detalle de tarea |

**Descripción del fallo:** Los campos para agregar etiquetas y comentarios no tenían un nombre accesible asociado: eran un `<input>` y un `<textarea>` fuera de un `<label>`.

**Fix aplicado:** Se agregaron los textos `Nombre de etiqueta` y `Comentario`, se envolvieron los controles con `<label>` y se incorporaron identificadores estables en [client/src/pages/TaskDetailPage.tsx](../client/src/pages/TaskDetailPage.tsx).

**Verificación:** La regla `label` quedó configurada en `VERIFICAR` dentro de [e2e/a11y.spec.ts](../e2e/a11y.spec.ts), por lo que la prueba falla si vuelve a aparecer en las vistas auditadas.

### Hallazgo de Accesibilidad N.° 02

| Campo | Detalle |
|---|---|
| ID | ACC-02 |
| SC WCAG 2.1 | 1.3.1 Información y relaciones |
| Nivel | A |
| Principio POUR | Robusto |
| Detección | Revisión manual complementaria |
| Vista afectada | Formularios de Login y Proyectos |

**Descripción del riesgo revisado:** Los campos dependían únicamente del texto visual dentro de un `<label>`. Aunque el anidamiento hacía que axe los reconociera, no había identificadores explícitos para facilitar mantenimiento, automatización y asociación estable con tecnologías asistivas.

**Fix aplicado:** Se agregaron IDs (`login-name`, `login-email`, `login-password`, `project-name` y `project-description`) en [client/src/pages/LoginPage.tsx](../client/src/pages/LoginPage.tsx) y [client/src/pages/ProjectsPage.tsx](../client/src/pages/ProjectsPage.tsx), preservando los `data-testid` existentes.

### Controles manuales sin hallazgo

- **Teclado:** los proyectos se exponen como enlaces nativos y pueden alcanzarse y activarse con `Tab` y `Enter`.
- **Idioma:** [client/index.html](../client/index.html) declara `lang="es"`, consistente con el contenido.
- **Mensajes de error:** [client/src/lib/ui.tsx](../client/src/lib/ui.tsx) usa `role="alert"` para anunciar errores de autenticación y formularios.

### Hallazgo de Accesibilidad N.° 03

| Campo | Detalle |
|---|---|
| ID | ACC-03 |
| SC WCAG 2.1 | 2.4.7 Foco visible |
| Nivel | AA |
| Principio POUR | Operable |
| Detección | Revisión manual con teclado |
| Vista afectada | Login, Proyectos y Detalle de tarea |

**Descripción del fallo:** Al recorrer los controles con `Tab`, el navegador no tenía un estilo de foco consistente definido por la aplicación. En fondos claros, la persona podía perder la posición actual del foco.

**Fix aplicado:** Se agregó un indicador de foco visible con `:focus-visible` para enlaces, botones y campos en [client/src/styles.css](../client/src/styles.css).

**Verificación:** Recorrer Login, Proyectos y Detalle de tarea con `Tab` muestra un contorno azul de 3 px sin eliminar el foco nativo.

## 4.4 User stories de remediación

### US-SEC-01 — Restringir orígenes CORS

**Como** responsable de seguridad, **quiero** permitir únicamente el origen oficial del frontend **para** evitar consumo cross-origin no autorizado.

**Criterios de aceptación:**

- Una solicitud con el origen configurado recibe los headers CORS esperados.
- Una solicitud desde un origen no autorizado no recibe `Access-Control-Allow-Origin`.
- La configuración cambia por ambiente sin permitir `*` en producción.

### US-SEC-02 — Invalidar tokens de recuperación

**Como** usuario, **quiero** que el token de recuperación sea de un solo uso **para** impedir cambios posteriores si el token se filtra.

**Criterios de aceptación:**

- El primer reset válido actualiza la contraseña y marca el token como usado.
- Un segundo reset con el mismo token responde `400`.
- Un token vencido o usado no puede modificar la cuenta.

### US-ACC-01 — Mantener nombres accesibles

**Como** persona que usa lector de pantalla, **quiero** que todos los controles tengan un nombre accesible **para** comprender y completar los formularios.

**Criterios de aceptación:**

- axe no reporta la regla `label` en Login, Registro, Proyectos ni Detalle de tarea.
- La auditoría `npx playwright test a11y --project=chromium` verifica la regla corregida en verde.
- Los selectores `data-testid` de los flujos existentes permanecen sin cambios.

## 4.5 Evidencias de ejecución

| Verificación | Comando | Resultado |
|---|---|---|
| Suite API | `npm test` | 4 suites y 11 tests en verde |
| Build frontend | `npm run build:client` | TypeScript y Vite en verde |
| Auditoría axe | `npx playwright test a11y --project=chromium` | 4 vistas auditadas; la regla `label` queda verificada |
| Autenticación/autorización | `npm run test:e2e -- auth.spec.ts members.spec.ts --project=chromium` | 6 tests en verde |
| Dependencias raíz | `npm audit` | 9 vulnerabilidades: 3 moderate, 3 high, 3 critical |
| Dependencias servidor | `npm --prefix server audit` | Evidencia guardada en [docs/evidencias/npm-audit-server.txt](./evidencias/npm-audit-server.txt) |
| Dependencias cliente | `npm --prefix client audit` | Evidencia guardada en [docs/evidencias/npm-audit-client.txt](./evidencias/npm-audit-client.txt) |

## 05 Checklist de entrega

### Seguridad

- [x] La app TaskFlow se levanta localmente y la API responde en `/api/health`.
- [x] Se ejecutó `npm audit` desde la raíz y se documentaron vulnerabilidades HIGH/CRITICAL en las evidencias.
- [x] Se inspeccionaron headers con `curl.exe -i` y se documentó la política CORS permisiva como SEC-01.
- [x] Se probó el control de acceso con dos usuarios sobre proyectos y tareas; evidencia en [e2e/members.spec.ts](../e2e/members.spec.ts).
- [x] Se probaron JWT manipulado, inyección SQL y payloads de texto; resultados en la tabla de controles verificados.
- [x] Se documentaron hallazgos con ID, severidad, ubicación, impacto, reproducción, remediación y evidencia.
- [x] Cada hallazgo tiene severidad y pasos de reproducción verificables.

### Accesibilidad

- [x] `@axe-core/playwright` está instalado desde la raíz y [e2e/a11y.spec.ts](../e2e/a11y.spec.ts) ejecuta la auditoría.
- [x] La auditoría cubre Login, Registro, Proyectos y Detalle de tarea con `--project=chromium`.
- [x] Se documentaron tres hallazgos mapeados a SC WCAG 2.1, incluyendo la revisión manual de foco.
- [x] Se corrigieron nombres accesibles en formularios y foco visible en [client/src/](../client/src/); la verificación `label` queda en verde.

### Reporte y User Stories

- [x] Los hallazgos incluyen todos los campos de la plantilla y las evidencias apuntan a archivos reproducibles.
- [x] Cada User Story incluye formato Como / quiero / para y al menos tres criterios de aceptación comprobables.
- [x] El reporte queda versionado en este repositorio para su entrega en GitHub.
