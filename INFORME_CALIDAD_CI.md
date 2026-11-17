# Informe de calidad y recomendación de liberación

## 1. Resumen ejecutivo

Revisamos las pruebas y la documentación de `ci-test-branch`, junto con la última ejecución de CI del 10/11/2026. De sus seis jobs, cinco terminaron correctamente y falló el de Playwright. También encontramos un hallazgo de seguridad documentado sobre la configuración de CORS.

La branch contiene recorridos E2E con Playwright, pruebas de contrato con Pact, controles de seguridad y pruebas de API. El commit [`d3defa5`](https://github.com/Rodri240/taskflow_2026_s2/commit/d3defa5) incorporó los recorridos E2E y el reporte de issues propuestos; [`3c2393d`](https://github.com/Rodri240/taskflow_2026_s2/commit/3c2393d) agregó Pact; y [`4ab611f`](https://github.com/Rodri240/taskflow_2026_s2/commit/4ab611f) amplió las pruebas del servidor y corrigió filtros y paginación. El commit [`dbe15b6`](https://github.com/Rodri240/taskflow_2026_s2/commit/dbe15b6) identifica su aporte como «parte 1 y 2» del práctico del módulo 2 e incluye auditorías y tarjetas de seguridad. Sin la consigna de los ejercicios no podemos asignar con certeza estos trabajos a 1b o 2a.

## 2. Estado de las pruebas y del pipeline

Analizamos la branch `ci-test-branch` en el commit [`0ef2b07`](https://github.com/Rodri240/taskflow_2026_s2/commit/0ef2b07a1460099ff5da6b8c5498fc08dd8a9d4e). La [ejecución de CI #5](https://github.com/Rodri240/taskflow_2026_s2/actions/runs/42914239167) comenzó el 10/11/2026 a las 19:24, hora de Montevideo, y terminó **fallida**.

Aprobaron la compilación del servidor y del cliente, ESLint, los tests unitarios y de integración, y el control de cobertura. Este último superó los umbrales configurados de 70 % de líneas y 40 % de ramas; no pudimos consultar los valores exactos. Las pruebas del servidor incluyen validaciones, membresía, filtros y paginación ([tests de tareas](server/tests/tasks.test.ts) y [controles HTTP](server/tests/plumbing.test.ts)). El workflow es informativo y no bloquea el merge.

Las [pruebas de contrato](contract-tests/README.md) definen con Pact la respuesta esperada para `GET /api/projects` y su verificación contra la API real. Están implementadas, pero no hay un job de contrato en este pipeline ni encontramos un resultado de ejecución para el commit analizado.

En Playwright se instalaron las dependencias y los navegadores, pero el paso de pruebas terminó con código 1. El reporte quedó guardado como `playwright-report`, aunque su descarga requiere autenticación y no tuvimos acceso a los logs. Por eso no conocemos los casos fallidos ni si el problema fue funcional o del entorno. La advertencia de configuración sobre Node 20 no alcanza para atribuirle el fallo. La consulta se hizo mediante la API pública de GitHub, ya que `gh` no estaba instalado.

## 3. Métricas seleccionadas

| Métrica y cálculo | Resultado y fuente | Interpretación y motivo de elección |
| --- | --- | --- |
| **Jobs exitosos:** jobs aprobados ÷ jobs ejecutados × 100. | **5/6 = 83,3 %** en la [ejecución #5](https://github.com/Rodri240/taskflow_2026_s2/actions/runs/42914239167). | Resume el estado de la CI, pero no es el porcentaje de tests aprobados: Playwright falló y no tenemos el detalle de sus casos. |
| **Historias con escenarios E2E documentados:** historias distintas listadas ÷ 17 historias de la especificación × 100. | **12/17 = 70,6 %**: US-01 a US-08, US-11, US-14, US-16 y US-17. Fuentes: [trazabilidad E2E](e2e/README.md) y [README](README.md). | Muestra el alcance declarado. Tener escenarios documentados no significa que todos se hayan ejecutado o aprobado, ni que cubran todos los criterios de cada historia. |
| **Hallazgos pendientes por severidad:** contar los hallazgos documentados sin corrección por nivel de severidad. | **Al menos 1 alto:** SEC-01, según el [reporte de seguridad](docs/reporte_hallazgos_m2.md). La [consulta pública de issues](https://github.com/Rodri240/taskflow_2026_s2/issues?q=is%3Aissue+is%3Aopen) devolvió **0 abiertos** el 16/11/2026. | Nos ayuda a considerar riesgos pendientes. SEC-01 es un hallazgo documentado, no un issue registrado; que no haya issues abiertos no implica que no existan defectos. |

**Métrica descartada: duración del pipeline.** Sirve para medir qué tan rápido obtenemos resultados, pero para decidir la liberación nos importan más los resultados de las pruebas y los riesgos encontrados.

## 4. Defectos

No encontramos issues públicos abiertos ni IDs para asociar a esta branch. El archivo [PLAYWRIGHT_GITHUB_ISSUES.md](PLAYWRIGHT_GITHUB_ISSUES.md) contiene issues *propuestos*, con pasos de reproducción y referencias a tests. Allí se registra una ejecución anterior, del 20/10/2026, con **4 pruebas aprobadas y 12 fallidas de 16**. Incluía problemas de acceso de exmiembros, recuperación de contraseña y fechas. Esos resultados corresponden a la branch `juan` y al commit base `76bf33b`, no al pipeline actual.

El [reporte posterior de seguridad](docs/reporte_hallazgos_m2.md) indica que se corrigieron y verificaron la reutilización de tokens y la enumeración de cuentas; también informa que un exmiembro ya no puede operar sobre tareas. No contamos esos problemas históricos como defectos abiertos actuales.

Las [tarjetas originales de seguridad](docs/tarjetas_hallazgos_seguridad_m2.docx) también registran que una búsqueda malformada devolvía error 500. Después, `4ab611f` reemplazó la consulta SQL construida con texto por filtros de Prisma y agregó una prueba que trata la búsqueda como texto ([tests de tareas](server/tests/tasks.test.ts)); el job de tests de servidor del CI aprobó, aunque no tuvimos acceso al detalle por caso. Las tarjetas y el reporte posterior reutilizan algunos identificadores para hallazgos distintos.

En el reporte posterior, **SEC-01** tiene severidad **alta** y no tiene una corrección documentada. La configuración permisiva de CORS permite solicitudes a la API desde otros orígenes; el reporte incluye pasos para reproducirlo y aclara que el token no se envía automáticamente como una cookie. El archivo [server/src/app.ts](server/src/app.ts) todavía utiliza `cors()` sin restringir orígenes.

## 5. Riesgos

El fallo actual de Playwright podría deberse a un defecto del producto o a un problema de ejecución. Además, las historias y criterios que no figuran en la matriz E2E podrían contener errores no detectados. CORS permisivo permite que otros sitios web hagan solicitudes a la API desde un navegador. Los cinco jobs aprobados son una buena señal, pero no garantizan que el producto esté libre de defectos.

## 6. Recomendación final: **NO LIBERAR**

Consideramos que todavía no corresponde liberar: aunque varias verificaciones pasaron, no pudimos comprobar qué ocurrió con los E2E y hay un hallazgo de seguridad pendiente. Antes de volver a decidir, deberíamos revisar los logs y el reporte de Playwright, corregir lo que corresponda y repetir las pruebas, además de evaluar y resolver SEC-01 y verificar los escenarios pendientes.
