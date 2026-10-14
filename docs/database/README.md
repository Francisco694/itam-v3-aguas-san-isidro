# Documentación de base de datos

**Actualizado:** 13 de octubre de 2026
**Tipo:** índice técnico

Esta carpeta documenta el estado actual del versionamiento SQL y las reglas para continuar el historial sin alterar migraciones ya aplicadas.

- [Arquitectura y base de datos](../arquitectura/BASE_DE_DATOS.md): motor, esquema, entidades, versionamiento y limitaciones conocidas.
- [Historial de migraciones](HISTORIAL_MIGRACIONES.md): propósito documentado de las migraciones `001` a `041` y sus excepciones históricas.
- [Estado de migraciones](ESTADO_MIGRACIONES.md): comparación entre el repositorio y la base analizada.
- [Estado actual de la base](ESTADO_ACTUAL_BD.md): fotografía técnica de `itam_dev`.
- [Cómo crear una migración](COMO_CREAR_MIGRACION.md): guía para futuras migraciones.
- [Instalador PostgreSQL](INSTALADOR_POSTGRESQL.md): instalación nueva reproducible en PostgreSQL 16 y validación en Ubuntu.
- [Reconciliación de la migración 029](RECONCILIACION_029.md): diagnóstico, validación en escenarios A y B, y estrategia definitiva de instalación y actualización.

Esta documentación no ejecuta SQL ni reemplaza los archivos de `database/migrations`.
