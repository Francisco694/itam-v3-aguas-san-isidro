# API de colaboradores

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y funcional
**Base:** `/api/v1/colaboradores`

Todas las rutas requieren sesión.

## GET `/colaboradores`

- **Propósito:** listar personas con departamento y estado de actividad.
- **Query:** `nombre`, `rut`, `departamentoId`, `activo`.
- **Respuesta:** `200` colección `{ id, rut, nombre, cargo, departamento, localidad, activo, observaciones, creadoEn, actualizadoEn }`.
- **Errores:** `400` por filtro inválido; `401` por sesión.

## GET `/colaboradores/:id`

- **Propósito:** obtener una ficha.
- **Path:** `id` entero positivo.
- **Respuesta:** `200` colaborador.
- **Errores:** `400`, `404`.

## GET `/colaboradores/rut/:rut`

- **Propósito:** buscar una persona por RUT.
- **Path:** `rut` no vacío; se normaliza al formato canónico del dominio.
- **Respuesta:** `200` colaborador.
- **Errores:** `400` si está vacío o no es válido; `404` si no existe.

## GET `/colaboradores/:id/inventario`

- **Propósito:** consultar equipos bajo custodia directa vigente y su historial.
- **Respuesta:** `200` objeto con colaborador, activos actuales, historial de activos y valor comercial total actual.
- **Errores:** `400`, `404`.
- **Reglas:** no inventa custodias por nombre; usa relaciones y eventos del colaborador.

## GET `/colaboradores/:id/inventario-conciliado`

- **Propósito:** exponer la conciliación entre inventario y la historia de asignaciones.
- **Respuesta:** `200` `{ colaborador, actuales, historicos, pendientes, valorTotalActual }`; cada activo incluye clasificación, motivo y si requiere validación manual.
- **Errores:** `400`, `404`.
- **Reglas:** las categorías pueden ser `ACTUAL_CONFIRMADO`, `ACTUAL_PROBABLE`, `HISTORICO_CONFIRMADO`, `HISTORICO_PROBABLE`, `PENDIENTE_VALIDACION` o `CONFLICTO_DATOS`.

## GET `/colaboradores/offboarding-pendientes`

- **Propósito:** listar colaboradores con activos pendientes de salida.
- **Respuesta:** `200` colección con colaborador, cantidad y valor pendiente.
- **Errores:** `401`, `500`.

## POST `/colaboradores`

- **Propósito:** crear una persona.
- **Body:** `rut`, `nombre`; opcionales `cargo`, `departamentoId`, `localidad`, `activo`, `observaciones`.
- **Respuesta:** `201` colaborador creado.
- **Errores:** `400`, `404` si departamento no existe, `409` por RUT duplicado.
- **Reglas:** el RUT se guarda normalizado y es único.

```json
{"rut":"11111111-1","nombre":"Persona Ejemplo","cargo":"Analista","departamentoId":1,"localidad":"San Isidro","activo":true}
```

## PATCH `/colaboradores/:id`

- **Propósito:** editar datos administrativos.
- **Body:** uno o más de `rut`, `nombre`, `cargo`, `departamentoId`, `localidad`, `activo`, `observaciones`.
- **Respuesta:** `200` colaborador actualizado.
- **Errores:** `400` si no hay campos o son inválidos; `404`; `409` por RUT duplicado.
- **Reglas:** desactivar una persona no borra su historial ni sus custodias históricas; las nuevas asignaciones deben respetar que esté activa.
