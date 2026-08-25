# ITAM v3.0 API MVP

## Base URL para Angular

```text
http://localhost:3000/api/v1
```

## Formato global

Respuesta individual:

```json
{
  "success": true,
  "data": {}
}
```

Respuesta de coleccion:

```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

Respuesta de error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mensaje entendible"
  }
}
```

Codigos de error habituales:

- `VALIDATION_ERROR`: HTTP 400.
- `NOT_FOUND`: HTTP 404.
- `CONFLICT`: HTTP 409.
- `INTERNAL_ERROR`: HTTP 500.
- `DATABASE_UNAVAILABLE`: HTTP 503 en health database.

## Health

### GET /health

Verifica que la API este viva.

Respuesta 200:

```json
{
  "success": true,
  "service": "ITAM v3.0 API",
  "status": "OK",
  "timestamp": "2026-08-13T12:00:00.000Z"
}
```

### GET /health/database

Verifica conectividad con PostgreSQL.

Respuesta 200:

```json
{
  "success": true,
  "service": "PostgreSQL",
  "status": "OK",
  "database": "itam_dev",
  "user": "itam_app",
  "databaseTime": "2026-08-13T12:00:00.000Z"
}
```

Error 503:

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "PostgreSQL no se encuentra disponible."
  }
}
```

## Estados

### GET /estados

Catalogo read-only de estados.

Query params:

- `tipoEntidad`: opcional. `DISPOSITIVO` o `SIM`.

Respuesta 200:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "1",
      "tipoEntidad": "DISPOSITIVO",
      "codigo": "DISPONIBLE",
      "nombre": "Disponible",
      "descripcion": "Dispositivo inventariado y disponible.",
      "esTerminal": false,
      "activo": true,
      "creadoEn": "2026-08-13T12:00:00.000Z"
    }
  ]
}
```

Errores:

- 400 si `tipoEntidad` no es valido.

## Familias de código ITAM

### GET /familias-codigo

Lista la configuración administrativa de familias. Admite `activo=true|false` y `tipoEntidad=DISPOSITIVO|SIM`. Cada elemento expone nombre, prefijo, estrategia, versión, último ordinal, próximo código estimado, tipos asociados y `tieneCodigosEmitidos`. `agrupaTipos` y `etiquetaOperativa` permiten que Angular represente varios tipos concretos bajo una opción operacional, sin exponer el prefijo ni crear un tipo genérico.

### GET /familias-codigo/prefijo-sugerido

Sugiere el primer prefijo libre entre `1` y `9`. La sugerencia nunca crea una familia ni reemplaza la confirmación del administrador. Si no quedan prefijos simples, indica que debe definirse una nueva estrategia/versionado.

### GET /familias-codigo/:id

Obtiene una familia o responde 404.

### POST /familias-codigo

```json
{
  "nombreFamilia": "Audio",
  "prefijo": "7",
  "estrategiaCodigo": "REPEAT_PREFIX",
  "activo": true
}
```

### PATCH /familias-codigo/:id

Permite editar nombre, prefijo, estrategia y estado. No existe `DELETE`: se utiliza desactivación lógica. Nombre y prefijo son únicos; `REPEAT_PREFIX` admite solamente un dígito de `1` a `9`. El prefijo no puede cambiar si la familia ya emitió códigos.

La numeración confirmada es:

- Smartphone: `1001` … `1999`, luego `11001` … `11999`;
- SIM: `2001` … `2999`, luego `22001` … `22999`.
- Notebook: prefijo `3`;
- Monitor: prefijo `4`;
- PC: prefijo `5`;
- Periféricos: prefijo `6`, sin crear un tipo periférico genérico.

Los prefijos `7`, `8` y `9` no se crean automáticamente. Los demás tipos se crean desde el catálogo y deben asociarse explícitamente a una familia activa; la API no deduce familias por el nombre.

## Tipos de dispositivo

`tipos_dispositivo` describe qué es el activo. La familia de código describe cómo se numera. Son conceptos diferentes y la familia es opcional en el catálogo.

### GET /tipos-dispositivo

Lista el catálogo con la familia relacionada y `configuracionFormulario`, que define los campos técnicos visibles y los atributos específicos permitidos para el alta. Query param opcional:

- `activo`: `true` o `false`.

### GET /tipos-dispositivo/:id

