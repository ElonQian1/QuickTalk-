/**
 * 员工管理系统
 * 负责店铺员工的添加、删除、权限管理、消息分配等功能
 */
class EmployeeManager {
    constructor(database, messageAdapter) {
        this.db = database;
        this.messageAdapter = messageAdapter;
        this.employees = new Map();
        this.workQueues = new Map(); // 员工工作队列
        this.distributionRules = new Map(); // 消息分配规则
        this.employeeStatus = new Map(); // 员工工作状态
        
        this.initializeDefaultRules();
    }

    /**
     * 初始化默认分配规则
     */
    initializeDefaultRules() {
        this.distributionRules.set('round_robin', {
            name: '轮询分配',
            description: '按顺序轮流分配消息给员工',
            handler: this.roundRobinDistribution.bind(this)
        });
        
        this.distributionRules.set('load_based', {
            name: '负载均衡',
            description: '优先分配给消息数量较少的员工',
            handler: this.loadBasedDistribution.bind(this)
        });
        
        this.distributionRules.set('skill_based', {
            name: '技能分配',
            description: '根据员工技能标签分配对应消息',
            handler: this.skillBasedDistribution.bind(this)
        });
    }

    /**
     * 添加员工
     */
    async addEmployee(shopId, employeeData) {
        try {
            const employeeId = this.generateEmployeeId();
            const employee = {
                id: employeeId,
                shopId: shopId,
                name: employeeData.name,
                email: employeeData.email,
                phone: employeeData.phone || '',
                role: employeeData.role || 'customer_service', // customer_service, supervisor, admin
                permissions: employeeData.permissions || this.getDefaultPermissions(employeeData.role),
                skills: employeeData.skills || [], // 技能标签
                status: 'offline', // online, offline, busy, away
                createdAt: new Date(),
                updatedAt: new Date(),
                isActive: true
            };

            // 保存到数据库
            await this.saveEmployeeToDatabase(employee);
            
            // 缓存到内存
            this.employees.set(employeeId, employee);
            this.workQueues.set(employeeId, []);
            this.employeeStatus.set(employeeId, {
                status: 'offline',
                currentConversations: [],
                messageCount: 0,
                lastActivity: new Date()
            });

            console.log(`✅ 员工 ${employee.name} 已添加到店铺 ${shopId}`);
            return employee;
        } catch (error) {
            console.error('❌ 添加员工失败:', error);
            throw error;
        }
    }

    /**
     * 删除员工
     */
    async removeEmployee(employeeId) {
        try {
            const employee = this.employees.get(employeeId);
            if (!employee) {
                throw new Error('员工不存在');
            }

            // 转移未完成的对话给其他员工
            await this.transferEmployeeConversations(employeeId);
            
            // 从数据库删除
            await this.deleteEmployeeFromDatabase(employeeId);
            
            // 从内存清除
            this.employees.delete(employeeId);
            this.workQueues.delete(employeeId);
            this.employeeStatus.delete(employeeId);

            console.log(`✅ 员工 ${employee.name} 已被删除`);
            return true;
        } catch (error) {
            console.error('❌ 删除员工失败:', error);
            throw error;
        }
    }

    /**
     * 更新员工信息
     */
    async updateEmployee(employeeId, updateData) {
        try {
            const employee = this.employees.get(employeeId);
            if (!employee) {
                throw new Error('员工不存在');
            }

            // 更新员工信息
            Object.assign(employee, updateData, { updatedAt: new Date() });
            
            // 保存到数据库
            await this.saveEmployeeToDatabase(employee);
            
            // 更新内存缓存
            this.employees.set(employeeId, employee);

            console.log(`✅ 员工 ${employee.name} 信息已更新`);
            return employee;
        } catch (error) {
            console.error('❌ 更新员工失败:', error);
            throw error;
        }
    }

