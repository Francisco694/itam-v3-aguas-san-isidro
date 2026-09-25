# ITAM - MediciÃ³n de Recursos

Fecha: 2026-09-24 11:36:10
Escenario: Reposo
DuraciÃ³n configurada: 1 minuto(s)
DuraciÃ³n real: 1,00 minuto(s)
Intervalo: 5 segundo(s)
Muestras: 12
Procesadores lÃ³gicos: 8
RAM sistema al finalizar: 8.422,89 MB usada de 12.163,60 MB

## Backend ITAM
RAM promedio: 55,72 MB
RAM mÃ­nima: 48,21 MB
RAM mÃ¡xima: 56,97 MB
CPU promedio: 0,02%
CPU mÃ¡xima: 0,12%

## Frontend
Modo detectado: Desarrollo
RAM promedio: 60,33 MB
RAM mÃ¡xima: 60,36 MB
CPU promedio: 0,00%
CPU mÃ¡xima: 0,04%

ATENCIÃ“N: El frontend estÃ¡ ejecutÃ¡ndose en modo desarrollo. Su consumo no representa un despliegue productivo de Angular y no debe utilizarse directamente para dimensionar producciÃ³n en AWS.

## PostgreSQL
Procesos mÃ¡ximos observados: 11
RAM promedio: 48,09 MB
RAM mÃ¡xima: 49,44 MB
CPU promedio: 0,00%
CPU mÃ¡xima: 0,00%
TamaÃ±o BD: 15 MB
Conexiones: 9

Nota: Working Set de PostgreSQL es una aproximaciÃ³n de memoria observada desde Windows y puede no representar perfectamente memoria compartida o cachÃ©.

## Sistema
CPU promedio: 20,67%
CPU mÃ¡xima: 43,00%
RAM usada promedio: 8.419,38 MB
RAM usada mÃ¡xima: 8.442,74 MB
Disco libre: 291,54 GB en E:
Disco utilizado: 34,79%
Backend/dist: 0,00 MB
Frontend/dist: 0,00 MB
Reports: 0,00 MB

## API
Health exitosos: 12
Health fallidos: 0
Latencia promedio: 202,35 ms
Latencia mÃ¡xima: 2.184,09 ms
Health endpoint: http://localhost:3000/api/v1/health
Health database endpoint: http://localhost:3000/api/v1/health/database

## Resultado para AWS
Backend pico RAM: 56,97 MB
Backend pico CPU: 0,12%
PostgreSQL pico RAM: 49,44 MB
PostgreSQL pico CPU: 0,00%

Para dimensionar AWS se requiere repetir esta mediciÃ³n bajo carga controlada con usuarios concurrentes.

## ClasificaciÃ³n de procesos
Los Node se clasifican mediante CommandLine y cadena de procesos padre: BACKEND_ITAM, FRONTEND_DEV, NPM_TOOLING, OTRO_NODE_PROYECTO y NODE_EXTERNO. No se presenta Node total como consumo de ITAM.

## Archivos
- CSV: E:\Aguas San Isidro V2\ITAM\reports\performance\itam-recursos-2026-09-24_113607.csv
- Procesos: E:\Aguas San Isidro V2\ITAM\reports\performance\itam-procesos-2026-09-24_113607.txt
- Resumen: E:\Aguas San Isidro V2\ITAM\reports\performance\itam-performance-resumen-2026-09-24_113607.md