Devuelve un tipo. Responde 404 si no existe.

### POST /tipos-dispositivo

```json
{
  "nombre": "Smartphone",
  "descripcion": "Teléfono inteligente corporativo",
  "familiaCodigoInventarioId": 1,
  "requiereImei": true,
  "activo": true
}
```

### PATCH /tipos-dispositivo/:id

Permite editar nombre, descripción, familia, `requiereImei` y estado activo. `familiaCodigoInventarioId` acepta `null`. No existe `DELETE`; los tipos referenciados se conservan para trazabilidad. Una vez que el tipo posee dispositivos, no puede trasladarse a otra familia.

Los nombres son únicos sin distinguir mayúsculas. Una familia asociada debe pertenecer a `DISPOSITIVO`; la familia de SIM no se puede asociar a este catálogo. La configuración dinámica es administrada mediante migraciones en esta etapa; los endpoints de catálogo no aceptan modificaciones arbitrarias de `configuracionFormulario`.

## Departamentos

### GET /departamentos

Respuesta 200:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "1",
      "nombre": "Operaciones",
      "activo": true,
      "observaciones": null,
      "creadoEn": "2026-08-13T12:00:00.000Z",
      "actualizadoEn": "2026-08-13T12:00:00.000Z"
    }
  ]
}
```

### GET /departamentos/:id

Params:

- `id`: entero positivo.

Errores:

- 400 si `id` no es entero positivo.
- 404 si no existe.

### GET /departamentos/:id/inventario

Devuelve el detalle operacional en una única consulta API, separando:

- `custodiaDirecta`: dispositivos cuyo custodio directo es el departamento;
- `activosColaboradores`: dispositivos cuyo custodio directo es un colaborador perteneciente al departamento;
- `resumen`: cantidades de ambas categorías y total relacionado.

Los activos de colaboradores no se consideran custodia directa del departamento.

### POST /departamentos

Body:

```json
{
  "nombre": "Operaciones",
  "activo": true,
  "observaciones": "Custodia de equipos de terreno"
}
```

Respuesta 201: departamento creado.

Errores:

- 400 si falta `nombre` o un campo tiene tipo invalido.
- 409 si el nombre ya existe.

### PATCH /departamentos/:id

Body, al menos un campo:

```json
{
  "nombre": "Operaciones Norte",
  "activo": true,
  "observaciones": null
}
```

Errores:

- 400 si no hay campos validos.
- 404 si no existe.
- 409 si el nombre ya existe.

## Colaboradores

### GET /colaboradores

Query params opcionales:

- `nombre`
- `rut`
- `departamentoId`
- `activo`

Respuesta 200:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "1",
      "rut": "11111111-1",
      "nombre": "Persona Ejemplo",
      "cargo": "Analista",
      "departamento": {
        "id": "1",
        "nombre": "Operaciones"
      },
      "localidad": "San Isidro",
      "activo": true,
      "observaciones": null,
      "creadoEn": "2026-08-13T12:00:00.000Z",
      "actualizadoEn": "2026-08-13T12:00:00.000Z"
    }
  ]
}
```

### GET /colaboradores/:id

Params:

- `id`: entero positivo.

Errores:

- 400 si `id` no es entero positivo.
- 404 si no existe.

### GET /colaboradores/rut/:rut

Params:

- `rut`: string.

Errores:

- 400 si `rut` viene vacio.
- 404 si no existe.

### POST /colaboradores

Body:

```json
{
  "rut": "11111111-1",
  "nombre": "Persona Ejemplo",
  "cargo": "Analista",
  "departamentoId": 1,
  "localidad": "San Isidro",
  "activo": true,
  "observaciones": null
}
```

Errores:

- 400 si faltan `rut` o `nombre`.
- 404 si `departamentoId` no existe.
- 409 si el RUT ya existe.

### PATCH /colaboradores/:id

Body, al menos un campo:

```json
{
  "cargo": "Jefatura",
  "departamentoId": null,
  "activo": true
}
```

Errores:

- 400 si no hay campos validos.
- 404 si colaborador o departamento no existen.
- 409 si el nuevo RUT ya existe.

## Dispositivos

### GET /dispositivos

Query params opcionales:

- `q`
- `tipo`
- `tipoDispositivoId` (preferido; FK del catálogo)
- `familiaCodigoInventarioId`
- `estado`
- `colaboradorId`
- `departamentoId`
- `localidad`

