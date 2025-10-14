#!/usr/bin/env pwsh

# 批量修复 Service 编译问题脚本

Write-Host "🔧 开始批量修复 Service 编译问题..." -ForegroundColor Yellow

$backend_src = "E:\duihua\customer-service-system\backend\src"

# 需要修复的 Service 文件
$services = @(
    "customer_service.rs",
    "session_service.rs", 
    "message_service.rs"
)

foreach ($service in $services) {
    $file_path = Join-Path "$backend_src\services" $service
    
    Write-Host "📝 修复 $service..." -ForegroundColor Cyan
    
    if (Test-Path $file_path) {
        $content = Get-Content $file_path -Raw
        
        # 1. 添加 Clone derive 和数据库字段
        $service_name = ($service -split '_')[0] + ($service -split '_')[1] -replace '\.rs$', ''
        $service_struct = $service_name.Substring(0,1).ToUpper() + $service_name.Substring(1).ToLower() + "Service"
        
        $old_pattern = "pub struct $service_struct;"
        $new_struct = @"
#[derive(Clone)]
pub struct $service_struct {
    pub db: DatabaseConnection,
}
"@
        $content = $content -replace [regex]::Escape($old_pattern), $new_struct
        
        # 2. 添加构造函数
        $impl_pattern = "impl $service_struct \{"
        $new_impl = @"
impl $service_struct {
    /// 构造函数
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
"@
        $content = $content -replace [regex]::Escape($impl_pattern), $new_impl
        
        # 3. 添加 DatabaseConnection 导入（如果不存在）
        if ($content -notmatch "use sea_orm::DatabaseConnection") {
            $content = $content -replace "use anyhow::Result;", @"
use anyhow::Result;
use sea_orm::DatabaseConnection;
"@
        }
        
        Set-Content $file_path $content -Encoding UTF8
        
        Write-Host "  ✅ $service 修复完成" -ForegroundColor Green
    } else {
        Write-Host "  ❌ 文件不存在: $file_path" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎉 Service 结构修复完成！" -ForegroundColor Green
Write-Host "📋 下一步需要手动修复方法签名..." -ForegroundColor Yellow