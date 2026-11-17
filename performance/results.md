# Resultados de rendimiento

**Fecha:** 2026-11-17

**Equipo:** macOS arm64, Node 24.3.0, Docker 28.5.1, k6 2.4.0

**Carga:** 10 VUs constantes, 30 s, pausa de 100 ms, páginas de 20 tareas con offset aleatorio.

| Dataset | Tareas | Comentarios | p95 listado | Error rate | Iteraciones/s | Criterio p95 < 500 ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Seed chico | 12 | 5 | **18,81 ms** | **0,00 %** | **87,57** | Cumple |
| Seed grande | 5.000 | 20.000 | **30,42 ms** | **0,00 %** | **81,01** | Cumple |

## Lectura

El p95 aumentó **61,7 %** y el throughput bajó **7,5 %**, pero el dataset grande quedó 469,58 ms debajo del máximo: un margen de **93,9 %**. El volumen crece más de 400 veces y la latencia no lo acompaña linealmente porque el endpoint continúa paginado.

La diferencia se explica por tres costos que sí crecen: `count` recorre un conjunto mayor, los offsets aleatorios pueden saltar miles de filas y la página grande serializa 20 elementos mientras el proyecto chico solo tiene 6. La relación asignado y el conteo de comentarios se cargan ahora junto con la consulta paginada; se eliminó el patrón de dos consultas por cada resultado.

## Hipótesis y siguiente experimento

Con volúmenes mayores, `COUNT(*)` y la paginación por `OFFSET` deberían dominar. Conviene repetir con 50.000 tareas, observar el plan de SQLite y comparar cursor por ID contra offset. También debe repetirse sobre el servidor productivo, sin `ts-node-dev` ni Docker Desktop, antes de usar estos valores como capacidad operativa.

## Reproducibilidad

Escenario: [scenarios/api-load.k6.js](./scenarios/api-load.k6.js). Seed: [server/prisma/seed-large.ts](../server/prisma/seed-large.ts). Los comandos están en [README.md](./README.md). Los JSON de k6 no se versionan porque `--summary-export` incluye el token Bearer del setup; este documento conserva exclusivamente métricas agregadas.