Respuesta 200:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "1",
      "codigoInventario": 3001,
      "tipoDispositivo": "Notebook",
      "tipo": {
        "id": "2",
        "nombre": "Notebook",
        "descripcion": null,
        "activo": true,
        "familiaCodigoInventario": null
      },
      "marca": "Lenovo",
      "modelo": "ThinkPad",
      "numeroSerie": "ABC123",
      "imei": null,
      "atributosEspecificos": {},
      "localidad": "San Isidro",
      "ubicacionDetalle": "Oficina TI",
      "observaciones": null,
      "fechaRegistro": "2026-08-13",
      "creadoEn": "2026-08-13T12:00:00.000Z",
      "actualizadoEn": "2026-08-13T12:00:00.000Z",
      "estado": {
        "id": "1",
        "codigo": "DISPONIBLE",
        "nombre": "Disponible"
      },
      "colaborador": null,
      "departamento": null,
      "recibidoPor": null,
      "simAsociada": null
    }
  ]
}
```

### GET /dispositivos/:codigo

`codigo` representa `codigo_inventario`.

Errores:

- 400 si `codigo` no es entero positivo.
- 404 si no existe.

### POST /dispositivos

Crea dispositivo sin custodia, con estado `DISPONIBLE`, genera el código ITAM en el backend y registra `ALTA_DISPOSITIVO` en la misma transacción.

Body:

```json
{
  "tipoDispositivoId": 1,
  "marca": "Lenovo",
  "modelo": "ThinkPad",
  "numeroSerie": "ABC123",
  "imei": null,
  "atributosEspecificos": {},
  "localidad": "San Isidro",
  "ubicacionDetalle": "Oficina TI",
  "observaciones": null,
  "responsable": "TI"
}
```

Errores:

- 400 si faltan `tipoDispositivoId` o `responsable`, el tipo está inactivo, no tiene una familia de código activa o `atributosEspecificos` no cumple la configuración del tipo.
- 404 si `tipoDispositivoId` no existe.
- 409 si serie o IMEI ya existen.

El código es globalmente único entre dispositivos y SIM. El backend obtiene la familia desde `tipos_dispositivo.familia_codigo_inventario_id`; Angular nunca selecciona prefijos. La reserva usa bloqueo de fila transaccional y no utiliza `MAX + 1`.

`atributosEspecificos` es un objeto JSON plano y extensible. Solo acepta las claves declaradas por `configuracionFormulario.camposEspecificos`; el backend valida obligatoriedad, tipo, longitud, rango y opciones permitidas. Por ejemplo, Cable exige `tipoCable`, mientras que Teclado puede guardar `partNumber`.

### PATCH /dispositivos/:codigo

No permite modificar directamente código, estado o custodia. `codigoInventario` es inmutable tanto en la API como en PostgreSQL.

Body, al menos un campo:

```json
{
  "tipoDispositivoId": 1,
  "marca": "Dell",
  "modelo": "Latitude",
  "ubicacionDetalle": "Bodega TI"
}
```

Errores:

- 400 si incluye `codigoInventario`, `estadoId`, `colaboradorId`, `departamentoId` o `recibidoPorId`.
- 404 si no existe.
- 409 por identificadores duplicados.

### POST /dispositivos/:codigo/asignar-colaborador

Body:

```json
{
  "colaboradorId": 1,
  "responsable": "TI",
  "observaciones": "Entrega operativa"
}
```

Registra `ASIGNAR_COLABORADOR`.

Errores:

- 400 si faltan campos.
- 404 si dispositivo o colaborador no existen.

### POST /dispositivos/:codigo/asignar-departamento

Body:

```json
{
  "departamentoId": 1,
  "localidad": "San Isidro",
  "ubicacionDetalle": "Sala de control",
  "responsable": "TI",
  "observaciones": "Entrega a area"
}
```

Registra `ASIGNAR_DEPARTAMENTO`. La custodia es directa del departamento; no se requiere ni se almacena un receptor personal nuevo.

Errores:

- 400 si faltan campos obligatorios.
- 404 si dispositivo o departamento no existen.

### POST /dispositivos/:codigo/devolver

Body:

```json
{
  "responsable": "TI",
  "observaciones": "Equipo devuelto"
}
```

Limpia custodia, cambia estado a `RETENIDO_REVISION` y registra `DEVOLVER_DISPOSITIVO`.

### POST /dispositivos/:codigo/cambiar-estado

Body:

```json
{
  "estadoId": 5,
  "responsable": "TI",
  "observaciones": "Revision tecnica"
}
```

Valida que el estado sea de tipo `DISPOSITIVO` y registra `CAMBIAR_ESTADO`.

Errores:

- 404 si dispositivo o estado no existen.

### GET /dispositivos/:codigo/historial

Respuesta 200:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "1",
      "tipoEntidad": "DISPOSITIVO",
      "dispositivoId": "1",
      "tipoEvento": "ALTA_DISPOSITIVO",
      "estadoAnterior": null,
      "estadoNuevo": {
        "id": "1",
        "codigo": "DISPONIBLE",
        "nombre": "Disponible"
      },
      "responsable": "TI",
      "observaciones": null,
      "detalle": {
        "codigoInventario": 3001
      },
      "fechaEvento": "2026-08-13T12:00:00.000Z"
    }
  ]
}
```

