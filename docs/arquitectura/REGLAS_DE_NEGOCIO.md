# Reglas de negocio

**Actualizado:** 23 de septiembre de 2026
**Tipo:** funcional

## Inventario y códigos

1. El backend genera el código ITAM desde la familia asociada al tipo; el frontend no elige prefijos.
2. El código ITAM es único entre dispositivos y SIM y no se puede cambiar.
3. El tipo de dispositivo y la familia de codificación son conceptos separados.
4. Un tipo debe usar una familia activa compatible cuando la configuración del catálogo lo exige.
5. Los atributos específicos solo aceptan claves configuradas para el tipo.

## Custodia

1. Un dispositivo puede estar bajo custodia de un colaborador, un departamento o nadie, pero nunca de dos custodios simultáneos.
2. La asignación exige que el activo esté disponible para esa operación y que el receptor sea válido.
3. Para cambiar de custodio se debe cerrar la custodia anterior mediante devolución o flujo equivalente.
4. La recepción departamental puede registrar un receptor personal sin convertirlo en custodio directo.
5. La custodia temporal mantiene fechas, usuario ejecutor, evidencia y nivel de confianza.

## Estados y cierre patrimonial

- `EXTRAVIADO` y `DADO_BAJA` no se modifican mediante un cambio genérico; requieren recuperación o baja controlada.
- Dar de baja exige motivo, responsable y conserva el valor comercial del momento.
- La devolución deja el activo sin custodio y en revisión/bodega según el flujo aplicado.
- Las operaciones relevantes registran evento de historial.

## Verificación física

- Una verificación compara existencia e identificador observado con el activo esperado.
- Los resultados son `PENDIENTE`, `VERIFICADO` o `REVISAR`.
- El alta manual puede quedar verificada por la regla implementada; un importado no se considera verificado sin evidencia suficiente.
- Registrar una línea móvil no equivale a verificar físicamente un equipo.

## SIM y línea

- La SIM y la línea telefónica son entidades diferentes.
- Una línea puede existir sin SIM y una SIM puede cambiar de línea según las reglas del servicio.
- Una asociación SIM–dispositivo debe respetar unicidad y estado operativo.

## Servicio técnico y offboarding

- Un dispositivo no admite dos órdenes técnicas abiertas.
- El servicio técnico sigue envío, diagnóstico/cotización, decisión, reparación y retorno/cierre.
- Un offboarding abierto es único por colaborador.
- Un proceso pendiente conserva la custodia hasta que el equipo sea recibido o se registre el resultado correspondiente.
