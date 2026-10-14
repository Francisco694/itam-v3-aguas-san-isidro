# Diagramas

**Actualizado:** 13 de octubre de 2026
**Tipo:** índice técnico y funcional

Diagramas Mermaid versionados. Cada uno ilustra una parte del sistema y debe leerse junto con el documento de arquitectura o API que lo respalda.

## Diagramas disponibles

| Archivo | Tipo | Ilustra |
| --- | --- | --- |
| [Vista general](DIAGRAMA_ARQUITECTURA.md) | flowchart | Flujo Angular → API → PostgreSQL. |
| [Modelo de relaciones](MODELO_RELACIONES.md) | erDiagram | Entidades del dominio y sus vínculos. |
| [Casos de uso](CASOS_DE_USO.md) | flowchart | Actores y funciones principales. |
| [Ciclo de vida del activo](CICLO_VIDA_ACTIVO.md) | stateDiagram | Estados y transiciones de un dispositivo. |
| [Flujo de alta de dispositivo](FLUJO_ALTA_DISPOSITIVO.md) | sequenceDiagram | Registro inicial de un dispositivo. |
| [Flujo de asignación](FLUJO_ASIGNACION.md) | sequenceDiagram | Alta de custodia. |
| [Flujo de devolución](FLUJO_DEVOLUCION.md) | sequenceDiagram | Cierre de custodia y comprobante. |
| [Flujo de offboarding](FLUJO_OFFBOARDING.md) | flowchart | Proceso de salida de un colaborador. |
| [Flujo de servicio técnico](FLUJO_SERVICIO_TECNICO.md) | stateDiagram | Ciclo de una orden técnica. |
| [Flujo de SIM y línea](FLUJO_SIM_LINEA.md) | flowchart | Relaciones entre SIM, línea y dispositivo. |
| [Flujo de verificación física](FLUJO_VERIFICACION_FISICA.md) | flowchart | Verificación basada en evidencia. |

## Convenciones

- Los nombres de entidades son de dominio; el mapeo físico exacto vive en `database/migrations`.
- Los diagramas se renderizan con la extensión *Markdown Preview Mermaid Support* de VSCode.