## SIM

### GET /sim

Respuesta 200:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "1",
      "codigoInventario": 2001,
      "iccidCodigoFabrica": "8956032255756673254",
      "numeroAsociado": "+56911111111",
      "compania": "Compania",
      "estado": {
        "id": "8",
        "codigo": "DISPONIBLE",
        "nombre": "Disponible"
      },
      "colaborador": null,
      "dispositivo": null,
      "observaciones": null,
      "fechaRegistro": "2026-08-13",
      "creadoEn": "2026-08-13T12:00:00.000Z",
      "actualizadoEn": "2026-08-13T12:00:00.000Z"
    }
  ]
}
```

### GET /sim/:codigo

`codigo` representa `codigo_inventario`.

Errores:

- 404 si no existe.

### POST /sim

Crea SIM con estado `DISPONIBLE`, genera el código ITAM de familia `2` y registra `ALTA_SIM`.

Body:

```json
{
  "iccidCodigoFabrica": "8956032255756673254",
  "numeroAsociado": "+56911111111",
  "compania": "Compania",
  "observaciones": null,
  "responsable": "TI"
}
```

Errores:

- 400 si faltan `iccidCodigoFabrica` o `responsable`.
- 409 si el ICCID ya existe.

### PATCH /sim/:codigo

No permite modificar directamente código, estado, colaborador o dispositivo.

Body, al menos un campo:

```json
{
  "numeroAsociado": "+56922222222",
  "compania": "Compania"
}
```

### POST /sim/:codigo/asociar-dispositivo

Body:

```json
{
  "dispositivoCodigoInventario": 3001,
  "responsable": "TI",
  "observaciones": "Instalada en equipo"
}
```

Valida:

- SIM existe.
- Dispositivo existe.
- SIM no esta asociada a otro dispositivo.
- Dispositivo no tiene otra SIM.
- SIM esta en estado operable: `DISPONIBLE` o `ASIGNADA`.

Comportamiento de estado:

- Al asociar dispositivo, la SIM queda automaticamente `ASIGNADA`.
- Si la SIM esta `EXTRAVIADA`, `DADA_BAJA` u otro estado no operable, la operacion responde 409 y requiere cambio explicito previo.
- El cambio automatico queda registrado en historial dentro de la misma transaccion.

Errores:

- 404 si SIM o dispositivo no existen.
- 409 si la asociacion viola unicidad.

### POST /sim/:codigo/desasociar-dispositivo

Body:

```json
{
  "responsable": "TI",
  "observaciones": "SIM retirada"
}
```

Comportamiento de estado:

- Si la SIM aun tiene colaborador asignado, continua `ASIGNADA`.
- Si queda sin colaborador y sin dispositivo, vuelve automaticamente a `DISPONIBLE`.
- No opera sobre estados no operables como `EXTRAVIADA` o `DADA_BAJA`.
- El cambio automatico queda registrado en historial dentro de la misma transaccion.

### POST /sim/:codigo/asignar-colaborador

Body:

```json
{
  "colaboradorId": 1,
  "responsable": "TI",
  "observaciones": "Entrega de linea"
}
```

Comportamiento de estado:

- Al asignar colaborador, la SIM queda automaticamente `ASIGNADA`.
- No opera sobre estados no operables como `EXTRAVIADA` o `DADA_BAJA`.
- El cambio automatico queda registrado en historial dentro de la misma transaccion.

### POST /sim/:codigo/desasignar-colaborador

Body:

```json
{
  "responsable": "TI",
  "observaciones": "Linea recuperada"
}
```

Comportamiento de estado:

- Si la SIM aun esta asociada a un dispositivo, continua `ASIGNADA`.
- Si queda sin colaborador y sin dispositivo, vuelve automaticamente a `DISPONIBLE`.
- No opera sobre estados no operables como `EXTRAVIADA` o `DADA_BAJA`.
- El cambio automatico queda registrado en historial dentro de la misma transaccion.

### POST /sim/:codigo/cambiar-estado

Body:

```json
{
  "estadoId": 9,
  "responsable": "TI",
  "observaciones": "Linea asignada"
}
```

Valida que el estado sea de tipo `SIM`.

### GET /sim/:codigo/historial

Respuesta 200:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "1",
      "tipoEntidad": "SIM",
      "simId": "1",
      "tipoEvento": "ALTA_SIM",
      "estadoAnterior": null,
      "estadoNuevo": {
        "id": "8",
        "codigo": "DISPONIBLE",
        "nombre": "Disponible"
      },
      "responsable": "TI",
      "observaciones": null,
      "detalle": {
        "codigoInventario": 2001
      },
      "fechaEvento": "2026-08-13T12:00:00.000Z"
    }
  ]
}
```

