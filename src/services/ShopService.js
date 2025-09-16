/**
 * ShopService - 店铺业务逻辑服务
 * 负责店铺管理的业务逻辑
 */

class ShopService {
    constructor(shopRepository, notificationService, apiKeyManager) {
        this.shopRepository = shopRepository;
        this.notificationService = notificationService;
        this.apiKeyManager = apiKeyManager;
    }

    /**
     * 创建新店铺
     * @param {Object} shopData - 店铺数据
     */
    async createShop(shopData) {
        try {
            // 1. 验证店铺数据
            this.validateShopData(shopData);

            // 2. 检查域名是否已被使用
            if (shopData.domain) {
                const existingShop = await this.shopRepository.getShopByDomain(shopData.domain);
                if (existingShop) {
                    throw new Error('该域名已被其他店铺使用');
                }
            }

            // 3. 生成API密钥
            const apiKey = this.apiKeyManager ? 
                await this.apiKeyManager.generateApiKey() : 
                this.generateApiKey();

            // 4. 准备店铺数据
            const shopToCreate = {
                ...shopData,
                apiKey,
                status: 'pending', // 新店铺默认待审核
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // 5. 创建店铺
            const createdShop = await this.shopRepository.createShop(shopToCreate);

            // 6. 发送创建通知
            await this.notificationService.notifyShopCreated({
                shopId: createdShop.id,
                shopName: createdShop.name,
                ownerId: createdShop.ownerId
            });

            return {
                success: true,
                shop: this.formatShopData(createdShop),
                apiKey
            };

        } catch (error) {
            console.error('创建店铺失败:', error);
            throw new Error(`创建店铺失败: ${error.message}`);
        }
    }

    /**
     * 获取店铺信息
     * @param {string} shopId - 店铺ID
     * @param {boolean} includeStats - 是否包含统计信息
     */
    async getShopById(shopId, includeStats = false) {
        try {
            if (!shopId) {
                throw new Error('店铺ID不能为空');
            }

            const shop = await this.shopRepository.getShopById(shopId);
            if (!shop) {
                throw new Error('店铺不存在');
            }

            const formattedShop = this.formatShopData(shop);

            // 如果需要包含统计信息
            if (includeStats) {
                const stats = await this.getShopStats(shopId);
                formattedShop.stats = stats.stats;
            }

            return {
                success: true,
                shop: formattedShop
            };

        } catch (error) {
            console.error('获取店铺信息失败:', error);
            throw new Error(`获取店铺信息失败: ${error.message}`);
        }
    }

    /**
     * 通过API密钥获取店铺
     * @param {string} apiKey - API密钥
     */
    async getShopByApiKey(apiKey) {
        try {
            if (!apiKey) {
                throw new Error('API密钥不能为空');
            }

            const shop = await this.shopRepository.getShopByApiKey(apiKey);
            if (!shop) {
                throw new Error('无效的API密钥');
            }

            if (shop.status !== 'active' && shop.status !== 'approved') {
                throw new Error('店铺未激活或已被禁用');
            }

            return {
                success: true,
                shop: this.formatShopData(shop)
            };

        } catch (error) {
            console.error('通过API密钥获取店铺失败:', error);
            throw new Error(`通过API密钥获取店铺失败: ${error.message}`);
        }
    }

    /**
     * 获取用户的店铺列表
     * @param {string} userId - 用户ID
     * @param {Object} options - 查询选项
     */
    async getUserShops(userId, options = {}) {
        try {
            if (!userId) {
                throw new Error('用户ID不能为空');
            }

            const queryOptions = {
                status: options.status || 'all',
                limit: options.limit || 50,
                offset: options.offset || 0,
                sortBy: options.sortBy || 'createdAt',
                sortOrder: options.sortOrder || 'DESC'
            };

            const shops = await this.shopRepository.getUserShops(userId, queryOptions);
            const formattedShops = shops.map(shop => this.formatShopData(shop));

            return {
                success: true,
                shops: formattedShops,
                total: shops.length,
                hasMore: shops.length === queryOptions.limit
            };

        } catch (error) {
            console.error('获取用户店铺列表失败:', error);
            throw new Error(`获取用户店铺列表失败: ${error.message}`);
        }
    }

    /**
     * 更新店铺信息
     * @param {string} shopId - 店铺ID
     * @param {Object} updateData - 更新数据
     */
    async updateShop(shopId, updateData) {
        try {
            // 1. 验证店铺是否存在
            const existingShop = await this.shopRepository.getShopById(shopId);
            if (!existingShop) {
                throw new Error('店铺不存在');
            }

            // 2. 验证更新数据
            this.validateUpdateData(updateData);

            // 3. 检查域名冲突（如果更新了域名）
            if (updateData.domain && updateData.domain !== existingShop.domain) {
                const domainConflict = await this.shopRepository.getShopByDomain(updateData.domain);
                if (domainConflict && domainConflict.id !== shopId) {
                    throw new Error('该域名已被其他店铺使用');
                }
            }

            // 4. 准备更新数据
            const dataToUpdate = {
                ...updateData,
                updatedAt: new Date()
            };

            // 5. 执行更新
            const updatedShop = await this.shopRepository.updateShop(shopId, dataToUpdate);

            // 6. 发送更新通知
            await this.notificationService.notifyShopUpdated({
                shopId,
                changes: Object.keys(updateData),
                updatedBy: updateData.updatedBy
            });

            return {
                success: true,
                shop: this.formatShopData(updatedShop)
            };

        } catch (error) {
            console.error('更新店铺失败:', error);
            throw new Error(`更新店铺失败: ${error.message}`);
        }
    }

    /**
     * 更新店铺状态
     * @param {string} shopId - 店铺ID
     * @param {string} status - 新状态
     * @param {string} reason - 状态变更原因（可选）
     */
    async updateShopStatus(shopId, status, reason = '') {
        try {
            const validStatuses = ['pending', 'approved', 'active', 'suspended', 'expired', 'rejected'];
            if (!validStatuses.includes(status)) {
                throw new Error(`无效的店铺状态: ${status}`);
            }

            const shop = await this.shopRepository.getShopById(shopId);
            if (!shop) {
                throw new Error('店铺不存在');
            }

            // 记录状态变更历史
            const statusChange = {
                shopId,
                fromStatus: shop.status,
                toStatus: status,
                reason,
                timestamp: new Date()
            };

            // 更新状态
            const updatedShop = await this.shopRepository.updateShopStatus(shopId, status);

            // 记录状态变更日志
            await this.shopRepository.addStatusChangeLog(statusChange);

            // 发送状态变更通知
            await this.notificationService.notifyShopStatusChanged({
                shopId,
                shopName: shop.name,
                fromStatus: shop.status,
                toStatus: status,
                reason
            });

            return {
                success: true,
                shop: this.formatShopData(updatedShop),
                statusChange
            };

        } catch (error) {
            console.error('更新店铺状态失败:', error);
            throw new Error(`更新店铺状态失败: ${error.message}`);
        }
    }

    /**
     * 删除店铺
     * @param {string} shopId - 店铺ID
     * @param {boolean} hardDelete - 是否硬删除（默认软删除）
     */
    async deleteShop(shopId, hardDelete = false) {
        try {
            const shop = await this.shopRepository.getShopById(shopId);
            if (!shop) {
                throw new Error('店铺不存在');
            }

            if (hardDelete) {
                // 硬删除：完全删除数据
                await this.shopRepository.deleteShop(shopId);
            } else {
                // 软删除：更新状态为deleted
                await this.shopRepository.updateShopStatus(shopId, 'deleted');
            }

            // 发送删除通知
            await this.notificationService.notifyShopDeleted({
                shopId,
                shopName: shop.name,
                deleteType: hardDelete ? 'hard' : 'soft'
            });

            return {
                success: true,
                shopId,
                deleteType: hardDelete ? 'hard' : 'soft'
            };

        } catch (error) {
            console.error('删除店铺失败:', error);
            throw new Error(`删除店铺失败: ${error.message}`);
        }
    }

    /**
     * 重新生成API密钥
     * @param {string} shopId - 店铺ID
     */
    async regenerateApiKey(shopId) {
        try {
            const shop = await this.shopRepository.getShopById(shopId);
            if (!shop) {
                throw new Error('店铺不存在');
            }

            // 生成新的API密钥
            const newApiKey = this.apiKeyManager ? 
                await this.apiKeyManager.generateApiKey() : 
                this.generateApiKey();

            // 更新API密钥
            await this.shopRepository.updateShop(shopId, {
                apiKey: newApiKey,
                updatedAt: new Date()
            });

            // 记录API密钥变更
            await this.shopRepository.addApiKeyChangeLog({
                shopId,
                oldApiKey: shop.apiKey.substring(0, 8) + '****', // 只记录前8位
                newApiKey: newApiKey.substring(0, 8) + '****',
                timestamp: new Date()
            });

            // 发送API密钥变更通知
            await this.notificationService.notifyApiKeyChanged({
                shopId,
                shopName: shop.name
            });

            return {
                success: true,
                apiKey: newApiKey
            };

        } catch (error) {
            console.error('重新生成API密钥失败:', error);
            throw new Error(`重新生成API密钥失败: ${error.message}`);
        }
    }

    /**
     * 获取店铺统计信息
     * @param {string} shopId - 店铺ID
     * @param {Object} timeRange - 时间范围
     */
    async getShopStats(shopId, timeRange = {}) {
        try {
            const shop = await this.shopRepository.getShopById(shopId);
            if (!shop) {
                throw new Error('店铺不存在');
            }

            const stats = await this.shopRepository.getShopStats(shopId, timeRange);

            return {
                success: true,
                stats: {
                    // 基本信息
                    totalConversations: stats.conversationCount,
                    totalMessages: stats.messageCount,
                    activeConversations: stats.activeConversationCount,
                    
                    // 时间统计
                    averageResponseTime: stats.averageResponseTime,
                    firstResponseTime: stats.firstResponseTime,
                    
                    // 活跃度统计
                    dailyActiveUsers: stats.dailyActiveUsers,
                    peakHours: stats.peakHours,
                    
                    // 满意度统计
                    customerSatisfaction: stats.satisfactionScore,
                    resolvedRate: stats.resolvedRate,
                    
                    // 趋势数据
                    conversationTrend: stats.conversationTrend,
                    messageTrend: stats.messageTrend
                }
            };

        } catch (error) {
            console.error('获取店铺统计失败:', error);
            throw new Error(`获取店铺统计失败: ${error.message}`);
        }
    }

    /**
     * 验证店铺数据
     * @private
     */
    validateShopData(shopData) {
        const required = ['name', 'ownerId'];
        const missing = required.filter(field => !shopData[field]);
        
        if (missing.length > 0) {
            throw new Error(`缺少必需字段: ${missing.join(', ')}`);
        }

        if (shopData.name.trim().length < 2) {
            throw new Error('店铺名称至少需要2个字符');
        }

        if (shopData.name.length > 100) {
            throw new Error('店铺名称不能超过100个字符');
        }

        if (shopData.domain) {
            const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/;
            if (!domainRegex.test(shopData.domain)) {
                throw new Error('无效的域名格式');
            }
        }
    }

    /**
     * 验证更新数据
     * @private
     */
    validateUpdateData(updateData) {
        if (updateData.name !== undefined) {
            if (updateData.name.trim().length < 2) {
                throw new Error('店铺名称至少需要2个字符');
            }
            if (updateData.name.length > 100) {
                throw new Error('店铺名称不能超过100个字符');
            }
        }

        if (updateData.domain !== undefined && updateData.domain) {
            const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/;
            if (!domainRegex.test(updateData.domain)) {
                throw new Error('无效的域名格式');
            }
        }
    }

    /**
     * 格式化店铺数据
     * @private
     */
    formatShopData(shop) {
        return {
            id: shop.id,
            name: shop.name,
            description: shop.description,
            domain: shop.domain,
            status: shop.status,
            ownerId: shop.ownerId,
            apiKey: shop.apiKey,
            settings: shop.settings || {},
            createdAt: shop.createdAt,
            updatedAt: shop.updatedAt,
            
            // 格式化的状态信息
            statusInfo: this.getStatusInfo(shop.status),
            
            // 格式化的时间显示
            timeFormatted: {
                created: this.formatDate(shop.createdAt),
                updated: this.formatDate(shop.updatedAt)
            }
        };
    }

    /**
     * 获取状态信息
     * @private
     */
    getStatusInfo(status) {
        const statusMap = {
            'pending': { text: '待审核', class: 'warning', icon: '⏳' },
            'approved': { text: '已审核', class: 'success', icon: '✅' },
            'active': { text: '正常运营', class: 'success', icon: '✅' },
            'suspended': { text: '已暂停', class: 'danger', icon: '⏸️' },
            'expired': { text: '已过期', class: 'danger', icon: '❌' },
            'rejected': { text: '已拒绝', class: 'danger', icon: '❌' },
            'deleted': { text: '已删除', class: 'muted', icon: '🗑️' }
        };

        return statusMap[status] || { text: '未知', class: 'muted', icon: '❓' };
    }

    /**
     * 格式化日期
     * @private
     */
    formatDate(date) {
        return new Date(date).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 生成API密钥
     * @private
     */
    generateApiKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'qt_'; // QuickTalk前缀
        
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return result;
    }
}

module.exports = ShopService;