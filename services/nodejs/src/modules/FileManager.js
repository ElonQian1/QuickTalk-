/**
 * 增强版文件管理与共享系统
 * 
 * 功能特性：
 * - 文件上传下载
 * - 文件共享与权限控制
 * - 版本控制
 * - 文件预览
 * - 存储空间管理
 * - 文件分类与搜索
 * - 安全检查与病毒扫描
 * - 缩略图生成
 * - 批量操作
 * - 回收站功能
 * 
 * @author QuickTalk Team
 * @version 6.0.0
 * @since 2025-09-14
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileManager {
    constructor(database, moduleManager = null) {
        this.db = database;
        this.moduleManager = moduleManager;
        
        // 文件存储配置
        this.config = {
            uploadPath: path.join(__dirname, '../../uploads'),
            tempPath: path.join(__dirname, '../../temp'),
            maxFileSize: 100 * 1024 * 1024, // 100MB
            allowedTypes: [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'application/pdf', 'text/plain', 'text/csv',
                'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/zip', 'application/x-rar-compressed'
            ],
            thumbnailSizes: [150, 300, 600],
            enableVersionControl: true,
            enableVirusScan: false, // 在生产环境中启用
            compressionThreshold: 5 * 1024 * 1024 // 5MB
        };
        
        // 文件操作缓存
        this.fileCache = new Map();
        this.uploadSessions = new Map();
        this.downloadTokens = new Map();
        
        // 统计信息
        this.stats = {
            totalUploads: 0,
            totalDownloads: 0,
            totalStorage: 0,
            activeShares: 0
        };
        
        this.initialized = false;
        console.log('📁 文件管理与共享系统初始化...');
    }

    /**
     * 初始化文件管理系统
     */
    async initialize() {
        try {
            console.log('🚀 开始初始化文件管理系统...');
            
            // 1. 创建文件相关数据表
            await this.createFileTables();
            
            // 2. 创建文件存储目录
            await this.createStorageDirectories();
            
            // 3. 初始化文件处理器
            await this.initializeFileProcessors();
            
            // 4. 加载默认配置
            await this.loadDefaultSettings();
            
            // 5. 启动后台任务
            await this.startBackgroundTasks();
            
            this.initialized = true;
            console.log('✅ 文件管理系统初始化完成');
            
        } catch (error) {
            console.error('❌ 文件管理系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建文件相关数据表
     */
    async createFileTables() {
        console.log('📋 创建文件相关数据表...');
        
        // 文件信息表
        await this.createFileInfoTable();
        
        // 文件版本表
        await this.createFileVersionTable();
        
        // 文件共享表
        await this.createFileShareTable();
        
        // 文件权限表
        await this.createFilePermissionTable();
        
        // 上传会话表
        await this.createUploadSessionTable();
        
        // 文件标签表
        await this.createFileTagTable();
        
        // 文件评论表
        await this.createFileCommentTable();
        
        // 回收站表
        await this.createRecycleBinTable();
        
        // 创建索引
        await this.createFileIndexes();
        
        console.log('✅ 文件相关数据表创建完成');
    }

    /**
     * 创建文件信息表
     */
    async createFileInfoTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS file_info (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                original_name TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                file_extension TEXT,
                category TEXT DEFAULT 'other',
                description TEXT,
                thumbnail_path TEXT,
                preview_available BOOLEAN DEFAULT FALSE,
                download_count INTEGER DEFAULT 0,
                view_count INTEGER DEFAULT 0,
                is_public BOOLEAN DEFAULT FALSE,
                is_compressed BOOLEAN DEFAULT FALSE,
                compression_ratio REAL DEFAULT 1.0,
                virus_scan_status TEXT DEFAULT 'pending',
                virus_scan_result TEXT,
                upload_status TEXT DEFAULT 'uploading',
                upload_progress REAL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                expires_at TEXT,
                metadata TEXT
            )
        `;
        
        if (this.db.run) {
            this.db.run(sql);
        } else {
            console.log('📋 模拟执行SQL:', sql.substring(0, 100) + '...');
        }
        console.log('📄 文件信息表创建完成');
    }

    /**
     * 创建文件版本表
     */
    async createFileVersionTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS file_versions (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_hash TEXT NOT NULL,
                change_description TEXT,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_current BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (file_id) REFERENCES file_info(id) ON DELETE CASCADE
            )
        `;
        
        if (this.db.run) {
            this.db.run(sql);
        } else {
            console.log('📋 模拟执行SQL:', sql.substring(0, 100) + '...');
        }
        console.log('📚 文件版本表创建完成');
    }

    /**
     * 创建文件共享表
     */
    async createFileShareTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS file_shares (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                shared_by TEXT NOT NULL,
                shared_with TEXT,
                share_type TEXT NOT NULL,
                share_token TEXT UNIQUE,
                password_hash TEXT,
                access_level TEXT DEFAULT 'read',
                download_allowed BOOLEAN DEFAULT TRUE,
                view_count INTEGER DEFAULT 0,
                download_count INTEGER DEFAULT 0,
                expires_at TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TEXT NOT NULL,
                last_accessed TEXT,
                access_restrictions TEXT,
                FOREIGN KEY (file_id) REFERENCES file_info(id) ON DELETE CASCADE
            )
        `;
        
        if (this.db.run) {
            this.db.run(sql);
        } else {
            console.log('📋 模拟执行SQL:', sql.substring(0, 100) + '...');
        }
        console.log('🔗 文件共享表创建完成');
    }

    /**
     * 创建文件权限表
     */
    async createFilePermissionTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS file_permissions (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                permission_type TEXT NOT NULL,
                granted_by TEXT NOT NULL,
                granted_at TEXT NOT NULL,
                expires_at TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (file_id) REFERENCES file_info(id) ON DELETE CASCADE
            )
        `;
        
        if (this.db.run) {
            this.db.run(sql);
        } else {
            console.log('📋 模拟执行SQL:', sql.substring(0, 100) + '...');
        }
        console.log('🔐 文件权限表创建完成');
    }

    /**
     * 创建上传会话表
     */
    async createUploadSessionTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS upload_sessions (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                session_token TEXT UNIQUE NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                chunk_size INTEGER NOT NULL,
                total_chunks INTEGER NOT NULL,
                uploaded_chunks INTEGER DEFAULT 0,
                upload_progress REAL DEFAULT 0.0,
                status TEXT DEFAULT 'active',
                temp_path TEXT,
                target_path TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        `;
        
        if (this.db.run) {
            this.db.run(sql);
        } else {
            console.log('📋 模拟执行SQL:', sql.substring(0, 100) + '...');
        }
        console.log('📤 上传会话表创建完成');
    }

    /**
     * 创建文件标签表
     */
    async createFileTagTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS file_tags (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                tag_name TEXT NOT NULL,
                tag_color TEXT DEFAULT '#007bff',
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (file_id) REFERENCES file_info(id) ON DELETE CASCADE
            )
        `;
        
        if (this.db.run) {
            this.db.run(sql);
        } else {
            console.log('📋 模拟执行SQL:', sql.substring(0, 100) + '...');
        }
        console.log('🏷️ 文件标签表创建完成');
    }

    /**
     * 创建文件评论表
     */
    async createFileCommentTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS file_comments (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                comment_text TEXT NOT NULL,
                parent_comment_id TEXT,
                is_system BOOLEAN DEFAULT FALSE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (file_id) REFERENCES file_info(id) ON DELETE CASCADE
            )
        `;
        
        if (this.db.run) {
            this.db.run(sql);
        } else {
            console.log('📋 模拟执行SQL:', sql.substring(0, 100) + '...');
        }
        console.log('💬 文件评论表创建完成');
    }

    /**
     * 创建回收站表
     */
    async createRecycleBinTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS file_recycle_bin (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                original_path TEXT NOT NULL,
                deleted_by TEXT NOT NULL,
                deleted_at TEXT NOT NULL,
                restore_deadline TEXT NOT NULL,
                file_data TEXT,
                FOREIGN KEY (file_id) REFERENCES file_info(id)
            )
        `;
        
        if (this.db.run) {
            this.db.run(sql);
        } else {
            console.log('📋 模拟执行SQL:', sql.substring(0, 100) + '...');
        }
        console.log('🗑️ 回收站表创建完成');
    }

    /**
     * 创建文件索引
     */
    async createFileIndexes() {
        console.log('📇 创建文件相关索引...');
        
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_file_info_shop_user ON file_info(shop_id, user_id)',
            'CREATE INDEX IF NOT EXISTS idx_file_info_hash ON file_info(file_hash)',
            'CREATE INDEX IF NOT EXISTS idx_file_info_category ON file_info(category, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_file_info_public ON file_info(is_public, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_file_versions_file ON file_versions(file_id, version_number)',
            'CREATE INDEX IF NOT EXISTS idx_file_versions_current ON file_versions(is_current)',
            'CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares(share_token)',
            'CREATE INDEX IF NOT EXISTS idx_file_shares_file ON file_shares(file_id, is_active)',
            'CREATE INDEX IF NOT EXISTS idx_file_permissions_file_user ON file_permissions(file_id, user_id)',
            'CREATE INDEX IF NOT EXISTS idx_upload_sessions_token ON upload_sessions(session_token)',
            'CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id, status)',
            'CREATE INDEX IF NOT EXISTS idx_file_tags_file ON file_tags(file_id)',
            'CREATE INDEX IF NOT EXISTS idx_file_tags_name ON file_tags(tag_name)',
            'CREATE INDEX IF NOT EXISTS idx_file_comments_file ON file_comments(file_id, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_recycle_bin_file ON file_recycle_bin(file_id)',
            'CREATE INDEX IF NOT EXISTS idx_recycle_bin_deadline ON file_recycle_bin(restore_deadline)'
        ];
        
        for (const indexSql of indexes) {
            if (this.db.run) {
                this.db.run(indexSql);
            } else {
                console.log('📋 模拟执行SQL:', indexSql + '...');
            }
        }
        
        console.log('✅ 文件相关索引创建完成');
    }

    /**
     * 创建存储目录
     */
    async createStorageDirectories() {
        console.log('📂 创建文件存储目录...');
        
        const directories = [
            this.config.uploadPath,
            this.config.tempPath,
            path.join(this.config.uploadPath, 'images'),
            path.join(this.config.uploadPath, 'documents'),
            path.join(this.config.uploadPath, 'archives'),
            path.join(this.config.uploadPath, 'others'),
            path.join(this.config.uploadPath, 'thumbnails'),
            path.join(this.config.uploadPath, 'versions')
        ];
        
        for (const dir of directories) {
            try {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`📁 创建目录: ${dir}`);
                }
            } catch (error) {
                console.log(`📁 模拟创建目录: ${dir}`);
            }
        }
        
        console.log('✅ 文件存储目录创建完成');
    }

    /**
     * 初始化文件处理器
     */
    async initializeFileProcessors() {
        console.log('🔧 初始化文件处理器...');
        
        // 文件类型检测器
        this.fileTypeDetector = {
            detectType: (filename, buffer) => {
                const ext = path.extname(filename).toLowerCase();
                
                // 基于文件扩展名的简单检测
                const typeMap = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.pdf': 'application/pdf',
                    '.txt': 'text/plain',
                    '.csv': 'text/csv',
                    '.doc': 'application/msword',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.xls': 'application/vnd.ms-excel',
                    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.zip': 'application/zip',
                    '.rar': 'application/x-rar-compressed'
                };
                
                return typeMap[ext] || 'application/octet-stream';
            }
        };
        
        // 缩略图生成器
        this.thumbnailGenerator = {
            generate: async (filePath, outputPath, size = 150) => {
                console.log(`🖼️ 生成缩略图: ${filePath} -> ${outputPath} (${size}px)`);
                // 实际实现中会使用sharp或其他图像处理库
                return outputPath;
            },
            
            canGenerate: (mimeType) => {
                return mimeType.startsWith('image/');
            }
        };
        
        // 文件压缩器
        this.fileCompressor = {
            compress: async (inputPath, outputPath) => {
                console.log(`📦 压缩文件: ${inputPath} -> ${outputPath}`);
                // 实际实现中会使用zlib或其他压缩库
                return {
                    success: true,
                    originalSize: 1024,
                    compressedSize: 512,
                    compressionRatio: 0.5
                };
            },
            
            shouldCompress: (fileSize, mimeType) => {
                return fileSize > this.config.compressionThreshold && 
                       !mimeType.startsWith('image/') && 
                       !mimeType.includes('compressed');
            }
        };
        
        // 病毒扫描器
        this.virusScanner = {
            scan: async (filePath) => {
                console.log(`🛡️ 扫描文件: ${filePath}`);
                // 实际实现中会集成ClamAV或其他杀毒引擎
                return {
                    status: 'clean',
                    threats: [],
                    scanTime: Date.now()
                };
            }
        };
        
        console.log('✅ 文件处理器初始化完成');
    }

    /**
     * 加载默认设置
     */
    async loadDefaultSettings() {
        console.log('📋 加载默认文件管理设置...');
        
        // 模拟加载配置
        const defaultSettings = {
            maxFileSize: 100 * 1024 * 1024,
            allowedTypes: this.config.allowedTypes,
            enableVersionControl: true,
            maxVersions: 10,
            autoDeleteExpired: true,
            virusScanEnabled: false,
            thumbnailQuality: 80,
            compressionLevel: 6
        };
        
        // 合并配置
        this.config = { ...this.config, ...defaultSettings };
        
        console.log('✅ 默认设置加载完成');
    }

    /**
     * 启动后台任务
     */
    async startBackgroundTasks() {
        console.log('🔄 启动文件管理后台任务...');
        
        // 清理过期上传会话
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // 每5分钟
        
        // 清理临时文件
        setInterval(() => {
            this.cleanupTempFiles();
        }, 30 * 60 * 1000); // 每30分钟
        
        // 更新统计信息
        setInterval(() => {
            this.updateStatistics();
        }, 10 * 60 * 1000); // 每10分钟
        
        // 回收站清理
        setInterval(() => {
            this.cleanupRecycleBin();
        }, 24 * 60 * 60 * 1000); // 每24小时
        
        console.log('✅ 后台任务启动完成');
    }

    // ============ 文件上传相关方法 ============

    /**
     * 开始文件上传会话
     */
    async startUploadSession(shopId, userId, fileInfo) {
        try {
            const sessionId = 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const sessionToken = crypto.randomBytes(32).toString('hex');
            
            // 计算分块信息
            const chunkSize = 1024 * 1024; // 1MB chunks
            const totalChunks = Math.ceil(fileInfo.size / chunkSize);
            
            const session = {
                id: sessionId,
                shop_id: shopId,
                user_id: userId,
                session_token: sessionToken,
                file_name: fileInfo.name,
                file_size: fileInfo.size,
                chunk_size: chunkSize,
                total_chunks: totalChunks,
                uploaded_chunks: 0,
                upload_progress: 0.0,
                status: 'active',
                temp_path: path.join(this.config.tempPath, sessionId),
                target_path: '',
                metadata: JSON.stringify(fileInfo),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时过期
            };
            
            // 保存到内存缓存
            this.uploadSessions.set(sessionId, session);
            
            console.log(`📤 创建上传会话: ${sessionId}`);
            
            return {
                sessionId,
                sessionToken,
                chunkSize,
                totalChunks,
                uploadUrl: `/api/files/upload/chunk/${sessionToken}`
            };
            
        } catch (error) {
            console.error('❌ 创建上传会话失败:', error);
            throw error;
        }
    }

    /**
     * 上传文件块
     */
    async uploadChunk(sessionToken, chunkIndex, chunkData) {
        try {
            // 查找上传会话
            let session = null;
            for (const [id, sess] of this.uploadSessions) {
                if (sess.session_token === sessionToken) {
                    session = sess;
                    break;
                }
            }
            
            if (!session) {
                throw new Error('上传会话不存在或已过期');
            }
            
            // 验证块索引
            if (chunkIndex < 0 || chunkIndex >= session.total_chunks) {
                throw new Error('无效的块索引');
            }
            
            // 保存块数据（实际实现中会写入临时文件）
            console.log(`📦 上传块 ${chunkIndex + 1}/${session.total_chunks} (${chunkData.length} bytes)`);
            
            // 更新上传进度
            session.uploaded_chunks = chunkIndex + 1;
            session.upload_progress = (session.uploaded_chunks / session.total_chunks) * 100;
            session.updated_at = new Date().toISOString();
            
            // 检查是否完成上传
            if (session.uploaded_chunks === session.total_chunks) {
                return await this.completeUpload(session);
            }
            
            return {
                success: true,
                progress: session.upload_progress,
                uploadedChunks: session.uploaded_chunks,
                totalChunks: session.total_chunks
            };
            
        } catch (error) {
            console.error('❌ 上传块失败:', error);
            throw error;
        }
    }

    /**
     * 完成文件上传
     */
    async completeUpload(session) {
        try {
            console.log(`✅ 完成文件上传: ${session.file_name}`);
            
            // 生成文件ID和路径
            const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const fileHash = crypto.createHash('sha256').update(session.file_name + Date.now()).digest('hex');
            const fileExtension = path.extname(session.file_name);
            const category = this.categorizeFile(session.file_name);
            const finalPath = path.join(this.config.uploadPath, category, fileId + fileExtension);
            
            // 创建文件记录
            const fileInfo = {
                id: fileId,
                shop_id: session.shop_id,
                user_id: session.user_id,
                original_name: session.file_name,
                file_name: fileId + fileExtension,
                file_path: finalPath,
                file_size: session.file_size,
                mime_type: this.fileTypeDetector.detectType(session.file_name),
                file_hash: fileHash,
                file_extension: fileExtension,
                category: category,
                description: '',
                thumbnail_path: '',
                preview_available: false,
                download_count: 0,
                view_count: 0,
                is_public: false,
                is_compressed: false,
                compression_ratio: 1.0,
                virus_scan_status: 'pending',
                virus_scan_result: '',
                upload_status: 'completed',
                upload_progress: 100.0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                expires_at: null,
                metadata: session.metadata
            };
            
            // 保存到缓存
            this.fileCache.set(fileId, fileInfo);
            
            // 生成缩略图
            if (this.thumbnailGenerator.canGenerate(fileInfo.mime_type)) {
                await this.generateThumbnails(fileInfo);
            }
            
            // 病毒扫描
            if (this.config.enableVirusScan) {
                await this.scanFile(fileInfo);
            }
            
            // 清理上传会话
            this.uploadSessions.delete(session.id);
            
            // 更新统计
            this.stats.totalUploads++;
            this.stats.totalStorage += session.file_size;
            
            return {
                success: true,
                fileId: fileId,
                fileName: fileInfo.original_name,
                fileSize: fileInfo.file_size,
                mimeType: fileInfo.mime_type,
                category: fileInfo.category,
                uploadTime: fileInfo.created_at
            };
            
        } catch (error) {
            console.error('❌ 完成上传失败:', error);
            throw error;
        }
    }

    // ============ 文件管理相关方法 ============

    /**
     * 文件分类
     */
    categorizeFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
            return 'images';
        } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'].includes(ext)) {
            return 'documents';
        } else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
            return 'archives';
        } else {
            return 'others';
        }
    }

    /**
     * 生成缩略图
     */
    async generateThumbnails(fileInfo) {
        try {
            console.log(`🖼️ 生成缩略图: ${fileInfo.original_name}`);
            
            const thumbnailDir = path.join(this.config.uploadPath, 'thumbnails', fileInfo.id);
            const thumbnailPaths = {};
            
            for (const size of this.config.thumbnailSizes) {
                const thumbnailPath = path.join(thumbnailDir, `${size}.jpg`);
                await this.thumbnailGenerator.generate(fileInfo.file_path, thumbnailPath, size);
                thumbnailPaths[size] = thumbnailPath;
            }
            
            // 更新文件信息
            fileInfo.thumbnail_path = JSON.stringify(thumbnailPaths);
            fileInfo.preview_available = true;
            
            console.log(`✅ 缩略图生成完成: ${fileInfo.id}`);
            
        } catch (error) {
            console.error('❌ 生成缩略图失败:', error);
        }
    }

    /**
     * 扫描文件
     */
    async scanFile(fileInfo) {
        try {
            console.log(`🛡️ 扫描文件: ${fileInfo.original_name}`);
            
            const scanResult = await this.virusScanner.scan(fileInfo.file_path);
            
            fileInfo.virus_scan_status = scanResult.status;
            fileInfo.virus_scan_result = JSON.stringify(scanResult);
            
            if (scanResult.status === 'infected') {
                // 隔离感染文件
                await this.quarantineFile(fileInfo);
            }
            
            console.log(`✅ 文件扫描完成: ${fileInfo.id} - ${scanResult.status}`);
            
        } catch (error) {
            console.error('❌ 文件扫描失败:', error);
            fileInfo.virus_scan_status = 'error';
        }
    }

    /**
     * 隔离文件
     */
    async quarantineFile(fileInfo) {
        console.log(`🚨 隔离感染文件: ${fileInfo.id}`);
        
        // 移动到隔离区
        const quarantinePath = path.join(this.config.uploadPath, 'quarantine', fileInfo.id);
        
        // 更新文件状态
        fileInfo.upload_status = 'quarantined';
        fileInfo.file_path = quarantinePath;
        
        // 记录隔离日志
        await this.logFileAction(fileInfo.id, 'quarantine', 'system', {
            reason: 'virus_detected',
            scan_result: fileInfo.virus_scan_result
        });
    }

    /**
     * 记录文件操作日志
     */
    async logFileAction(fileId, action, userId, metadata = {}) {
        const logEntry = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            file_id: fileId,
            action: action,
            user_id: userId,
            metadata: JSON.stringify(metadata),
            timestamp: new Date().toISOString()
        };
        
        console.log(`📝 文件操作日志: ${action} - ${fileId}`);
    }

    // ============ 清理和维护方法 ============

    /**
     * 清理过期上传会话
     */
    async cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [sessionId, session] of this.uploadSessions) {
            const expiresAt = new Date(session.expires_at).getTime();
            if (now > expiresAt) {
                this.uploadSessions.delete(sessionId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 清理过期上传会话: ${cleanedCount} 个`);
        }
    }

    /**
     * 清理临时文件
     */
    async cleanupTempFiles() {
        console.log('🧹 清理临时文件...');
        // 实际实现中会扫描临时目录并删除过期文件
    }

    /**
     * 更新统计信息
     */
    async updateStatistics() {
        this.stats.totalFiles = this.fileCache.size;
        this.stats.activeUploadSessions = this.uploadSessions.size;
        
        console.log(`📊 文件统计更新: ${this.stats.totalFiles} 个文件`);
    }

    /**
     * 清理回收站
     */
    async cleanupRecycleBin() {
        console.log('🗑️ 清理回收站过期文件...');
        // 实际实现中会删除过期的回收站文件
    }

    /**
     * 销毁实例
     */
    async destroy() {
        try {
            console.log('🔄 销毁文件管理系统实例...');
            
            // 清理缓存
            this.fileCache.clear();
            this.uploadSessions.clear();
            this.downloadTokens.clear();
            
            console.log('✅ 文件管理系统实例销毁完成');
            
        } catch (error) {
            console.error('❌ 销毁文件管理系统实例失败:', error);
            throw error;
        }
    }

    // ============ 文件下载和分享 ============

    /**
     * 生成下载令牌
     */
    async generateDownloadToken(fileId, userId, options = {}) {
        try {
            const file = this.fileCache.get(fileId);
            if (!file) {
                throw new Error('文件不存在');
            }
            
            // 检查权限
            const hasPermission = await this.checkFilePermission(fileId, userId, 'read');
            if (!hasPermission) {
                throw new Error('没有下载权限');
            }
            
            const token = crypto.randomBytes(32).toString('hex');
            const tokenInfo = {
                fileId,
                userId,
                token,
                createdAt: Date.now(),
                expiresAt: Date.now() + (options.expiresIn || 3600000), // 默认1小时
                downloadCount: 0,
                maxDownloads: options.maxDownloads || 1
            };
            
            this.downloadTokens.set(token, tokenInfo);
            
            return {
                token,
                downloadUrl: `/api/files/download/${token}`,
                expiresAt: tokenInfo.expiresAt
            };
            
        } catch (error) {
            console.error('❌ 生成下载令牌失败:', error);
            throw error;
        }
    }

    /**
     * 创建文件分享
     */
    async createFileShare(fileId, userId, shareOptions) {
        try {
            const shareId = 'share_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const shareToken = crypto.randomBytes(32).toString('hex');
            
            const share = {
                id: shareId,
                file_id: fileId,
                shared_by: userId,
                shared_with: shareOptions.sharedWith || null,
                share_type: shareOptions.shareType || 'public',
                share_token: shareToken,
                password_hash: shareOptions.password ? 
                    crypto.createHash('sha256').update(shareOptions.password).digest('hex') : null,
                access_level: shareOptions.accessLevel || 'read',
                download_allowed: shareOptions.downloadAllowed !== false,
                view_count: 0,
                download_count: 0,
                expires_at: shareOptions.expiresAt || null,
                is_active: true,
                created_at: new Date().toISOString(),
                last_accessed: null,
                access_restrictions: JSON.stringify(shareOptions.restrictions || {})
            };
            
            // 保存分享信息（实际中会保存到数据库）
            console.log(`🔗 创建文件分享: ${shareId}`);
            
            this.stats.activeShares++;
            
            return {
                shareId,
                shareToken,
                shareUrl: `/share/${shareToken}`,
                accessLevel: share.access_level,
                expiresAt: share.expires_at
            };
            
        } catch (error) {
            console.error('❌ 创建文件分享失败:', error);
            throw error;
        }
    }

    /**
     * 获取文件列表
     */
    async getFileList(shopId, userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                category = null,
                sortBy = 'created_at',
                sortOrder = 'desc',
                search = null,
                includeShared = false
            } = options;
            
            const files = [];
            
            // 从缓存中获取文件
            for (const [fileId, file] of this.fileCache) {
                if (file.shop_id !== shopId) continue;
                
                // 权限检查
                const hasAccess = file.user_id === userId || includeShared;
                if (!hasAccess) continue;
                
                // 分类过滤
                if (category && file.category !== category) continue;
                
                // 搜索过滤
                if (search && !file.original_name.toLowerCase().includes(search.toLowerCase())) {
                    continue;
                }
                
                files.push({
                    id: file.id,
                    originalName: file.original_name,
                    fileName: file.file_name,
                    fileSize: file.file_size,
                    mimeType: file.mime_type,
                    category: file.category,
                    description: file.description,
                    downloadCount: file.download_count,
                    viewCount: file.view_count,
                    isPublic: file.is_public,
                    previewAvailable: file.preview_available,
                    thumbnailPath: file.thumbnail_path,
                    uploadStatus: file.upload_status,
                    virusScanStatus: file.virus_scan_status,
                    createdAt: file.created_at,
                    updatedAt: file.updated_at,
                    owner: file.user_id === userId
                });
            }
            
            // 排序
            files.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];
                
                if (sortOrder === 'desc') {
                    return bVal > aVal ? 1 : -1;
                } else {
                    return aVal > bVal ? 1 : -1;
                }
            });
            
            // 分页
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedFiles = files.slice(startIndex, endIndex);
            
            return {
                files: paginatedFiles,
                pagination: {
                    page,
                    limit,
                    total: files.length,
                    totalPages: Math.ceil(files.length / limit)
                }
            };
            
        } catch (error) {
            console.error('❌ 获取文件列表失败:', error);
            throw error;
        }
    }

    /**
     * 获取文件详情
     */
    async getFileDetails(fileId, userId) {
        try {
            const file = this.fileCache.get(fileId);
            if (!file) {
                throw new Error('文件不存在');
            }
            
            // 检查权限
            const hasPermission = await this.checkFilePermission(fileId, userId, 'read');
            if (!hasPermission) {
                throw new Error('没有查看权限');
            }
            
            // 增加查看次数
            file.view_count++;
            
            // 获取版本信息
            const versions = await this.getFileVersions(fileId);
            
            // 获取分享信息
            const shares = await this.getFileShares(fileId);
            
            // 获取标签
            const tags = await this.getFileTags(fileId);
            
            // 获取评论
            const comments = await this.getFileComments(fileId);
            
            return {
                ...file,
                versions,
                shares,
                tags,
                comments,
                permissions: await this.getFilePermissions(fileId)
            };
            
        } catch (error) {
            console.error('❌ 获取文件详情失败:', error);
            throw error;
        }
    }

    /**
     * 删除文件（移到回收站）
     */
    async deleteFile(fileId, userId) {
        try {
            const file = this.fileCache.get(fileId);
            if (!file) {
                throw new Error('文件不存在');
            }
            
            // 检查权限
            const hasPermission = await this.checkFilePermission(fileId, userId, 'delete');
            if (!hasPermission) {
                throw new Error('没有删除权限');
            }
            
            // 移到回收站
            const recycleBinEntry = {
                id: 'recycle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                file_id: fileId,
                original_path: file.file_path,
                deleted_by: userId,
                deleted_at: new Date().toISOString(),
                restore_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后永久删除
                file_data: JSON.stringify(file)
            };
            
            // 更新文件状态
            file.upload_status = 'deleted';
            file.updated_at = new Date().toISOString();
            
            console.log(`🗑️ 文件移到回收站: ${fileId}`);
            
            // 记录操作日志
            await this.logFileAction(fileId, 'delete', userId, {
                restore_deadline: recycleBinEntry.restore_deadline
            });
            
            return {
                success: true,
                message: '文件已移到回收站',
                restoreDeadline: recycleBinEntry.restore_deadline
            };
            
        } catch (error) {
            console.error('❌ 删除文件失败:', error);
            throw error;
        }
    }

    /**
     * 恢复文件
     */
    async restoreFile(fileId, userId) {
        try {
            const file = this.fileCache.get(fileId);
            if (!file || file.upload_status !== 'deleted') {
                throw new Error('文件不存在或未删除');
            }
            
            // 检查权限
            const hasPermission = await this.checkFilePermission(fileId, userId, 'restore');
            if (!hasPermission) {
                throw new Error('没有恢复权限');
            }
            
            // 恢复文件状态
            file.upload_status = 'completed';
            file.updated_at = new Date().toISOString();
            
            console.log(`♻️ 恢复文件: ${fileId}`);
            
            // 记录操作日志
            await this.logFileAction(fileId, 'restore', userId);
            
            return {
                success: true,
                message: '文件已恢复'
            };
            
        } catch (error) {
            console.error('❌ 恢复文件失败:', error);
            throw error;
        }
    }

    // ============ 版本控制 ============

    /**
     * 创建文件版本
     */
    async createFileVersion(fileId, userId, newFilePath, changeDescription) {
        try {
            if (!this.config.enableVersionControl) {
                throw new Error('版本控制未启用');
            }
            
            const file = this.fileCache.get(fileId);
            if (!file) {
                throw new Error('文件不存在');
            }
            
            // 检查权限
            const hasPermission = await this.checkFilePermission(fileId, userId, 'write');
            if (!hasPermission) {
                throw new Error('没有编辑权限');
            }
            
            // 获取当前版本号
            const versions = await this.getFileVersions(fileId);
            const nextVersion = versions.length + 1;
            
            const versionId = 'version_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const version = {
                id: versionId,
                file_id: fileId,
                version_number: nextVersion,
                file_path: newFilePath,
                file_size: 0, // 实际实现中会获取文件大小
                file_hash: crypto.createHash('sha256').update(newFilePath).digest('hex'),
                change_description: changeDescription || '',
                created_by: userId,
                created_at: new Date().toISOString(),
                is_current: true
            };
            
            // 将之前的版本设为非当前版本
            versions.forEach(v => v.is_current = false);
            
            console.log(`📚 创建文件版本: ${fileId} v${nextVersion}`);
            
            // 记录操作日志
            await this.logFileAction(fileId, 'version_create', userId, {
                version_number: nextVersion,
                change_description: changeDescription
            });
            
            return version;
            
        } catch (error) {
            console.error('❌ 创建文件版本失败:', error);
            throw error;
        }
    }

    /**
     * 获取文件版本列表
     */
    async getFileVersions(fileId) {
        // 模拟返回版本列表
        return [
            {
                id: 'version_1',
                file_id: fileId,
                version_number: 1,
                file_path: '/uploads/file_v1.txt',
                file_size: 1024,
                file_hash: 'hash1',
                change_description: '初始版本',
                created_by: 'user_1',
                created_at: new Date().toISOString(),
                is_current: true
            }
        ];
    }

    // ============ 权限和安全 ============

    /**
     * 检查文件权限
     */
    async checkFilePermission(fileId, userId, permission) {
        const file = this.fileCache.get(fileId);
        if (!file) return false;
        
        // 文件所有者拥有所有权限
        if (file.user_id === userId) return true;
        
        // 公开文件的读取权限
        if (file.is_public && permission === 'read') return true;
        
        // TODO: 检查具体权限表
        return false;
    }

    /**
     * 获取文件权限列表
     */
    async getFilePermissions(fileId) {
        // 模拟返回权限列表
        return [];
    }

    /**
     * 获取文件分享列表
     */
    async getFileShares(fileId) {
        // 模拟返回分享列表
        return [];
    }

    /**
     * 获取文件标签
     */
    async getFileTags(fileId) {
        // 模拟返回标签列表
        return [];
    }

    /**
     * 获取文件评论
     */
    async getFileComments(fileId) {
        // 模拟返回评论列表
        return [];
    }

    // ============ 公共API方法 ============

    /**
     * 搜索文件
     */
    async searchFiles(shopId, userId, query, options = {}) {
        try {
            const {
                category = null,
                fileType = null,
                dateRange = null,
                sizeRange = null,
                tags = [],
                sortBy = 'relevance'
            } = options;
            
            const results = [];
            
            for (const [fileId, file] of this.fileCache) {
                if (file.shop_id !== shopId) continue;
                
                // 权限检查
                const hasPermission = await this.checkFilePermission(fileId, userId, 'read');
                if (!hasPermission) continue;
                
                // 搜索匹配
                const nameMatch = file.original_name.toLowerCase().includes(query.toLowerCase());
                const descMatch = file.description && file.description.toLowerCase().includes(query.toLowerCase());
                
                if (nameMatch || descMatch) {
                    let score = nameMatch ? 10 : 5; // 文件名匹配权重更高
                    
                    results.push({
                        ...file,
                        searchScore: score,
                        matchType: nameMatch ? 'filename' : 'description'
                    });
                }
            }
            
            // 按相关度排序
            results.sort((a, b) => b.searchScore - a.searchScore);
            
            return {
                query,
                results: results.slice(0, 50), // 限制结果数量
                total: results.length
            };
            
        } catch (error) {
            console.error('❌ 搜索文件失败:', error);
            throw error;
        }
    }

    /**
     * 获取文件统计信息
     */
    async getFileStatistics(shopId, userId) {
        try {
            let totalFiles = 0;
            let totalSize = 0;
            const categoryStats = {};
            const typeStats = {};
            
            for (const [fileId, file] of this.fileCache) {
                if (file.shop_id !== shopId) continue;
                if (file.upload_status !== 'completed') continue;
                
                const hasPermission = await this.checkFilePermission(fileId, userId, 'read');
                if (!hasPermission) continue;
                
                totalFiles++;
                totalSize += file.file_size;
                
                // 分类统计
                categoryStats[file.category] = (categoryStats[file.category] || 0) + 1;
                
                // 类型统计
                const ext = file.file_extension || 'unknown';
                typeStats[ext] = (typeStats[ext] || 0) + 1;
            }
            
            return {
                totalFiles,
                totalSize,
                averageSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0,
                categoryStats,
                typeStats,
                recentUploads: totalFiles, // 简化实现
                ...this.stats
            };
            
        } catch (error) {
            console.error('❌ 获取文件统计失败:', error);
            throw error;
        }
    }

    // ============ 新增核心文件操作方法 ============

    /**
     * 上传文件
     */
    async uploadFile(fileData, metadata = {}) {
        try {
            const { filename, buffer, userId, shopId } = fileData;
            
            console.log(`📤 开始上传文件: ${filename}`);
            
            // 1. 生成文件ID和路径
            const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const fileHash = require('crypto').createHash('md5').update(buffer).digest('hex');
            const fileExtension = require('path').extname(filename);
            const mimeType = this.detectMimeType(filename, buffer);
            
            // 2. 验证文件
            const validation = this.validateFile(filename, buffer, mimeType);
            if (!validation.valid) {
                throw new Error(`文件验证失败: ${validation.errors.join(', ')}`);
            }
            
            // 3. 保存到缓存（模拟文件存储）
            const fileInfo = {
                id: fileId,
                shop_id: shopId || 'default_shop',
                user_id: userId,
                original_name: filename,
                file_name: fileId + fileExtension,
                file_path: `/uploads/${fileId}${fileExtension}`,
                file_size: buffer.length,
                mime_type: mimeType,
                file_hash: fileHash,
                file_extension: fileExtension,
                category: this.getCategoryFromMimeType(mimeType),
                description: metadata.description || '',
                thumbnail_path: null,
                preview_available: false,
                download_count: 0,
                view_count: 0,
                is_public: metadata.isPublic || false,
                is_compressed: false,
                compression_ratio: 1.0,
                virus_scan_status: 'clean',
                virus_scan_result: null,
                upload_status: 'completed',
                upload_progress: 1.0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                expires_at: null,
                metadata: JSON.stringify(metadata)
            };
            
            // 4. 存储文件信息到缓存
            this.fileCache.set(fileId, fileInfo);
            
            // 5. 存储文件内容
            if (!this.fileContentCache) {
                this.fileContentCache = new Map();
            }
            this.fileContentCache.set(fileId, buffer);
            
            // 6. 更新统计
            this.stats.totalUploads++;
            
            console.log(`✅ 文件上传成功: ${filename} (ID: ${fileId})`);
            
            return {
                success: true,
                fileId,
                fileInfo,
                message: '文件上传成功'
            };
            
        } catch (error) {
            console.error('❌ 文件上传失败:', error);
            throw error;
        }
    }

    /**
     * 下载文件
     */
    async downloadFile(fileId, userId) {
        try {
            // 检查文件是否存在
            const fileInfo = this.fileCache.get(fileId);
            if (!fileInfo) {
                throw new Error('文件不存在');
            }
            
            // 检查权限
            const hasPermission = await this.checkFilePermission(fileId, userId, 'read');
            if (!hasPermission) {
                throw new Error('无权限访问此文件');
            }
            
            // 获取文件内容
            const fileContent = this.fileContentCache?.get(fileId);
            if (!fileContent) {
                throw new Error('文件内容不存在');
            }
            
            // 更新统计
            fileInfo.download_count = (fileInfo.download_count || 0) + 1;
            fileInfo.updated_at = new Date().toISOString();
            this.fileCache.set(fileId, fileInfo);
            this.stats.totalDownloads++;
            
            console.log(`📥 文件下载: ${fileInfo.original_name} (ID: ${fileId})`);
            
            return {
                success: true,
                fileData: fileContent,
                fileInfo,
                message: '文件下载成功'
            };
            
        } catch (error) {
            console.error('❌ 文件下载失败:', error);
            throw error;
        }
    }

    /**
     * 获取文件列表
     */
    async getFileList(options = {}) {
        try {
            const { shopId, userId, category, mimeType, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = options;
            
            let files = Array.from(this.fileCache.values());
            
            // 筛选条件
            if (shopId) {
                files = files.filter(file => file.shop_id === shopId);
            }
            
            if (userId) {
                // 只显示用户有权限访问的文件
                const accessibleFiles = [];
                for (const file of files) {
                    const hasPermission = await this.checkFilePermission(file.id, userId, 'read');
                    if (hasPermission) {
                        accessibleFiles.push(file);
                    }
                }
                files = accessibleFiles;
            }
            
            if (category && category !== 'all') {
                files = files.filter(file => file.category === category);
            }
            
            if (mimeType) {
                files = files.filter(file => file.mime_type.startsWith(mimeType));
            }
            
            // 只显示上传完成的文件
            files = files.filter(file => file.upload_status === 'completed');
            
            // 排序
            files.sort((a, b) => {
                const aVal = a[sortBy] || '';
                const bVal = b[sortBy] || '';
                const order = sortOrder === 'desc' ? -1 : 1;
                
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return aVal.localeCompare(bVal) * order;
                }
                
                return (aVal > bVal ? 1 : aVal < bVal ? -1 : 0) * order;
            });
            
            // 分页
            const total = files.length;
            const startIndex = (page - 1) * limit;
            const paginatedFiles = files.slice(startIndex, startIndex + limit);
            
            return {
                success: true,
                files: paginatedFiles,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
            
        } catch (error) {
            console.error('❌ 获取文件列表失败:', error);
            throw error;
        }
    }

    /**
     * 搜索文件
     */
    async searchFiles(query, options = {}) {
        try {
            const { shopId, limit = 20 } = options;
            
            let files = Array.from(this.fileCache.values());
            
            // 筛选店铺
            if (shopId) {
                files = files.filter(file => file.shop_id === shopId);
            }
            
            // 只搜索已完成上传的文件
            files = files.filter(file => file.upload_status === 'completed');
            
            // 搜索逻辑
            const results = [];
            const searchTerm = query.toLowerCase();
            
            for (const file of files) {
                let score = 0;
                
                // 文件名匹配
                if (file.original_name.toLowerCase().includes(searchTerm)) {
                    score += 10;
                }
                
                // 描述匹配
                if (file.description && file.description.toLowerCase().includes(searchTerm)) {
                    score += 5;
                }
                
                // 扩展名匹配
                if (file.file_extension && file.file_extension.toLowerCase().includes(searchTerm)) {
                    score += 3;
                }
                
                if (score > 0) {
                    results.push({
                        ...file,
                        relevanceScore: score
                    });
                }
            }
            
            // 按相关度排序
            results.sort((a, b) => b.relevanceScore - a.relevanceScore);
            
            return {
                success: true,
                files: results.slice(0, limit),
                query,
                total: results.length
            };
            
        } catch (error) {
            console.error('❌ 搜索文件失败:', error);
            throw error;
        }
    }

    /**
     * 获取文件预览
     */
    async getFilePreview(fileId, userId) {
        try {
            // 检查文件是否存在
            const fileInfo = this.fileCache.get(fileId);
            if (!fileInfo) {
                throw new Error('文件不存在');
            }
            
            // 检查权限
            const hasPermission = await this.checkFilePermission(fileId, userId, 'read');
            if (!hasPermission) {
                throw new Error('无权限访问此文件');
            }
            
            // 生成预览
            const preview = this.generatePreview(fileInfo);
            
            return {
                success: true,
                preview,
                fileInfo
            };
            
        } catch (error) {
            console.error('❌ 获取文件预览失败:', error);
            throw error;
        }
    }

    /**
     * 创建共享链接
     */
    async createShareLink(fileId, userId, options = {}) {
        try {
            // 检查文件是否存在
            const fileInfo = this.fileCache.get(fileId);
            if (!fileInfo) {
                throw new Error('文件不存在');
            }
            
            // 检查权限
            const hasPermission = await this.checkFilePermission(fileId, userId, 'share');
            if (!hasPermission && fileInfo.user_id !== userId) {
                throw new Error('无权限共享此文件');
            }
            
            // 生成共享令牌
            const shareToken = require('crypto').randomBytes(32).toString('hex');
            
            // 存储共享信息
            if (!this.shareLinks) {
                this.shareLinks = new Map();
            }
            
            const shareInfo = {
                fileId,
                token: shareToken,
                type: options.type || 'public',
                createdBy: userId,
                createdAt: new Date().toISOString(),
                expiresAt: options.expiresAt,
                password: options.password,
                maxDownloads: options.maxDownloads,
                downloadCount: 0,
                isActive: true
            };
            
            this.shareLinks.set(shareToken, shareInfo);
            
            return {
                success: true,
                shareToken,
                shareUrl: `/api/files/share/${shareToken}`,
                message: '共享链接创建成功'
            };
            
        } catch (error) {
            console.error('❌ 创建共享链接失败:', error);
            throw error;
        }
    }

    /**
     * 删除文件
     */
    async deleteFile(fileId, userId) {
        try {
            // 检查文件是否存在
            const fileInfo = this.fileCache.get(fileId);
            if (!fileInfo) {
                throw new Error('文件不存在');
            }
            
            // 检查权限
            const hasPermission = await this.checkFilePermission(fileId, userId, 'delete');
            if (!hasPermission && fileInfo.user_id !== userId) {
                throw new Error('无权限删除此文件');
            }
            
            // 删除文件信息
            this.fileCache.delete(fileId);
            
            // 删除文件内容
            if (this.fileContentCache) {
                this.fileContentCache.delete(fileId);
            }
            
            // 删除相关共享链接
            if (this.shareLinks) {
                for (const [token, shareInfo] of this.shareLinks.entries()) {
                    if (shareInfo.fileId === fileId) {
                        this.shareLinks.delete(token);
                    }
                }
            }
            
            console.log(`🗑️ 文件删除成功: ${fileInfo.original_name} (ID: ${fileId})`);
            
            return {
                success: true,
                message: '文件删除成功'
            };
            
        } catch (error) {
            console.error('❌ 文件删除失败:', error);
            throw error;
        }
    }

    /**
     * 获取存储统计
     */
    async getStorageStats(shopId) {
        try {
            const shopFiles = Array.from(this.fileCache.values()).filter(file => 
                file.shop_id === shopId && file.upload_status === 'completed'
            );
            
            const stats = {
                shopId,
                totalFiles: shopFiles.length,
                totalSize: shopFiles.reduce((sum, file) => sum + file.file_size, 0),
                fileTypes: shopFiles.reduce((types, file) => {
                    const type = file.category || 'other';
                    types[type] = (types[type] || 0) + 1;
                    return types;
                }, {}),
                recentFiles: shopFiles
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .slice(0, 5),
                lastUpdated: new Date().toISOString()
            };
            
            return {
                success: true,
                stats,
                globalStats: this.stats
            };
            
        } catch (error) {
            console.error('❌ 获取存储统计失败:', error);
            throw error;
        }
    }

    // ============ 辅助方法 ============

    /**
     * 检测文件MIME类型
     */
    detectMimeType(filename, buffer) {
        const ext = require('path').extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf', '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain', '.html': 'text/html', '.css': 'text/css',
            '.js': 'text/javascript', '.json': 'application/json', '.csv': 'text/csv',
            '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
            '.mp4': 'video/mp4', '.avi': 'video/avi',
            '.zip': 'application/zip', '.rar': 'application/x-rar-compressed'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * 验证文件
     */
    validateFile(filename, buffer, mimeType) {
        const errors = [];
        
        // 检查文件大小
        if (buffer.length > this.config.maxFileSize) {
            errors.push(`文件大小超过限制 (${this.config.maxFileSize / 1024 / 1024}MB)`);
        }
        
        // 检查文件类型
        if (!this.config.allowedTypes.includes(mimeType)) {
            // 检查是否为通配符类型
            const generalType = mimeType.split('/')[0] + '/*';
            if (!this.config.allowedTypes.includes(generalType)) {
                errors.push('不支持的文件类型');
            }
        }
        
        // 检查文件名
        if (!/^[a-zA-Z0-9\u4e00-\u9fa5._-]+$/.test(filename)) {
            errors.push('文件名包含非法字符');
        }
        
        return { valid: errors.length === 0, errors };
    }

    /**
     * 根据MIME类型获取分类
     */
    getCategoryFromMimeType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('excel')) return 'document';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'archive';
        if (mimeType.startsWith('text/')) return 'text';
        return 'other';
    }

    /**
     * 生成预览
     */
    generatePreview(fileInfo) {
        const preview = {
            fileId: fileInfo.id,
            type: 'preview',
            generatedAt: new Date().toISOString()
        };
        
        if (fileInfo.mime_type.startsWith('image/')) {
            preview.previewType = 'image';
            preview.thumbnail = `/api/files/thumbnail/${fileInfo.id}`;
        } else if (fileInfo.mime_type.startsWith('text/')) {
            preview.previewType = 'text';
            preview.canPreview = true;
        } else if (fileInfo.mime_type === 'application/pdf') {
            preview.previewType = 'pdf';
            preview.canPreview = true;
        } else {
            preview.previewType = 'generic';
            preview.canPreview = false;
        }
        
        return preview;
    }

    /**
     * 检查文件权限
     */
    async checkFilePermission(fileId, userId, permission) {
        // 简化权限检查：文件所有者拥有所有权限，其他用户有读权限
        const fileInfo = this.fileCache.get(fileId);
        if (!fileInfo) return false;
        
        // 文件所有者
        if (fileInfo.user_id === userId) return true;
        
        // 公开文件的读权限
        if (fileInfo.is_public && permission === 'read') return true;
        
        // 其他情况暂时允许（实际应用中需要更复杂的权限系统）
        return permission === 'read';
    }
}

module.exports = FileManager;