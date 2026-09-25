param(
    [int]$DuracionMinutos = 10,
    [int]$IntervaloSegundos = 5,
    [ValidateSet('Reposo', 'UsoNormal', 'Carga10', 'Carga25', 'Carga50', 'Personalizado')]
    [string]$Escenario = 'Reposo'
)

$ErrorActionPreference = 'Continue'
if ($DuracionMinutos -lt 1) { Write-Error 'DuracionMinutos debe ser mayor o igual a 1.'; exit 1 }
if ($IntervaloSegundos -lt 1) { Write-Error 'IntervaloSegundos debe ser mayor o igual a 1.'; exit 1 }

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$projectRootLower = $projectRoot.ToLowerInvariant()
$projectName = Split-Path $projectRoot -Leaf
$logicalProcessors = [Environment]::ProcessorCount
$reportDir = Join-Path $projectRoot 'reports\performance'
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$csvPath = Join-Path $reportDir "itam-recursos-$timestamp.csv"
$processPath = Join-Path $reportDir "itam-procesos-$timestamp.txt"
$summaryPath = Join-Path $reportDir "itam-performance-resumen-$timestamp.md"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

function Read-DotEnv([string]$Path) {
    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $values }
    foreach ($line in (Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue)) {
        if ($line -match '^\s*(?:export\s+)?([^#=\s]+)\s*=\s*(.*)\s*$') {
            $key = $Matches[1]; $value = $Matches[2].Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
            else { $value = $value -replace '\s+#.*$', '' }
            $values[$key] = $value
        }
    }
    return $values
}

function Get-EnvValue([hashtable]$Values, [string[]]$Names, [string]$Default = '') {
    foreach ($name in $Names) { if ($Values.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace([string]$Values[$name])) { return [string]$Values[$name] } }
    return $Default
}

function Protect-CommandLine([AllowNull()][string]$CommandLine) {
    if ([string]::IsNullOrWhiteSpace($CommandLine)) { return '[no disponible]' }
    $safe = $CommandLine
    $safe = $safe -replace '(?i)(--?(?:password|passwd|secret|token|api[-_]?key|connection[-_]?string|database[-_]?url|db[-_]?password)(?:=|\s+))("[^"]*"|\S+)', '$1[REDACTED]'
    $safe = $safe -replace '(?i)(\b(?:PASSWORD|PGPASSWORD|DB_PASSWORD|JWT_SECRET|SESSION_SECRET|ACCESS_TOKEN|API_KEY)\s*=\s*)("[^"]*"|\S+)', '$1[REDACTED]'
    return $safe
}

function Get-CimProcessSet {
    try {
        $items = @(Get-CimInstance Win32_Process -ErrorAction Stop)
        $byId = @{}; foreach ($item in $items) { $byId[[int]$item.ProcessId] = $item }
        return [PSCustomObject]@{ Available = $true; Items = $items; ById = $byId; Error = '' }
    } catch {
        return [PSCustomObject]@{ Available = $false; Items = @(); ById = @{}; Error = $_.Exception.Message }
    }
}

