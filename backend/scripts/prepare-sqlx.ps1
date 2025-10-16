Param(
    [string]$DatabaseUrl = "sqlite:../服务器数据库/customer_service.db"
)

Write-Host "== SQLx Prepare (compile-time query cache) ==" -ForegroundColor Cyan
Write-Host "DATABASE_URL = $DatabaseUrl" -ForegroundColor Yellow

$env:DATABASE_URL = $DatabaseUrl
$env:SQLX_OFFLINE = $null

# Ensure sqlx-cli is installed
if (-not (Get-Command cargo-sqlx -ErrorAction SilentlyContinue)) {
  Write-Host "Installing sqlx-cli (if not present)..." -ForegroundColor Yellow
  cargo install sqlx-cli --no-default-features --features sqlite,rustls
}

# Run prepare to generate sqlx-data.json
Push-Location "$PSScriptRoot\.."
try {
  cargo sqlx prepare
  if ($LASTEXITCODE -ne 0) { throw "cargo sqlx prepare failed" }
  Write-Host "✅ sqlx-data.json updated successfully" -ForegroundColor Green
}
finally {
  Pop-Location
}
