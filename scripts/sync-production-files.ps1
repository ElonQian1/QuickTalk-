$ErrorActionPreference = "Stop"
$RootDir = "E:\duihua\customer-service-system"
$ProductionDir = Join-Path $RootDir "服务器数据库"
$DeployDir = Join-Path $RootDir "ubuntu-deploy-ready"

Write-Host "Syncing production files..." -ForegroundColor Yellow

if (-not (Test-Path "$DeployDir\certs")) {
    New-Item -ItemType Directory -Path "$DeployDir\certs" -Force | Out-Null
}

Copy-Item "$ProductionDir\customer_service.db" -Destination "$DeployDir\customer_service.db" -Force
Copy-Item "$ProductionDir\server.crt" -Destination "$DeployDir\certs\server.crt" -Force
Copy-Item "$ProductionDir\server.key" -Destination "$DeployDir\certs\server.key" -Force

Write-Host "Database synced" -ForegroundColor Green
Write-Host "Certificate synced" -ForegroundColor Green
Write-Host "Key synced" -ForegroundColor Green
Write-Host "Done!" -ForegroundColor Green
