# Manual de Usuario

## Objetivo

Este manual explica cómo utilizar ITAM para consultar y administrar activos tecnológicos de Aguas San Isidro. Describe las tareas visibles en el frontend y las reglas que condicionan cada operación.

## Alcance

Incluye inicio de sesión, panel principal, colaboradores, usuarios, dispositivos, inventario, SIM, líneas telefónicas, asignaciones, recepciones, devoluciones, actas, servicio técnico, órdenes de trabajo, estados, historial, búsquedas, filtros, formularios, impresión y generación de PDF. La documentación se basa en el código disponible en el commit `754d036f00aa24b180c3812c460a2b18bd82b1a5` y distingue los datos confirmados de los que requieren validación en servidor.

## Usuarios, roles y permisos

| Rol | Puede consultar | Puede modificar | Restricciones verificadas |
| --- | --- | --- | --- |
| `SUPER_USUARIO` | Todos los módulos autorizados | Usuarios, catálogos, inventario y operaciones de negocio | La administración de usuarios exige este rol |
| `USUARIO` | Módulos de negocio y reportes autorizados | Operaciones de inventario y procesos permitidos | No administra usuarios; las rutas pueden exigir permisos adicionales |
| `SOLO_LECTURA` | Información disponible para lectura | Ninguna mutación | El backend rechaza `POST`, `PUT`, `PATCH` y `DELETE`; la interfaz oculta o bloquea acciones de escritura |

El control de solo lectura se aplica en `backend/src/shared/auth.middleware.ts` mediante `rejectReadOnlyMutations`. En el frontend, `writeGuard` restringe la ruta de alertas de stock y los componentes ocultan acciones de edición según el rol. La seguridad del backend es la autoridad final.

## Inicio de sesión y Mi acceso

1. Abra la aplicación y use el formulario de **Login**.
2. Si la cuenta exige cambio de contraseña o PIN, la aplicación redirige a **Mi acceso**.
3. Actualice las credenciales solicitadas antes de intentar abrir otro módulo.
4. La sesión se mantiene en la cookie HTTP-only `itam_session`.

Los valores por defecto del código son 60 minutos de inactividad y una advertencia 5 minutos antes. Los valores productivos dependen de `SESSION_IDLE_TIMEOUT_MINUTES` y `SESSION_IDLE_WARNING_MINUTES`, por lo que la configuración final debe validarse en servidor.

## Navegación y panel principal

Después de autenticarse, el frontend carga `MainLayout` y redirige a **Dashboard**. Las rutas funcionales confirmadas son:

- `/dashboard`: resumen gerencial y accesos a información operativa.
- `/departamentos`: departamentos e inventario departamental.
- `/colaboradores`: búsqueda, detalle e inventario de personas.
- `/dispositivos`: inventario, detalle y operaciones del activo.
- `/sim`: tarjetas SIM y sus asociaciones.
- `/estados`, `/tipos-dispositivo` y `/familias-codigo`: catálogos.
- `/alertas-stock`: alertas configurables de stock; no accesible para solo lectura.
- `/offboarding`: procesos de salida de personal.
- `/servicio-tecnico`: órdenes y revisiones técnicas.
- `/actas` y `/reportes`: documentos y reportes.
- `/administracion/usuarios`: administración exclusiva del superusuario.
- `/mi-acceso`: cambio de credenciales.

## Colaboradores

Desde **Colaboradores** se puede buscar por los criterios expuestos por la interfaz, abrir el detalle de una persona y consultar sus equipos actuales, historial y procesos de salida. El detalle de inventario puede diferenciar inventario vigente y conciliado. Las operaciones de alta, edición y devolución requieren un perfil con escritura.

## Usuarios

La ruta **Administración de usuarios** permite listar, crear y actualizar usuarios solo cuando el backend reconoce `SUPER_USUARIO`. El formulario contiene nombre, correo, cargo, contraseña, PIN, perfil y estado activo. El perfil `SOLO_LECTURA` debe guardarse como tal y no se debe confundir con desactivar la cuenta: una cuenta puede estar activa y ser de solo lectura.

