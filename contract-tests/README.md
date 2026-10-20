# Contract tests

- `consumer/projects.pact.test.ts`: ejecuta el cliente web contra el mock de Pact y genera `pacts/TaskFlowWeb-TaskFlowAPI.json`.
- `provider/projects.provider.test.ts`: reproduce las interacciones del contrato contra la API real.

## Ejecución

Preparar la base SQLite de test con el esquema y el seed:

```bash
npm run contract:db:setup
```

Levantar la API en una terminal:

```bash
npm run contract:provider:start
```

En otra terminal, generar y verificar el contrato, en ese orden:

```bash
npm run test:contract:consumer
npm run test:contract:provider
```

La API de provider se ejecuta en `http://localhost:3001/api`, usa `server/prisma/taskflow_test.db` y autentica el usuario del seed `ana@test.com` con contraseña `Password1`.
