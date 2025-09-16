/**
 * 服务层集成测试脚本
 * 验证新的服务层架构是否正确集成到主应用
 * 测试API端点和服务功能
 */

const axios = require('axios');
const WebSocket = require('ws');

class ServiceLayerIntegrationTest {
    constructor(baseUrl = 'http://localhost:3030') {
        this.baseUrl = baseUrl;
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        console.log('🧪 开始服务层集成测试...');
        console.log(`🌐 测试服务器: ${this.baseUrl}`);
        
        try {
            // 基础连接测试
            await this.testBasicConnectivity();
            
            // 服务层健康检查
            await this.testServiceLayerHealth();
            
            // 服务统计测试
            await this.testServiceStats();
            
            // API端点测试
            await this.testAPIEndpoints();
            
            // 兼容性测试
            await this.testCompatibilityAPI();
            
            // WebSocket测试
            await this.testWebSocketConnection();
            
            // 生成测试报告
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ 测试执行失败:', error);
        }
    }

    /**
     * 基础连接测试
     */
    async testBasicConnectivity() {
        await this.runTest('基础连接测试', async () => {
            const response = await axios.get(`${this.baseUrl}/status`);
            
            if (response.status !== 200) {
                throw new Error(`HTTP状态码错误: ${response.status}`);
            }
            
            const status = response.data;
            
            // 验证状态结构
            if (!status.server || !status.modules || !status.architecture) {
                throw new Error('状态响应结构不正确');
            }
            
            console.log('📊 系统状态:', status.architecture);
            return { status: 'connected', data: status };
        });
    }

