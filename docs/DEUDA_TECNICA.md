# Deuda técnica conocida

**Actualizado:** 14 de octubre de 2026
**Tipo:** técnico y operativo
**Alcance:** problemas conocidos que no bloquean el desarrollo
diario pero sí bloquean una entrega o despliegue formal.

> Este documento consolida la deuda técnica detectada durante la
> reorganización documental de octubre de 2026. Cada entrada enlaza al
> detalle técnico en la carpeta correspondiente. No resuelve los
> problemas; solo los documenta y prioriza.

## Clasificación

| Severidad | Significado |
| --- | --- |
| **Bloqueante** | Impide una entrega o un despliegue en producción. |
| **Alta** | Afecta la reproducibilidad o la validación del sistema. |
| **Media** | Afecta la calidad documental o la experiencia de desarrollo. |
| **Baja** | Mejoras pendientes sin impacto inmediato. |

## 1. Bloqueantes de build y despliegue

### 1.1 — Presupuesto SCSS en `dashboard.scss` (Bloqueante)

**Qué:** `docs/ux/DASHBOARD.md` y los registros de validación indican
que el build de producción fue rechazado por el presupuesto de estilos
de `frontend/src/app/features/dashboard/dashboard.scss`.

La configuración actual de producción en `frontend/angular.json` define
`anyComponentStyle` con advertencia en `26kB` y error en `30kB`. El
archivo fuente actual mide 30.651 bytes; el tamaño compilado del estilo
debe confirmarse con el build correspondiente.

**Cifras contradictorias en la documentación:**

- `PRODUCTION_CHECKLIST.md`: 19,91 kB frente a 10 kB de máximo de error.
- `docs/bitacoras/avance-2026-09-23.md`: 19,91 kB frente a 10 kB.
- `docs/entrega/_historico/02_manual_de_desarrollo.md`:
  advertencia no bloqueante por presupuesto inicial de 500 kB.
- `docs/entrega/02_Manual_de_Desarrollo.md`: build con código 0 y
  advertencia del bundle inicial.

**Acción requerida:** confirmar el valor real del presupuesto durante
el build de producción, medir el tamaño compilado y decidir entre
refactorizar el SCSS o ajustar el presupuesto de forma justificada.

**Evidencia:**

