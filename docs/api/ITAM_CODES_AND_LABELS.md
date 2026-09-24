# Códigos ITAM y etiquetas

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y operativo

## Código de inventario

El código ITAM se genera en backend a partir de `familias_codigo_inventario` y de la familia asociada al tipo de dispositivo o SIM. El frontend no envía prefijo ni ordinal. La reserva es transaccional y el código emitido es único e inmutable.

La estrategia vigente es `REPEAT_PREFIX`: una familia con prefijo de un dígito puede producir códigos como `1001`–`1999`, luego `11001`–`11999`, según los ordinales reservados. La secuencia concreta depende de la familia instalada en la base de datos; la documentación no fija un catálogo que pueda quedar desactualizado.

## Identificadores físicos

- Smartphone: la configuración del tipo puede exigir IMEI.
- Otros equipos: pueden usar número de serie.
- El backend valida duplicados de IMEI y serie; la interfaz puede consultar `/dispositivos/validar-identificador` antes de guardar.
- La comparación normaliza espacios exteriores y mayúsculas para detectar duplicados equivalentes.

## Etiqueta física

La etiqueta representa al activo, no reemplaza el registro del inventario. Debe mostrar, según disponibilidad y tipo:

- código ITAM;
- tipo operativo;
- marca y modelo;
- IMEI o número de serie;
- responsable o ubicación cuando corresponda;
- número telefónico para smartphones cuando exista;
- QR asociado al activo.

Los detalles de hardware y medidas de impresión se encuentran en [ETIQUETAS.md](../prototipo/ETIQUETAS.md). La prueba de impresión real debe registrarse en el checklist de producción.
