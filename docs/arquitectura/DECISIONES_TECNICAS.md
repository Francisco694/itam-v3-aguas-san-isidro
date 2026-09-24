# Decisiones técnicas

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico

| Decisión | Motivo y consecuencia |
| --- | --- |
| Angular standalone y rutas lazy | Reduce carga inicial y separa las áreas funcionales del frontend. |
| API REST bajo `/api/v1` | Permite separar el contrato del frontend de la implementación interna. |
| Cookie de sesión HTTP-only | Evita exponer el token de sesión a código de interfaz. |
| Códigos generados con reserva transaccional | Evita colisiones concurrentes y hace el código inmutable. |
| PostgreSQL como fuente de integridad | Las relaciones, índices parciales y `CHECK` protegen reglas incluso fuera de la API. |
| Historial de eventos separado de la auditoría HTTP | El historial explica el ciclo del activo; la auditoría explica quién llamó qué mutación. |
| SIM y línea móvil separadas | Evita tratar el número telefónico como si fuera la tarjeta física. |
| Verificación física explícita | Distingue un registro histórico/importado de una comprobación real. |
| Archivos con metadatos en DB | Permite versionar, identificar y autorizar documentos sin guardar el binario dentro de una columna. |
| PDF generado en backend | Centraliza formato de actas, reportes, comprobantes y órdenes de trabajo. |
| Mermaid para diagramas | Mantiene los diagramas versionables y cercanos al modelo real. |

## Decisiones que no se deben inferir

No se documentan servicios de correo, sincronización externa, aplicación móvil nativa ni despliegue cloud porque no hay rutas o configuración vigente que los implementen.
