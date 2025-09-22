# 简化的数据修复测试
Write-Host "⏳ 等待服务器启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "🔧 调用数据修复API..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/fix-owners" -Method POST
    Write-Host "✅ 修复成功！" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ 修复失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "响应状态: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
}