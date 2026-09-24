# API de SIM y líneas móviles

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y funcional
**Base SIM:** `/api/v1/sim`

Todas las rutas requieren sesión. El módulo `lineas-moviles` no publica un router independiente: la línea se consulta y gestiona mediante la ficha del dispositivo y las operaciones de asociación.

## GET `/sim`

- **Propósito:** listar tarjetas SIM con ICCID, número, compañía, estado, colaborador, dispositivo y línea asociada.
- **Respuesta:** `200` colección.
- **Errores:** `401`, `500`.

## GET `/sim/:codigo`

- **Propósito:** obtener una SIM por código ITAM.
- **Path:** `codigo` entero positivo.
- **Respuesta:** `200` SIM con `lineaMovil`, `estado`, `colaborador` y `dispositivo`.
- **Errores:** `400`, `404`.

## POST `/sim`

- **Propósito:** crear una SIM disponible.
- **Body:** `iccidCodigoFabrica` obligatorio; opcionales `numeroAsociado`, `compania`, `observaciones`. El responsable se toma de la sesión.
- **Respuesta:** `201` SIM creada con código ITAM generado.
- **Errores:** `400` por ICCID o body inválido; `409` por ICCID duplicado.
- **Reglas:** no se acepta `codigoInventario` enviado por cliente; el backend usa la familia de SIM.

```json
{"iccidCodigoFabrica":"8956032255756673254","numeroAsociado":"+56911111111","compania":"Compañía","observaciones":null}
```

## PATCH `/sim/:codigo`

- **Propósito:** editar ICCID, número, compañía u observaciones.
- **Body:** al menos uno de `iccidCodigoFabrica`, `numeroAsociado`, `compania`, `observaciones`.
- **Respuesta:** `200` SIM actualizada.
- **Errores:** `400` si incluye código, estado, custodio o dispositivo; `404`; `409` por unicidad.
- **Reglas:** la asociación y el estado se cambian mediante endpoints de negocio.

## POST `/sim/:codigo/asociar-dispositivo`

- **Propósito:** asociar la SIM a un dispositivo.
- **Body:** `dispositivoCodigoInventario` obligatorio; opcionales `numeroTelefonico`, `reemplazarSimActual`; observaciones opcionales. El responsable se toma de sesión.
- **Respuesta:** `200` SIM con dispositivo y línea.
- **Errores:** `400`, `404`, `409` si el dispositivo o SIM ya tienen una relación incompatible o la SIM está en estado no operable.
- **Reglas:** una SIM y un dispositivo solo pueden tener una relación vigente; la SIM pasa a `ASIGNADA` cuando corresponde.

## POST `/sim/:codigo/desasociar-dispositivo`

- **Propósito:** retirar la SIM del dispositivo.
- **Body:** solo `observaciones` opcional; responsable de sesión.
- **Respuesta:** `200` SIM actualizada.
- **Errores:** `400`, `404`, `409` en estados terminales o relación inexistente.
- **Reglas:** si no queda colaborador ni dispositivo, la SIM puede volver a `DISPONIBLE`.

## POST `/sim/:codigo/asignar-colaborador`

- **Propósito:** asignar la SIM a una persona.
- **Body:** `colaboradorId` obligatorio y `observaciones` opcional; responsable de sesión.
- **Respuesta:** `200` SIM actualizada.
- **Errores:** `400`, `404`, `409` por colaborador inválido, estado no operable o asignación incompatible.
- **Reglas:** asignar colaborador deja la SIM `ASIGNADA`.

## POST `/sim/:codigo/desasignar-colaborador`

- **Propósito:** cerrar la asignación personal de la SIM.
- **Body:** `observaciones` opcional; responsable de sesión.
- **Respuesta:** `200` SIM actualizada.
- **Errores:** `400`, `404`, `409`.
- **Reglas:** si continúa asociada a un dispositivo, permanece asignada; si queda sin relaciones, puede volver a disponible.

## POST `/sim/:codigo/cambiar-estado`

- **Propósito:** cambiar el estado de la SIM.
- **Body:** `estadoId` obligatorio y `observaciones` opcional; responsable de sesión.
- **Respuesta:** `200` SIM actualizada.
- **Errores:** `400`, `404`, `409` si el estado no es de entidad `SIM` o la transición no procede.

## GET `/sim/:codigo/historial`

- **Propósito:** consultar eventos de la SIM.
- **Respuesta:** `200` colección de eventos con estado anterior/nuevo, responsable, observaciones, detalle y fecha.
- **Errores:** `400`, `404`.

## Línea móvil en dispositivos

La operación `POST /api/v1/dispositivos/:codigo/asociar-linea` recibe `numeroTelefonico`, `simId` opcional, `responsable` y `observaciones`. La línea es independiente de la SIM: puede existir sin SIM y se muestra en la ficha del dispositivo. Registrar o corregir el número no marca automáticamente la verificación física del equipo.
