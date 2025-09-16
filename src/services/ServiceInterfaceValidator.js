/**
 * 服务接口验证工具
 * 验证所有服务是否正确实现了定义的接口契约
 * 提供测试支持和接口一致性检查
 */

const {
    IMessageService,
    IConversationService,
    IShopService,
    INotificationService,
    IKnowledgeBaseService,
    IIntentClassificationService,
    IAutoReplyService,
    IServiceManager,
    IServiceFactory,
    validateServiceInterface,
    createMockService
} = require('./interfaces');

class ServiceInterfaceValidator {
    constructor() {
        this.validationResults = new Map();
        this.interfaceMapping = new Map([
            ['MessageService', IMessageService],
            ['ConversationService', IConversationService],
            ['ShopService', IShopService],
            ['NotificationService', INotificationService],
            ['KnowledgeBaseService', IKnowledgeBaseService],
            ['IntentClassificationService', IIntentClassificationService],
            ['AutoReplyService', IAutoReplyService],
            ['ServiceManager', IServiceManager],
            ['ServiceFactory', IServiceFactory]
        ]);
    }

    /**
     * 验证单个服务
     * @param {Object} service - 服务实例
     * @param {string} serviceName - 服务名称
     * @returns {Object} 验证结果
     */
    validateService(service, serviceName) {
        try {
            const interfaceClass = this.interfaceMapping.get(serviceName);
            if (!interfaceClass) {
                throw new Error(`No interface definition found for service: ${serviceName}`);
            }

            // 验证接口实现
            validateServiceInterface(service, interfaceClass);

            const result = {
                serviceName,
                isValid: true,
                missingMethods: [],
                implementedMethods: this.getImplementedMethods(service),
                timestamp: new Date()
            };

            this.validationResults.set(serviceName, result);
            console.log(`✅ 服务接口验证通过: ${serviceName}`);
            
            return result;

        } catch (error) {
            const result = {
                serviceName,
                isValid: false,
                error: error.message,
                missingMethods: this.extractMissingMethods(error.message),
                implementedMethods: this.getImplementedMethods(service),
                timestamp: new Date()
            };

            this.validationResults.set(serviceName, result);
            console.error(`❌ 服务接口验证失败: ${serviceName} - ${error.message}`);
            
            return result;
        }
    }

    /**
     * 验证所有服务
     * @param {Object} services - 服务实例映射
     * @returns {Object} 验证报告
     */
    validateAllServices(services) {
        console.log('🔍 开始验证所有服务接口...');
        
        const results = [];
        let validCount = 0;
        let invalidCount = 0;

        for (const [serviceName, service] of Object.entries(services)) {
            if (service && typeof service === 'object') {
                const result = this.validateService(service, serviceName);
                results.push(result);
                
                if (result.isValid) {
                    validCount++;
                } else {
                    invalidCount++;
                }
            }
        }

        const report = {
            summary: {
                total: results.length,
                valid: validCount,
                invalid: invalidCount,
                successRate: results.length > 0 ? (validCount / results.length * 100).toFixed(2) + '%' : '0%'
            },
            results,
            timestamp: new Date()
        };

        console.log(`📊 服务接口验证完成: ${validCount}/${results.length} 通过`);
        
        return report;
    }

    /**
     * 验证服务管理器
     * @param {Object} serviceManager - 服务管理器实例
     * @returns {Object} 验证结果
     */
    validateServiceManager(serviceManager) {
        console.log('🔍 验证服务管理器接口...');
        
        try {
            const services = serviceManager.getAllServices();
            const managerValidation = this.validateService(serviceManager, 'ServiceManager');
            const servicesValidation = this.validateAllServices(services);

            return {
                serviceManager: managerValidation,
                services: servicesValidation,
                overallValid: managerValidation.isValid && servicesValidation.summary.invalid === 0
            };

        } catch (error) {
            console.error('❌ 服务管理器验证失败:', error);
            return {
                serviceManager: { isValid: false, error: error.message },
                services: { summary: { invalid: -1 } },
                overallValid: false
            };
        }
    }

    /**
     * 生成模拟服务
     * @param {string} serviceName - 服务名称
     * @returns {Object} 模拟服务实例
     */
    generateMockService(serviceName) {
        const interfaceClass = this.interfaceMapping.get(serviceName);
        if (!interfaceClass) {
            throw new Error(`No interface definition found for service: ${serviceName}`);
        }

        console.log(`🎭 生成模拟服务: ${serviceName}`);
        return createMockService(interfaceClass);
    }

    /**
     * 生成所有模拟服务
     * @returns {Object} 所有模拟服务
     */
    generateAllMockServices() {
        console.log('🎭 生成所有模拟服务...');
        
        const mockServices = {};
        
        for (const serviceName of this.interfaceMapping.keys()) {
            if (serviceName !== 'ServiceManager' && serviceName !== 'ServiceFactory') {
                mockServices[serviceName.toLowerCase()] = this.generateMockService(serviceName);
            }
        }

        console.log(`✅ 已生成 ${Object.keys(mockServices).length} 个模拟服务`);
        return mockServices;
    }

