# PERF-01 — Evitar degradación del listado con 5.000 tareas

## Criterio de la especificación

> Con un volumen de 5.000 tareas y 20.000 comentarios, el tiempo de respuesta del listado de tareas (percentil 95) no supera los 500 ms.

Además, la cantidad de consultas por request no debe depender del número de resultados devueltos.

## Problema observado

El controlador consultaba asignado y cantidad de comentarios dentro de un bucle: dos consultas adicionales por cada tarea devuelta. Una página de 20 elementos generaba 42 operaciones de lectura, por lo que aumentar `limit` degradaba el request aun si el volumen total permanecía constante.

## Cambio aplicado

- Obtener asignado y `_count.comments` mediante relaciones de Prisma en la consulta paginada.
- Mantener `countTasks` como consulta separada para el total.
- Verificar seed chico versus grande con `performance/scenarios/api-load.k6.js`.

## Resultado medido

| Dataset | p95 | Error rate | Iteraciones/s |
| --- | ---: | ---: | ---: |
| 12 tareas / 5 comentarios | 18,81 ms | 0,00 % | 87,57 |
| 5.000 tareas / 20.000 comentarios | 30,42 ms | 0,00 % | 81,01 |

El criterio de 500 ms se cumple con 93,9 % de margen en la corrida documentada.

## Criterios de cierre

- p95 de `task_list_duration` menor a 500 ms con 5.000/20.000.
- `task_list_errors` menor a 1 %.
- El número de consultas no crece con la cantidad de items de la página.
- Resultados y ambiente documentados en `performance/results.md`.

Este archivo contiene el cuerpo listo para crear el issue en GitHub; la creación remota requiere permisos sobre el repositorio.
