# 最终验证脚本 - 确认所有修复都已完成
Write-Host "🎯 开始最终数据验证..." -ForegroundColor Green

try {
    # 1. 获取账号统计
    Write-Host "`n📊 获取账号统计..." -ForegroundColor Cyan
    $stats = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/stats" -Method GET
    
    # 2. 验证店铺所有者关联
    Write-Host "`n🏪 验证店铺所有者关联:" -ForegroundColor Yellow
    $allShopsValid = $true
    foreach ($shop in $stats.data.shops) {
        $owner = $stats.data.admins | Where-Object { $_.id -eq $shop.owner_id }
        if ($owner) {
            Write-Host "  ✅ $($shop.name) → 所有者: $($owner.username) ($($owner.role))" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $($shop.name) → 无效的所有者ID: $($shop.owner_id)" -ForegroundColor Red
            $allShopsValid = $false
        }
    }
    
    # 3. 运行数据完整性验证
    Write-Host "`n🔍 运行数据完整性验证..." -ForegroundColor Cyan
    $validation = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/validate" -Method GET
    
    # 4. 显示验证结果
    Write-Host "`n📋 验证结果总结:" -ForegroundColor Magenta
    Write-Host "=" * 50 -ForegroundColor Gray
    Write-Host "  账号总数: $($stats.data.summary.total_accounts)" -ForegroundColor White
    Write-Host "  店铺总数: $($stats.data.summary.total_shops)" -ForegroundColor White
    Write-Host "  客户总数: $($stats.data.summary.total_customers)" -ForegroundColor White
    Write-Host "  数据完整性: $($validation.data.summary.status)" -ForegroundColor $(if ($validation.data.is_valid) { "Green" } else { "Red" })
    Write-Host "  验证错误: $($validation.data.summary.error_count)" -ForegroundColor $(if ($validation.data.summary.error_count -eq 0) { "Green" } else { "Red" })
    Write-Host "  验证警告: $($validation.data.summary.warning_count)" -ForegroundColor $(if ($validation.data.summary.warning_count -eq 0) { "Green" } else { "Yellow" })
    Write-Host "  店铺关联: $(if ($allShopsValid) { '全部有效' } else { '存在问题' })" -ForegroundColor $(if ($allShopsValid) { "Green" } else { "Red" })
    
    # 5. 最终状态判断
    $overallSuccess = $validation.data.is_valid -and $allShopsValid
    
    Write-Host "`n🎉 修复结果:" -ForegroundColor Magenta
    if ($overallSuccess) {
        Write-Host "  ✅ 所有数据问题已成功修复！" -ForegroundColor Green
        Write-Host "  ✅ 店铺创建逻辑已优化！" -ForegroundColor Green
        Write-Host "  ✅ 数据验证机制已建立！" -ForegroundColor Green
    } else {
        Write-Host "  ❌ 仍存在数据问题需要处理" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ 验证过程出错: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔚 最终验证完成" -ForegroundColor Green