    /**
     * 设置员工状态
     */
    async setEmployeeStatus(employeeId, status) {
        try {
            const employee = this.employees.get(employeeId);
            if (!employee) {
                throw new Error('员工不存在');
            }

            const statusInfo = this.employeeStatus.get(employeeId);
            if (statusInfo) {
                statusInfo.status = status;
                statusInfo.lastActivity = new Date();
                this.employeeStatus.set(employeeId, statusInfo);
            }

            employee.status = status;
            await this.saveEmployeeToDatabase(employee);

            console.log(`✅ 员工 ${employee.name} 状态设置为 ${status}`);
            return true;
        } catch (error) {
            console.error('❌ 设置员工状态失败:', error);
            throw error;
        }
    }

    /**
     * 获取店铺所有员工
     */
    getShopEmployees(shopId) {
        const employees = Array.from(this.employees.values())
            .filter(emp => emp.shopId === shopId && emp.isActive);
        
        return employees.map(emp => ({
            ...emp,
            statusInfo: this.employeeStatus.get(emp.id)
        }));
    }

    /**
     * 分配消息给员工
     */
    async assignMessage(shopId, conversationId, customerMessage, distributionMethod = 'load_based') {
        try {
            const availableEmployees = this.getAvailableEmployees(shopId);
            if (availableEmployees.length === 0) {
                console.log('⚠️ 没有可用员工，消息将进入待分配队列');
                return null;
            }

            const rule = this.distributionRules.get(distributionMethod);
            if (!rule) {
                throw new Error('无效的分配规则');
            }

            const assignedEmployee = await rule.handler(availableEmployees, customerMessage);
            if (assignedEmployee) {
                await this.addConversationToEmployee(assignedEmployee.id, conversationId);
                console.log(`✅ 消息已分配给员工 ${assignedEmployee.name}`);
            }

            return assignedEmployee;
        } catch (error) {
            console.error('❌ 分配消息失败:', error);
            throw error;
        }
    }

    /**
     * 轮询分配策略
     */
    async roundRobinDistribution(employees, message) {
        if (employees.length === 0) return null;
        
        // 简单轮询：选择对话数量最少的员工
        const sortedEmployees = employees.sort((a, b) => {
            const aStatus = this.employeeStatus.get(a.id);
            const bStatus = this.employeeStatus.get(b.id);
            return aStatus.currentConversations.length - bStatus.currentConversations.length;
        });
        
        return sortedEmployees[0];
    }

    /**
     * 负载均衡分配策略
     */
    async loadBasedDistribution(employees, message) {
        if (employees.length === 0) return null;
        
        // 选择负载最轻的员工
        const sortedEmployees = employees.sort((a, b) => {
            const aStatus = this.employeeStatus.get(a.id);
            const bStatus = this.employeeStatus.get(b.id);
            const aLoad = aStatus.currentConversations.length + aStatus.messageCount * 0.1;
            const bLoad = bStatus.currentConversations.length + bStatus.messageCount * 0.1;
            return aLoad - bLoad;
        });
        
        return sortedEmployees[0];
    }

    /**
     * 技能分配策略
     */
    async skillBasedDistribution(employees, message) {
        if (employees.length === 0) return null;
        
        // 简化的技能匹配：根据消息内容匹配员工技能
        const messageText = message.content.toLowerCase();
        const skilledEmployees = employees.filter(emp => {
            if (!emp.skills || emp.skills.length === 0) return true;
            return emp.skills.some(skill => messageText.includes(skill.toLowerCase()));
        });
        
        if (skilledEmployees.length > 0) {
            return this.loadBasedDistribution(skilledEmployees, message);
        }
        
        return this.loadBasedDistribution(employees, message);
    }

    /**
     * 获取可用员工列表
     */
    getAvailableEmployees(shopId) {
        return Array.from(this.employees.values())
            .filter(emp => {
                if (emp.shopId !== shopId || !emp.isActive) return false;
                const status = this.employeeStatus.get(emp.id);
                return status && (status.status === 'online' || status.status === 'away');
            });
    }