function Get-NodeType($ProcessInfo, [hashtable]$ById) {
    $parts = New-Object System.Collections.Generic.List[string]; $current = $ProcessInfo; $seen = @{}
    for ($depth = 0; $null -ne $current -and $depth -lt 7; $depth++) {
        $id = [int]$current.ProcessId; if ($seen.ContainsKey($id)) { break }; $seen[$id] = $true
        if ($current.CommandLine) { $parts.Add([string]$current.CommandLine) }
        $current = if ($ById.ContainsKey([int]$current.ParentProcessId)) { $ById[[int]$current.ParentProcessId] } else { $null }
    }
    $text = (($parts.ToArray()) -join ' ').ToLowerInvariant().Replace('/', '\')
    $projectEvidence = $text.Contains($projectRootLower) -or ($text -match "\\$([regex]::Escape($projectName.ToLowerInvariant()))\\(backend|frontend|scripts|node_modules)(\\|\s)")
    $backend = $text -match '(?i)(backend\\|backend/(?:dist|src)|tsx|ts-node|nodemon|node\s+.*(?:dist|src)[\\/].*(?:server|main))'
    $frontend = $text -match '(?i)(frontend\\|frontend/(?:src|dist)|ng\s+serve|@angular[\\/]cli|vite|webpack-dev-server|webpack\s+serve)'
    $tooling = $text -match '(?i)(npm(?:\.cmd|-cli\.js)?|npx|pnpm|yarn|scripts[\\/])'
    if ($projectEvidence -and $backend) { return 'BACKEND_ITAM' }
    if ($projectEvidence -and $frontend) { return 'FRONTEND_DEV' }
    if ($projectEvidence -and $tooling) { return 'NPM_TOOLING' }
    if ($projectEvidence) { return 'OTRO_NODE_PROYECTO' }
    return 'NODE_EXTERNO'
}

function Get-Resource($Id, $Name, $Classification, $CommandLine, $ExecutablePath = '[no disponible]') {
    try {
        $process = Get-Process -Id $Id -ErrorAction Stop
        return [PSCustomObject]@{ ProcessId = [int]$Id; Name = $Name; Classification = $Classification; ExecutablePath = $ExecutablePath; CommandLine = $CommandLine; CpuSeconds = [double]$process.TotalProcessorTime.TotalSeconds; RamMB = [math]::Round(([double]$process.WorkingSet64 / 1MB), 2) }
    } catch { return $null }
}

function Get-ResourceSnapshot {
    $cim = Get-CimProcessSet; $nodes = New-Object System.Collections.Generic.List[object]; $postgres = New-Object System.Collections.Generic.List[object]
    if ($cim.Available) {
        foreach ($item in $cim.Items) {
            if ($item.Name -ne 'node.exe' -and $item.Name -ne 'postgres.exe') { continue }
            $type = if ($item.Name -eq 'postgres.exe') { 'POSTGRESQL' } else { Get-NodeType $item $cim.ById }
            $resource = Get-Resource $item.ProcessId $item.Name $type (Protect-CommandLine $item.CommandLine) (Protect-CommandLine $item.ExecutablePath)
            if ($null -eq $resource) { continue }
            if ($item.Name -eq 'postgres.exe') { $postgres.Add($resource) } else { $nodes.Add($resource) }
        }
    } else {
        foreach ($p in @(Get-Process node -ErrorAction SilentlyContinue)) { $r = Get-Resource $p.Id 'node.exe' 'NODE_EXTERNO' '[no disponible: Win32_Process no accesible]' '[no disponible: Win32_Process no accesible]'; if ($null -ne $r) { $nodes.Add($r) } }
        foreach ($p in @(Get-Process postgres -ErrorAction SilentlyContinue)) { $r = Get-Resource $p.Id 'postgres.exe' 'POSTGRESQL' '[no disponible: Win32_Process no accesible]' '[no disponible: Win32_Process no accesible]'; if ($null -ne $r) { $postgres.Add($r) } }
    }
    return [PSCustomObject]@{ InventoryAvailable = $cim.Available; InventoryError = $cim.Error; Node = @($nodes.ToArray()); PostgreSQL = @($postgres.ToArray()) }
}

function Get-GroupMetrics([object[]]$Items, [hashtable]$Previous, [double]$Elapsed, [int]$Processors) {
    $ram = 0.0; $cpuDelta = 0.0; $cpuAccumulated = 0.0
    foreach ($item in @($Items)) {
        $ram += [double]$item.RamMB; $cpuAccumulated += [double]$item.CpuSeconds
        $old = if ($Previous.ContainsKey([int]$item.ProcessId)) { [double]$Previous[[int]$item.ProcessId] } else { [double]$item.CpuSeconds }
        $delta = [double]$item.CpuSeconds - $old; if ($delta -gt 0) { $cpuDelta += $delta }
    }
    $cpu = if ($Elapsed -gt 0 -and $Processors -gt 0) { ($cpuDelta / $Elapsed / $Processors) * 100 } else { 0 }
    return [PSCustomObject]@{ CpuPct = [math]::Round($cpu, 2); CpuAccumulatedSeconds = [math]::Round($cpuAccumulated, 2); RamMB = [math]::Round($ram, 2); ProcessCount = @($Items).Count }
}

function Get-SystemMetrics {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if ($null -eq $os) { return [PSCustomObject]@{ TotalMB = 0; UsedMB = 0; AvailableMB = 0; UsedPct = 0 } }
    $total = [math]::Round(([double]$os.TotalVisibleMemorySize / 1024), 2); $available = [math]::Round(([double]$os.FreePhysicalMemory / 1024), 2); $used = [math]::Round(($total - $available), 2)
    return [PSCustomObject]@{ TotalMB = $total; UsedMB = $used; AvailableMB = $available; UsedPct = if ($total -gt 0) { [math]::Round(($used / $total) * 100, 2) } else { 0 } }
}

function Get-SystemCpuPct {
    $items = @(Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue); if ($items.Count -eq 0) { return 0 }
    $value = ($items | Measure-Object LoadPercentage -Average).Average; if ($null -eq $value) { return 0 }; return [math]::Round([double]$value, 2)
}

function Get-DiskMetrics {
    $unit = ([IO.Path]::GetPathRoot($projectRoot)).TrimEnd('\'); $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$unit'" -ErrorAction SilentlyContinue
    if ($null -eq $disk -or [double]$disk.Size -le 0) { return [PSCustomObject]@{ Unit = $unit; TotalGB = 0; UsedGB = 0; FreeGB = 0; UsedPct = 0 } }
    $total = [double]$disk.Size / 1GB; $free = [double]$disk.FreeSpace / 1GB; $used = $total - $free
    return [PSCustomObject]@{ Unit = $unit; TotalGB = [math]::Round($total, 2); UsedGB = [math]::Round($used, 2); FreeGB = [math]::Round($free, 2); UsedPct = [math]::Round(($used / $total) * 100, 2) }
}

function Get-DirectorySizeMB([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return 0 }
    try {
        $sum = (Get-ChildItem -LiteralPath $Path -File -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
        if ($null -eq $sum) { return 0 }
        return [math]::Round(([double]$sum / 1MB), 2)
    } catch { return 0 }
}

function Test-Endpoint([string]$Url) {
    $watch = [Diagnostics.Stopwatch]::StartNew()
    try { $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4 -ErrorAction Stop; $watch.Stop(); return [PSCustomObject]@{ Status = [int]$response.StatusCode; Milliseconds = [math]::Round($watch.Elapsed.TotalMilliseconds, 2); Ok = $true } }
    catch { $watch.Stop(); $status = 0; if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $status = [int]$_.Exception.Response.StatusCode }; return [PSCustomObject]@{ Status = $status; Milliseconds = [math]::Round($watch.Elapsed.TotalMilliseconds, 2); Ok = $false } }
}

function Get-DatabaseMetrics([hashtable]$Values) {
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -eq $psql) { return [PSCustomObject]@{ Available = $false; Size = 'Métrica de tamaño PostgreSQL no disponible'; Connections = 'No disponible' } }
    $hostName = Get-EnvValue $Values @('DB_HOST', 'PGHOST') 'localhost'; $port = Get-EnvValue $Values @('DB_PORT', 'PGPORT') '5432'; $database = Get-EnvValue $Values @('DB_NAME', 'DB_DATABASE', 'PGDATABASE', 'POSTGRES_DB') 'itam'; $user = Get-EnvValue $Values @('DB_USER', 'DB_USERNAME', 'PGUSER', 'POSTGRES_USER') 'postgres'; $password = Get-EnvValue $Values @('DB_PASSWORD', 'PGPASSWORD', 'POSTGRES_PASSWORD') ''
    $url = Get-EnvValue $Values @('DATABASE_URL', 'POSTGRES_URL') ''
    if ($url) { try { $uri = [Uri]$url; if ($uri.Host) { $hostName = $uri.Host }; if ($uri.Port -gt 0) { $port = [string]$uri.Port }; if ($uri.AbsolutePath.Trim('/')) { $database = [Uri]::UnescapeDataString($uri.AbsolutePath.Trim('/')) }; if ($uri.UserInfo) { $info = $uri.UserInfo.Split(':', 2); $user = [Uri]::UnescapeDataString($info[0]); if ($info.Count -gt 1) { $password = [Uri]::UnescapeDataString($info[1]) } } } catch { return [PSCustomObject]@{ Available = $false; Size = 'Métrica de tamaño PostgreSQL no disponible'; Connections = 'No disponible' } } }
    $args = @('-X', '-qAt', '-h', $hostName, '-p', $port, '-U', $user, '-d', $database, '-c', "SELECT pg_size_pretty(pg_database_size(current_database())) || E'\t' || (SELECT count(*) FROM pg_stat_activity);")
    $had = Test-Path Env:PGPASSWORD; $old = $env:PGPASSWORD
    try { if ($password) { $env:PGPASSWORD = $password }; $output = @(& $psql.Source @args 2>$null); if ($LASTEXITCODE -ne 0 -or $output.Count -eq 0) { return [PSCustomObject]@{ Available = $false; Size = 'Métrica de tamaño PostgreSQL no disponible'; Connections = 'No disponible' } }; $fields = ([string]($output -join '')).Trim().Split("`t"); if ($fields.Count -lt 2) { return [PSCustomObject]@{ Available = $false; Size = 'Métrica de tamaño PostgreSQL no disponible'; Connections = 'No disponible' } }; return [PSCustomObject]@{ Available = $true; Size = $fields[0].Trim(); Connections = $fields[1].Trim() } } catch { return [PSCustomObject]@{ Available = $false; Size = 'Métrica de tamaño PostgreSQL no disponible'; Connections = 'No disponible' } } finally { if ($had) { $env:PGPASSWORD = $old } else { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } }
}

function Get-Stats([object[]]$Rows, [string]$Property) {
    $values = @($Rows | ForEach-Object { [double]($_.$Property) }); if ($values.Count -eq 0) { return [PSCustomObject]@{ Average = 0; Minimum = 0; Maximum = 0 } }
    return [PSCustomObject]@{ Average = [math]::Round(($values | Measure-Object -Average).Average, 2); Minimum = [math]::Round(($values | Measure-Object -Minimum).Minimum, 2); Maximum = [math]::Round(($values | Measure-Object -Maximum).Maximum, 2) }
}
function F([double]$Value) { return ('{0:N2}' -f $Value) }

$backendEnv = Read-DotEnv (Join-Path $projectRoot 'backend\.env')
$backendPort = 3000; $portText = Get-EnvValue $backendEnv @('PORT') '3000'; if (-not [int]::TryParse($portText, [ref]$backendPort) -or $backendPort -lt 1 -or $backendPort -gt 65535) { $backendPort = 3000 }
$healthUrl = "http://localhost:$backendPort/api/v1/health"; $databaseHealthUrl = "http://localhost:$backendPort/api/v1/health/database"
$backendDistMB = Get-DirectorySizeMB (Join-Path $projectRoot 'backend\dist'); $frontendDistMB = Get-DirectorySizeMB (Join-Path $projectRoot 'frontend\dist'); $reportsMB = Get-DirectorySizeMB (Join-Path $projectRoot 'reports')
$databaseMetrics = Get-DatabaseMetrics $backendEnv; $initial = Get-ResourceSnapshot
$lines = New-Object System.Collections.Generic.List[string]; $lines.Add('PROCESOS DETECTADOS AL INICIO'); $lines.Add(('Fecha: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))); $lines.Add(('ProjectRoot: {0}' -f $projectRoot)); $lines.Add('Clasificación por CommandLine y cadena de procesos padre. Secretos sanitizados.'); $lines.Add('')
if (-not $initial.InventoryAvailable) { $lines.Add(('Win32_Process no disponible: {0}' -f (Protect-CommandLine $initial.InventoryError))); $lines.Add('') }
foreach ($item in @($initial.Node + $initial.PostgreSQL) | Sort-Object ProcessId) { $lines.Add(('PID: {0}' -f $item.ProcessId)); $lines.Add(('Tipo: {0}' -f $item.Classification)); $lines.Add(('RAM inicial: {0} MB' -f (F $item.RamMB))); $lines.Add(('ExecutablePath: {0}' -f (Protect-CommandLine $item.ExecutablePath))); $lines.Add(('CommandLine: {0}' -f (Protect-CommandLine $item.CommandLine))); $lines.Add('') }
$lines | Set-Content -LiteralPath $processPath -Encoding utf8

Write-Host ''; Write-Host '==========================================' -ForegroundColor Cyan; Write-Host ' ITAM - MEDICIÓN DE RECURSOS' -ForegroundColor Cyan; Write-Host '==========================================' -ForegroundColor Cyan; Write-Host "Escenario: $Escenario"; Write-Host "Duración: $DuracionMinutos minuto(s)"; Write-Host "Intervalo: $IntervaloSegundos segundo(s)"; Write-Host "CSV: $csvPath"; Write-Host ''
$rows = New-Object System.Collections.Generic.List[object]; $healthRows = New-Object System.Collections.Generic.List[object]; $previous = @{}; $start = Get-Date; $end = $start.AddMinutes($DuracionMinutos); $previousTime = $null; $next = $start

while ((Get-Date) -lt $end -or $rows.Count -eq 0) {
    $when = Get-Date; $snapshot = Get-ResourceSnapshot; $all = @($snapshot.Node + $snapshot.PostgreSQL); $current = @{}; foreach ($item in $all) { $current[[int]$item.ProcessId] = [double]$item.CpuSeconds }
    $elapsed = if ($null -eq $previousTime) { 0 } else { [math]::Max(0.001, ($when - $previousTime).TotalSeconds) }
    $backend = Get-GroupMetrics @($snapshot.Node | Where-Object Classification -eq 'BACKEND_ITAM') $previous $elapsed $logicalProcessors; $frontend = Get-GroupMetrics @($snapshot.Node | Where-Object Classification -eq 'FRONTEND_DEV') $previous $elapsed $logicalProcessors; $other = Get-GroupMetrics @($snapshot.Node | Where-Object Classification -eq 'OTRO_NODE_PROYECTO') $previous $elapsed $logicalProcessors; $tooling = Get-GroupMetrics @($snapshot.Node | Where-Object Classification -eq 'NPM_TOOLING') $previous $elapsed $logicalProcessors; $postgres = Get-GroupMetrics @($snapshot.PostgreSQL) $previous $elapsed $logicalProcessors
    $system = Get-SystemMetrics; $disk = Get-DiskMetrics; $systemCpu = Get-SystemCpuPct; $health = Test-Endpoint $healthUrl; $dbHealth = Test-Endpoint $databaseHealthUrl; $healthRows.Add([PSCustomObject]@{ Health = $health; Database = $dbHealth })
    $row = [PSCustomObject]([ordered]@{ FechaHora = $when.ToString('yyyy-MM-dd HH:mm:ss'); Escenario = $Escenario; CPU_Sistema_Pct = $systemCpu; RAM_Total_MB = $system.TotalMB; RAM_Usada_MB = $system.UsedMB; RAM_Disponible_MB = $system.AvailableMB; RAM_Usada_Pct = $system.UsedPct; Backend_CPU_Pct = $backend.CpuPct; Backend_RAM_MB = $backend.RamMB; Backend_Procesos = $backend.ProcessCount; Frontend_CPU_Pct = $frontend.CpuPct; Frontend_RAM_MB = $frontend.RamMB; Frontend_Procesos = $frontend.ProcessCount; PostgreSQL_CPU_Pct = $postgres.CpuPct; PostgreSQL_RAM_MB = $postgres.RamMB; PostgreSQL_Procesos = $postgres.ProcessCount; OtrosNodeITAM_CPU_Pct = $other.CpuPct; OtrosNodeITAM_RAM_MB = $other.RamMB; OtrosNodeITAM_Procesos = $other.ProcessCount; NPMTooling_CPU_Pct = $tooling.CpuPct; NPMTooling_RAM_MB = $tooling.RamMB; NPMTooling_Procesos = $tooling.ProcessCount; Backend_Health_HTTP = $health.Status; Backend_Health_MS = $health.Milliseconds; Backend_DatabaseHealth_HTTP = $dbHealth.Status; Backend_DatabaseHealth_MS = $dbHealth.Milliseconds; Disco_Unidad = $disk.Unit; Disco_Total_GB = $disk.TotalGB; Disco_Usado_GB = $disk.UsedGB; Disco_Libre_GB = $disk.FreeGB; Disco_Usado_Pct = $disk.UsedPct; Backend_Dist_MB = $backendDistMB; Frontend_Dist_MB = $frontendDistMB; Reports_MB = $reportsMB })
    $rows.Add($row); $previous = $current; $previousTime = $when
    $frontLabel = if ($frontend.ProcessCount -gt 0) { 'Frontend DEV' } else { 'Frontend no detectado' }; Write-Host "[$($row.FechaHora)]" -ForegroundColor Gray; Write-Host ("Sistema CPU: {0}% | Sistema RAM: {1}%" -f (F $systemCpu), (F $system.UsedPct)); Write-Host ("Backend: CPU {0}% | RAM {1} MB | Procesos {2}" -f (F $backend.CpuPct), (F $backend.RamMB), $backend.ProcessCount); Write-Host ("$frontLabel`: CPU {0}% | RAM {1} MB | Procesos {2}" -f (F $frontend.CpuPct), (F $frontend.RamMB), $frontend.ProcessCount); Write-Host ("PostgreSQL: CPU {0}% | RAM {1} MB | Procesos {2}" -f (F $postgres.CpuPct), (F $postgres.RamMB), $postgres.ProcessCount); Write-Host ("Health: {0} - {1} ms" -f $health.Status, (F $health.Milliseconds)); Write-Host ''
    $next = $next.AddSeconds($IntervaloSegundos)
    $nowAfterSample = Get-Date
    if ($next -le $nowAfterSample) { $next = $nowAfterSample.AddSeconds($IntervaloSegundos) }
    $sleep = [math]::Floor(($next - (Get-Date)).TotalMilliseconds)
    if ($sleep -gt 0 -and (Get-Date).AddMilliseconds($sleep) -lt $end) { Start-Sleep -Milliseconds $sleep }
}

$rows | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding utf8; $duration = ((Get-Date) - $start).TotalSeconds
$br = Get-Stats $rows 'Backend_RAM_MB'; $bc = Get-Stats $rows 'Backend_CPU_Pct'; $fr = Get-Stats $rows 'Frontend_RAM_MB'; $fc = Get-Stats $rows 'Frontend_CPU_Pct'; $pr = Get-Stats $rows 'PostgreSQL_RAM_MB'; $pc = Get-Stats $rows 'PostgreSQL_CPU_Pct'; $sr = Get-Stats $rows 'RAM_Usada_MB'; $sc = Get-Stats $rows 'CPU_Sistema_Pct'; $pp = Get-Stats $rows 'PostgreSQL_Procesos'; $ok = @($healthRows | Where-Object { $_.Health.Ok }).Count; $fail = $healthRows.Count - $ok; $lat = @($healthRows | Where-Object { $_.Health.Ok } | ForEach-Object { [double]$_.Health.Milliseconds }); $latAvg = if ($lat.Count) { [math]::Round(($lat | Measure-Object -Average).Average, 2) } else { 0 }; $latMax = if ($lat.Count) { [math]::Round(($lat | Measure-Object -Maximum).Maximum, 2) } else { 0 }; $mode = if (@($rows | Where-Object { $_.Frontend_Procesos -gt 0 }).Count) { 'Desarrollo' } else { 'No detectado' }; $last = $rows[$rows.Count - 1]
$warning = if ($mode -eq 'Desarrollo') { 'ATENCIÓN: El frontend está ejecutándose en modo desarrollo. Su consumo no representa un despliegue productivo de Angular y no debe utilizarse directamente para dimensionar producción en AWS.' } else { '' }

$markdown = @"
# ITAM - Medición de Recursos

Fecha: $($start.ToString('yyyy-MM-dd HH:mm:ss'))
Escenario: $Escenario
Duración configurada: $DuracionMinutos minuto(s)
Duración real: $(F ($duration / 60)) minuto(s)
Intervalo: $IntervaloSegundos segundo(s)
Muestras: $($rows.Count)
Procesadores lógicos: $logicalProcessors
RAM sistema al finalizar: $(F $last.RAM_Usada_MB) MB usada de $(F $last.RAM_Total_MB) MB

## Backend ITAM
RAM promedio: $(F $br.Average) MB
RAM mínima: $(F $br.Minimum) MB
RAM máxima: $(F $br.Maximum) MB
CPU promedio: $(F $bc.Average)%
CPU máxima: $(F $bc.Maximum)%

## Frontend
Modo detectado: $mode
RAM promedio: $(F $fr.Average) MB
RAM máxima: $(F $fr.Maximum) MB
CPU promedio: $(F $fc.Average)%
CPU máxima: $(F $fc.Maximum)%

$warning

## PostgreSQL
Procesos máximos observados: $($pp.Maximum)
RAM promedio: $(F $pr.Average) MB
RAM máxima: $(F $pr.Maximum) MB
CPU promedio: $(F $pc.Average)%
CPU máxima: $(F $pc.Maximum)%
Tamaño BD: $($databaseMetrics.Size)
Conexiones: $($databaseMetrics.Connections)

Nota: Working Set de PostgreSQL es una aproximación de memoria observada desde Windows y puede no representar perfectamente memoria compartida o caché.

## Sistema
CPU promedio: $(F $sc.Average)%
CPU máxima: $(F $sc.Maximum)%
RAM usada promedio: $(F $sr.Average) MB
RAM usada máxima: $(F $sr.Maximum) MB
Disco libre: $(F $last.Disco_Libre_GB) GB en $($last.Disco_Unidad)
Disco utilizado: $(F $last.Disco_Usado_Pct)%
Backend/dist: $(F $backendDistMB) MB
Frontend/dist: $(F $frontendDistMB) MB
Reports: $(F $reportsMB) MB

## API
Health exitosos: $ok
Health fallidos: $fail
Latencia promedio: $(F $latAvg) ms
Latencia máxima: $(F $latMax) ms
Health endpoint: $healthUrl
Health database endpoint: $databaseHealthUrl

## Resultado para AWS
Backend pico RAM: $(F $br.Maximum) MB
Backend pico CPU: $(F $bc.Maximum)%
PostgreSQL pico RAM: $(F $pr.Maximum) MB
PostgreSQL pico CPU: $(F $pc.Maximum)%

Para dimensionar AWS se requiere repetir esta medición bajo carga controlada con usuarios concurrentes.

## Clasificación de procesos
Los Node se clasifican mediante CommandLine y cadena de procesos padre: BACKEND_ITAM, FRONTEND_DEV, NPM_TOOLING, OTRO_NODE_PROYECTO y NODE_EXTERNO. No se presenta Node total como consumo de ITAM.

## Archivos
- CSV: $csvPath
- Procesos: $processPath
- Resumen: $summaryPath
"@
$markdown | Set-Content -LiteralPath $summaryPath -Encoding utf8

Write-Host ''; Write-Host '==========================================' -ForegroundColor Green; Write-Host ' PRUEBA FINALIZADA' -ForegroundColor Green; Write-Host '==========================================' -ForegroundColor Green; Write-Host "Escenario: $Escenario"; Write-Host ("Duración real: {0} minuto(s)" -f (F ($duration / 60))); Write-Host "Muestras: $($rows.Count)"; Write-Host ''; Write-Host 'BACKEND ITAM'; Write-Host ("RAM promedio: {0} MB | RAM máxima: {1} MB" -f (F $br.Average), (F $br.Maximum)); Write-Host ("CPU promedio: {0}% | CPU máxima: {1}%" -f (F $bc.Average), (F $bc.Maximum)); Write-Host ''; Write-Host 'POSTGRESQL'; Write-Host ("RAM promedio: {0} MB | RAM máxima: {1} MB" -f (F $pr.Average), (F $pr.Maximum)); Write-Host ("CPU promedio: {0}% | CPU máxima: {1}%" -f (F $pc.Average), (F $pc.Maximum)); Write-Host ''; Write-Host 'FRONTEND'; Write-Host ("Modo: {0} | RAM máxima: {1} MB" -f $mode, (F $fr.Maximum)); Write-Host ''; Write-Host 'ARCHIVOS:'; Write-Host "CSV: $csvPath" -ForegroundColor Yellow; Write-Host "Procesos: $processPath" -ForegroundColor Yellow; Write-Host "Resumen: $summaryPath" -ForegroundColor Yellow
