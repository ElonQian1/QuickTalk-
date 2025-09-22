# 修复店铺所有者关联数据
Write-Host "🚀 启动后端服务器..." -ForegroundColor Green

# 启动后端服务器（后台运行）
Start-Process -FilePath "cargo" -ArgumentList "run" -WorkingDirectory "E:\kefu\backend" -WindowStyle Hidden

# 等待服务器启动
Write-Host "⏳ 等待服务器启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 12

try {
    # 先查看修复前的状态
    Write-Host "📊 修复前的店铺状态..." -ForegroundColor Cyan
    $beforeResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/stats" -Method GET
    
    Write-Host "修复前的店铺:" -ForegroundColor Yellow
    foreach ($shop in $beforeResponse.data.shops) {
        Write-Host "  - $($shop.name): owner_id='$($shop.owner_id)'" -ForegroundColor White
    }
    
    # 执行数据修复
    Write-Host "`n🔧 执行数据修复..." -ForegroundColor Magenta
    $fixResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/fix-owners" -Method POST
    
    Write-Host "✅ 修复操作完成！" -ForegroundColor Green
    Write-Host "修复结果:" -ForegroundColor White
    $fixResponse | ConvertTo-Json -Depth 10 | Write-Host
    
    # 再次查看修复后的状态
    Write-Host "`n📊 修复后的店铺状态..." -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    $afterResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/stats" -Method GET
    
    Write-Host "修复后的店铺:" -ForegroundColor Green
    foreach ($shop in $afterResponse.data.shops) {
        # 查找对应的管理员
        $owner = $afterResponse.data.admins | Where-Object { $_.id -eq $shop.owner_id }
        $ownerName = if ($owner) { $owner.username } else { "未知用户" }
        Write-Host "  - $($shop.name): owner_id='$($shop.owner_id)' (用户: $ownerName)" -ForegroundColor White
    }
    
    # 显示修复统计
    Write-Host "`n📋 修复统计:" -ForegroundColor Magenta
    Write-Host "  修复成功: $($fixResponse.data.fixed_count) 个店铺" -ForegroundColor Green
    Write-Host "  修复失败: $($fixResponse.data.error_count) 个店铺" -ForegroundColor Red
    Write-Host "  默认所有者ID: $($fixResponse.data.default_owner_id)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ 操作失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔚 数据修复完成" -ForegroundColor Green