## ExtensiÃ³n de ciclo de vida patrimonial

### GET /colaboradores/:id/inventario

Retorna los equipos actualmente bajo custodia directa del colaborador, su valor
comercial total calculado y el historial de asignaciones/devoluciones.

### POST /dispositivos/:codigo/dar-baja

Registra una baja controlada. Requiere `motivo`, `responsable` y admite
`observaciones`. Conserva el valor comercial vigente en el registro histÃ³rico
de la baja. No se permite reemplazar esta operaciÃ³n con un cambio de estado
genÃ©rico.

### POST /dispositivos/:codigo/resultado-offboarding

Registra `DEVUELTO`, `PENDIENTE`, `NO_ENTREGADO`, `EXTRAVIADO`,
`ROBADO_HURTADO` o `DANADO`, junto con condiciÃ³n, responsable TI y
observaciones. Los resultados pendientes conservan la custodia; una recepciÃ³n
la libera y deja el equipo en revisiÃ³n. ExtravÃ­o o robo conservan la custodia
para mantener el activo pendiente y actualizan su estado de inventario.

### Servicio tÃ©cnico

- `GET /servicio-tecnico`
- `GET /servicio-tecnico/:id`
- `POST /servicio-tecnico`
- `PATCH /servicio-tecnico/:id/cotizacion`
- `POST /servicio-tecnico/:id/decision`
- `POST /servicio-tecnico/:id/cerrar`

Una orden abierta bloquea asignaciÃ³n, devoluciÃ³n y cambios de estado
incompatibles. El flujo persiste falla, diagnÃ³stico, cotizaciÃ³n, decisiÃ³n,
costo final, resultado y responsables en cada etapa.

### Actas de entrega

- `GET /actas-entrega`
- `GET /actas-entrega/:id`
- `GET /actas-entrega/:id/pdf`
- `POST /actas-entrega`

La creaciÃ³n admite uno o varios `dispositivosCodigos`, destinatario colaborador
o departamento con recepcionante, localidad, responsable TI y observaciones.
La numeraciÃ³n persistente usa el formato `AE-AAAA-000001`. El endpoint PDF
entrega un documento A4 real (`application/pdf`). El envÃ­o por correo no forma
parte de esta API mientras no exista infraestructura SMTP y un correo de
colaborador definido en el modelo.

## Custodia, devoluciones y continuidad técnica (migraciones 009–011)

### Regla única de custodia

Un dispositivo puede tener como máximo un custodio vigente: colaborador,
departamento o ninguno. Las operaciones de asignación rechazan con `409
CONFLICT` un activo que ya tenga custodio; el cambio válido exige registrar
primero su devolución. Un colaborador sí puede custodiar varios dispositivos.
Los códigos ITAM permanecen inmutables durante todo el ciclo operacional.

### POST /dispositivos/:codigo/devolver