    /**
     * 为员工添加对话
     */
    async addConversationToEmployee(employeeId, conversationId) {
        const statusInfo = this.employeeStatus.get(employeeId);
        if (statusInfo) {
            if (!statusInfo.currentConversations.includes(conversationId)) {
                statusInfo.currentConversations.push(conversationId);
                statusInfo.messageCount++;
                this.employeeStatus.set(employeeId, statusInfo);
            }
        }
    }

    /**
     * 从员工移除对话
     */
    async removeConversationFromEmployee(employeeId, conversationId) {
        const statusInfo = this.employeeStatus.get(employeeId);
        if (statusInfo) {
            const index = statusInfo.currentConversations.indexOf(conversationId);
            if (index !== -1) {
                statusInfo.currentConversations.splice(index, 1);
                this.employeeStatus.set(employeeId, statusInfo);
            }
        }
    }

    /**
     * 转移员工的所有对话
     */
    async transferEmployeeConversations(employeeId) {
        const statusInfo = this.employeeStatus.get(employeeId);
        if (!statusInfo || statusInfo.currentConversations.length === 0) {
            return;
        }

        const employee = this.employees.get(employeeId);
        const availableEmployees = this.getAvailableEmployees(employee.shopId)
            .filter(emp => emp.id !== employeeId);

        for (const conversationId of statusInfo.currentConversations) {
            if (availableEmployees.length > 0) {
                const targetEmployee = availableEmployees[0]; // 简单选择第一个可用员工
                await this.addConversationToEmployee(targetEmployee.id, conversationId);
                console.log(`对话 ${conversationId} 已转移给员工 ${targetEmployee.name}`);
            }
        }

        statusInfo.currentConversations = [];
        this.employeeStatus.set(employeeId, statusInfo);
    }

    /**
     * 获取默认权限
     */
    getDefaultPermissions(role) {
        const permissions = {
            customer_service: [
                'view_messages',
                'send_messages',
                'view_customer_info',
                'create_notes'
            ],
            supervisor: [
                'view_messages',
                'send_messages',
                'view_customer_info',
                'create_notes',
                'manage_assignments',
                'view_reports',
                'manage_employees'
            ],
            admin: [
                'view_messages',
                'send_messages',
                'view_customer_info',
                'create_notes',
                'manage_assignments',
                'view_reports',
                'manage_employees',
                'manage_settings',
                'manage_billing'
            ]
        };
        
        return permissions[role] || permissions.customer_service;
    }

