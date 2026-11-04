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

**Descripción:** `resetPassword` valida que el token exista, pero no verifica `usedAt` ni lo marca como usado después de cambiar la contraseña. Por lo tanto, un token válido puede reutilizarse hasta su vencimiento.

**Pasos de reproducción:**

1. Solicitar un token con `POST /api/auth/forgot-password`.
2. Ejecutar `POST /api/auth/reset-password` con ese token y una contraseña nueva.
3. Repetir la misma solicitud con otra contraseña antes de que expire el token.

**Impacto:** El poseedor de un token filtrado puede cambiar repetidamente la contraseña de la cuenta durante la ventana de validez. También contradice el criterio de aceptación de token de un solo uso cubierto por [e2e/auth.spec.ts](../e2e/auth.spec.ts).

**Remediación propuesta:** Consultar con `where: { token, usedAt: null, expiresAt: { gt: new Date() } }` y actualizar `usedAt` dentro de una transacción junto con el cambio de contraseña. Mantener una prueba de primer uso exitoso y segundo uso rechazado.

### Hallazgo de Seguridad N.° 03

| Campo | Detalle |
|---|---|
| ID | SEC-03 |
| Título | Exposición del token de recuperación y enumeración de cuentas |
| Severidad | MEDIUM |
| CVSS | 6.5 (estimado) |
| Ubicación | [server/src/modules/auth/auth.service.ts](../server/src/modules/auth/auth.service.ts), líneas 98-119 |

**Descripción:** El endpoint de recuperación devuelve el token en la respuesta (`{ message, token }`) y responde `404 No account found for that email` cuando la cuenta no existe. Esto permite enumerar usuarios y hace que un token obtenido por un canal comprometido quede disponible directamente para el cliente.

**Pasos de reproducción:**

1. Enviar `POST /api/auth/forgot-password` con un email registrado y observar el token en la respuesta.
2. Repetir la solicitud con un email inexistente.
3. Comparar ambos estados y mensajes HTTP.

**Impacto:** Facilita campañas dirigidas y permite confirmar qué cuentas existen. Si el token se expone en logs, historial del navegador o herramientas de monitoreo, puede utilizarse para tomar control de la cuenta.

**Remediación propuesta:** Responder siempre `200` con un mensaje neutro, no devolver el token en producción y entregarlo exclusivamente mediante un canal de recuperación controlado. Para desarrollo, habilitar el token solo detrás de una configuración explícita.

## 4.2 Controles de seguridad verificados

| Control probado | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|
| JWT con algoritmo `none` | Rechazo con `401` | El middleware usa `jwt.verify` con secreto y rechaza el token manipulado | [server/src/middleware/auth.ts](../server/src/middleware/auth.ts) |
| Acceso de un usuario que no pertenece al proyecto | `403` o `404`, sin filtrar datos | La membresía se comprueba antes de continuar | [server/src/middleware/membership.ts](../server/src/middleware/membership.ts) |
| Inyección SQL en login y búsqueda | No ejecutar SQL arbitrario | Prisma usa consultas parametrizadas; el payload no autentica ni altera datos | [server/src/modules/auth/auth.service.ts](../server/src/modules/auth/auth.service.ts) |
| Bloqueo de cuenta | Bloquear al quinto intento fallido | Se registra `lockedUntil` por 15 minutos y se rechaza el login durante el bloqueo | [server/src/modules/auth/auth.service.ts](../server/src/modules/auth/auth.service.ts) |

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
