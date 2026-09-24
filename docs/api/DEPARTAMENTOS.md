# API de departamentos

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y funcional
**Base:** `/api/v1/departamentos`

Todas las rutas requieren sesión.

## GET `/departamentos`

- **Propósito:** listar departamentos y dependencia organizacional.
- **Query/body:** ninguno.
- **Respuesta:** `200` colección con `id`, `nombre`, `activo`, `observaciones`, `dependencia_id`, `dependencia_nombre`, `creadoEn` y `actualizadoEn`.
- **Errores:** `401`, `500`.

## GET `/departamentos/:id`

- **Propósito:** obtener un departamento.
- **Path:** `id` entero positivo.
- **Respuesta:** `200` departamento.
- **Errores:** `400`, `404`.

## GET `/departamentos/:id/inventario`

- **Propósito:** separar custodia directa del departamento de activos de sus colaboradores.
- **Respuesta:** `200` `{ departamento, resumen, custodiaDirecta, activosColaboradores }`; `resumen` contiene `custodiaDirecta`, `conColaboradores` y `totalRelacionado`.
- **Errores:** `400`, `404`.
- **Reglas:** un equipo bajo custodia de un colaborador se muestra como relacionado, no como custodia directa del departamento.

## POST `/departamentos`

- **Propósito:** crear un departamento.
- **Body:** `nombre` obligatorio; opcionales `activo`, `observaciones`, `dependencia_id`.
- **Respuesta:** `201` departamento.
- **Errores:** `400`, `404` si la dependencia no existe, `409` por nombre duplicado o dependencia inválida.
- **Reglas:** un departamento no puede depender de sí mismo.

```json
{"nombre":"Operaciones","activo":true,"observaciones":"Custodia de equipos de terreno","dependencia_id":null}
```

## PATCH `/departamentos/:id`

- **Propósito:** editar nombre, actividad, observaciones o dependencia.
- **Body:** al menos uno de `nombre`, `activo`, `observaciones`, `dependencia_id`.
- **Respuesta:** `200` departamento actualizado.
- **Errores:** `400`, `404`, `409`.
- **Reglas:** la desactivación es lógica; no elimina inventario ni relaciones históricas.
