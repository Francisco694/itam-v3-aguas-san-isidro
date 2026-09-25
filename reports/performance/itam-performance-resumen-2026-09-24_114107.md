# ITAM - MediciÃ³n de Recursos

Fecha: 2026-09-24 11:41:08
Escenario: Reposo
DuraciÃ³n configurada: 1 minuto(s)
DuraciÃ³n real: 1,00 minuto(s)
Intervalo: 5 segundo(s)
Muestras: 12
Procesadores lÃ³gicos: 8
RAM sistema al finalizar: 8.535,96 MB usada de 12.163,60 MB

## Backend ITAM
RAM promedio: 59,96 MB
RAM mÃ­nima: 59,34 MB
RAM mÃ¡xima: 61,42 MB
CPU promedio: 0,01%
CPU mÃ¡xima: 0,08%

## Frontend
Modo detectado: Desarrollo
RAM promedio: 62,49 MB
RAM mÃ¡xima: 62,54 MB
CPU promedio: 0,00%
CPU mÃ¡xima: 0,04%

ATENCIÃ“N: El frontend estÃ¡ ejecutÃ¡ndose en modo desarrollo. Su consumo no representa un despliegue productivo de Angular y no debe utilizarse directamente para dimensionar producciÃ³n en AWS.

## PostgreSQL
Procesos mÃ¡ximos observados: 11
RAM promedio: 48,28 MB
RAM mÃ¡xima: 49,63 MB
CPU promedio: 0,00%
CPU mÃ¡xima: 0,00%
TamaÃ±o BD: 15 MB
Conexiones: 9

Nota: Working Set de PostgreSQL es una aproximaciÃ³n de memoria observada desde Windows y puede no representar perfectamente memoria compartida o cachÃ©.

## Sistema
CPU promedio: 13,50%
CPU mÃ¡xima: 18,00%
RAM usada promedio: 8.559,42 MB
RAM usada mÃ¡xima: 8.590,60 MB
Disco libre: 291,54 GB en E:
Disco utilizado: 34,79%
Backend/dist: 1,24 MB
Frontend/dist: 0,00 MB
Reports: 0,44 MB

## API
Health exitosos: 12
Health fallidos: 0
Latencia promedio: 200,34 ms
Latencia mÃ¡xima: 2.133,01 ms
Health endpoint: http://localhost:3000/api/v1/health
Health database endpoint: http://localhost:3000/api/v1/health/database

## Resultado para AWS
Backend pico RAM: 61,42 MB
Backend pico CPU: 0,08%
PostgreSQL pico RAM: 49,63 MB
PostgreSQL pico CPU: 0,00%

Para dimensionar AWS se requiere repetir esta mediciÃ³n bajo carga controlada con usuarios concurrentes.

## ClasificaciÃ³n de procesos
Los Node se clasifican mediante CommandLine y cadena de procesos padre: BACKEND_ITAM, FRONTEND_DEV, NPM_TOOLING, OTRO_NODE_PROYECTO y NODE_EXTERNO. No se presenta Node total como consumo de ITAM.

## Archivos
- CSV: E:\Aguas San Isidro V2\ITAM\reports\performance\itam-recursos-2026-09-24_114107.csv
- Procesos: E:\Aguas San Isidro V2\ITAM\reports\performance\itam-procesos-2026-09-24_114107.txt
- Resumen: E:\Aguas San Isidro V2\ITAM\reports\performance\itam-performance-resumen-2026-09-24_114107.md
