# Códigos y etiquetas ITAM

## Identidad y custodia

`codigo_inventario` identifica físicamente al activo y es inmutable. La custodia es una relación operacional que puede cambiar entre `NONE`, `COLABORADOR` y `DEPARTAMENTO` sin cambiar la etiqueta.

La base de datos impide custodios directos simultáneos y los nuevos eventos de asignación/devolución guardan la custodia anterior y nueva en `historial_eventos.detalle`.

## Generación

`itam.familias_codigo_inventario` centraliza familia, prefijo, estrategia, versión y último ordinal. El servicio bloquea la fila de familia con `SELECT ... FOR UPDATE`, busca colisiones globales legacy y actualiza el ordinal dentro de la misma transacción que inserta el activo.

Familias confirmadas:

- `1`: Smartphone;
- `2`: SIM.
- `3`: Notebook;
- `4`: Monitor;
- `5`: PC;
- `6`: Periféricos.

No se crean familias `7` a `9` ni un tipo periférico genérico. Los tipos concretos pueden compartir la familia Periféricos. No existe fallback para otros tipos: deben configurarse y confirmarse antes de habilitar su alta.

La estrategia vigente es `REPEAT_PREFIX` y acepta prefijos simples de `1` a `9`. El algoritmo se selecciona por `estrategia_codigo`, nunca por el nombre de la familia. Si se agotan esos prefijos se debe incorporar una estrategia/versionado nuevo mediante otra migración; no se reutilizan prefijos.

Los códigos emitidos son inmutables. PostgreSQL impide cambiar el prefijo usado, mover a otra familia un tipo con activos o cambiar el tipo de un dispositivo hacia una familia diferente.

## Modelo de tipos

`itam.tipos_dispositivo` es el catálogo corporativo de clases físicas. Cada dispositivo referencia `tipo_dispositivo_id`; el texto `dispositivos.tipo_dispositivo` permanece temporalmente como espejo legacy para una transición segura.

La relación es:

```text
dispositivos.tipo_dispositivo_id
  → tipos_dispositivo.familia_codigo_inventario_id
  → familias_codigo_inventario.id
```

Un tipo puede existir sin familia para preservar datos legacy, pero no puede utilizarse en un alta hasta relacionarlo con una familia activa. `requiere_imei` configura la captura de IMEI sin depender del nombre del tipo. SIM continúa fuera de este catálogo y reserva códigos directamente desde su familia independiente.

La familia y su prefijo son configuración técnica interna: no se solicitan durante el alta. `configuracion_formulario` define los campos aplicables a cada tipo y `dispositivos.atributos_especificos` conserva propiedades técnicas extensibles sin crear columnas o tablas por cada clase. La familia Periféricos agrupa en la interfaz tipos reales como Mouse, Teclado, Cable, Cargador, Docking Station, Webcam, Adaptador, Hub USB y Otro; el dispositivo siempre persiste el tipo concreto.

## Etiqueta

La vista Angular genera Code 128 real con el valor numérico del código ITAM. La etiqueta mide `50mm × 25mm` y contiene únicamente empresa, sistema, código y tipo de activo. La impresión actual utiliza el diálogo del navegador sobre A4 a escala 100%.

La impresora productiva prevista es Zebra ZD421. Una fase posterior podrá generar ZPL en backend usando los mismos datos de etiqueta; no se implementa comunicación directa con la impresora en esta etapa.
## Etiqueta QR de activos

La identidad del activo continúa siendo su codigo_inventario; el QR no crea ni reemplaza códigos ITAM. La etiqueta principal mide 50 × 30 mm e incluye únicamente empresa, QR, código visible y tipo de dispositivo.

El contenido del QR es la ruta estable /dispositivos/:codigoInventario resuelta contra assetDetailBaseUrl del environment Angular. Si la base está vacía se utiliza el origen actual de la aplicación. No se almacena un dominio productivo ficticio.

La impresión usa window.print() y CSS de impresión, sin acoplamiento a un fabricante específico.
