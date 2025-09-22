# 查询店铺所有者详细信息
Write-Host "🚀 启动后端服务器..." -ForegroundColor Green

# 启动后端服务器（后台运行）
Start-Process -FilePath "cargo" -ArgumentList "run" -WorkingDirectory "E:\kefu\backend" -WindowStyle Hidden

# 等待服务器启动
Write-Host "⏳ 等待服务器启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 12

try {
    # 调用账号统计API
    Write-Host "📊 查询详细店铺和所有者信息..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/admin/stats" -Method GET
    
    Write-Host "✅ API调用成功！" -ForegroundColor Green
    
    # 分析店铺与所有者关系
    Write-Host "`n🏪 店铺与所有者关系分析:" -ForegroundColor Magenta
    Write-Host "=" * 60 -ForegroundColor Gray
    
    foreach ($shop in $response.data.shops) {
        Write-Host "`n📍 店铺: $($shop.name)" -ForegroundColor Yellow
        Write-Host "   ID: $($shop.id)" -ForegroundColor Gray
        Write-Host "   状态: $($shop.status)" -ForegroundColor $(if ($shop.status -eq "active") { "Green" } else { "Red" })
        Write-Host "   创建时间: $($shop.created_at)" -ForegroundColor Gray
        Write-Host "   所有者ID: $($shop.owner_id)" -ForegroundColor Cyan
        
        # 查找对应的管理员账号
        if ($shop.owner_id -and $shop.owner_id -ne "" -and $shop.owner_id -ne "default_owner") {
            $owner = $response.data.admins | Where-Object { $_.id -eq $shop.owner_id }
            if ($owner) {
                Write-Host "   👤 所有者用户名: $($owner.username)" -ForegroundColor Green
                Write-Host "   👤 所有者角色: $($owner.role)" -ForegroundColor Green
                Write-Host "   👤 账号创建时间: $($owner.created_at)" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  未找到对应的管理员账号!" -ForegroundColor Red
            }
        } else {
            Write-Host "   ⚠️  所有者ID为空或默认值!" -ForegroundColor Red
        }
        Write-Host "   " + "-" * 40 -ForegroundColor Gray
    }
    
    # 显示所有管理员账号
    Write-Host "`n👥 所有管理员账号列表:" -ForegroundColor Magenta
    Write-Host "=" * 60 -ForegroundColor Gray
    
    foreach ($admin in $response.data.admins) {
        Write-Host "`n👤 用户名: $($admin.username)" -ForegroundColor Cyan
        Write-Host "   ID: $($admin.id)" -ForegroundColor Gray
        Write-Host "   角色: $($admin.role)" -ForegroundColor $(if ($admin.role -eq "owner") { "Green" } else { "Yellow" })
        Write-Host "   创建时间: $($admin.created_at)" -ForegroundColor Gray
        
        # 检查是否拥有店铺
        $ownedShops = $response.data.shops | Where-Object { $_.owner_id -eq $admin.id }
        if ($ownedShops) {
            Write-Host "   🏪 拥有的店铺:" -ForegroundColor Green
            foreach ($ownedShop in $ownedShops) {
                Write-Host "      - $($ownedShop.name) (状态: $($ownedShop.status))" -ForegroundColor White
            }
        } else {
            Write-Host "   🚫 未拥有任何店铺" -ForegroundColor Red
        }
    }
    
    # 总结分析
    Write-Host "`n📋 数据关联性分析:" -ForegroundColor Magenta
    Write-Host "=" * 60 -ForegroundColor Gray
    $shopsWithValidOwners = $response.data.shops | Where-Object { $_.owner_id -and $_.owner_id -ne "" -and $_.owner_id -ne "default_owner" }
    $shopsWithoutOwners = $response.data.shops | Where-Object { -not $_.owner_id -or $_.owner_id -eq "" -or $_.owner_id -eq "default_owner" }
    
    Write-Host "📊 有明确所有者的店铺: $($shopsWithValidOwners.Count)" -ForegroundColor Green
    Write-Host "📊 无明确所有者的店铺: $($shopsWithoutOwners.Count)" -ForegroundColor Red
    Write-Host "📊 管理员账号总数: $($response.data.admins.Count)" -ForegroundColor Cyan
    
    if ($shopsWithoutOwners.Count -gt 0) {
        Write-Host "`n⚠️  发现数据问题:" -ForegroundColor Red
        Write-Host "   以下店铺没有明确的所有者ID:" -ForegroundColor Red
        foreach ($shop in $shopsWithoutOwners) {
            Write-Host "   - $($shop.name) (owner_id: '$($shop.owner_id)')" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "❌ API调用失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔚 分析完成" -ForegroundColor Green