    /**
     * 创建测试套件
     * @param {Object} services - 服务实例
     * @returns {Object} 测试套件
     */
    createTestSuite(services) {
        return {
            // 基础接口测试
            testBasicInterface: (serviceName) => {
                const service = services[serviceName];
                if (!service) {
                    throw new Error(`Service not found: ${serviceName}`);
                }

                const validation = this.validateService(service, serviceName);
                if (!validation.isValid) {
                    throw new Error(`Service interface validation failed: ${validation.error}`);
                }

                return validation;
            },

            // 健康检查测试
            testHealthCheck: async (serviceName) => {
                const service = services[serviceName];
                if (!service || typeof service.healthCheck !== 'function') {
                    throw new Error(`Service ${serviceName} does not implement healthCheck`);
                }

                try {
                    const result = await service.healthCheck();
                    return { serviceName, healthCheck: result, success: true };
                } catch (error) {
                    return { serviceName, healthCheck: null, success: false, error: error.message };
                }
            },

            // 初始化测试
            testInitialization: async (serviceName, config = {}) => {
                const service = services[serviceName];
                if (!service || typeof service.initialize !== 'function') {
                    throw new Error(`Service ${serviceName} does not implement initialize`);
                }

                try {
                    await service.initialize(config);
                    return { serviceName, initialization: true, success: true };
                } catch (error) {
                    return { serviceName, initialization: false, success: false, error: error.message };
                }
            },

            // 完整测试套件
            runCompleteTest: async () => {
                const results = {
                    interfaceValidation: {},
                    healthChecks: {},
                    initialization: {},
                    summary: { passed: 0, failed: 0, total: 0 }
                };

                for (const serviceName of Object.keys(services)) {
                    try {
                        // 接口验证
                        results.interfaceValidation[serviceName] = this.testBasicInterface(serviceName);
                        
                        // 健康检查
                        results.healthChecks[serviceName] = await this.testHealthCheck(serviceName);
                        
                        // 初始化测试
                        results.initialization[serviceName] = await this.testInitialization(serviceName);
                        
                        results.summary.passed++;
                    } catch (error) {
                        results.interfaceValidation[serviceName] = { success: false, error: error.message };
                        results.summary.failed++;
                    }
                    
                    results.summary.total++;
                }

                return results;
            }
        };
    }

    /**
     * 生成接口文档
     * @returns {string} 接口文档
     */
    generateInterfaceDocumentation() {
        let documentation = '# 服务接口文档\n\n';
        
        for (const [serviceName, interfaceClass] of this.interfaceMapping.entries()) {
            documentation += `## ${serviceName}\n\n`;
            documentation += `接口定义: \`${interfaceClass.name}\`\n\n`;
            
            const methods = this.getInterfaceMethods(interfaceClass);
            documentation += '### 方法列表\n\n';
            
            for (const method of methods) {
                documentation += `- \`${method}\`\n`;
            }
            
            documentation += '\n';
        }

        return documentation;
    }

    /**
     * 获取验证报告
     * @returns {Object} 详细验证报告
     */
    getValidationReport() {
        const report = {
            summary: {
                totalServices: this.validationResults.size,
                validServices: 0,
                invalidServices: 0,
                lastValidation: null
            },
            details: Array.from(this.validationResults.values()),
            recommendations: []
        };

        // 计算统计信息
        for (const result of this.validationResults.values()) {
            if (result.isValid) {
                report.summary.validServices++;
            } else {
                report.summary.invalidServices++;
                
                // 添加建议
                report.recommendations.push({
                    serviceName: result.serviceName,
                    issue: result.error,
                    suggestion: `请实现缺失的方法: ${result.missingMethods.join(', ')}`
                });
            }
            
            if (!report.summary.lastValidation || result.timestamp > report.summary.lastValidation) {
                report.summary.lastValidation = result.timestamp;
            }
        }

        return report;
    }

    /**
     * 提取已实现的方法
     * @private
     */
    getImplementedMethods(service) {
        if (!service || typeof service !== 'object') return [];
        
        const methods = [];
        const prototype = service.constructor.prototype;
        
        for (const methodName of Object.getOwnPropertyNames(prototype)) {
            if (methodName !== 'constructor' && typeof prototype[methodName] === 'function') {
                methods.push(methodName);
            }
        }

        return methods;
    }

    /**
     * 提取接口方法
     * @private
     */
    getInterfaceMethods(interfaceClass) {
        const methods = [];
        const prototype = interfaceClass.prototype;
        
        for (const methodName of Object.getOwnPropertyNames(prototype)) {
            if (methodName !== 'constructor') {
                methods.push(methodName);
            }
        }

        return methods;
    }

    /**
     * 从错误信息中提取缺失的方法
     * @private
     */
    extractMissingMethods(errorMessage) {
        const match = errorMessage.match(/Service missing required methods: (.+)/);
        if (match) {
            return match[1].split(', ').map(method => method.trim());
        }
        return [];
    }

    /**
     * 清除验证结果
     */
    clearValidationResults() {
        this.validationResults.clear();
        console.log('🧹 验证结果已清除');
    }
}

module.exports = ServiceInterfaceValidator;