/**
 * message-functionality-validator.js
 * 消息功能完整性验证器
 * 
 * 目的：小步快跑验证核心消息功能的完整性
 * 检查项：发送、接收、文件上传、语音录制、实时更新等
 */
(function(){
    'use strict';
    
    const VALIDATION_RESULTS = {
        messageInput: false,
        messageSending: false,
        messageReceiving: false,
        fileUpload: false,
        voiceRecording: false,
        realTimeUpdates: false,
        mobileAdaptation: false,
        responsiveDesign: false
    };
    
    /**
     * 验证消息输入功能
     */
    function validateMessageInput() {
        const inputElement = document.getElementById('chatInput');
        const sendButton = document.querySelector('.mobile-chat-send-btn, .send-btn, [data-action="send"]');
        
        if (!inputElement) {
            console.warn('❌ 消息输入框不存在');
            return false;
        }
        
        if (!sendButton) {
            console.warn('❌ 发送按钮不存在');
            return false;
        }
        
        // 检查输入框是否响应
        const originalValue = inputElement.value;
        inputElement.value = 'test';
        const canInput = inputElement.value === 'test';
        inputElement.value = originalValue;
        
        if (!canInput) {
            console.warn('❌ 消息输入框无法输入文本');
            return false;
        }
        
        console.log('✅ 消息输入功能正常');
        return true;
    }
    
    /**
     * 验证消息发送功能
     */
    function validateMessageSending() {
        const messageModule = window.MessageModuleInstance || window.messageModule;
        const sendChannel = window.MessageSendChannelInstance;
        const messagesManager = window.MessagesManager;
        
        if (!messageModule && !sendChannel && !messagesManager) {
            console.warn('❌ 消息发送模块不存在');
            return false;
        }
        
        if (messageModule && typeof messageModule.sendMessage !== 'function') {
            console.warn('❌ MessageModule.sendMessage 方法不存在');
            return false;
        }
        
        if (sendChannel && typeof sendChannel.sendText !== 'function') {
            console.warn('❌ SendChannel.sendText 方法不存在');
            return false;
        }
        
        console.log('✅ 消息发送功能模块存在');
        return true;
    }
    
    /**
     * 验证WebSocket实时更新
     */
    function validateRealTimeUpdates() {
        const wsAdapter = window.MessageWSAdapter || window.MessageWSHandler;
        const wsRouter = window.WsEventRouter;
        
        if (!wsAdapter && !wsRouter) {
            console.warn('❌ WebSocket适配器不存在');
            return false;
        }
        
        // 检查WebSocket连接状态
        const ws = window.websocket || (wsAdapter && wsAdapter._ws);
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('✅ WebSocket连接正常');
            return true;
        } else if (ws && ws.readyState === WebSocket.CONNECTING) {
            console.log('⏳ WebSocket正在连接中');
            return true;
        } else {
            console.warn('⚠️ WebSocket连接异常或未建立');
            return false;
        }
    }
    
    /**
     * 验证文件上传功能
     */
    function validateFileUpload() {
        const mediaHandler = window.MediaHandler;
        const fileInput = document.querySelector('input[type="file"], [data-action="upload"]');
        
        if (!mediaHandler && !fileInput) {
            console.warn('❌ 文件上传功能不存在');
            return false;
        }
        
        if (mediaHandler && typeof mediaHandler.uploadFile === 'function') {
            console.log('✅ 文件上传模块存在');
            return true;
        }
        
        console.log('⚠️ 文件上传功能部分存在');
        return true;
    }
    
    /**
     * 验证语音录制功能
     */
    function validateVoiceRecording() {
        const mediaHandler = window.MediaHandler;
        const voiceButton = document.querySelector('[data-action="voice"], .voice-btn');
        
        if (!mediaHandler && !voiceButton) {
            console.warn('❌ 语音录制功能不存在');
            return false;
        }
        
        if (mediaHandler && typeof mediaHandler.toggleVoiceRecording === 'function') {
            console.log('✅ 语音录制模块存在');
            return true;
        }
        
        console.log('⚠️ 语音录制功能部分存在');
        return true;
    }
    
    /**
     * 验证移动端适配
     */
    function validateMobileAdaptation() {
        const mobileAdapter = window.MobileMessageViewAdapter;
        const isMobile = window.innerWidth <= 820;
        
        if (!isMobile) {
            console.log('ℹ️ 当前非移动端环境');
            return true;
        }
        
        if (!mobileAdapter) {
            console.warn('❌ 移动端消息视图适配器不存在');
            return false;
        }
        
        // 检查移动端样式是否生效
        const mobileStyles = document.getElementById('mobile-message-view-adapter-styles');
        if (!mobileStyles) {
            console.warn('❌ 移动端适配样式未加载');
            return false;
        }
        
        console.log('✅ 移动端适配功能正常');
        return true;
    }
    
    /**
     * 验证响应式设计
     */
    function validateResponsiveDesign() {
        const responsiveLayout = document.querySelector('link[href*="responsive-layout.css"]');
        const responsiveMessages = document.querySelector('link[href*="responsive-messages.css"]');
        
        if (!responsiveLayout || !responsiveMessages) {
            console.warn('❌ 响应式CSS文件缺失');
            return false;
        }
        
        // 检查响应式类是否存在
        const appContainer = document.querySelector('.app-container');
        if (!appContainer) {
            console.warn('❌ 响应式容器不存在');
            return false;
        }
        
        console.log('✅ 响应式设计基础存在');
        return true;
    }
    
    /**
     * 验证消息接收功能
     */
    function validateMessageReceiving() {
        const messagesContainer = document.getElementById('chatMessages');
        const messageRenderer = window.MessageRenderer || window.MessageRenderAdapter;
        
        if (!messagesContainer) {
            console.warn('❌ 消息容器不存在');
            return false;
        }
        
        if (!messageRenderer) {
            console.warn('❌ 消息渲染器不存在');
            return false;
        }
        
        console.log('✅ 消息接收和渲染功能存在');
        return true;
    }
    
    /**
     * 运行所有验证
     */
    function runValidation() {
        console.log('🔍 开始验证消息功能完整性...');
        
        VALIDATION_RESULTS.messageInput = validateMessageInput();
        VALIDATION_RESULTS.messageSending = validateMessageSending();
        VALIDATION_RESULTS.messageReceiving = validateMessageReceiving();
        VALIDATION_RESULTS.fileUpload = validateFileUpload();
        VALIDATION_RESULTS.voiceRecording = validateVoiceRecording();
        VALIDATION_RESULTS.realTimeUpdates = validateRealTimeUpdates();
        VALIDATION_RESULTS.mobileAdaptation = validateMobileAdaptation();
        VALIDATION_RESULTS.responsiveDesign = validateResponsiveDesign();
        
        // 生成报告
        generateReport();
    }
    
    /**
     * 生成验证报告
     */
    function generateReport() {
        console.log('\n📊 消息功能验证报告:');
        console.log('=====================================');
        
        let passCount = 0;
        let totalCount = 0;
        
        for (const [feature, status] of Object.entries(VALIDATION_RESULTS)) {
            totalCount++;
            if (status) passCount++;
            
            const icon = status ? '✅' : '❌';
            const featureName = getFeatureName(feature);
            console.log(`${icon} ${featureName}: ${status ? '正常' : '异常'}`);
        }
        
        console.log('=====================================');
        console.log(`总计: ${passCount}/${totalCount} 项功能正常`);
        
        const percentage = Math.round((passCount / totalCount) * 100);
        console.log(`完整性: ${percentage}%`);
        
        if (percentage >= 80) {
            console.log('🎉 消息功能基本完整，可以继续优化');
        } else if (percentage >= 60) {
            console.log('⚠️ 消息功能部分缺失，需要修复');
        } else {
            console.log('🚨 消息功能严重缺失，需要重点修复');
        }
        
        return VALIDATION_RESULTS;
    }
    
    /**
     * 获取功能名称
     */
    function getFeatureName(key) {
        const names = {
            messageInput: '消息输入',
            messageSending: '消息发送',
            messageReceiving: '消息接收',
            fileUpload: '文件上传',
            voiceRecording: '语音录制',
            realTimeUpdates: '实时更新',
            mobileAdaptation: '移动端适配',
            responsiveDesign: '响应式设计'
        };
        return names[key] || key;
    }
    
    // 暴露到全局
    window.MessageFunctionalityValidator = {
        runValidation,
        getResults: () => ({ ...VALIDATION_RESULTS }),
        validateMessageInput,
        validateMessageSending,
        validateMessageReceiving,
        validateFileUpload,
        validateVoiceRecording,
        validateRealTimeUpdates,
        validateMobileAdaptation,
        validateResponsiveDesign
    };
    
    // 自动运行验证（延迟执行，确保所有模块已加载）
    if (document.readyState === 'complete') {
        setTimeout(runValidation, 1000);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runValidation, 1000);
        });
    }
    
})();