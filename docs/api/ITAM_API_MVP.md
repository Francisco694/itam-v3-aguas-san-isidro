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
      "marca": "Lenovo",
      "modelo": "ThinkPad",
      "numeroSerie": "ABC123",
      "imei": null,
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

Crea dispositivo sin custodia, con estado `DISPONIBLE`, y registra `ALTA_DISPOSITIVO` en la misma transaccion.

Body:

```json
{
  "codigoInventario": 3001,
  "tipoDispositivo": "Notebook",
  "marca": "Lenovo",
  "modelo": "ThinkPad",
  "numeroSerie": "ABC123",
  "imei": null,
  "localidad": "San Isidro",
  "ubicacionDetalle": "Oficina TI",
  "observaciones": null,
  "responsable": "TI"
}
```

Errores:

- 400 si faltan `codigoInventario`, `tipoDispositivo` o `responsable`.
- 409 si codigo, serie o IMEI ya existen, o si el codigo global ya lo usa una SIM.

### PATCH /dispositivos/:codigo

No permite modificar directamente estado/custodia.

Body, al menos un campo:

```json
{
  "marca": "Dell",
  "modelo": "Latitude",
  "ubicacionDetalle": "Bodega TI"
}
```

Errores:

- 400 si incluye `estadoId`, `colaboradorId`, `departamentoId` o `recibidoPorId`.
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
  "recibidoPorId": 2,
  "localidad": "San Isidro",
  "ubicacionDetalle": "Sala de control",
  "responsable": "TI",
  "observaciones": "Entrega a area"
}
```

Registra `ASIGNAR_DEPARTAMENTO`.

Errores:

- 400 si faltan campos obligatorios.
- 404 si dispositivo, departamento o receptor no existen.

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

Crea SIM con estado `DISPONIBLE` y registra `ALTA_SIM`.

Body:

```json
{
  "codigoInventario": 2001,
  "iccidCodigoFabrica": "8956032255756673254",
  "numeroAsociado": "+56911111111",
  "compania": "Compania",
  "observaciones": null,
  "responsable": "TI"
}
```

Errores:

- 400 si faltan `codigoInventario`, `iccidCodigoFabrica` o `responsable`.
- 409 si codigo o ICCID ya existen, o si el codigo global ya lo usa un dispositivo.

### PATCH /sim/:codigo

No permite modificar directamente estado, colaborador o dispositivo.

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