- `frontend/angular.json`
- `frontend/src/app/features/dashboard/dashboard.scss`
- [DASHBOARD.md](ux/DASHBOARD.md)
- [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
- [avance-2026-09-23.md](bitacoras/avance-2026-09-23.md)
- [Manual de desarrollo](entrega/02_Manual_de_Desarrollo.md)

## 2. Bloqueantes de base de datos y migraciones

### 2.1 — Migración 029 fuera de secuencia (Alta)

**Qué:** la documentación de reconciliación registra que la migración
`029_simplify_technical_service.sql` no aparece aplicada en el historial
analizado de `itam_dev`, mientras `030`, `031` y `032` sí aparecen
registradas. Ejecutarla directamente podría duplicar columnas y
restricciones ya creadas por migraciones posteriores.

**Acción requerida:** no ejecutar 029 directamente. La migración
`033_reconcile_technical_service_schema.sql` está preparada para
reconciliar el esquema y requiere validación en PostgreSQL 16.

**Evidencia:**

- [RECONCILIACION_029.md](database/RECONCILIACION_029.md)
- [ESTADO_MIGRACIONES.md](database/ESTADO_MIGRACIONES.md)
- [ci-cd.md](ci/ci-cd.md)

### 2.2 — Columnas faltantes en `itam.ordenes_servicio_tecnico` (Alta)

**Qué:** el backend referencia `tipo_servicio` y
`accesorios_entregados` en el flujo de servicio técnico, pero la
documentación de la base analizada indica que esas columnas no existen
en `itam_dev`. La migración 033 las reconcilia, pero requiere validación
en PostgreSQL 16.

**Acción requerida:** ejecutar la validación en PostgreSQL 16 con una
copia aislada. No ejecutar sobre `itam_dev` ni `itam_prod`.

**Evidencia:**

- [RECONCILIACION_029.md](database/RECONCILIACION_029.md)
- [ESTADO_ACTUAL_BD.md](database/ESTADO_ACTUAL_BD.md)

### 2.3 — Sin runner oficial de migraciones (Alta)

**Qué:** `database/install.sh` está diseñado para bases vacías. No
existe un actualizador de bases existentes que inspeccione
`schema_migrations` antes de aplicar archivos.

**Acción requerida:** definir el runner antes de actualizar `itam_dev`
o `itam_prod` con nuevas migraciones. Debe manejar la excepción
histórica de 029 y no insertar filas falsas.

**Evidencia:**

- [INSTALADOR_POSTGRESQL.md](database/INSTALADOR_POSTGRESQL.md)
- [RECONCILIACION_029.md](database/RECONCILIACION_029.md)

### 2.4 — `schema_migrations` sin checksum (Media)

**Qué:** la tabla `itam.schema_migrations` almacena `version`,
`nombre` y `aplicado_en`, pero no un checksum del SQL aplicado. No se
puede verificar automáticamente si un archivo fue modificado después
de aplicarse.

**Acción requerida:** evaluar agregar una columna `checksum` en una
migración futura. No modificar la tabla actual sin análisis.

**Evidencia:**

- [HISTORIAL_MIGRACIONES.md](database/HISTORIAL_MIGRACIONES.md)
- [ESTADO_MIGRACIONES.md](database/ESTADO_MIGRACIONES.md)

## 3. Bloqueantes de CI/CD

### 3.1 — CI sin pruebas de integración (Alta)

**Qué:** el workflow `.github/workflows/ci.yml` ejecuta typecheck y
build, pero no habilita `npm test` en CI porque las pruebas de
integración requieren PostgreSQL y fixtures reproducibles que no están
versionados.

**Acción requerida:** definir un fixture SQL sintético y un mecanismo
de preparación de una base temporal para habilitar la batería completa.

**Evidencia:**

- [ci-cd.md](ci/ci-cd.md)

### 3.2 — Falta de fixtures de prueba (Alta)

**Qué:** `database/seeds` no contiene fixtures. Las pruebas de
integración necesitan datos preexistentes —dispositivos,
colaboradores, departamentos, estados y usuarios— que no existen en
una base limpia.

**Acción requerida:** crear un fixture sintético mínimo. No copiar
datos empresariales.

**Evidencia:**

- [ci-cd.md](ci/ci-cd.md)

## 4. Contradicciones documentales

### 4.1 — Pruebas frontend: 0 vs 77 vs 86 (Media)

**Qué:** documentos históricos reportan cifras distintas para las
pruebas frontend:

- `docs/entrega/_historico/02_manual_de_desarrollo.md`: 86.
- `docs/bitacoras/avance-2026-09-23.md`: 77.
- `docs/entrega/02_Manual_de_Desarrollo.md` e
  `INFORME_FINAL_DE_VALIDACION.md`: no existen archivos `*.spec.ts`
  bajo `frontend/src`.

**Acción requerida:** confirmar cuál es la cifra real para el commit
vigente `d8cd34c`. Actualizar los documentos cuando exista evidencia.
Si no hay pruebas, aprobar una excepción formal o crear las pruebas.

### 4.2 — Pruebas backend: 106 vs 107 vs 113 (Media)

**Qué:** existen cifras distintas en la documentación:

- `PRODUCTION_CHECKLIST.md`: 106.
- `docs/ci/CI.md`: 107, pero ese archivo no existe actualmente en el
  árbol de trabajo.
- `INFORME_FINAL_DE_VALIDACION.md`: 113.

**Acción requerida:** confirmar la cifra real del commit vigente y
actualizar los documentos con su evidencia. No crear `docs/ci/CI.md`
como parte de esta consolidación.

### 4.3 — Presupuesto CSS: 10 kB vs 500 kB (Bloqueante)

La diferencia entre los presupuestos documentados se detalla en la
sección 1.1.

### 4.4 — Mojibake reportado históricamente (Media)

Una revisión anterior señaló posible codificación rota en:

- `docs/api/ACTAS_ENTREGA.md`
- `docs/arquitectura/BASE_DE_DATOS.md`
- `docs/entrega/_historico/05_gestion_segura_de_accesos_y_llaves.md`

La comprobación actual no encontró los marcadores `Ã` o `â` en esos
tres archivos. El hallazgo histórico queda registrado para confirmar
la codificación en el flujo de distribución documental, sin modificar
los archivos en esta tarea.

### 4.5 — Migración 041 no reflejada de forma uniforme (Media)

La matriz de validación actual indica que la migración 041 ya existe y
fue aplicada por el CD, mientras documentos de base de datos y registros
anteriores describen historiales que llegan solo hasta 032 o 036.

**Acción requerida:** mantener `docs/database/` y los registros de
entrega alineados con 041 y las migraciones posteriores, conservando la
distinción entre evidencia histórica y estado vigente.

## 5. Deuda documental pendiente

### 5.1 — Falta archivo canónico 04 (Media)

**Qué:** `docs/entrega/04_Procedimientos_Operativos.md` está
referenciado pero no existe. Solo está el histórico
`_historico/04_procedimientos_operativos_y_tecnicos.md`.

**Acción requerida:** crear el canónico a partir del histórico o
actualizar la referencia. No se crea en esta tarea.

### 5.2 — Falta archivo canónico 09 (Media)

**Qué:** `docs/entrega/09_Gestion_de_Accesos.md` está referenciado pero
no existe. Solo está el histórico con el contenido de accesos.

**Acción requerida:** crear el canónico a partir del histórico
corregido. No se crea en esta tarea.

### 5.3 — Falta archivo canónico 10 (Media)

**Qué:** `docs/entrega/10_Checklist_de_Entrega.md` está referenciado
pero no existe. `PRODUCTION_CHECKLIST.md` se encuentra en la raíz de
`docs/`.

**Acción requerida:** decidir si el canónico 10 es
`PRODUCTION_CHECKLIST.md` movido a `entrega/`, o si se crea uno nuevo.
No se mueve ni se crea en esta tarea.

### 5.4 — Pendientes de servidor sin validar (Alta)

**Qué:** permanecen sin evidencia directa controles de infraestructura
como backup y restauración de PostgreSQL, TLS, firewall, DNS y rollback
probado en producción.

**Acción requerida:** revisar [03_Informacion_del_Servidor.md](entrega/03_Informacion_del_Servidor.md)
y [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

## 6. Resumen ejecutivo

| # | Problema | Severidad | Categoría |
| --- | --- | --- | --- |
| 1.1 | Presupuesto SCSS bloquea build | Bloqueante | Frontend |
| 2.1 | Migración 029 fuera de secuencia | Alta | Base de datos |
| 2.2 | Columnas faltantes en servicio técnico | Alta | Base de datos |
| 2.3 | Sin runner de migraciones | Alta | Base de datos |
| 2.4 | `schema_migrations` sin checksum | Media | Base de datos |
| 3.1 | CI sin pruebas de integración | Alta | CI/CD |
| 3.2 | Falta de fixtures | Alta | CI/CD |
| 4.1 | Pruebas frontend: 0/77/86 | Media | Documentación |
| 4.2 | Pruebas backend: 106/107/113 | Media | Documentación |
| 4.3 | Presupuesto CSS: 10 vs 500 kB | Bloqueante | Documentación |
| 4.4 | Mojibake reportado históricamente | Media | Documentación |
| 4.5 | Migración 041 no reflejada uniformemente | Media | Documentación |
| 5.1 | Falta canónico 04 | Media | Documentación |
| 5.2 | Falta canónico 09 | Media | Documentación |
| 5.3 | Falta canónico 10 | Media | Documentación |
| 5.4 | Pendientes de servidor sin validar | Alta | Infraestructura |

## 7. Cómo usar este documento

- Antes de cada release: revisar los bloqueantes.
- Antes de cada despliegue: revisar las deudas altas.
- Al cerrar una entrega: actualizar el estado de cada entrada.
- Al detectar un problema nuevo: agregar una entrada con el mismo
  formato: qué, acción requerida y evidencia.
