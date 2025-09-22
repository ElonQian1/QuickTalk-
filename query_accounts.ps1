# 启动后端服务器并查询账号统计
Write-Host "🚀 启动后端服务器..." -ForegroundColor Green

# 启动后端服务器（后台运行）
Start-Process -FilePath "cargo" -ArgumentList "run" -WorkingDirectory "E:\kefu\backend" -WindowStyle Hidden

# 等待服务器启动
Write-Host "⏳ 等待服务器启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

try {
    # 调用账号统计API
    Write-Host "📊 查询账号统计..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/stats" -Method GET
    
    Write-Host "✅ API调用成功！" -ForegroundColor Green
    Write-Host "📊 账号统计结果:" -ForegroundColor White
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
    # 显示摘要信息
    Write-Host "`n📋 摘要信息:" -ForegroundColor Magenta
    Write-Host "  管理员账号数量: $($response.data.summary.total_accounts)" -ForegroundColor White
    Write-Host "  店铺数量: $($response.data.summary.total_shops)" -ForegroundColor White  
    Write-Host "  客户数量: $($response.data.summary.total_customers)" -ForegroundColor White
    Write-Host "  所有账号独立: $($response.data.independence_check.all_accounts_independent)" -ForegroundColor Green
    
} catch {
    Write-Host "❌ API调用失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔚 脚本执行完成" -ForegroundColor Green