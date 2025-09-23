# 完全重置数据库到干净状态
Write-Host "🧹 完全重置数据库，创建干净的测试环境..." -ForegroundColor Yellow

Start-Sleep 10

try {
    # 1. 完全清理所有数据（包括您的账号）
    Write-Host "🗑️ 清理所有现有数据..." -ForegroundColor Cyan
    
    # 创建一个临时的清理请求（不保留任何用户）
    $cleanupRequest = @{ keep_username = "NONE_DELETE_ALL" } | ConvertTo-Json
    $cleanupResult = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/clean-test-data" -Method POST -Body $cleanupRequest -ContentType "application/json"
    
    Write-Host "✅ 数据清理结果:" -ForegroundColor Green
    $cleanupResult.data.cleanup_results | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    
    if ($cleanupResult.data.errors.Count -gt 0) {
        Write-Host "⚠️ 清理过程中的问题:" -ForegroundColor Yellow
        $cleanupResult.data.errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    
    # 2. 强制清理店铺
    Write-Host "`n🔨 强制清理所有店铺..." -ForegroundColor Cyan
    $forceCleanResult = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/force-clean-shops" -Method POST
    
    Write-Host "✅ 店铺清理结果:" -ForegroundColor Green
    $forceCleanResult.data.cleanup_results | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    
    # 3. 验证清理结果
    Write-Host "`n📊 验证清理结果..." -ForegroundColor Cyan
    Start-Sleep 2
    $finalStats = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/stats" -Method GET
    
    Write-Host "`n🎯 数据库当前状态:" -ForegroundColor Magenta
    Write-Host "  账号总数: $($finalStats.data.summary.total_accounts)" -ForegroundColor White
    Write-Host "  店铺总数: $($finalStats.data.summary.total_shops)" -ForegroundColor White
    Write-Host "  客户总数: $($finalStats.data.summary.total_customers)" -ForegroundColor White
    
    if ($finalStats.data.summary.total_accounts -eq 0 -and $finalStats.data.summary.total_shops -eq 0) {
        Write-Host "`n✅ 完美！数据库已完全清空" -ForegroundColor Green
        Write-Host "✅ 现在您可以创建新账号进行纯净的功能测试" -ForegroundColor Green
        Write-Host "✅ 新账号不会看到任何历史数据" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ 还有一些数据残留:" -ForegroundColor Yellow
        if ($finalStats.data.admins.Count -gt 0) {
            Write-Host "  剩余账号:" -ForegroundColor Yellow
            $finalStats.data.admins | ForEach-Object { Write-Host "    - $($_.username)" -ForegroundColor Red }
        }
        if ($finalStats.data.shops.Count -gt 0) {
            Write-Host "  剩余店铺:" -ForegroundColor Yellow
            $finalStats.data.shops | ForEach-Object { Write-Host "    - $($_.name)" -ForegroundColor Red }
        }
    }
    
} catch {
    Write-Host "❌ 清理过程出错: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔚 数据库重置完成，可以开始干净的功能测试了！" -ForegroundColor Green