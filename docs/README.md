# Documentación ITAM

**Organización:** Aguas San Isidro
**Actualizado:** 23 de septiembre de 2026
**Tipo:** índice técnico, funcional y operativo

Esta carpeta documenta el sistema ITAM según el código vigente. Los documentos distinguen entre comportamiento implementado, decisiones de diseño, evidencia histórica y tareas pendientes. La documentación no sustituye las migraciones ni los contratos TypeScript: cuando existe una diferencia, la fuente de verdad es el código actual.

## API

- [Índice de API](api/README.md)
- [Autenticación y sesiones](api/AUTH.md)
- [Dispositivos](api/DISPOSITIVOS.md)
- [Colaboradores](api/COLABORADORES.md)
- [Departamentos](api/DEPARTAMENTOS.md)
- [SIM y líneas móviles](api/SIM_LINEAS.md)
- [Actas y comprobantes](api/ACTAS_ENTREGA.md)
- [Servicio técnico](api/SERVICIO_TECNICO.md)
- [Offboarding](api/OFFBOARDING.md)
- [Dashboard y reportes](api/DASHBOARD.md)
- [Errores HTTP](api/ERRORES_HTTP.md)
- [Códigos y etiquetas](api/ITAM_CODES_AND_LABELS.md)
- [Referencia histórica de API](api/ITAM_API_MVP.md)

## Arquitectura

- [Índice de arquitectura](arquitectura/README.md)
- [Arquitectura general](arquitectura/ARQUITECTURA_GENERAL.md)
- [Frontend](arquitectura/FRONTEND.md)
- [Backend](arquitectura/BACKEND.md)
- [Base de datos](arquitectura/BASE_DE_DATOS.md)
- [Seguridad](arquitectura/SEGURIDAD.md)
- [Reglas de negocio](arquitectura/REGLAS_DE_NEGOCIO.md)
- [Decisiones técnicas](arquitectura/DECISIONES_TECNICAS.md)

## Bitácoras

- [Índice de bitácoras](bitacoras/README.md)
- [Agosto de 2026](bitacoras/BITACORA_AGOSTO_2026.md)
- [Septiembre de 2026](bitacoras/BITACORA_SEPTIEMBRE_2026.md)
- [Bitácora detallada 24 de agosto–22 de septiembre](bitacoras/bitacora-2026-08-24-a-2026-09-22.md)
- [Avance documental del 23 de septiembre](bitacoras/avance-2026-09-23.md)

## Diagramas

- [Arquitectura general](diagramas/ARQUITECTURA_GENERAL.md)
- [Casos de uso](diagramas/CASOS_DE_USO.md)
- [Ciclo de vida del activo](diagramas/CICLO_VIDA_ACTIVO.md)
- [Flujo de asignación](diagramas/FLUJO_ASIGNACION.md)
- [Flujo de devolución](diagramas/FLUJO_DEVOLUCION.md)
- [Flujo de offboarding](diagramas/FLUJO_OFFBOARDING.md)
- [Flujo de servicio técnico](diagramas/FLUJO_SERVICIO_TECNICO.md)
- [Flujo SIM y línea](diagramas/FLUJO_SIM_LINEA.md)
- [Flujo de verificación física](diagramas/FLUJO_VERIFICACION_FISICA.md)
- [Modelo de relaciones](diagramas/MODELO_RELACIONES.md)

## Prototipo y producto

- [Índice de prototipo](prototipo/README.md)
- [Evolución de interfaz](prototipo/EVOLUCION_INTERFAZ.md)
- [Dashboard](prototipo/DASHBOARD.md)
- [Ficha de activo](prototipo/FICHA_ACTIVO.md)
- [Etiquetas](prototipo/ETIQUETAS.md)
- [Actas](prototipo/ACTAS.md)
- [Servicio técnico](prototipo/SERVICIO_TECNICO.md)
- [Offboarding](prototipo/OFFBOARDING.md)

## Producción

- [Checklist de producción](PRODUCTION_CHECKLIST.md)

## Convenciones

- El nombre del sistema es **ITAM**.
- La organización documentada es **Aguas San Isidro**.
- Las fechas se expresan en formato ISO cuando representan datos técnicos y en español cuando forman parte de una bitácora.
- Un documento nuevo debe incluir fecha de actualización y tipo de documento.
- Los diagramas usan Mermaid y deben reflejar rutas, estados y relaciones existentes.
