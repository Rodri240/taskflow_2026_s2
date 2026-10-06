# ADR-0001: Arquitectura de testing de TaskFlow

## Parte 1 — Qué usa el proyecto HOY (reconocimiento honesto)

 **ninguno de los 4 patrones de UI se usa en ningún lado.**

| Patrón | ¿Dónde se usa hoy? |
|--------|---------------------|
| POM | En ningún lado. No hay clases de página |
| App Actions / Fixtures | Solo en el server: los helpers `registerUser`/`createProject`/`createTask` de `tests/helpers.ts` hacen acciones + inyección de estado, pero contra la **API**, no contra una UI. En el cliente: nada. |
| Component Object Model | No implementado. Pero la app ya define la interfaz estable para hacerlo pero faltalas clases que los usen. |
| Screenplay | En ningún lado. |


## Parte 2 — Por qué conviene cada elección


- **Frontend: COM + App Actions/Fixtures** — la combinación que conviene para una SPA React con componentes reutilizables 

- **POM clásico: descartado**  — con componentes compartidos, las clases de página completa duplican selectores y mezclan responsabilidades.

- **Screenplay: descartado por ahora**  — costo alto, aplicacion relativamente pequeña. No vale la pena todo el trabajo de seteo 

## Parte 3 — Propuesta de cambio 

> **Adoptar tests E2E, usando Component Object Model + App Actions/Fixtures.** 

**Posible Estructura:**

```
client/tests/
├── fixtures/              # inyección de estado
│   ├── api.ts             # request contra la API (crear proyecto/tarea por HTTP)
│   └── auth.ts            # login real + plantar token en localStorage
├── actions/               # App Actions (módulos funcionales)
│   └── app.ts             # loginAs(), openBoard(), createTask(), logout()
├── components/            # Component Object Model
│   ├── header.ts          # class AppHeader (logout, email del usuario)
│   ├── board.ts           # class BoardColumn (TODO / IN_PROGRESS / DONE)
│   └── feedback.ts        # class Feedback (Loading, ErrorMessage, EmptyState)
├── pages/                 # páginas como composición de componentes
│   ├── login.page.ts      # class LoginPage (formulario + submit)
│   ├── projects.page.ts
│   └── board.page.ts
```

