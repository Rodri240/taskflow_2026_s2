# Reporte de hallazgos de seguridad y accesibilidad

**Proyecto:** TaskFlow

**Actualizado:** 2026-11-17

**Alcance:** API Express/Prisma, frontend React y auditoría dinámica baseline sobre el servidor de desarrollo.

## 1. Método de valoración

Los hallazgos de seguridad usan **CVSS v3.1 Base**. Los vectores y puntajes se recalcularon con la [especificación](https://www.first.org/cvss/v3.1/specification-document) y la [calculadora oficial de FIRST](https://www.first.org/cvss/calculator/3.1). El puntaje describe el riesgo del defecto original; el estado indica si continúa explotable en la versión actual.

## 2. Hallazgos de seguridad

### SEC-01 — Política CORS global y permisiva

| Campo | Detalle |
| --- | --- |
| Severidad | **MEDIUM — 4.2** |
| Vector | `CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N` |
| Estado | **Corregido y verificado** |
| Ubicación | [server/src/app.ts](../server/src/app.ts) |

**Descripción original.** La API registraba `cors()` sin allowlist y respondía `Access-Control-Allow-Origin: *`. La explotación útil requería que la víctima visitara un origen malicioso y que el atacante resolviera además el acceso al token Bearer, que no se adjunta automáticamente desde `localStorage`; por eso se asignan `AC:H` y `UI:R`, en lugar de la severidad alta estimada previamente.

**Reproducción original:** iniciar la API y ejecutar `curl -i -H 'Origin: https://evil.example' http://localhost:3000/api/health`; la respuesta incluía `Access-Control-Allow-Origin: *`.

**Remediación aplicada.** `CORS_ALLOWED_ORIGINS` acepta una lista separada por comas; por defecto solo permite `localhost:5173` y `127.0.0.1:5173`. Se limitan métodos y headers, mientras que las solicitudes sin `Origin` siguen habilitadas para clientes no navegador.

**Verificación.** [server/tests/plumbing.test.ts](../server/tests/plumbing.test.ts) comprueba que el origen configurado recibe el header y que un origen ajeno no lo recibe.

### SEC-02 — Token de recuperación reutilizable

| Campo | Detalle |
| --- | --- |
| Severidad | **HIGH — 7.4** |
| Vector | `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N` |
| Estado | **Corregido y verificado** |
| Ubicación | [server/src/modules/auth/auth.service.ts](../server/src/modules/auth/auth.service.ts) |

**Descripción original.** Un token válido podía reutilizarse hasta vencer. Para explotar el defecto era necesario obtener previamente un token de recuperación válido (`AC:H`), pero su reutilización permitía mantener el control de la cuenta sin interacción adicional.

**Pasos:** solicitar un token; restablecer la contraseña; repetir el reset con el mismo token antes del vencimiento. Antes del fix ambos cambios eran aceptados.

**Remediación aplicada.** Se validan `usedAt` y `expiresAt`; el consumo del token y el cambio de contraseña se realizan en una transacción. El segundo uso responde `400`.

**Evidencia:** [e2e/specs/critical/auth.spec.ts](../e2e/specs/critical/auth.spec.ts) y [e2e/specs/password-recovery.spec.ts](../e2e/specs/password-recovery.spec.ts).

### SEC-03 — Exposición del token y enumeración de cuentas

| Campo | Detalle |
| --- | --- |
| Severidad | **CRITICAL — 9.1** |
| Vector | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N` |
| Estado | **Corregido y verificado** |
| Ubicación | [server/src/modules/auth/auth.service.ts](../server/src/modules/auth/auth.service.ts) |

**Descripción original.** El endpoint devolvía el token al cliente y distinguía con `404` una cuenta inexistente. Conocer un email registrado permitía solicitar y obtener un token sin autenticación, por lo que la exposición del token —no solo la enumeración— justificaba impacto alto en confidencialidad e integridad.

**Pasos:** enviar `forgot-password` para un email registrado y observar el token; repetir con uno inexistente y comparar estado/cuerpo.

**Remediación aplicada.** La respuesta pública es siempre `200` con mensaje neutro. El token solo se incluye bajo `NODE_ENV=test`, donde sustituye el servicio de correo para las pruebas automatizadas.

**Evidencia:** [e2e/specs/critical/auth.spec.ts](../e2e/specs/critical/auth.spec.ts) verifica respuestas indistinguibles.

## 3. Baseline OWASP ZAP

Se ejecutó ZAP Baseline contra `http://host.docker.internal:5173` con el frontend Vite de desarrollo y una base temporal aislada:

```bash
docker run --rm -v "$PWD/docs:/zap/wrk/:rw" -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://host.docker.internal:5173 \
  -r zap-baseline-report.html -I -m 1
```

Resultado: **7 URLs**, **0 alertas high**, **3 medium**, **4 low** y **2 informativas**. El reporte íntegro está en [zap-baseline-report.html](./zap-baseline-report.html).

Las alertas medium fueron CSP ausente, anti-clickjacking ausente y configuración cross-domain. Se conservan como backlog de hardening del despliegue: el target fue Vite dev, no un servidor HTTPS productivo, por lo que headers como CSP, HSTS, COOP/COEP y cache deben definirse y volver a medirse en la plataforma real. Este baseline no reemplaza pruebas activas autenticadas sobre la API.

## 4. Controles de seguridad verificados

| Control | Resultado | Evidencia |
| --- | --- | --- |
| JWT `alg:none` | Rechazado con `401` | [server/src/middleware/auth.ts](../server/src/middleware/auth.ts) |
| Acceso ajeno a proyectos/tareas | `403`/`404` sin filtrar datos | [server/src/middleware/membership.ts](../server/src/middleware/membership.ts) |
| Búsqueda con comillas | Consulta parametrizada; no rompe SQL | [server/src/modules/tasks/tasks.repository.ts](../server/src/modules/tasks/tasks.repository.ts) |
| Bloqueo de cuenta | Bloqueo al quinto fallo; contador reiniciado tras login válido | [server/tests/auth.test.ts](../server/tests/auth.test.ts) |
| Recuperación | Token de un uso y respuesta neutra | [e2e/specs/password-recovery.spec.ts](../e2e/specs/password-recovery.spec.ts) |
| CORS | Allowlist por ambiente | [server/tests/plumbing.test.ts](../server/tests/plumbing.test.ts) |

## 5. Hallazgos de accesibilidad

### ACC-01 — Controles sin nombre accesible

| Campo | Detalle |
| --- | --- |
| SC WCAG 2.1 | 1.3.1 / 4.1.2 |
| Nivel | A |
| Estado | Corregido |

Los campos de etiquetas y comentarios no estaban asociados a un nombre accesible. Se agregaron `label`, texto visible e IDs estables en [client/src/pages/TaskDetailPage.tsx](../client/src/pages/TaskDetailPage.tsx).

### ACC-02 — Asociaciones implícitas difíciles de mantener

| Campo | Detalle |
| --- | --- |
| SC WCAG 2.1 | 1.3.1 |
| Nivel | A |
| Estado | Corregido |

Login y Proyectos dependían solo del anidamiento dentro del `label`. Se agregaron IDs explícitos, manteniendo los `data-testid`, en [client/src/pages/LoginPage.tsx](../client/src/pages/LoginPage.tsx) y [client/src/pages/ProjectsPage.tsx](../client/src/pages/ProjectsPage.tsx).

### ACC-03 — Foco visible inconsistente

| Campo | Detalle |
| --- | --- |
| SC WCAG 2.1 | 2.4.7 |
| Nivel | AA |
| Estado | Corregido |

Se incorporó un indicador `:focus-visible` de 3 px para enlaces, botones y campos en [client/src/styles.css](../client/src/styles.css). La revisión manual recorre Login, Proyectos y Detalle con teclado.

La auditoría automatizada [e2e/specs/critical/a11y.spec.ts](../e2e/specs/critical/a11y.spec.ts) cubre Login, Registro, Proyectos y Detalle: las cuatro vistas reportan **0 violaciones axe** en la ejecución actual.

## 6. User stories de remediación

### US-SEC-01 — Restringir orígenes CORS

**Como** responsable de seguridad, **quiero** permitir solo los orígenes configurados **para** reducir el consumo cross-origin no autorizado.

- El origen configurado recibe `Access-Control-Allow-Origin`.
- Un origen ajeno no recibe ese header.
- La lista cambia por ambiente sin usar `*` como valor por defecto.

### US-SEC-02 — Invalidar tokens de recuperación

**Como** usuario, **quiero** que el token sea de un solo uso **para** impedir cambios posteriores si se filtra.

- El primer uso válido actualiza la contraseña.
- Un segundo uso responde `400`.
- Tokens vencidos o consumidos no modifican la cuenta.

### US-SEC-03 — Evitar enumeración y exposición del token

**Como** responsable de privacidad, **quiero** una respuesta pública uniforme y sin secretos **para** no revelar cuentas ni credenciales de recuperación.

- Email existente e inexistente producen mismo estado y mensaje.
- Producción no incluye el token en el cuerpo.
- El caso queda cubierto por E2E.

### US-ACC-01 — Mantener nombres accesibles

**Como** persona que usa lector de pantalla, **quiero** controles con nombre accesible **para** completar los formularios.

- axe no reporta `label` en las cuatro vistas auditadas.
- Los nombres describen la acción o dato.
- Los selectores E2E existentes se conservan.

### US-ACC-02 — Asociar labels e inputs explícitamente

**Como** mantenedor, **quiero** asociaciones estables entre etiqueta y control **para** evitar regresiones al reorganizar el DOM.

- Cada control tiene `id` único.
- La etiqueta mantiene una asociación válida.
- La navegación por teclado conserva el orden lógico.

### US-ACC-03 — Mostrar foco visible

**Como** persona que navega con teclado, **quiero** distinguir el elemento enfocado **para** saber dónde actuará la próxima tecla.

- Enlaces, botones y campos muestran foco visible.
- El indicador tiene contraste y no queda recortado.
- Se verifica manualmente en las vistas críticas.

## 7. Evidencia de ejecución actual

| Verificación | Resultado |
| --- | --- |
| Suite servidor | **165/165** tests |
| Suite E2E | **83/83** tests |
| Auditoría axe | 4 vistas, 0 violaciones |
| Build servidor | Correcto |
| ZAP baseline | 0 high; 3 medium; 4 low; 2 info |

Los IDs del documento de tarjetas se movieron al namespace `CARD-SEC-*`, por lo que no colisionan con `SEC-*` de este reporte. El DOCX actualizado es [tarjetas_hallazgos_seguridad_m2.docx](./tarjetas_hallazgos_seguridad_m2.docx).