Registra una devolución definitiva mediante el servicio central de devolución.
Libera la custodia, deja el activo en `RETENIDO_REVISION`, crea un comprobante
persistente `CD-AAAA-000001` y agrega un evento append-only al historial. Si
existe un detalle vigente de Acta de Entrega, queda relacionado al comprobante.

Body:

```json
{
  "responsable": "Responsable TI",
  "condicion": "Operativo con desgaste normal",
  "resultado": "DEVUELTO",
  "observaciones": "Recepción en oficina TI"
}
```

La respuesta contiene `dispositivo` y `comprobante`. `resultado` admite
`DEVUELTO` o `DANADO`. Un activo sin custodia, con orden técnica abierta o en
estado terminal responde `409`.

`POST /dispositivos/:codigo/resultado-offboarding` reutiliza esta misma
operación cuando el resultado es `DEVUELTO` o `DANADO`; resultados pendientes
no crean comprobantes ni cierran la custodia.

### Comprobantes de devolución

- `GET /comprobantes-devolucion`
- `GET /comprobantes-devolucion/:id`
- `GET /comprobantes-devolucion/:id/pdf`

El PDF es A4 y contiene fecha, persona que devuelve, activo, código ITAM,
serie/IMEI, condición, observaciones, responsable TI y Acta de Entrega de
origen cuando existe.

### Estado documental de Actas de Entrega

`GET /actas-entrega` y `GET /actas-entrega/:id` incorporan
`estadoDocumental`, calculado desde los detalles:

- `VIGENTE`: ningún activo devuelto.
- `DEVOLUCION_PARCIAL`: algunos activos devueltos.
- `CERRADA`: todos los activos devueltos.
- `ANULADA`: el acta fue anulada.

Cada dispositivo del acta incluye `devolucion` solo cuando existe un
comprobante real. Las actas destinadas a trabajadores almacenan siempre la
declaración corporativa obligatoria completa y su PDF permite paginación A4.

### Equipo temporal dentro de Servicio Técnico

- `POST /servicio-tecnico/:id/equipo-temporal`
- `POST /servicio-tecnico/:id/equipo-temporal/:entregaId/cerrar`

La entrega temporal es contextual a una orden abierta y al colaborador que era
custodio del activo original. El activo temporal debe estar `DISPONIBLE`, sin
custodio y sin otra orden abierta. Al cerrar, queda sin custodia y en
`RETENIDO_REVISION`. No genera por sí sola una asignación definitiva ni un
Acta de Entrega definitiva.

La orden conserva un snapshot de la custodia al ingreso. Recibir físicamente
el equipo en TI no crea una segunda custodia. El cierre técnico exige que no
quede una entrega temporal abierta; si el custodio original continúa vigente,
el activo vuelve a `ASIGNADO` y se registra
`RETORNO_POST_SERVICIO_TECNICO`, sin generar un comprobante de devolución.
## Extensiones previas a producción (migración 013)

### Organización

La dependencia de departamentos admite varios niveles y rechaza ciclos directos e indirectos tanto en servicio backend como mediante restricción de base de datos. La jerarquía organizacional no modifica ni hereda custodia.

### Reportes

- GET /api/v1/reportes/inventario?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
- GET /api/v1/reportes/inventario/pdf?desde=YYYY-MM-DD&hasta=YYYY-MM-DD

El reporte separa el estado actual de los movimientos históricos del período, incluye valorización y consolida descendientes por departamento.

### Antecedentes de adquisición

- GET /api/v1/facturas-adquisicion
- GET /api/v1/facturas-adquisicion/:id
- GET /api/v1/facturas-adquisicion/:id/documento
- POST /api/v1/facturas-adquisicion
- PATCH /api/v1/facturas-adquisicion/:id

Una factura puede relacionarse con varios dispositivos y conserva un único
documento principal compartido por todos ellos. Tanto la factura como su
documento son opcionales; un dispositivo puede registrarse sin antecedentes de
adquisición y continuar con la generación normal de su código ITAM.

POST y PATCH mantienen compatibilidad con JSON cuando no se adjunta archivo.
Para crear o reemplazar un documento aceptan multipart/form-data con:

- metadata: objeto JSON serializado con los mismos campos de la operación;
- documento: archivo opcional.

