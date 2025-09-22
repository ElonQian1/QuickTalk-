#!/usr/bin/env pwsh
# 测试移动端dashboard新建店铺功能
# 这个脚本测试完整的流程: 创建店铺 -> 自动切换到店铺tab -> 显示新店铺

Write-Host "🧪 开始测试移动端dashboard新建店铺功能..." -ForegroundColor Green

# 1. 测试服务器健康状态
Write-Host "`n1️⃣ 测试服务器状态..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/health" -Method GET
    Write-Host "✅ 服务器状态: $($healthResponse.data.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ 服务器未启动或连接失败" -ForegroundColor Red
    Write-Host "请先启动服务器: cd backend && cargo run" -ForegroundColor Red
    exit 1
}

# 2. 测试当前店铺列表（创建前）
Write-Host "`n2️⃣ 获取当前店铺列表..." -ForegroundColor Yellow
try {
    $shopsBefore = Invoke-RestMethod -Uri "http://localhost:3030/api/shops" -Method GET
    Write-Host "📊 创建前店铺数量: $($shopsBefore.data.Count)" -ForegroundColor Blue
} catch {
    Write-Host "⚠️ 无法获取店铺列表" -ForegroundColor Yellow
}

# 3. 模拟创建新店铺
Write-Host "`n3️⃣ 创建测试店铺..." -ForegroundColor Yellow
$testShop = @{
    name = "测试店铺$(Get-Date -Format 'HHmmss')"
    domain = "test$(Get-Date -Format 'HHmmss').example.com"
    description = "自动化测试创建的店铺"
}

try {
    $createResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/shops" -Method POST -Body ($testShop | ConvertTo-Json) -ContentType "application/json"
    
    if ($createResponse.success) {
        Write-Host "✅ 店铺创建成功!" -ForegroundColor Green
        Write-Host "   店铺名称: $($testShop.name)" -ForegroundColor Cyan
        Write-Host "   店铺域名: $($testShop.domain)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ 店铺创建失败: $($createResponse.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 创建店铺API调用失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. 验证店铺是否出现在列表中
Write-Host "`n4️⃣ 验证新店铺是否在列表中..." -ForegroundColor Yellow
Start-Sleep -Seconds 1

try {
    $shopsAfter = Invoke-RestMethod -Uri "http://localhost:3030/api/shops" -Method GET
    Write-Host "📊 创建后店铺数量: $($shopsAfter.data.Count)" -ForegroundColor Blue
    
    # 查找刚创建的店铺
    $newShop = $shopsAfter.data | Where-Object { $_.name -eq $testShop.name }
    if ($newShop) {
        Write-Host "✅ 新店铺已出现在列表中!" -ForegroundColor Green
        Write-Host "   ID: $($newShop.id)" -ForegroundColor Cyan
        Write-Host "   状态: $($newShop.status)" -ForegroundColor Cyan
        Write-Host "   所有者: $($newShop.owner_id)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ 新店铺未在列表中找到" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 获取更新后的店铺列表失败" -ForegroundColor Red
}

# 5. 打开浏览器测试前端
Write-Host "`n5️⃣ 提示前端测试..." -ForegroundColor Yellow
Write-Host "📱 请在浏览器中访问: http://localhost:3030/mobile/dashboard" -ForegroundColor Cyan
Write-Host "🔄 测试步骤:" -ForegroundColor Cyan
Write-Host "   1. 点击'新建店铺'按钮" -ForegroundColor White
Write-Host "   2. 填写店铺信息并提交" -ForegroundColor White
Write-Host "   3. 检查是否自动切换到'店铺'tab" -ForegroundColor White
Write-Host "   4. 验证新店铺是否显示为'待审核'状态" -ForegroundColor White

Write-Host "`n✅ API测试完成！" -ForegroundColor Green