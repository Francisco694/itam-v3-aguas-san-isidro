# Actas de entrega

**Actualizado:** 24 de septiembre de 2026
**Tipo:** funcional y visual

## Flujo

1. Seleccionar uno o varios activos.
2. Elegir colaborador o departamento.
3. Registrar recepcionante cuando el destinatario es un departamento.
4. Confirmar localidad, declaración y observaciones.
5. Crear el acta con número anual correlativo.
6. Descargar o revisar el PDF.

## Decisiones

La pantalla muestra el destinatario, los equipos y la declaración antes de confirmar. El departamento custodio y la persona recepcionante son datos distintos. El departamento real asociado al colaborador se consulta para evitar mostrar información desactualizada en el documento.

## Estado actual

La API expone listado, detalle, creación y PDF. La trazabilidad del acta se conserva junto al detalle de activos y no se reemplaza por una descarga de archivo.

---

**Referencias cruzadas:**
- [Reglas de negocio](../arquitectura/REGLAS_DE_NEGOCIO.md)
- [Arquitectura general](../arquitectura/ARQUITECTURA_GENERAL.md)
- [Documentación de API](../api/README.md)