Los únicos formatos admitidos son PDF, JPG, JPEG y PNG. El backend valida
conjuntamente extensión y MIME (application/pdf, image/jpeg o image/png) y
aplica un máximo de 10 MB. PostgreSQL almacena nombre original, nombre interno,
MIME, tamaño y ruta relativa; el binario permanece en storage privado
configurable mediante DOCUMENT_STORAGE_PATH.

GET /api/v1/facturas-adquisicion/:id/documento requiere la sesión general de
la API y entrega el archivo en modo inline. El parámetro download=true solicita
Content-Disposition: attachment. La ruta física y el nombre interno no se
exponen en respuestas, la carpeta no se publica como contenido estático y los
nombres físicos se generan con UUID. La migración 015 agrega los campos
nullable de documento sin modificar la relación factura-dispositivos.

### Servicio Técnico

- GET /api/v1/servicio-tecnico/:id/envio/pdf

El alta de la orden recibe activo, falla, fecha, proveedor/destino, responsable TI y observaciones. La orden continúa siendo un activo por documento y no altera la custodia patrimonial.

### Autenticación y perfiles

- POST /api/v1/auth/login
- POST /api/v1/auth/login-pin
- GET /api/v1/auth/me
- POST /api/v1/auth/change-pin
- POST /api/v1/auth/logout
- GET /api/v1/usuarios
- POST /api/v1/usuarios
- PATCH /api/v1/usuarios/:id

La sesión utiliza cookie HttpOnly, SameSite=Lax y Secure en producción. Solo existen SUPER_USUARIO y USUARIO. La administración de usuarios exige SUPER_USUARIO; el resto de módulos exige sesión válida. Los hashes de contraseña y PIN nunca se incluyen en respuestas.

La contraseña continúa siendo el método principal y de respaldo. El acceso
rápido recibe correo y un PIN de exactamente seis dígitos mediante
`POST /api/v1/auth/login-pin`, y crea la misma clase de sesión que el login
por contraseña. El PIN se almacena con scrypt y salt aleatorio. Cinco intentos
fallidos consecutivos bloquean solamente el PIN durante quince minutos; la
contraseña permanece disponible. Se auditan `LOGIN_PIN_OK`,
`LOGIN_PIN_FALLIDO` y `LOGIN_PIN_BLOQUEADO` sin persistir el PIN.

Un SUPER_USUARIO define manualmente contraseña inicial y PIN al crear una
cuenta, o puede restablecer cualquiera de ellos mediante
`PATCH /api/v1/usuarios/:id`. No se generan PIN automáticos. El usuario puede
personalizar un PIN ya configurado mediante `POST /api/v1/auth/change-pin`
informando `currentPin` y `newPin`.

Las operaciones de escritura se registran en auditoria_operaciones. Los eventos nuevos de dispositivos también conservan usuario_ejecutor_id; los históricos previos permanecen con valor NULL.

### Estructura organizacional oficial

La migración 016 agrega `departamentos.codigo_organizacional` como
identificador externo nullable y único, separado del ID PostgreSQL. La fuente
oficial de importación es `1.-ESTRUCTURA ESSSI.xlsx`, hoja `RESUMEN`, con
las cabeceras exactas `ID UNIDAD ORGANIZACIONAL`,
`NOMBRE UNIDAD ORGANIZACIONAL` y `Dependecia Unidad`. El script
`npm run import:organization` valida las 98 unidades antes de abrir una
transacción, inserta primero las unidades y luego resuelve dependencias. La
dependencia externa 1000 de GERENCIA GENERAL (1001) se representa como NULL;
no se crea un departamento artificial. La importación es idempotente por
`codigo_organizacional`.

### Lectura QR en Inventario

El frontend usa `@zxing/browser` exclusivamente para decodificar el QR de la
etiqueta. Solo acepta la ruta interna `/dispositivos/:codigoInventario` o una
URL HTTP(S) cuya ruta coincida exactamente; extrae el código y navega con
Angular Router, sin seguir dominios externos. La captura se detiene al leer,
cancelar o destruir el modal. No se almacenan ni transmiten fotografías,
frames o video.

`getUserMedia` requiere un contexto seguro. En la LAN servida por HTTP desde
una IP, el lector muestra la limitación y mantiene disponible la búsqueda
manual; bajo HTTPS solicita permiso y prefiere la cámara trasera. No se
deshabilitan controles de seguridad del navegador.
