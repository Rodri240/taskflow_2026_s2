# Suite E2E de TaskFlow

La suite usa Playwright sobre Chromium y una base SQLite temporal exclusiva que se crea para cada ejecución. No modifica `dev.db` ni depende del seed compartido.

## Ejecución

```bash
npx playwright install chromium
npm run test:e2e:typecheck
npm run test:e2e
```

Para depurar visualmente:

```bash
npm run test:e2e:headed
```

## Selección y trazabilidad

Se automatizaron los recorridos de prioridad alta y los límites de seguridad o integridad con mayor costo de regresión:

| Historia | Riesgo cubierto | Nivel |
| --- | --- | --- |
| US-01 | registro, normalización, duplicados y sesión | navegador + API |
| US-02 | login inválido/válido y bloqueo al quinto intento | navegador + API |
| US-03/04 | creación, validación y listado del proyecto | navegador |
| US-05 | creación completa y estado inicial inmutable | navegador + API |
| US-06 | transiciones válidas/inválidas e historial | navegador |
| US-07 | filtros combinados, búsqueda sin case y paginación | API |
| US-08 | alta, orden y borrado de comentarios propios | navegador |
| US-11 | alta/baja, visibilidad, desasignación y acceso de exmiembros | navegador + API |
| US-14/16 | asignación, prioridad y fecha calendario | navegador |
| US-17 | privacidad y token de un solo uso | API |

Los casos de contrato que no pueden generarse desde la UI se prueban con `APIRequestContext` de Playwright. Los recorridos visibles esperan la respuesta HTTP que causó cada cambio y luego verifican el estado renderizado; no usan pausas fijas. Los datos llevan identificadores únicos para impedir dependencias entre tests y los selectores se apoyan en los `data-testid` del producto.
