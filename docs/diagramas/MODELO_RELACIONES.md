# Modelo de relaciones

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico

```mermaid
erDiagram
    DEPARTAMENTO ||--o{ COLABORADOR : contiene
    DEPARTAMENTO ||--o{ DISPOSITIVO : custodia
    COLABORADOR ||--o{ DISPOSITIVO : custodia
    TIPO_DISPOSITIVO }o--|| FAMILIA_CODIGO : usa
    TIPO_DISPOSITIVO ||--o{ DISPOSITIVO : clasifica
    ESTADO ||--o{ DISPOSITIVO : define
    DISPOSITIVO ||--o| SIM : puede_tener
    DISPOSITIVO ||--o{ HISTORIAL_EVENTO : registra
    SIM ||--o{ HISTORIAL_EVENTO : registra
    DISPOSITIVO ||--o{ CUSTODIA : conserva
    DISPOSITIVO ||--o{ VERIFICACION_FISICA : verifica
    DISPOSITIVO ||--o{ ORDEN_SERVICIO : recibe
    ORDEN_SERVICIO ||--o{ COTIZACION_ARCHIVO : adjunta
    COLABORADOR ||--o{ PROCESO_OFFBOARDING : inicia
    PROCESO_OFFBOARDING ||--o{ COMPROBANTE_DEVOLUCION : produce
    ACTA_ENTREGA ||--o{ ACTA_DETALLE : contiene
    DISPOSITIVO ||--o{ ACTA_DETALLE : documenta
    USUARIO ||--o{ SESION : mantiene
    USUARIO ||--o{ AUDITORIA : ejecuta
```

El diagrama representa relaciones de dominio; los nombres físicos exactos y restricciones se mantienen en `database/migrations`.
