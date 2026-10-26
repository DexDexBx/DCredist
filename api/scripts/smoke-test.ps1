<#
    Prueba de endpoints de la API de DCredits (Windows PowerShell 5.1).

    Uso:
      powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
      powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -SkipBuild

    No usa rutas de Linux ni rutas cortas de Windows: todos los archivos se
    resuelven con -LiteralPath porque el perfil de usuario contiene un espacio
    ("TEAM TI") y Remove-Item falla con rutas como "TEAMTI~1".
#>

[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [string]$ApiUrl = 'http://localhost:3000/api'
)

$ErrorActionPreference = 'Stop'
$apiRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $apiRoot

# --- Rutas seguras para logs -------------------------------------------------
# $env:TEMP puede contener espacios: se normaliza con GetFullPath y todo acceso
# usa -LiteralPath para que no se interpreten comillas ni comodines.
$logDir = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP 'opencode'))
$log = [System.IO.Path]::GetFullPath((Join-Path $logDir 'dcredits-api.log'))
$errLog = [System.IO.Path]::GetFullPath((Join-Path $logDir 'dcredits-api-error.log'))

if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

foreach ($file in @($log, $errLog)) {
    if (Test-Path -LiteralPath $file) {
        Remove-Item -LiteralPath $file -Force
    }
}

# --- Rutas a probar (exactamente las del contrato) --------------------------
$routes = @(
    '/students?professionalSchool=&headquarters=&status=&search=',
    '/students?search=AGUILAR&status=ACTIVE',
    '/students/facets',
    '/events?search=&category=&status=',
    '/events?category=Congreso',
    '/participations?eventId=&studentId=&status=&search=',
    '/reports/dashboard',
    '/reports/schools/credits',
    '/verification',
    '/verification?q=DC-2026&limit=3'
)

function Invoke-Endpoint {
    param([string]$Method, [string]$Url, [string]$RequestedRoute)

    $status = 0
    $body = ''
    $error = ''

    try {
        # -UseBasicParsing es obligatorio en PowerShell 5.1 no interactivo: sin
        # el, Invoke-WebRequest intenta inicializar IE y falla con
        # "Windows PowerShell se encuentra en modo no interactivo".
        $response = Invoke-WebRequest -Uri $Url -Method $Method -UseBasicParsing -TimeoutSec 30
        $status = [int]$response.StatusCode
        $body = [string]$response.Content
    }
    catch {
        $status = 0
        $error = $_.Exception.Message

        if ($_.Exception.Response -ne $null) {
            try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = 0 }

            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $body = $reader.ReadToEnd()
                $reader.Close()
            }
            catch {
                $body = ''
            }
        }

        if ([string]::IsNullOrWhiteSpace($error)) {
            $error = 'Error sin descripcion'
        }
    }

    $uri = [System.Uri]$Url
    $preview = ($body -replace '\s+', ' ')
    if ($preview.Length -gt 110) { $preview = $preview.Substring(0, 110) + '...' }

    [pscustomobject]@{
        Method  = $Method
        Route   = $RequestedRoute
        Url     = $Url
        Status  = $status
        Ok      = ($status -ge 200 -and $status -lt 300)
        Bytes   = $body.Length
        Preview = $preview
        Error   = $error
        Body    = $body
    }
}

# --- Compilacion -------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host 'Compilando la API (nest build)...' -ForegroundColor Cyan
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw 'La compilacion fallo: no se puede probar la API.'
    }
}

# --- Arranque ----------------------------------------------------------------
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host "Ya hay un proceso escuchando en el puerto 3000 (PID $($listener.OwningProcess)). Se detiene para probar el build actual." -ForegroundColor Yellow
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