## Dispositivos e inventario

En **Inventario** se consulta el código ITAM, tipo, marca, modelo, IMEI o número de serie, estado, valor comercial, custodio, SIM, línea móvil, historial y verificaciones físicas. El código de inventario es generado y validado por el backend; no se debe editar manualmente para reutilizarlo.

Las operaciones disponibles dependen del estado del activo y del rol:

1. Abrir el detalle del dispositivo.
2. Revisar identificadores y custodio actual.
3. Ejecutar la operación permitida: asignar, devolver, recuperar, cambiar estado, dar de baja, asociar línea, registrar verificación o enviar a servicio técnico.
4. Revisar el mensaje de confirmación y el historial resultante.

El backend evita custodias vigentes incompatibles, duplicidad de IMEI o serie cuando corresponde y operaciones que contradicen el ciclo de vida del activo.

## SIM y líneas telefónicas

La SIM, el smartphone y la línea telefónica son entidades relacionadas pero distintas. En **SIM** se consulta la tarjeta, su ICCID, estado, número asociado, equipo y colaborador. En el detalle del dispositivo se puede asociar o desasociar una línea según la operación permitida.

Una línea móvil no reemplaza una verificación física del equipo. La asociación debe comprobarse en el historial del dispositivo y en el historial de la SIM.

## Asignaciones, recepción y devoluciones

Una asignación relaciona un dispositivo con un colaborador o departamento. Antes de guardar, compruebe que el activo esté disponible, que el custodio sea válido y que no exista otra custodia vigente.

Una recepción o devolución debe registrar el resultado que ofrece el formulario y conservar la trazabilidad. En caso de devolución de un equipo temporal, primero debe cerrarse la entrega temporal asociada a la orden técnica.

## Actas, impresión y generación y descarga de PDF

El módulo de actas permite consultar actas de entrega y generar su PDF. Los comprobantes de devolución tienen un endpoint de PDF separado. Antes de imprimir:

1. Revise número, persona, departamento y activos.
2. Confirme que no falten datos obligatorios.
3. Use **Ver / imprimir PDF** o **Descargar PDF** según el módulo.
4. Compruebe visualmente el documento antes de archivarlo.

Las etiquetas físicas de activos utilizan QR y el componente `AssetLabel` llama a `window.print()` para imprimir solo la etiqueta. La impresión de una etiqueta no modifica el inventario.

## Servicio técnico y órdenes de trabajo

En **Servicio técnico** se muestran las revisiones y la orden seleccionada. El flujo tiene tres etapas: envío, diagnóstico o cotización y retorno o cierre.

### Crear una orden

El formulario exige fecha de envío, proveedor o destino, falla reportada, tipo de servicio y responsable TI. También admite área solicitante, contacto, accesorios y observaciones. No se puede crear otra orden abierta para el mismo equipo.

### Generación y descarga de PDF

La aplicación consulta `GET /api/v1/servicio-tecnico/:id/envio/pdf`. El generador usa A4, logo, tablas de fondo blanco, bordes gris claro, firmas y pie institucional. La sección debe aparecer exactamente como `5. RECEPCIÓN Y DEVOLUCIÓN (INTERNO)`. El número visible utiliza la correlatividad `numero_ot` de la migración 036; no se debe hardcodear la OT-163.

### Diagnóstico, cotización y cierre

- **Diagnóstico:** registra diagnóstico, reparación propuesta, costo, plazo, ticket y observaciones.
- **Cotización:** puede adjuntar un PDF, imagen, DOC o DOCX; el backend valida extensión, MIME, firma y tamaño.
- **Decisión:** permite aprobar, rechazar o dar de baja según el estado y el motivo.
- **Equipo temporal:** se entrega solo si cumple las condiciones del proceso y debe devolverse antes de cerrar.
- **Cierre:** exige fecha de retorno, costo final, resultado y estado final: operativo, sin reparación o baja.

## Estados, historial, búsquedas y filtros

