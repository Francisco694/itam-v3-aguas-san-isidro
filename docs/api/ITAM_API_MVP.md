# Referencia complementaria de API ITAM

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico
**Estado:** referencia complementaria; el contrato por dominio está indexado en [README.md](README.md).

Este archivo conserva el nombre histórico del documento, pero ya no representa una versión del producto ni debe usarse como fuente única. Los endpoints detallados se encuentran en los documentos por dominio.

## Catálogos

### Estados

- `GET /api/v1/estados`
- Query opcional: `tipoEntidad=DISPOSITIVO|SIM`.
- Respuesta: colección de `{ id, tipoEntidad, codigo, nombre, descripcion, esTerminal, activo, creadoEn }`.
- Error: `400 VALIDATION_ERROR` si el tipo de entidad no es válido.

### Familias de códigos

- `GET /api/v1/familias-codigo`
- `GET /api/v1/familias-codigo/prefijo-sugerido`
- `GET /api/v1/familias-codigo/:id`
- `POST /api/v1/familias-codigo`
- `PATCH /api/v1/familias-codigo/:id`

La creación recibe `nombreFamilia`, `prefijo`, `estrategiaCodigo`, `activo` y los campos que el controlador permita. El prefijo simple usa la estrategia `REPEAT_PREFIX`; una familia que ya emitió códigos no puede cambiar su prefijo. No existe `DELETE`: se desactiva lógicamente.

### Tipos de dispositivo

- `GET /api/v1/tipos-dispositivo`
- `GET /api/v1/tipos-dispositivo/:id`
- `POST /api/v1/tipos-dispositivo`
- `PATCH /api/v1/tipos-dispositivo/:id`

El tipo define descripción, familia, requisito de IMEI, actividad y configuración dinámica del formulario. Los nombres son únicos sin distinguir mayúsculas. No existe `DELETE`.

## Adquisiciones

- `GET /api/v1/facturas-adquisicion`
- `GET /api/v1/facturas-adquisicion/:id`
- `GET /api/v1/facturas-adquisicion/:id/documento`
- `POST /api/v1/facturas-adquisicion`
- `PATCH /api/v1/facturas-adquisicion/:id`

Las dos mutaciones aceptan multipart con documento opcional según `facturas-adquisicion.upload`. Los metadatos de factura se asocian a dispositivos y el archivo se entrega por el endpoint `documento`.

## Administración de usuarios

- `GET /api/v1/usuarios`
- `POST /api/v1/usuarios`
- `PATCH /api/v1/usuarios/:id`

Todas requieren rol `SUPER_USUARIO`. Las contraseñas y PIN no se devuelven en las respuestas.

## Contrato común

```json
{"success":true,"data":{}}
```

Los errores usan el formato documentado en [ERRORES_HTTP.md](ERRORES_HTTP.md). Para autenticación, dispositivos, organización, SIM, actas, servicio técnico, offboarding y Dashboard se deben seguir los documentos enlazados desde [README.md](README.md).
