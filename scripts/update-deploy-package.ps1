$ErrorActionPreference = "Stop"
$RootDir = "E:\duihua\customer-service-system"
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"
$DeployDir = Join-Path $RootDir "ubuntu-deploy-ready"
$ProductionDir = Join-Path $RootDir "服务器数据库"

Write-Host "========== Update Deployment Package ==========" -ForegroundColor Cyan

Write-Host "Step 1/5: Compiling Rust backend..." -ForegroundColor Yellow
Set-Location $BackendDir
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Step 2/5: Copying backend binary..." -ForegroundColor Yellow
Copy-Item "$BackendDir\target\x86_64-unknown-linux-musl\release\customer-service-backend" -Destination "$DeployDir\customer-service-backend" -Force

Write-Host "Step 3/5: Compiling frontend..." -ForegroundColor Yellow
Set-Location $RootDir
npm run build:frontend
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Step 4/5: Copying frontend files..." -ForegroundColor Yellow
Remove-Item "$DeployDir\static\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$FrontendDir\build\*" -Destination "$DeployDir\static\" -Recurse -Force
New-Item -ItemType Directory -Path "$DeployDir\static\sdk" -Force | Out-Null
New-Item -ItemType Directory -Path "$DeployDir\static\embed" -Force | Out-Null
Copy-Item "$BackendDir\static\sdk\*" -Destination "$DeployDir\static\sdk\" -Recurse -Force
Copy-Item "$BackendDir\static\embed\*" -Destination "$DeployDir\static\embed\" -Recurse -Force

Write-Host "Step 5/5: Syncing production files..." -ForegroundColor Yellow
if (-not (Test-Path "$DeployDir\certs")) {
    New-Item -ItemType Directory -Path "$DeployDir\certs" -Force | Out-Null
}
Copy-Item "$ProductionDir\customer_service.db" -Destination "$DeployDir\customer_service.db" -Force
Copy-Item "$ProductionDir\server.crt" -Destination "$DeployDir\certs\server.crt" -Force
Copy-Item "$ProductionDir\server.key" -Destination "$DeployDir\certs\server.key" -Force

Write-Host "========== Deployment Package Updated ==========" -ForegroundColor Green
Set-Location $RootDir
