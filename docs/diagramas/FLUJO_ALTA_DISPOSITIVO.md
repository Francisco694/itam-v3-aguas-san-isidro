# Flujo de alta de dispositivo

**Actualizado:** 13 de octubre de 2026
**Tipo:** funcional

```mermaid
sequenceDiagram
    actor TI as Usuario TI
    participant FE as Angular
    participant API as API
    participant DB as PostgreSQL
    TI->>FE: Completa formulario de alta
    FE->>API: POST /dispositivos
    API->>API: Valida tipo, atributos, IMEI/serie
    API->>DB: Reserva código ITAM (transaccional)
    API->>DB: Inserta dispositivo + evento ALTA_DISPOSITIVO
    DB-->>API: Ficha creada
    API-->>FE: 201 con código ITAM
    FE-->>TI: Muestra ficha y etiqueta
```

---

**Referencias cruzadas:**
- [Arquitectura general](../arquitectura/ARQUITECTURA_GENERAL.md)
- [Reglas de negocio](../arquitectura/REGLAS_DE_NEGOCIO.md)
- [Documentación de API](../api/README.md)
