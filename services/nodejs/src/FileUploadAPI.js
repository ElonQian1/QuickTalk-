/**
 * 文件上传API路由模块
 * 支持图片、文档等多种文件类型的上传功能
 * 专为电商客服系统优化
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

class FileUploadAPI {
    constructor(fileManager, authValidator, database = null) {
        this.fileManager = fileManager;
        this.authValidator = authValidator;
        this.database = database || global.database; // 优先使用传入的数据库实例
        this.router = express.Router();
        
        // 配置multer中间件
        this.setupMulter();
        
        // 初始化路由
        this.initializeRoutes();
    }

    /**
     * 配置Multer中间件
     */
    setupMulter() {
        // 确保上传目录存在
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // 配置存储
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const fileType = this.getFileType(file.originalname);
                const typedDir = path.join(uploadDir, fileType);
                
                if (!fs.existsSync(typedDir)) {
                    fs.mkdirSync(typedDir, { recursive: true });
                }
                
                cb(null, typedDir);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const ext = path.extname(file.originalname);
                const filename = `${uniqueSuffix}${ext}`;
                cb(null, filename);
            }
        });

        // 文件过滤器
        const fileFilter = (req, file, cb) => {
            const allowedTypes = {
                image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                document: ['.pdf', '.doc', '.docx', '.txt'],
                audio: ['.mp3', '.wav', '.ogg'],
                video: ['.mp4', '.webm', '.avi']
            };

            const ext = path.extname(file.originalname).toLowerCase();
            const fileType = this.getFileType(file.originalname);
            
            if (allowedTypes[fileType] && allowedTypes[fileType].includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error(`不支持的文件类型: ${ext}`), false);
            }
        };

        this.upload = multer({
            storage,
            fileFilter,
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB
                files: 5 // 最多5个文件
            }
        });
    }

    /**
     * 初始化路由
     */
    initializeRoutes() {
        // 创建一个简单的认证中间件
        const optionalAuth = (req, res, next) => {
            // 暂时跳过认证，后续可以集成真正的认证
            next();
        };

        const requiredAuth = (req, res, next) => {
            // 暂时跳过认证，后续可以集成真正的认证  
            next();
        };

        // 单文件上传（支持FormData和Base64）
        this.router.post('/upload', 
            optionalAuth,
            this.handleUpload.bind(this)
        );

        // 多文件上传
        this.router.post('/upload-multiple',
            optionalAuth,
            this.upload.array('files', 5),
            this.handleMultipleUpload.bind(this)
        );

        // 获取文件信息
        this.router.get('/file/:fileId',
            this.handleGetFile.bind(this)
        );

        // 下载文件
        this.router.get('/download/:fileId',
            this.handleDownloadFile.bind(this)
        );

        // 删除文件
        this.router.delete('/file/:fileId',
            requiredAuth,
            this.handleDeleteFile.bind(this)
        );
    }

    /**
     * 处理文件上传
     */
    async handleUpload(req, res) {
        try {
            console.log('📤 收到文件上传请求');
            console.log('Content-Type:', req.headers['content-type']);
            console.log('Request body keys:', Object.keys(req.body));

            // 处理FormData上传
            if (req.headers['content-type']?.includes('multipart/form-data')) {
                return this.handleFormDataUpload(req, res);
            }

            // 处理JSON Base64上传
            if (req.headers['content-type']?.includes('application/json')) {
                return this.handleBase64Upload(req, res);
            }

            // 处理其他格式的上传
            return res.status(400).json({
                success: false,
                error: '不支持的上传格式'
            });

        } catch (error) {
            console.error('❌ 文件上传失败:', error);
            res.status(500).json({
                success: false,
                error: '文件上传失败: ' + error.message
            });
        }
    }

    /**
     * 处理FormData格式的文件上传
     */
    async handleFormDataUpload(req, res) {
        // 使用multer中间件处理
        this.upload.single('file')(req, res, async (err) => {
            if (err) {
                console.error('❌ Multer上传错误:', err);
                return res.status(400).json({
                    success: false,
                    error: err.message
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: '没有收到文件'
                });
            }

            try {
                // 处理文件
                const fileInfo = await this.processUploadedFile(req.file, req);
                
                res.json({
                    success: true,
                    file: fileInfo,
                    message: '文件上传成功'
                });

            } catch (error) {
                console.error('❌ 处理上传文件失败:', error);
                res.status(500).json({
                    success: false,
                    error: '处理文件失败: ' + error.message
                });
            }
        });
    }

    /**
     * 处理Base64格式的文件上传
     */
    async handleBase64Upload(req, res) {
        const { filename, fileData, shopId, userId, description } = req.body;

        if (!filename || !fileData) {
            return res.status(400).json({
                success: false,
                error: '缺少文件名或文件数据'
            });
        }

        try {
            // 解码Base64数据
            const buffer = Buffer.from(fileData, 'base64');
            
            // 使用FileManager处理上传
            if (this.fileManager && this.fileManager.uploadFile) {
                const result = await this.fileManager.uploadFile({
                    filename,
                    buffer,
                    userId: userId || req.session?.userId || 'anonymous',
                    shopId: shopId || req.session?.shopId || 'default_shop'
                }, {
                    description: description || '',
                    uploadMethod: 'base64'
                });

                res.json({
                    success: true,
                    file: result.fileInfo,
                    fileId: result.fileId,
                    message: '文件上传成功'
                });
            } else {
                // 备用处理方案
                const fileInfo = await this.handleFallbackUpload(filename, buffer, req);
                
                res.json({
                    success: true,
                    file: fileInfo,
                    message: '文件上传成功'
                });
            }

        } catch (error) {
            console.error('❌ Base64上传失败:', error);
            res.status(500).json({
                success: false,
                error: '文件上传失败: ' + error.message
            });
        }
    }

    /**
     * 备用文件上传处理
     */
    async handleFallbackUpload(filename, buffer, req) {
        const uploadDir = path.join(__dirname, '../../uploads');
        const fileType = this.getFileType(filename);
        const typedDir = path.join(uploadDir, fileType);
        
        // 确保目录存在
        if (!fs.existsSync(typedDir)) {
            fs.mkdirSync(typedDir, { recursive: true });
        }

        // 生成唯一文件名
        const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const ext = path.extname(filename);
        const savedFilename = `${uniqueSuffix}${ext}`;
        const filePath = path.join(typedDir, savedFilename);

        // 保存文件
        fs.writeFileSync(filePath, buffer);

        // 生成文件信息
        const fileInfo = {
            id: 'file_' + uniqueSuffix,
            originalName: filename,
            filename: savedFilename,
            path: filePath,
            url: `/uploads/${fileType}/${savedFilename}`,
            size: buffer.length,
            type: fileType,
            mimetype: this.getMimeType(filename),
            uploadedAt: new Date().toISOString(),
            userId: req.session?.userId || 'anonymous',
            shopId: req.session?.shopId || 'default_shop'
        };

        return fileInfo;
    }

    /**
     * 处理多文件上传
     */
    async handleMultipleUpload(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '没有收到文件'
                });
            }

            const uploadedFiles = [];

            for (const file of req.files) {
                try {
                    const fileInfo = await this.processUploadedFile(file, req);
                    uploadedFiles.push(fileInfo);
                } catch (error) {
                    console.error('❌ 处理文件失败:', file.originalname, error);
                    uploadedFiles.push({
                        error: error.message,
                        filename: file.originalname
                    });
                }
            }

            res.json({
                success: true,
                files: uploadedFiles,
                message: `成功上传 ${uploadedFiles.filter(f => !f.error).length} 个文件`
            });

        } catch (error) {
            console.error('❌ 多文件上传失败:', error);
            res.status(500).json({
                success: false,
                error: '多文件上传失败: ' + error.message
            });
        }
    }

    /**
     * 处理已上传的文件
     */
    async processUploadedFile(file, req) {
        // 从请求头获取用户信息
        const userId = req.headers['x-user-id'] || req.session?.userId || 'anonymous';
        const shopKey = req.headers['x-shop-key'] || req.session?.shopKey || '';
        const shopId = req.headers['x-shop-id'] || req.session?.shopId || 'default_shop';

        const fileInfo = {
            id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            url: `/uploads/${this.getFileType(file.originalname)}/${file.filename}`,
            size: file.size,
            type: this.getFileType(file.originalname),
            mimetype: file.mimetype,
            uploadedAt: new Date().toISOString(),
            userId: userId,
            shopId: shopId,
            shopKey: shopKey
        };

        // 如果是图片，生成缩略图
        if (fileInfo.type === 'image') {
            try {
                fileInfo.thumbnail = await this.generateThumbnail(file.path);
            } catch (error) {
                console.error('❌ 生成缩略图失败:', error);
            }
        }

        // 保存文件信息到数据库
        try {
            const database = this.database || global.database;
            if (database) {
                await database.runAsync(`
                    INSERT INTO uploaded_files (id, original_name, filename, file_path, file_size, mime_type, uploader_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    fileInfo.id,
                    fileInfo.originalName,
                    fileInfo.filename,
                    fileInfo.path,
                    fileInfo.size,
                    fileInfo.mimetype,
                    fileInfo.userId
                ]);
                console.log(`💾 文件信息已保存到数据库: ${fileInfo.id}`);
                
                // 添加文件完整性验证
                const savedRecord = await database.getAsync(
                    'SELECT * FROM uploaded_files WHERE id = ?',
                    [fileInfo.id]
                );
                
                if (!savedRecord) {
                    throw new Error('文件记录保存失败，无法查询到保存的记录');
                }
                
                console.log(`✅ 文件记录验证通过: ${fileInfo.id}`);
                
            } else {
                console.warn('⚠️ 数据库实例不可用 (this.database:', !!this.database, ', global.database:', !!global.database, ')');
                throw new Error('数据库连接不可用');
            }
        } catch (error) {
            console.error('❌ 保存文件信息到数据库失败:', error);
            // 如果数据库保存失败，删除已上传的物理文件
            try {
                const fs = require('fs').promises;
                await fs.unlink(fileInfo.path);
                console.log(`🗑️  已清理失败的文件: ${fileInfo.path}`);
            } catch (cleanupError) {
                console.error('❌ 清理文件失败:', cleanupError);
            }
            throw error;
        }

        console.log(`✅ 文件处理完成: ${fileInfo.originalName}`);
        return fileInfo;
    }

    /**
     * 获取文件类型
     */
    getFileType(filename) {
        const ext = path.extname(filename).toLowerCase();
        
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            return 'image';
        } else if (['.pdf', '.doc', '.docx', '.txt'].includes(ext)) {
            return 'document';
        } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
            return 'audio';
        } else if (['.mp4', '.webm', '.avi'].includes(ext)) {
            return 'video';
        }
        
        return 'other';
    }

    /**
     * 获取MIME类型
     */
    getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.txt': 'text/plain',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.avi': 'video/x-msvideo'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * 生成缩略图（简化版本）
     */
    async generateThumbnail(imagePath) {
        // 这里应该使用图片处理库如sharp来生成缩略图
        // 暂时返回原图路径
        return imagePath.replace('/uploads/', '/uploads/thumbnails/');
    }

    /**
     * 获取文件信息
     */
    async handleGetFile(req, res) {
        try {
            const { fileId } = req.params;
            console.log('🔍 获取文件信息:', fileId);
            
            // 从数据库获取文件信息
            const db = this.app.get('database');
            const fileInfo = await new Promise((resolve, reject) => {
                db.db.get(
                    'SELECT * FROM uploaded_files WHERE id = ?',
                    [fileId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (!fileInfo) {
                return res.status(404).json({
                    success: false,
                    error: '文件不存在'
                });
            }
            
            console.log('📄 文件信息:', fileInfo);
            
            // 检查文件是否存在
            const fs = require('fs');
            if (!fs.existsSync(fileInfo.file_path)) {
                return res.status(404).json({
                    success: false,
                    error: '文件已丢失'
                });
            }
            
            // 返回文件信息（用于前端显示）
            if (req.query.info === 'true') {
                return res.json({
                    success: true,
                    file: {
                        id: fileInfo.id,
                        originalName: fileInfo.original_name,
                        filename: fileInfo.filename,
                        mimeType: fileInfo.mime_type,
                        size: fileInfo.file_size,
                        uploadTime: fileInfo.upload_time,
                        url: `/api/files/${fileId}` // 文件访问URL
                    }
                });
            }
            
            // 直接返回文件内容
            res.setHeader('Content-Type', fileInfo.mime_type);
            res.setHeader('Content-Disposition', `inline; filename="${fileInfo.original_name}"`);
            res.sendFile(path.resolve(fileInfo.file_path));
            
        } catch (error) {
            console.error('❌ 获取文件失败:', error);
            res.status(500).json({
                success: false,
                error: '获取文件失败'
            });
        }
    }

    /**
     * 下载文件
     */
    async handleDownloadFile(req, res) {
        try {
            const { fileId } = req.params;
            
            // 这里应该根据fileId查找实际文件路径
            res.json({
                success: false,
                error: '文件下载功能待实现'
            });
            
        } catch (error) {
            console.error('❌ 文件下载失败:', error);
            res.status(500).json({
                success: false,
                error: '文件下载失败'
            });
        }
    }

    /**
     * 删除文件
     */
    async handleDeleteFile(req, res) {
        try {
            const { fileId } = req.params;
            
            // 这里应该实现文件删除逻辑
            res.json({
                success: false,
                error: '文件删除功能待实现'
            });
            
        } catch (error) {
            console.error('❌ 文件删除失败:', error);
            res.status(500).json({
                success: false,
                error: '文件删除失败'
            });
        }
    }

    /**
     * 获取路由器
     */
    getRouter() {
        return this.router;
    }
}

module.exports = FileUploadAPI;