# Ficha de activo

**Actualizado:** 24 de septiembre de 2026
**Tipo:** funcional y visual

## Información mostrada

- código ITAM y tipo;
- marca, modelo, serie o IMEI;
- atributos específicos del tipo;
- valor comercial y factura de adquisición cuando existe;
- estado, localidad y ubicación;
- custodio actual y receptor departamental;
- SIM y línea telefónica;
- último responsable conocido;
- resultado de offboarding;
- verificación física;
- historial de eventos y trazabilidad;
- estado y resumen de servicio técnico.

## Catálogos técnicos

La ficha permite consultar uno o más manuales o documentos técnicos en PDF asociados al equipo.
Los perfiles `SUPER_USUARIO` y `USUARIO` pueden adjuntar, cambiar y eliminar documentos. El
perfil `SOLO_LECTURA` solo puede abrirlos: la columna de acciones no se muestra y los catálogos se
presentan en una tarjeta independiente de documentación.

La gestión exige confirmación dentro de la página antes de abrir el selector de archivos o
eliminar un documento. La convención recomendada es `Tipo de documento - Marca Modelo.pdf`.

El acceso desde un QR ofrece la opción **Catálogo Técnico y Manuales PDF** y navega a la ficha con
el ancla `#catalogo`.

## Acciones

La ficha concentra editar, entregar a colaborador, entregar a departamento, devolver, cambiar estado, recuperar, dar de baja, registrar verificación, gestionar línea/SIM y abrir servicio técnico. Las acciones se deshabilitan cuando la regla de estado, custodia u orden técnica lo exige.

## Razón de diseño

La ficha es el punto de auditoría de un activo: una persona debe poder identificarlo físicamente, saber quién responde por él, entender qué ocurrió antes y distinguir una acción disponible de una operación terminal.

---

**Referencias cruzadas:**
- [Reglas de negocio](../arquitectura/REGLAS_DE_NEGOCIO.md)
- [Arquitectura general](../arquitectura/ARQUITECTURA_GENERAL.md)
