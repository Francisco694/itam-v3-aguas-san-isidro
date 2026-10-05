# Manual de Uso

> Archivo histórico conservado por compatibilidad. La fuente canónica de entrega es [`01_manual_de_usuario.md`](01_manual_de_usuario.md), que contiene la versión ampliada y validada del manual.

## Propósito y alcance

Este manual describe el uso funcional observado de ITAM v3.0 para Aguas San Isidro. Cubre el acceso, la consulta del inventario, la custodia de activos, las líneas móviles, los documentos operativos, el servicio técnico, el offboarding y los reportes. Las indicaciones se basan en las rutas Angular y los módulos del backend presentes en el commit `d98da1223838be87ec48302a8c5427b88ee45bf7`.

## Acceso y sesión

1. Abrir la aplicación y autenticarse mediante el formulario de login.
2. Si la cuenta exige cambio de contraseña o PIN, completar primero la pantalla **Mi acceso**.
3. La aplicación mantiene una cookie HTTP-only llamada `itam_session`.
4. Cerrar sesión desde el encabezado al finalizar el trabajo.

La sesión tiene expiración absoluta y control de inactividad. Los valores por defecto documentados son 60 minutos de inactividad y una advertencia 5 minutos antes, aunque los valores productivos deben validarse en la configuración del servidor.

## Perfiles

| Perfil | Uso confirmado | Restricción |
| --- | --- | --- |
| `SUPER_USUARIO` | Administración de usuarios y todas las operaciones autorizadas | Requiere controles de seguridad y auditoría |
| `USUARIO` | Operación normal de inventario y módulos de negocio | No administra usuarios ni configura alertas de stock |
| `SOLO_LECTURA` | Consulta de información | No puede ejecutar `POST`, `PUT`, `PATCH` ni `DELETE`; tampoco debe ver acciones de cambio |

La restricción de solo lectura se aplica en el backend mediante `rejectReadOnlyMutations` y en el frontend mediante `writeGuard` y ocultamiento de acciones. La migración `035_read_only_user_role.sql` permite guardar el perfil en PostgreSQL.

## Navegación funcional

Las pantallas reales observadas son:

- Dashboard.
- Inventario y detalle de dispositivos.
- Colaboradores y detalle de inventario por persona.
- Departamentos y detalle de inventario departamental.
- Tarjetas SIM y líneas móviles.
- Estados, tipos de dispositivo y familias de códigos.
- Alertas de stock.
- Offboarding o salida de personal.
- Servicio técnico.
- Actas y comprobantes.
- Reportes.
- Administración de usuarios, solo para `SUPER_USUARIO`.
- Mi acceso.

## Flujos de trabajo

### Inventario y dispositivos

1. Buscar o abrir un dispositivo desde **Inventario**.
2. Revisar código ITAM, tipo, marca, modelo, identificadores, estado, valor comercial, custodia, historial y verificaciones físicas.
3. Según el perfil y las reglas del activo, registrar entrega a colaborador, entrega a departamento, devolución, recuperación, cambio de estado, baja, verificación física o envío a servicio técnico.
4. Revisar el historial posterior a cada operación.

El código ITAM es generado por el backend, es único y no se cambia desde el frontend. IMEI y número de serie tienen validaciones de duplicidad cuando aplican.

### SIM y línea móvil

La SIM, el dispositivo y la línea telefónica son entidades separadas. Se puede consultar historial de SIM, asociar una línea a un dispositivo y registrar o actualizar el número según las reglas del módulo. Registrar una línea no equivale a realizar una verificación física.

### Custodia y devoluciones

Un dispositivo puede estar bajo custodia de un colaborador, un departamento o sin custodio, pero no puede tener dos custodias vigentes. La devolución registra el resultado y la condición y conserva la trazabilidad.

### Actas y comprobantes

El módulo de actas lista actas, permite consultar el detalle y generar PDF. El módulo de comprobantes permite consultar comprobantes y generar su PDF. Los documentos deben revisarse antes de imprimirlos o archivarlos.

### Servicio técnico

El flujo observado comprende creación de orden, envío, diagnóstico o cotización, decisión, archivo de cotización, equipo temporal, cierre y retorno. No se deben abrir dos órdenes técnicas para el mismo dispositivo.

### Offboarding

1. Buscar al colaborador.
2. Revisar equipos pendientes y proceso abierto.
3. Abrir el proceso de salida.
4. Registrar devoluciones o resultados pendientes.
5. Cerrar el proceso cuando la situación esté resuelta.

Un colaborador no debe tener más de un proceso de offboarding abierto.

## Evidencia y estado

| Dato | Fuente | Estado |
| --- | --- | --- |
| Pantallas y rutas | `frontend/src/app/app.routes.ts` | Confirmado |
| Perfiles | `backend/src/shared/auth-context.ts`, `frontend/src/app/core/models/auth.models.ts` | Confirmado |
| Bloqueo de mutaciones para solo lectura | `backend/src/shared/auth.middleware.ts` | Confirmado |
| Flujos de negocio | `docs/arquitectura/REGLAS_DE_NEGOCIO.md`, módulos fuente | Confirmado |
| Prueba completa con usuarios productivos | No ejecutada durante esta recopilación | Pendiente de validar con Codex |
