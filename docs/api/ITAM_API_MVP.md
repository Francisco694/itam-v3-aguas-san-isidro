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