    /**
     * 生成员工ID
     */
    generateEmployeeId() {
        return 'emp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 保存员工到数据库
     */
    async saveEmployeeToDatabase(employee) {
        try {
            if (this.db.run && typeof this.db.run === 'function') {
                // SQLite数据库
                const stmt = this.db.prepare(`
                    INSERT OR REPLACE INTO employees 
                    (id, shop_id, name, email, phone, role, permissions, skills, status, created_at, updated_at, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                stmt.run(
                    employee.id,
                    employee.shopId,
                    employee.name,
                    employee.email,
                    employee.phone,
                    employee.role,
                    JSON.stringify(employee.permissions),
                    JSON.stringify(employee.skills),
                    employee.status,
                    employee.createdAt.toISOString(),
                    employee.updatedAt.toISOString(),
                    employee.isActive ? 1 : 0
                );
            } else if (this.db.employees && this.db.employees instanceof Map) {
                // 内存数据库
                this.db.employees.set(employee.id, { ...employee });
            }
        } catch (error) {
            console.error('保存员工到数据库失败:', error);
            throw error;
        }
    }

    /**
     * 从数据库删除员工
     */
    async deleteEmployeeFromDatabase(employeeId) {
        try {
            if (this.db.run && typeof this.db.run === 'function') {
                // SQLite数据库
                const stmt = this.db.prepare('UPDATE employees SET is_active = 0, updated_at = ? WHERE id = ?');
                stmt.run(new Date().toISOString(), employeeId);
            } else if (this.db.employees && this.db.employees instanceof Map) {
                // 内存数据库
                const employee = this.db.employees.get(employeeId);
                if (employee) {
                    employee.isActive = false;
                    employee.updatedAt = new Date();
                }
            }
        } catch (error) {
            console.error('从数据库删除员工失败:', error);
            throw error;
        }
    }

    /**
     * 从数据库加载员工数据
     */
    async loadEmployeesFromDatabase() {
        try {
            if (this.db.getAllAsync && typeof this.db.getAllAsync === 'function') {
                // 使用数据库抽象层的getAllAsync方法
                const rows = await this.db.getAllAsync('SELECT * FROM employees WHERE is_active = 1');
                
                for (const row of rows) {
                    const employee = {
                        id: row.id,
                        shopId: row.shop_id,
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        role: row.role,
                        permissions: JSON.parse(row.permissions || '[]'),
                        skills: JSON.parse(row.skills || '[]'),
                        status: row.status,
                        createdAt: new Date(row.created_at),
                        updatedAt: new Date(row.updated_at),
                        isActive: row.is_active === 1
                    };
                    
                    this.employees.set(employee.id, employee);
                    this.workQueues.set(employee.id, []);
                    this.employeeStatus.set(employee.id, {
                        status: employee.status,
                        currentConversations: [],
                        messageCount: 0,
                        lastActivity: new Date()
                    });
                }
                
                console.log(`✅ 已加载 ${rows.length} 名员工`);
            } else if (this.db.employees && this.db.employees instanceof Map) {
                // 内存数据库
                for (const [id, employee] of this.db.employees) {
                    if (employee.isActive) {
                        this.employees.set(id, employee);
                        this.workQueues.set(id, []);
                        this.employeeStatus.set(id, {
                            status: employee.status,
                            currentConversations: [],
                            messageCount: 0,
                            lastActivity: new Date()
                        });
                    }
                }
                
                console.log(`✅ 已加载 ${this.employees.size} 名员工`);
            }
        } catch (error) {
            console.error('❌ 加载员工数据失败:', error);
        }
    }

    /**
     * 初始化员工管理系统
     */
    async initialize() {
        try {
            await this.createEmployeeTableIfNotExists();
            await this.loadEmployeesFromDatabase();
            console.log('✅ 员工管理系统初始化完成');
        } catch (error) {
            console.error('❌ 员工管理系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建员工表（如果不存在）
     */
    async createEmployeeTableIfNotExists() {
        try {
            if (this.db.prepare && typeof this.db.prepare === 'function') {
                // SQLite数据库
                this.db.exec(`
                    CREATE TABLE IF NOT EXISTS employees (
                        id TEXT PRIMARY KEY,
                        shop_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL,
                        phone TEXT,
                        role TEXT DEFAULT 'customer_service',
                        permissions TEXT DEFAULT '[]',
                        skills TEXT DEFAULT '[]',
                        status TEXT DEFAULT 'offline',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        is_active INTEGER DEFAULT 1,
                        FOREIGN KEY (shop_id) REFERENCES shops (id)
                    )
                `);
                console.log('✅ 员工表检查/创建完成');
            } else if (this.db.employees === undefined) {
                // 内存数据库
                this.db.employees = new Map();
                console.log('✅ 员工内存存储初始化完成');
            }
        } catch (error) {
            console.error('❌ 创建员工表失败:', error);
            throw error;
        }
    }

    /**
     * 获取员工统计信息
     */
    getEmployeeStats(shopId) {
        const shopEmployees = this.getShopEmployees(shopId);
        const stats = {
            total: shopEmployees.length,
            online: 0,
            offline: 0,
            busy: 0,
            away: 0,
            totalConversations: 0,
            totalMessages: 0
        };

        shopEmployees.forEach(emp => {
            if (emp.statusInfo) {
                stats[emp.statusInfo.status]++;
                stats.totalConversations += emp.statusInfo.currentConversations.length;
                stats.totalMessages += emp.statusInfo.messageCount;
            }
        });

        return stats;
    }
}

module.exports = EmployeeManager;