# Flujo de asignación

**Actualizado:** 23 de septiembre de 2026
**Tipo:** funcional

```mermaid
sequenceDiagram
    actor TI as Usuario TI
    participant FE as Angular
    participant API as API
    participant DB as PostgreSQL
    TI->>FE: Selecciona activo y custodio
    FE->>API: POST asignar-colaborador/departamento
    API->>API: Valida sesión, estado y custodio único
    API->>DB: Transacción: custodia, estado e historial
    DB-->>API: Registro confirmado
    API-->>FE: Ficha actualizada
    FE-->>TI: Confirma asignación
```
