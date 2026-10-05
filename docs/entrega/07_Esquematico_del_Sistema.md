# Esquematico del Sistema

## Vista de componentes

```mermaid
flowchart LR
  U[Usuario] --> B[Navegador]
  B --> N[Nginx y HTTPS]
  N --> F[Angular frontend]
  N --> A[Express backend API]
  A --> DB[(PostgreSQL esquema itam)]
  A --> FS[Almacenamiento de documentos]
  A --> PDF[PDFKit y PDF de OT]
  G[GitHub Actions] --> AWS[AWS por SSH y SCP]
  AWS --> N
  AWS --> A
  AWS --> DB
```

El frontend se sirve como archivos estáticos y usa el backend bajo `/api/v1`. El backend autentica, autoriza, audita, valida reglas de negocio y persiste en PostgreSQL. Los documentos cargados se guardan según `DOCUMENT_STORAGE_PATH`. Los PDF se generan en backend y se devuelven como `application/pdf`.

## Flujo de autenticación

```mermaid
sequenceDiagram
  actor Usuario
  participant Frontend
  participant API
  participant DB
  Usuario->>Frontend: Correo y credencial
  Frontend->>API: POST /api/v1/auth/login
  API->>DB: Verifica usuario y sesión
  DB-->>API: Usuario, rol y flags de credencial
  API-->>Frontend: Cookie itam_session
  Frontend->>API: GET /api/v1/auth/me
  API-->>Frontend: Rol y sesión vigente
```

Las sesiones tienen vigencia absoluta e inactividad. El backend revoca una sesión vencida y registra el evento en auditoría.

## Flujo de solicitud y PDF

```mermaid
sequenceDiagram
  actor Usuario
  participant Navegador
  participant Nginx
  participant API
  participant PostgreSQL
  participant PDFKit
  Usuario->>Navegador: Descargar PDF de OT
  Navegador->>Nginx: GET /api/v1/servicio-tecnico/:id/envio/pdf
  Nginx->>API: Proxy interno
  API->>PostgreSQL: Consulta orden y equipo(s)
  PostgreSQL-->>API: Datos de OT
  API->>PDFKit: Construye A4, tablas y firmas
  PDFKit-->>API: Buffer PDF
  API-->>Navegador: application/pdf
  Navegador-->>Usuario: Vista previa, impresión o descarga
```

## Flujo de despliegue

```mermaid
flowchart TD
  C[Commit en main] --> CI[CI: npm ci, typecheck y build]
  CI --> CD[CD: checkout SHA validado]
  CD --> PKG[Artefactos backend y frontend]
  PKG --> SCP[SCP por SSH]
  SCP --> REL[Crear release /opt/itam/releases/id]
  REL --> MIG[psql con ON_ERROR_STOP]
  MIG --> PM2[Iniciar PM2]
  PM2 --> HEALTH[Health loopback]
  HEALTH --> NGINX[nginx -t y reload]
  HEALTH -. falla .-> ROLLBACK[Restaurar backend anterior]
  NGINX -. falla .-> RESTORE[Restaurar Nginx y backend]
```

## Backups y recuperación

El workflow respalda la configuración Nginx antes de modificarla y conserva releases anteriores. No hay evidencia en el repositorio de un backup de PostgreSQL ni de una prueba real de restauración. Ambos puntos quedan **Pendiente de validar en servidor**.
