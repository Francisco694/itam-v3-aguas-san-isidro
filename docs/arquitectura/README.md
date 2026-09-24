# Arquitectura ITAM

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico

## Documentos

- [Arquitectura general](ARQUITECTURA_GENERAL.md): recorrido de una operación desde Angular hasta PostgreSQL.
- [Frontend](FRONTEND.md): rutas, componentes y servicios Angular.
- [Backend](BACKEND.md): módulos Express y separación de responsabilidades.
- [Base de datos](BASE_DE_DATOS.md): PostgreSQL, esquema `itam`, migraciones e invariantes.
- [Seguridad](SEGURIDAD.md): sesión, credenciales, roles, CORS, auditoría y errores.
- [Reglas de negocio](REGLAS_DE_NEGOCIO.md): invariantes que afectan inventario, custodia y trazabilidad.
- [Decisiones técnicas](DECISIONES_TECNICAS.md): decisiones visibles en el código y sus motivos.

## Fuente de verdad

La implementación está en `frontend/src`, `backend/src` y `database/migrations`. Esta carpeta explica la solución actual; no agrega capacidades que no estén representadas por esas fuentes.