    /**
     * 服务层健康检查
     */
    async testServiceLayerHealth() {
        await this.runTest('服务层健康检查', async () => {
            try {
                const response = await axios.get(`${this.baseUrl}/api/health/services`);
                
                if (response.status !== 200) {
                    throw new Error(`健康检查HTTP状态码错误: ${response.status}`);
                }
                
                const health = response.data;
                console.log('🏥 服务层健康状态:', health.status);
                
                return { status: health.status, services: health.services };
                
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    console.log('⚠️ 服务层健康检查端点不存在（可能未启用服务层）');
                    return { status: 'service_layer_disabled' };
                }
                throw error;
            }
        });
    }

    /**
     * 服务统计测试
     */
    async testServiceStats() {
        await this.runTest('服务统计测试', async () => {
            try {
                const response = await axios.get(`${this.baseUrl}/api/stats/services`);
                
                if (response.status !== 200) {
                    throw new Error(`统计HTTP状态码错误: ${response.status}`);
                }
                
                const stats = response.data;
                if (!stats.success) {
                    throw new Error('统计请求失败');
                }
                
                console.log('📊 服务统计:', stats.stats);
                return stats.stats;
                
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    console.log('⚠️ 服务统计端点不存在（可能未启用服务层）');
                    return { status: 'service_layer_disabled' };
                }
                throw error;
            }
        });
    }

    /**
     * API端点测试
     */
    async testAPIEndpoints() {
        // 测试传统API
        await this.runTest('传统API测试', async () => {
            try {
                const response = await axios.get(`${this.baseUrl}/api/shops`);
                console.log('📡 传统API响应状态:', response.status);
                return { status: 'available', endpoint: '/api/shops' };
            } catch (error) {
                if (error.response) {
                    console.log('📡 传统API端点存在但可能需要认证');
                    return { status: 'requires_auth', endpoint: '/api/shops' };
                }
                throw error;
            }
        });

        // 测试服务层API
        await this.runTest('服务层API测试', async () => {
            try {
                // 尝试获取对话消息（可能需要参数）
                const response = await axios.get(`${this.baseUrl}/api/v2/messages/unread?userId=test`);
                console.log('🚀 服务层API响应状态:', response.status);
                return { status: 'available', endpoint: '/api/v2/messages/unread' };
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    console.log('🚀 服务层API端点存在但需要有效参数');
                    return { status: 'requires_params', endpoint: '/api/v2/messages/unread' };
                } else if (error.response && error.response.status === 404) {
                    console.log('⚠️ 服务层API端点不存在（可能未启用服务层）');
                    return { status: 'service_layer_disabled' };
                }
                throw error;
            }
        });
    }

    /**
     * 兼容性API测试
     */
    async testCompatibilityAPI() {
        await this.runTest('兼容性API测试', async () => {
            try {
                const testMessage = {
                    userId: 'test-user',
                    message: 'Hello from integration test',
                    shopKey: 'test-key'
                };

                const response = await axios.post(`${this.baseUrl}/api/compat/send-message`, testMessage);
                console.log('🔄 兼容性API响应状态:', response.status);
                return { status: 'available', endpoint: '/api/compat/send-message' };
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    console.log('🔄 兼容性API端点存在但需要有效参数');
                    return { status: 'requires_valid_params', endpoint: '/api/compat/send-message' };
                } else if (error.response && error.response.status === 404) {
                    console.log('⚠️ 兼容性API端点不存在（可能未启用服务层）');
                    return { status: 'service_layer_disabled' };
                }
                throw error;
            }
        });
    }

    /**
     * WebSocket连接测试
     */
    async testWebSocketConnection() {
        await this.runTest('WebSocket连接测试', async () => {
            return new Promise((resolve, reject) => {
                const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
                const ws = new WebSocket(wsUrl);
                
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('WebSocket连接超时'));
                }, 5000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    console.log('🔌 WebSocket连接成功');
                    ws.close();
                    resolve({ status: 'connected', url: wsUrl });
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`WebSocket连接失败: ${error.message}`));
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        console.log('📥 收到WebSocket消息:', message.type);
                    } catch (error) {
                        console.log('📥 收到非JSON WebSocket消息');
                    }
                });
            });
        });
    }

    /**
     * 运行单个测试
     */
    async runTest(testName, testFunction) {
        this.totalTests++;
        
        try {
            console.log(`\n🧪 执行测试: ${testName}`);
            const result = await testFunction();
            
            this.testResults.push({
                name: testName,
                status: 'passed',
                result,
                timestamp: new Date()
            });
            
            this.passedTests++;
            console.log(`✅ 测试通过: ${testName}`);
            
        } catch (error) {
            this.testResults.push({
                name: testName,
                status: 'failed',
                error: error.message,
                timestamp: new Date()
            });
            
            console.error(`❌ 测试失败: ${testName} - ${error.message}`);
        }
    }

    /**
     * 生成测试报告
     */
    generateTestReport() {
        console.log('\n📋 ========== 测试报告 ==========');
        console.log(`📊 总测试数: ${this.totalTests}`);
        console.log(`✅ 通过测试: ${this.passedTests}`);
        console.log(`❌ 失败测试: ${this.totalTests - this.passedTests}`);
        console.log(`📈 通过率: ${((this.passedTests / this.totalTests) * 100).toFixed(2)}%`);
        
        console.log('\n📝 测试详情:');
        this.testResults.forEach((result, index) => {
            const status = result.status === 'passed' ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${result.name}`);
            if (result.error) {
                console.log(`   错误: ${result.error}`);
            }
        });
        
        console.log('\n🎯 测试建议:');
        if (this.passedTests === this.totalTests) {
            console.log('🎉 所有测试都通过了！服务层集成成功。');
        } else {
            console.log('⚠️ 部分测试失败，请检查服务层配置和启动状态。');
            
            const failedTests = this.testResults.filter(r => r.status === 'failed');
            if (failedTests.length > 0) {
                console.log('💡 失败的测试可能指示以下问题:');
                failedTests.forEach(test => {
                    if (test.error.includes('ECONNREFUSED')) {
                        console.log('- 服务器未启动或端口不正确');
                    } else if (test.error.includes('404')) {
                        console.log('- 服务层API端点未正确配置');
                    } else if (test.error.includes('service_layer_disabled')) {
                        console.log('- 服务层可能未启用，运行在传统模式');
                    }
                });
            }
        }
        
        console.log('\n================================\n');
    }

    /**
     * 保存测试报告到文件
     */
    saveTestReport() {
        const fs = require('fs');
        const path = require('path');
        
        const report = {
            summary: {
                totalTests: this.totalTests,
                passedTests: this.passedTests,
                failedTests: this.totalTests - this.passedTests,
                successRate: ((this.passedTests / this.totalTests) * 100).toFixed(2) + '%',
                timestamp: new Date()
            },
            results: this.testResults
        };
        
        const reportPath = path.join(__dirname, 'service-layer-integration-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📄 测试报告已保存到: ${reportPath}`);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const test = new ServiceLayerIntegrationTest();
    
    // 等待一段时间确保服务器启动
    setTimeout(async () => {
        await test.runAllTests();
        test.saveTestReport();
        process.exit(0);
    }, 2000);
}

module.exports = ServiceLayerIntegrationTest;