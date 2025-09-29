# 聊天输入框增强功能验证脚本

Write-Host "🚀 开始验证聊天输入框增强功能..." -ForegroundColor Green

# 检查服务器是否运行
Write-Host "`n📊 检查服务器状态..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3030/api/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ 服务器运行正常 (端口 3030)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ 服务器未运行或无法访问" -ForegroundColor Red
    Write-Host "请确保运行: cd e:\kefu\backend && cargo run" -ForegroundColor Yellow
    exit 1
}

# 检查CSS模块文件
Write-Host "`n📁 检查CSS模块文件..." -ForegroundColor Yellow
$cssFile = "e:\kefu\static\css\chat-input-enhanced.css"
if (Test-Path $cssFile) {
    Write-Host "✅ CSS模块文件存在: $cssFile" -ForegroundColor Green
    $cssContent = Get-Content $cssFile -Raw
    if ($cssContent -match "\.chat-input-container" -and $cssContent -match "fixed") {
        Write-Host "✅ CSS包含固定定位样式" -ForegroundColor Green
    } else {
        Write-Host "⚠️  CSS可能缺少固定定位样式" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ CSS模块文件不存在" -ForegroundColor Red
}

# 检查JavaScript模块文件
Write-Host "`n📁 检查JavaScript模块文件..." -ForegroundColor Yellow
$jsFile = "e:\kefu\static\js\chat-input-enhanced.js"
if (Test-Path $jsFile) {
    Write-Host "✅ JavaScript模块文件存在: $jsFile" -ForegroundColor Green
    $jsContent = Get-Content $jsFile -Raw
    if ($jsContent -match "ChatInputEnhancer" -and $jsContent -match "autoResize") {
        Write-Host "✅ JavaScript包含增强功能" -ForegroundColor Green
    } else {
        Write-Host "⚠️  JavaScript可能缺少核心功能" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ JavaScript模块文件不存在" -ForegroundColor Red
}

# 检查移动端控制台集成
Write-Host "`n📱 检查移动端控制台集成..." -ForegroundColor Yellow
$mobileFile = "e:\kefu\backend\presentation\static\mobile-dashboard.html"
if (Test-Path $mobileFile) {
    Write-Host "✅ 移动端控制台文件存在" -ForegroundColor Green
    $mobileContent = Get-Content $mobileFile -Raw
    
    if ($mobileContent -match "chat-input-enhanced\.css") {
        Write-Host "✅ CSS模块已正确引入" -ForegroundColor Green
    } else {
        Write-Host "❌ CSS模块未引入" -ForegroundColor Red
    }
    
    if ($mobileContent -match "chat-input-enhanced\.js") {
        Write-Host "✅ JavaScript模块已正确引入" -ForegroundColor Green
    } else {
        Write-Host "❌ JavaScript模块未引入" -ForegroundColor Red
    }
} else {
    Write-Host "❌ 移动端控制台文件不存在" -ForegroundColor Red
}

# 检查测试页面
Write-Host "`n🧪 检查测试页面..." -ForegroundColor Yellow
$testFile = "e:\kefu\static\test\test-chat-input-enhanced.html"
if (Test-Path $testFile) {
    Write-Host "✅ 测试页面存在: $testFile" -ForegroundColor Green
} else {
    Write-Host "⚠️  测试页面不存在" -ForegroundColor Yellow
}

# 提供访问链接
Write-Host "`n🌐 可用访问链接:" -ForegroundColor Cyan
Write-Host "📱 移动端控制台: http://localhost:3030/mobile/dashboard" -ForegroundColor White
Write-Host "🧪 测试页面: http://localhost:3030/static/test/test-chat-input-enhanced.html" -ForegroundColor White
Write-Host "💊 健康检查: http://localhost:3030/api/health" -ForegroundColor White

# 功能验证提示
Write-Host "`n✨ 功能验证提示:" -ForegroundColor Magenta
Write-Host "1. 访问移动端控制台，检查输入框是否固定在底部" -ForegroundColor White
Write-Host "2. 尝试输入长文本，观察自动高度调整" -ForegroundColor White
Write-Host "3. 测试快速回复功能是否正常" -ForegroundColor White
Write-Host "4. 检查渐变背景和美化效果" -ForegroundColor White
Write-Host "5. 验证触摸反馈和动画效果" -ForegroundColor White

Write-Host "`n🎉 验证脚本运行完成!" -ForegroundColor Green
Write-Host "如果所有检查都通过，说明聊天输入框增强功能已成功实现！" -ForegroundColor Green