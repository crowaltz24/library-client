[CmdletBinding()]
param(
    [string]$BackendPath = ''
)

$ErrorActionPreference = 'Stop'
$scriptRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptRoot)) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
$clientPath = Split-Path $scriptRoot -Parent
if ([string]::IsNullOrWhiteSpace($BackendPath)) {
    $BackendPath = Join-Path $clientPath '..\personal-library'
}
$backendPython = Join-Path $BackendPath '.venv\Scripts\python.exe'

if (-not (Test-Path $backendPython)) {
    throw "Backend Python was not found at '$backendPython'. Create the backend virtual environment first."
}

function Stop-ProcessTree([System.Diagnostics.Process]$process) {
    if ($null -ne $process -and -not $process.HasExited) {
        taskkill.exe /PID $process.Id /T /F *> $null
    }
}

$backend = $null
$frontend = $null

try {
    Write-Host "Starting backend from $BackendPath"
    $backend = Start-Process `
        -FilePath $backendPython `
        -ArgumentList '-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000' `
        -WorkingDirectory $BackendPath `
        -PassThru

    Write-Host "Starting frontend from $clientPath"
    $frontend = Start-Process `
        -FilePath 'npm.cmd' `
        -ArgumentList 'run', 'dev' `
        -WorkingDirectory $clientPath `
        -PassThru

    Write-Host ''
    Write-Host 'Backend:  http://localhost:8000'
    Write-Host 'Frontend: http://localhost:5173'
    Write-Host 'Press Ctrl+C to stop both processes.'
    Write-Host ''

    Wait-Process -Id $frontend.Id
}
finally {
    Write-Host 'Stopping local backend and frontend...'
    Stop-ProcessTree $frontend
    Stop-ProcessTree $backend
}
