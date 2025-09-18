/**
 * 增强版文件管理前端界面
 * 
 * 功能特性：
 * - 文件上传与下载
 * - 文件预览与搜索
 * - 文件共享与权限
 * - 版本控制
 * - 拖拽上传
 * - 批量操作
 * - 存储统计
 * 
 * @author QuickTalk Team
 * @version 6.0.0
 */

class EnhancedFileManagerUI {
    constructor(options = {}) {
        this.options = {
            containerId: 'file-manager-container',
            apiEndpoint: '/api/files',
            maxFileSize: 100 * 1024 * 1024, // 100MB
            allowedTypes: ['image/*', 'application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
            enableDragDrop: true,
            enablePreview: true,
            enableSharing: true,
            enableVersionControl: true,
            ...options
        };
        
        this.container = null;
        this.currentFiles = [];
        this.selectedFiles = [];
        this.currentView = 'grid'; // grid, list, preview
        this.currentSort = { field: 'uploadTime', order: 'desc' };
        this.currentFilter = { category: 'all', type: 'all' };
        this.uploadQueue = [];
        
        // 初始化组件
        this.init();
    }

    /**
     * 初始化文件管理器
     */
    init() {
        console.log('📁 初始化增强版文件管理器...');
        
        this.container = document.getElementById(this.options.containerId);
        if (!this.container) {
            console.error('❌ 未找到容器元素:', this.options.containerId);
            return;
        }
        
        this.createInterface();
        this.bindEvents();
        this.loadFiles();
        
        if (this.options.enableDragDrop) {
            this.setupDragDrop();
        }
        
        console.log('✅ 文件管理器初始化完成');
    }

    /**
     * 创建用户界面
     */
    createInterface() {
        this.container.innerHTML = `
            <div class="file-manager-header">
                <div class="file-manager-toolbar">
                    <div class="toolbar-left">
                        <button class="btn btn-primary" id="upload-btn">
                            <i class="icon-upload"></i> 上传文件
                        </button>
                        <div class="file-actions">
                            <button class="btn btn-outline" id="download-btn" disabled>
                                <i class="icon-download"></i> 下载
                            </button>
                            <button class="btn btn-outline" id="share-btn" disabled>
                                <i class="icon-share"></i> 共享
                            </button>
                            <button class="btn btn-outline" id="delete-btn" disabled>
                                <i class="icon-trash"></i> 删除
                            </button>
                        </div>
                    </div>
                    
                    <div class="toolbar-center">
                        <div class="search-box">
                            <input type="text" id="search-input" placeholder="搜索文件..." />
                            <button id="search-btn">
                                <i class="icon-search"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="toolbar-right">
                        <div class="view-toggle">
                            <button class="view-btn active" data-view="grid">
                                <i class="icon-grid"></i>
                            </button>
                            <button class="view-btn" data-view="list">
                                <i class="icon-list"></i>
                            </button>
                        </div>
                        
                        <div class="sort-dropdown">
                            <select id="sort-select">
                                <option value="uploadTime-desc">最新上传</option>
                                <option value="uploadTime-asc">最早上传</option>
                                <option value="filename-asc">文件名 A-Z</option>
                                <option value="filename-desc">文件名 Z-A</option>
                                <option value="fileSize-desc">大小(大→小)</option>
                                <option value="fileSize-asc">大小(小→大)</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="file-manager-filters">
                    <div class="filter-tabs">
                        <button class="filter-tab active" data-category="all">全部</button>
                        <button class="filter-tab" data-category="image">图片</button>
                        <button class="filter-tab" data-category="document">文档</button>
                        <button class="filter-tab" data-category="video">视频</button>
                        <button class="filter-tab" data-category="audio">音频</button>
                        <button class="filter-tab" data-category="other">其他</button>
                    </div>
                    
                    <div class="filter-stats">
                        <span id="file-count">0 个文件</span>
                        <span id="total-size">0 MB</span>
                    </div>
                </div>
            </div>
            
            <div class="file-manager-content">
                <div class="file-browser" id="file-browser">
                    <!-- 文件列表将在这里动态生成 -->
                </div>
                
                <div class="upload-area" id="upload-area" style="display: none;">
                    <div class="upload-drop-zone">
                        <i class="icon-cloud-upload"></i>
                        <h3>拖拽文件到这里或点击选择</h3>
                        <p>支持多文件上传，单个文件最大 100MB</p>
                        <input type="file" id="file-input" multiple accept="${this.options.allowedTypes.join(',')}" />
                    </div>
                    
                    <div class="upload-progress" id="upload-progress">
                        <!-- 上传进度将在这里显示 -->
                    </div>
                </div>
            </div>
            
            <div class="file-manager-sidebar" id="file-sidebar" style="display: none;">
                <div class="sidebar-header">
                    <h3>文件详情</h3>
                    <button class="close-btn" id="close-sidebar">×</button>
                </div>
                
                <div class="sidebar-content">
                    <div class="file-preview" id="file-preview">
                        <!-- 文件预览 -->
                    </div>
                    
                    <div class="file-info" id="file-info">
                        <!-- 文件信息 -->
                    </div>
                    
                    <div class="file-actions-panel">
                        <button class="btn btn-primary btn-block" id="preview-download">下载文件</button>
                        <button class="btn btn-outline btn-block" id="preview-share">创建共享链接</button>
                        ${this.options.enableVersionControl ? '<button class="btn btn-outline btn-block" id="preview-versions">版本历史</button>' : ''}
                    </div>
                </div>
            </div>
            
            <!-- 模态框 -->
            <div class="modal" id="share-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>创建共享链接</h3>
                        <button class="close-btn" data-modal="share-modal">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="share-form">
                            <div class="form-group">
                                <label>共享类型</label>
                                <select name="shareType">
                                    <option value="public">公开链接</option>
                                    <option value="password">密码保护</option>
                                    <option value="time">时间限制</option>
                                </select>
                            </div>
                            
                            <div class="form-group" id="password-group" style="display: none;">
                                <label>访问密码</label>
                                <input type="password" name="password" placeholder="设置访问密码" />
                            </div>
                            
                            <div class="form-group" id="expiry-group" style="display: none;">
                                <label>过期时间</label>
                                <input type="datetime-local" name="expiresAt" />
                            </div>
                            
                            <div class="form-group">
                                <label>下载限制</label>
                                <input type="number" name="maxDownloads" placeholder="最大下载次数（可选）" min="1" />
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" data-modal="share-modal">取消</button>
                        <button class="btn btn-primary" id="create-share-link">创建链接</button>
                    </div>
                </div>
            </div>
            
            <div class="modal" id="upload-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>文件上传</h3>
                        <button class="close-btn" data-modal="upload-modal">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="upload-file-list" id="upload-file-list">
                            <!-- 待上传文件列表 -->
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" data-modal="upload-modal">取消</button>
                        <button class="btn btn-primary" id="start-upload">开始上传</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 上传按钮
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        
        // 文件选择
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });
        
        // 搜索
        document.getElementById('search-input').addEventListener('input', 
            this.debounce(() => this.performSearch(), 500)
        );
        
        document.getElementById('search-btn').addEventListener('click', () => {
            this.performSearch();
        });
        
        // 视图切换
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });
        
        // 排序
        document.getElementById('sort-select').addEventListener('change', (e) => {
            const [field, order] = e.target.value.split('-');
            this.sortFiles(field, order);
        });
        
        // 分类筛选
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.filterByCategory(e.target.dataset.category);
            });
        });
        
        // 批量操作
        document.getElementById('download-btn').addEventListener('click', () => {
            this.downloadSelected();
        });
        
        document.getElementById('share-btn').addEventListener('click', () => {
            this.shareSelected();
        });
        
        document.getElementById('delete-btn').addEventListener('click', () => {
            this.deleteSelected();
        });
        
        // 侧边栏
        document.getElementById('close-sidebar').addEventListener('click', () => {
            this.closeSidebar();
        });
        
        // 模态框
        this.bindModalEvents();
    }

    /**
     * 绑定模态框事件
     */
    bindModalEvents() {
        // 关闭模态框
        document.querySelectorAll('[data-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.dataset.modal);
            });
        });
        
        // 共享类型切换
        document.querySelector('[name="shareType"]').addEventListener('change', (e) => {
            this.toggleShareOptions(e.target.value);
        });
        
        // 创建共享链接
        document.getElementById('create-share-link').addEventListener('click', () => {
            this.createShareLink();
        });
        
        // 开始上传
        document.getElementById('start-upload').addEventListener('click', () => {
            this.startUpload();
        });
    }

    /**
     * 设置拖拽上传
     */
    setupDragDrop() {
        const dropZone = document.getElementById('upload-area');
        
        // 防止默认拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.container.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // 拖拽进入
        this.container.addEventListener('dragenter', () => {
            this.container.classList.add('drag-over');
        });
        
        // 拖拽离开
        this.container.addEventListener('dragleave', (e) => {
            if (!this.container.contains(e.relatedTarget)) {
                this.container.classList.remove('drag-over');
            }
        });
        
        // 文件放置
        this.container.addEventListener('drop', (e) => {
            this.container.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(files) {
        const validFiles = [];
        const errors = [];
        
        Array.from(files).forEach(file => {
            // 验证文件大小
            if (file.size > this.options.maxFileSize) {
                errors.push(`${file.name}: 文件大小超过限制 (${this.formatFileSize(this.options.maxFileSize)})`);
                return;
            }
            
            // 验证文件类型
            const isValidType = this.options.allowedTypes.some(type => {
                if (type.endsWith('/*')) {
                    return file.type.startsWith(type.slice(0, -1));
                }
                return file.type === type;
            });
            
            if (!isValidType) {
                errors.push(`${file.name}: 不支持的文件类型`);
                return;
            }
            
            validFiles.push(file);
        });
        
        if (errors.length > 0) {
            this.showNotification('warning', `部分文件无法上传:\n${errors.join('\n')}`);
        }
        
        if (validFiles.length > 0) {
            this.addToUploadQueue(validFiles);
            this.showUploadModal();
        }
    }

    /**
     * 添加到上传队列
     */
    addToUploadQueue(files) {
        files.forEach(file => {
            const fileItem = {
                id: 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                file,
                status: 'pending',
                progress: 0,
                error: null
            };
            this.uploadQueue.push(fileItem);
        });
        
        this.updateUploadList();
    }

    /**
     * 更新上传列表
     */
    updateUploadList() {
        const listContainer = document.getElementById('upload-file-list');
        
        listContainer.innerHTML = this.uploadQueue.map(item => `
            <div class="upload-item" data-id="${item.id}">
                <div class="upload-item-info">
                    <div class="file-icon">
                        <i class="icon-${this.getFileIcon(item.file.type)}"></i>
                    </div>
                    <div class="file-details">
                        <div class="file-name">${item.file.name}</div>
                        <div class="file-size">${this.formatFileSize(item.file.size)}</div>
                    </div>
                    <div class="upload-status">
                        <span class="status-text">${this.getStatusText(item.status)}</span>
                        <button class="remove-btn" onclick="fileManager.removeFromQueue('${item.id}')">×</button>
                    </div>
                </div>
                
                <div class="upload-progress-bar">
                    <div class="progress-fill" style="width: ${item.progress}%"></div>
                </div>
                
                ${item.error ? `<div class="upload-error">${item.error}</div>` : ''}
            </div>
        `).join('');
    }

    /**
     * 从队列中移除文件
     */
    removeFromQueue(fileId) {
        const index = this.uploadQueue.findIndex(item => item.id === fileId);
        if (index > -1) {
            this.uploadQueue.splice(index, 1);
            this.updateUploadList();
        }
    }

    /**
     * 开始上传
     */
    async startUpload() {
        const pendingFiles = this.uploadQueue.filter(item => item.status === 'pending');
        
        for (const fileItem of pendingFiles) {
            try {
                fileItem.status = 'uploading';
                this.updateUploadList();
                
                await this.uploadFile(fileItem);
                
                fileItem.status = 'completed';
                fileItem.progress = 100;
                
            } catch (error) {
                fileItem.status = 'error';
                fileItem.error = error.message;
            }
            
            this.updateUploadList();
        }
        
        // 上传完成后刷新文件列表
        this.loadFiles();
        
        // 显示完成通知
        const completedCount = this.uploadQueue.filter(item => item.status === 'completed').length;
        const errorCount = this.uploadQueue.filter(item => item.status === 'error').length;
        
        if (completedCount > 0) {
            this.showNotification('success', `成功上传 ${completedCount} 个文件`);
        }
        
        if (errorCount > 0) {
            this.showNotification('error', `${errorCount} 个文件上传失败`);
        }
    }

    /**
     * 上传单个文件
     */
    async uploadFile(fileItem) {
        const { file } = fileItem;
        
        // 转换文件为base64
        const base64Data = await this.fileToBase64(file);
        
        const uploadData = {
            filename: file.name,
            fileData: base64Data.split(',')[1], // 移除 data:type;base64, 前缀
            shopId: this.options.shopId || 'default_shop',
            userId: this.options.userId || 'default_user',
            description: '',
            tags: ''
        };
        
        const response = await fetch(`${this.options.apiEndpoint}/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(uploadData)
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        return result;
    }

    /**
     * 文件转base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * 加载文件列表
     */
    async loadFiles() {
        try {
            const params = new URLSearchParams({
                shopId: this.options.shopId || 'default_shop',
                userId: this.options.userId || 'default_user',
                page: 1,
                limit: 100,
                sortBy: this.currentSort.field,
                sortOrder: this.currentSort.order
            });
            
            if (this.currentFilter.category !== 'all') {
                params.append('category', this.currentFilter.category);
            }
            
            const response = await fetch(`${this.options.apiEndpoint}/list?${params}`);
            const result = await response.json();
            
            if (result.success) {
                this.currentFiles = result.files;
                this.renderFiles();
                this.updateStats();
            } else {
                throw new Error(result.message);
            }
            
        } catch (error) {
            console.error('❌ 加载文件列表失败:', error);
            this.showNotification('error', '加载文件列表失败');
        }
    }

    /**
     * 渲染文件列表
     */
    renderFiles() {
        const browser = document.getElementById('file-browser');
        
        if (this.currentFiles.length === 0) {
            browser.innerHTML = `
                <div class="empty-state">
                    <i class="icon-folder-open"></i>
                    <h3>暂无文件</h3>
                    <p>点击上传按钮或拖拽文件到这里开始使用</p>
                </div>
            `;
            return;
        }
        
        if (this.currentView === 'grid') {
            this.renderGridView();
        } else {
            this.renderListView();
        }
    }

    /**
     * 渲染网格视图
     */
    renderGridView() {
        const browser = document.getElementById('file-browser');
        browser.className = 'file-browser grid-view';
        
        browser.innerHTML = this.currentFiles.map(file => `
            <div class="file-item" data-id="${file.id}" onclick="fileManager.selectFile('${file.id}')">
                <div class="file-thumbnail">
                    ${this.generateThumbnail(file)}
                </div>
                <div class="file-info">
                    <div class="file-name" title="${file.originalName}">${file.originalName}</div>
                    <div class="file-meta">
                        <span class="file-size">${this.formatFileSize(file.fileSize)}</span>
                        <span class="file-date">${this.formatDate(file.uploadTime)}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn" onclick="fileManager.previewFile('${file.id}')" title="预览">
                        <i class="icon-eye"></i>
                    </button>
                    <button class="action-btn" onclick="fileManager.downloadFile('${file.id}')" title="下载">
                        <i class="icon-download"></i>
                    </button>
                    <button class="action-btn" onclick="fileManager.shareFile('${file.id}')" title="共享">
                        <i class="icon-share"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染列表视图
     */
    renderListView() {
        const browser = document.getElementById('file-browser');
        browser.className = 'file-browser list-view';
        
        browser.innerHTML = `
            <div class="file-list-header">
                <div class="col-name">文件名</div>
                <div class="col-size">大小</div>
                <div class="col-type">类型</div>
                <div class="col-date">修改时间</div>
                <div class="col-actions">操作</div>
            </div>
            
            ${this.currentFiles.map(file => `
                <div class="file-list-item" data-id="${file.id}" onclick="fileManager.selectFile('${file.id}')">
                    <div class="col-name">
                        <i class="icon-${this.getFileIcon(file.mimeType)}"></i>
                        <span title="${file.originalName}">${file.originalName}</span>
                    </div>
                    <div class="col-size">${this.formatFileSize(file.fileSize)}</div>
                    <div class="col-type">${this.getFileType(file.mimeType)}</div>
                    <div class="col-date">${this.formatDate(file.uploadTime)}</div>
                    <div class="col-actions">
                        <button class="action-btn" onclick="fileManager.previewFile('${file.id}')" title="预览">
                            <i class="icon-eye"></i>
                        </button>
                        <button class="action-btn" onclick="fileManager.downloadFile('${file.id}')" title="下载">
                            <i class="icon-download"></i>
                        </button>
                        <button class="action-btn" onclick="fileManager.shareFile('${file.id}')" title="共享">
                            <i class="icon-share"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        `;
    }

    /**
     * 生成缩略图
     */
    generateThumbnail(file) {
        if (file.mimeType.startsWith('image/')) {
            return `<img src="${this.options.apiEndpoint}/preview/${file.id}?userId=${this.options.userId}" alt="${file.originalName}" />`;
        } else {
            return `<i class="icon-${this.getFileIcon(file.mimeType)}"></i>`;
        }
    }

    /**
     * 获取文件图标
     */
    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'music';
        if (mimeType.includes('pdf')) return 'file-pdf';
        if (mimeType.includes('word')) return 'file-word';
        if (mimeType.includes('excel')) return 'file-excel';
        if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
        if (mimeType.startsWith('text/')) return 'file-text';
        return 'file';
    }

    /**
     * 获取文件类型显示名称
     */
    getFileType(mimeType) {
        const types = {
            'image/': '图片',
            'video/': '视频',
            'audio/': '音频',
            'application/pdf': 'PDF文档',
            'application/msword': 'Word文档',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word文档',
            'application/vnd.ms-excel': 'Excel表格',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel表格',
            'text/': '文本',
            'application/zip': '压缩包',
            'application/x-rar-compressed': '压缩包'
        };
        
        for (const [key, value] of Object.entries(types)) {
            if (mimeType.includes(key)) {
                return value;
            }
        }
        
        return '其他';
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return '今天';
        } else if (diffDays === 2) {
            return '昨天';
        } else if (diffDays <= 7) {
            return `${diffDays} 天前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const statusMap = {
            'pending': '等待上传',
            'uploading': '上传中...',
            'completed': '上传完成',
            'error': '上传失败'
        };
        return statusMap[status] || status;
    }

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 显示通知
     */
    showNotification(type, message) {
        // 简单的通知实现，实际项目中可以使用更完善的通知库
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * 显示模态框
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 关闭模态框
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 显示上传模态框
     */
    showUploadModal() {
        this.showModal('upload-modal');
    }

    /**
     * 更新统计信息
     */
    updateStats() {
        const fileCount = this.currentFiles.length;
        const totalSize = this.currentFiles.reduce((sum, file) => sum + file.fileSize, 0);
        
        document.getElementById('file-count').textContent = `${fileCount} 个文件`;
        document.getElementById('total-size').textContent = this.formatFileSize(totalSize);
    }

    // ============ 公共方法 ============

    /**
     * 选择文件
     */
    selectFile(fileId) {
        // 实现文件选择逻辑
        console.log('选择文件:', fileId);
    }

    /**
     * 预览文件
     */
    async previewFile(fileId) {
        try {
            const response = await fetch(`${this.options.apiEndpoint}/preview/${fileId}?userId=${this.options.userId}`);
            const result = await response.json();
            
            if (result.success) {
                // 显示预览界面
                this.showFilePreview(result.preview, result.fileInfo);
            } else {
                throw new Error(result.message);
            }
            
        } catch (error) {
            console.error('❌ 预览文件失败:', error);
            this.showNotification('error', '预览文件失败');
        }
    }

    /**
     * 下载文件
     */
    async downloadFile(fileId) {
        try {
            const url = `${this.options.apiEndpoint}/download/${fileId}?userId=${this.options.userId}`;
            const link = document.createElement('a');
            link.href = url;
            link.download = '';
            link.click();
            
        } catch (error) {
            console.error('❌ 下载文件失败:', error);
            this.showNotification('error', '下载文件失败');
        }
    }

    /**
     * 共享文件
     */
    shareFile(fileId) {
        this.currentShareFileId = fileId;
        this.showModal('share-modal');
    }

    /**
     * 执行搜索
     */
    async performSearch() {
        const query = document.getElementById('search-input').value.trim();
        
        if (!query) {
            this.loadFiles();
            return;
        }
        
        try {
            const response = await fetch(`${this.options.apiEndpoint}/search?query=${encodeURIComponent(query)}&shopId=${this.options.shopId || 'default_shop'}`);
            const result = await response.json();
            
            if (result.success) {
                this.currentFiles = result.files;
                this.renderFiles();
                this.updateStats();
            } else {
                throw new Error(result.message);
            }
            
        } catch (error) {
            console.error('❌ 搜索失败:', error);
            this.showNotification('error', '搜索失败');
        }
    }

    /**
     * 切换视图
     */
    switchView(view) {
        this.currentView = view;
        
        // 更新按钮状态
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        this.renderFiles();
    }

    /**
     * 排序文件
     */
    sortFiles(field, order) {
        this.currentSort = { field, order };
        this.loadFiles();
    }

    /**
     * 按分类筛选
     */
    filterByCategory(category) {
        this.currentFilter.category = category;
        
        // 更新标签状态
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        
        this.loadFiles();
    }
}

// 全局实例
let fileManager = null;

// 初始化函数
function initFileManager(options = {}) {
    if (fileManager) {
        console.warn('⚠️ 文件管理器已经初始化');
        return fileManager;
    }
    
    fileManager = new EnhancedFileManagerUI(options);
    return fileManager;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EnhancedFileManagerUI, initFileManager };
}