Los estados se muestran como etiquetas de negocio, pero las reglas usan códigos como `DISPONIBLE`, `ASIGNADO`, `SERVICIO_TECNICO`, `RETENIDO_REVISION`, `EXTRAVIADO` y `DADO_BAJA`. Consulte el detalle y el historial cuando una operación no esté disponible.

Las pantallas de inventario, colaboradores, SIM, offboarding y servicio técnico incluyen búsquedas o filtros según el módulo. Un resultado vacío no significa que el registro no exista: revise filtros activos, paginación y permisos.

## Formularios, campos obligatorios y validaciones

| Formulario | Campos críticos comprobados | Validación o regla |
| --- | --- | --- |
| Login | Correo y credencial | Sesión válida, cuenta activa y credenciales vigentes |
| Usuario | Nombre, correo, rol y estado | Solo `SUPER_USUARIO` administra; roles definidos por catálogo |
| Dispositivo | Tipo, identificadores y datos exigidos por el tipo | Unicidad, formato, estado y custodia |
| Servicio técnico | Fecha, proveedor, tipo, falla y responsable | No duplicar orden abierta; estado compatible |
| Diagnóstico | Diagnóstico, reparación, monto y responsable | Monto no negativo y orden pendiente de diagnóstico |
| Cierre técnico | Fecha, costo, resultado, estado final y responsable | Equipo temporal cerrado y estado de orden válido |

Los mensajes del backend pueden incluir `AUTH_REQUIRED`, `INVALID_SESSION`, `FORBIDDEN`, `READ_ONLY`, `VALIDATION_ERROR`, `CONFLICT` y `NOT_FOUND`. El mensaje visible es informativo; el código HTTP y la auditoría son la evidencia técnica.

## Cierre de sesión

Use **Cerrar sesión** en el encabezado. Si la sesión vence por inactividad, vuelva a iniciar sesión. Si aparece `READ_ONLY`, consulte la información sin intentar guardar. Si una operación indica conflicto, revise el estado del activo, custodia vigente, orden técnica abierta o proceso de offboarding pendiente.

### Mensajes de error y soluciones

| Situación | Solución operativa |
| --- | --- |
| La pantalla vuelve a Login | Revisar sesión, actividad y disponibilidad del backend |
| El botón de guardar está deshabilitado | Completar campos obligatorios y revisar validaciones |
| Perfil solo lectura ve una consulta pero no guarda | Es el comportamiento esperado; solicitar cambio de rol al superusuario si corresponde |
| No se puede enviar a servicio técnico | Revisar estado terminal, orden abierta o datos obligatorios |
| PDF no abre | Reintentar la descarga, revisar la sesión y reportar el código de respuesta |
| No aparece un registro | Limpiar filtros y confirmar permisos |

## Glosario

| Término | Significado |
| --- | --- |
| Activo o dispositivo | Equipo inventariado y trazable por ITAM |
| Custodia | Relación vigente del equipo con una persona o departamento |
| ITAM | Identificador o sistema de gestión de activos tecnológicos |
| OT | Orden de trabajo de servicio técnico |
| Solo lectura | Rol que puede consultar pero no ejecutar mutaciones |
| SIM | Tarjeta de identificación del abonado móvil |
| Offboarding | Proceso de salida de una persona y recuperación de sus activos |
| Historial | Registro de eventos y cambios asociados a un activo |

## Evidencia y límites

| Tema | Evidencia | Estado |
| --- | --- | --- |
| Rutas y navegación | `frontend/src/app/app.routes.ts` y features | Confirmado |
| Roles y solo lectura | `backend/src/shared/auth.middleware.ts`, `auth-context.ts` y guards | Confirmado |
| PDFs | `backend/src/modules/*/*.pdf.ts` y rutas de PDF | Confirmado |
| Usuario productivo y pruebas con usuarios reales | No ejecutado en esta validación documental | Pendiente de validar |
| DNS, firewall, backups y certificados productivos | No se leyó configuración del servidor | Pendiente de validar en servidor |
