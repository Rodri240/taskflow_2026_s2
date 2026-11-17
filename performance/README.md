# Prueba de rendimiento del listado de tareas

El escenario mide `GET /api/projects/:projectId/tasks` con 10 usuarios virtuales durante 30 segundos. El criterio de la especificación es `p95 < 500 ms` con **5.000 tareas y 20.000 comentarios**; el error rate debe quedar debajo de 1 %.

## Preparar los datasets

```bash
# Seed chico
DATABASE_URL='file:./perf-small.db' npm --prefix server run db:seed

# Seed grande
DATABASE_URL='file:./perf-large.db' npm --prefix server run db:seed:large
```

Antes del seed, aplicar el esquema sobre la misma URL con `npx prisma db push`. Levantar la API con esa `DATABASE_URL` y luego ejecutar:

```bash
docker run --rm -i grafana/k6 run - \
  -e BASE_URL=http://host.docker.internal:3000 \
  -e PROJECT_NAME='Carga grande' \
  < performance/scenarios/api-load.k6.js
```

Para una medición reproducible se recomienda cerrar otros procesos intensivos, repetir al menos tres veces y comparar la mediana de cada métrica. [results.md](./results.md) registra la corrida local incluida en la entrega.