$apiProcess = Start-Process -FilePath 'node' `
    -ArgumentList 'dist/main.js' `
    -WorkingDirectory $apiRoot `
    -PassThru `
    -RedirectStandardOutput $log `
    -RedirectStandardError $errLog

Write-Host "API iniciada (PID $($apiProcess.Id)). Logs: $log" -ForegroundColor Cyan

# Espera activa: no se prueba nada hasta que NestJS responda de verdad.
$ready = $false
$deadline = (Get-Date).AddSeconds(40)
while ((Get-Date) -lt $deadline) {
    if ($apiProcess.HasExited) { break }

    try {
        $probe = Invoke-WebRequest -Uri "$ApiUrl/reports/schools/credits" -UseBasicParsing -TimeoutSec 5
        if ($probe.StatusCode -eq 200) { $ready = $true; break }
    }
    catch { Start-Sleep -Milliseconds 800 }
}

if (-not $ready) {
    Write-Host ''
    Write-Host 'La API no respondio a tiempo. stdout:' -ForegroundColor Red
    if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Tail 40 }
    Write-Host 'stderr:' -ForegroundColor Red
    if (Test-Path -LiteralPath $errLog) { Get-Content -LiteralPath $errLog -Tail 40 }
    if (-not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue }
    throw 'Arranque fallido.'
}

# --- Pruebas -----------------------------------------------------------------
Write-Host ''
Write-Host '========================================'
Write-Host 'DCredits API - Endpoint Test'
Write-Host '========================================'
Write-Host "API: $ApiUrl"
Write-Host ''

$results = @()
foreach ($route in $routes) {
    $result = Invoke-Endpoint -Method 'GET' -Url "$ApiUrl$route" -RequestedRoute $route
    $results += $result

    if ($result.Ok) {
        Write-Host ("[OK]   {0,-4} {1} -> {2}" -f $result.Method, $result.Route, $result.Status) -ForegroundColor Green
    }
    else {
        Write-Host ("[FAIL] {0,-4} {1} -> {2}" -f $result.Method, $result.Route, $result.Status) -ForegroundColor Red
        if (-not [string]::IsNullOrWhiteSpace($result.Preview)) {
            Write-Host "       $ $($result.Preview)" -ForegroundColor DarkRed
        }
        if (-not [string]::IsNullOrWhiteSpace($result.Error)) {
            Write-Host "       $ $($result.Error)" -ForegroundColor DarkRed
        }
    }
}

# --- Evidencia de PostgreSQL -------------------------------------------------
# El listado de estudiantes sale de PostgreSQL via Prisma: si responde 200 con un
# array JSON, la conexion y el esquema son correctos. No se conecta a mocks.
$databaseOk = $false
$studentRows = 0
$studentsRoute = '/students?professionalSchool=&headquarters=&status=&search='
$students = $results | Where-Object { $_.Route -eq $studentsRoute }
if ($students -and $students.Ok) {
    try {
        $parsed = $students.Body | ConvertFrom-Json
        $studentRows = @($parsed).Count
        $databaseOk = $true
    }
    catch { $databaseOk = $false }
}

# --- Resumen -----------------------------------------------------------------
$ok = @($results | Where-Object { $_.Ok }).Count
$failed = $results.Count - $ok

Write-Host ''
Write-Host '========================================'
Write-Host 'RESULTADO'
Write-Host '========================================'
Write-Host "API: $(if ($apiProcess.HasExited) { 'STOPPED' } else { 'RUNNING' })"
Write-Host "PostgreSQL: $(if ($databaseOk) { 'CONNECTED' } else { 'UNKNOWN' }) (estudiantes leidos: $studentRows)"
Write-Host "Endpoints tested: $($results.Count)"
Write-Host "Successful: $ok"
Write-Host "Failed: $failed"
Write-Host ''

if ($failed -gt 0) {
    Write-Host 'Errores de NestJS en el log:' -ForegroundColor Yellow
    if (Test-Path -LiteralPath $errLog) { Get-Content -LiteralPath $errLog -Tail 30 }
    if (Test-Path -LiteralPath $log) {
        Get-Content -LiteralPath $log |
            Select-String -Pattern 'ERROR|Exception|Prisma' -SimpleMatch:$false |
            Select-Object -Last 20 |
            ForEach-Object { Write-Host "  $($_.Line)" }
    }
}

Write-Host ''
Write-Host "Log completo: $log"
Write-Host "Errores:      $errLog"
Write-Host "La API sigue corriendo (PID $($apiProcess.Id)). Para detenerla:"
Write-Host "  Stop-Process -Id $($apiProcess.Id)"

if ($failed -gt 0) { exit 1 }
exit 0
