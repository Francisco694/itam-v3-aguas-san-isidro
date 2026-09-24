# Ciclo de vida del activo

**Actualizado:** 23 de septiembre de 2026
**Tipo:** funcional

```mermaid
stateDiagram-v2
    [*] --> DISPONIBLE: alta/importación
    DISPONIBLE --> ASIGNADO: asignación
    ASIGNADO --> RETENIDO_REVISION: devolución
    RETENIDO_REVISION --> DISPONIBLE: revisión y liberación
    ASIGNADO --> SERVICIO_TECNICO: envío a servicio
    SERVICIO_TECNICO --> DISPONIBLE: retorno operativo
    SERVICIO_TECNICO --> DADO_BAJA: cierre sin reparación
    ASIGNADO --> EXTRAVIADO: reporte de pérdida
    EXTRAVIADO --> RETENIDO_REVISION: recuperación controlada
    DISPONIBLE --> DADO_BAJA: baja controlada
    RETENIDO_REVISION --> DADO_BAJA: baja controlada
    DADO_BAJA --> [*]
```

Los nombres son códigos de estado; la API valida las transiciones y no permite reemplazar una baja o recuperación con un cambio genérico.
