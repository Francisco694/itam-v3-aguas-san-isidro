# Catálogos técnicos de dispositivos

**Actualizado:** 16 de octubre de 2026
**Tipo:** funcional, técnico y operativo

## Objetivo

La ficha de un dispositivo permite asociar uno o más documentos PDF relacionados con su uso,
seguridad, mantenimiento o características técnicas. Los archivos quedan vinculados al código de
inventario del equipo y pueden ser consultados desde la ficha.

Ejemplo: `ITAM-1001` puede tener un manual de usuario y una guía de seguridad.

## Visibilidad por perfil

| Perfil | Consultar PDF | Adjuntar | Cambiar | Eliminar |
| --- | --- | --- | --- | --- |
| `SUPER_USUARIO` | Sí | Sí | Sí | Sí |
| `USUARIO` | Sí | Sí | Sí | Sí |
| `SOLO_LECTURA` | Sí | No | No | No |

El perfil `SOLO_LECTURA` no muestra la columna de acciones del equipo. Sus documentos aparecen en
una tarjeta independiente de documentación debajo de la ficha, con el nombre, tamaño, fecha y
enlace **Ver PDF**.

La restricción se aplica en dos niveles:

- el frontend oculta las acciones de gestión y no permite iniciar sus métodos;
- el backend rechaza cualquier mutación distinta de `GET`, `HEAD` u `OPTIONS` para
  `SOLO_LECTURA`, con respuesta `403`.

## Operación en la interfaz

### Adjuntar

1. El usuario autorizado selecciona **Adjuntar**.
2. Se abre un modal dentro de la página con la recomendación de nombre.
3. El selector de archivos solo se abre después de pulsar **OK, continuar**.
4. Se pueden seleccionar uno o más PDF.
5. El sistema valida el archivo y actualiza la lista sin recargar la ficha completa.

### Cambiar

1. El usuario pulsa **Cambiar** sobre un documento existente.
2. Debe confirmar el modal de recomendación de nombre.
3. Selecciona un PDF nuevo.
4. El archivo reemplaza únicamente al documento seleccionado.

### Eliminar

1. El usuario pulsa **Eliminar**.
2. Se muestra un modal bloqueante de confirmación dentro de la página.
3. **Cancelar** conserva el documento.
4. La eliminación solo se ejecuta después de confirmar.

### Nombre recomendado

La interfaz comunica esta convención antes de adjuntar o reemplazar:

```text
Tipo de documento - Marca Modelo.pdf
```

Ejemplo:

```text
Manual de usuario - Motorola Moto G30.pdf
```

El sistema conserva el nombre original del archivo, pero lo almacena internamente con un nombre
seguro generado por el backend.

## Consulta desde QR

El flujo de escaneo de la lista de dispositivos abre `AssetScanOptionsDialog` cuando encuentra un
dispositivo. El usuario puede elegir:

- **Ficha y Custodia del Activo**, que navega a `/dispositivos/:codigo`.
- **Catálogo Técnico y Manuales PDF**, que navega a `/dispositivos/:codigo#catalogo`.

La rama de escaneo de SIM mantiene su navegación independiente a `/sim/:codigo`.

## Contrato de datos

Cada elemento de catálogo expone:

```json
{
  "id": "5",
  "dispositivoId": "1001",
  "nombreOriginal": "Guia de Seguridad - Samsung A13.pdf",
  "mimeType": "application/pdf",
  "tamanoBytes": 6573288,
  "subidoPor": "Usuario TI",
  "creadoEn": "2026-10-13T12:04:00.000Z"
}
```

## Validaciones

- Solo se aceptan archivos PDF.
- La extensión debe ser `.pdf`.
- El MIME esperado es `application/pdf`.
- El backend comprueba la firma `%PDF-`.
- El tamaño máximo es 10 MiB por archivo.
- El dispositivo debe existir y el catálogo debe pertenecer al código solicitado.

## API

Base: `/api/v1/dispositivos`

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/:codigo/catalogo-tecnico` | Lista los catálogos del dispositivo. |
| `GET` | `/:codigo/catalogo-tecnico/:catalogoId/archivo` | Abre el PDF en el navegador. |
| `POST` | `/:codigo/catalogo-tecnico` | Adjunta uno o más PDF en `multipart/form-data`, campo `archivos`. |
| `PUT` | `/:codigo/catalogo-tecnico/:catalogoId` | Reemplaza un PDF, campo `archivos`. |
| `DELETE` | `/:codigo/catalogo-tecnico/:catalogoId` | Elimina un PDF específico. |

El parámetro `download=true` puede agregarse al endpoint de archivo para solicitar descarga.
La consulta y visualización requieren sesión autenticada.

## Persistencia

Los metadatos se guardan en `itam.catalogos_tecnicos_dispositivo`. El binario se guarda en la
ruta configurada por `DOCUMENT_STORAGE_PATH`; PostgreSQL conserva la asociación, el nombre
original, MIME, tamaño, usuario y fecha.

## Referencias de implementación

- Frontend: `frontend/src/app/features/dispositivos/dispositivo-detail.ts`.
- Servicio frontend: `frontend/src/app/core/services/catalogo-tecnico.service.ts`.
- Escaneo QR: `frontend/src/app/features/dispositivos/dispositivos-list.ts` y
  `asset-scan-options-dialog.ts`.
- API: `backend/src/modules/dispositivos/dispositivos.routes.ts`.
- Controlador: `backend/src/modules/dispositivos/catalogo-tecnico.controller.ts`.
- Servicio y persistencia: `catalogo-tecnico.service.ts` y `catalogo-tecnico.repository.ts`.
- Protección de solo lectura: `backend/src/shared/auth.middleware.ts`.
