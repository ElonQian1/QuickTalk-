/**
 * 文件管理器 - 支持多媒体消息类型
 * 处理图片、文件、语音等多种消息格式
 * 
 * @author QuickTalk Team
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

class FileManager {
    constructor() {
        this.uploadDir = path.join(__dirname, '..', 'uploads');
        this.maxFileSize = {
            image: 10 * 1024 * 1024,      // 10MB for images
            file: 50 * 1024 * 1024,       // 50MB for files
            audio: 20 * 1024 * 1024,      // 20MB for audio
            video: 100 * 1024 * 1024      // 100MB for video
        };
        
        this.allowedTypes = {
            image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
            file: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar'],
            audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac'],
            video: ['.mp4', '.avi', '.mov', '.wmv', '.flv']
        };
        
        this.init();
        console.log('📁 文件管理器初始化完成');
    }

    /**
     * 初始化文件管理器
     */
    init() {
        // 确保上传目录存在
        this.ensureDirectoryExists(this.uploadDir);
        this.ensureDirectoryExists(path.join(this.uploadDir, 'images'));
        this.ensureDirectoryExists(path.join(this.uploadDir, 'files'));
        this.ensureDirectoryExists(path.join(this.uploadDir, 'audio'));
        this.ensureDirectoryExists(path.join(this.uploadDir, 'video'));
        this.ensureDirectoryExists(path.join(this.uploadDir, 'temp'));
    }

    /**
     * 确保目录存在
     */
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 创建目录: ${dirPath}`);
        }
    }

    /**
     * 配置Multer中间件
     */
    createUploadMiddleware() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const fileType = this.getFileType(file.originalname);
                const uploadPath = path.join(this.uploadDir, fileType + 's');
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
                const ext = path.extname(file.originalname);
                const filename = `${uniqueSuffix}${ext}`;
                cb(null, filename);
            }
        });

        const fileFilter = (req, file, cb) => {
            const fileType = this.getFileType(file.originalname);
            const ext = path.extname(file.originalname).toLowerCase();
            
            if (this.allowedTypes[fileType] && this.allowedTypes[fileType].includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error(`不支持的文件类型: ${ext}`), false);
            }
        };

        return multer({
            storage,
            fileFilter,
            limits: {
                fileSize: Math.max(...Object.values(this.maxFileSize))
            }
        });
    }

    /**
     * 获取文件类型
     */
    getFileType(filename) {
        const ext = path.extname(filename).toLowerCase();
        
        for (const [type, extensions] of Object.entries(this.allowedTypes)) {
            if (extensions.includes(ext)) {
                return type;
            }
        }
        
        return 'file'; // 默认为文件类型
    }

    /**
     * 处理文件上传
     */
    async handleFileUpload(file, metadata = {}) {
        try {
            const fileType = this.getFileType(file.originalname);
            const fileInfo = {
                id: this.generateFileId(),
                originalName: file.originalname,
                filename: file.filename,
                mimetype: file.mimetype,
                size: file.size,
                type: fileType,
                uploadedAt: new Date().toISOString(),
                path: file.path,
                url: this.generateFileUrl(file.filename, fileType),
                metadata: metadata
            };

            // 对图片进行额外处理
            if (fileType === 'image') {
                fileInfo.thumbnail = await this.generateThumbnail(file.path);
                fileInfo.dimensions = await this.getImageDimensions(file.path);
            }

            // 对音频进行额外处理
            if (fileType === 'audio') {
                fileInfo.duration = await this.getAudioDuration(file.path);
            }

            console.log(`📄 文件上传成功: ${fileInfo.originalName} (${fileInfo.size} bytes)`);
            return fileInfo;
        } catch (error) {
            console.error('❌ 文件处理失败:', error);
            throw error;
        }
    }

    /**
     * 生成文件ID
     */
    generateFileId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 生成文件访问URL
     */
    generateFileUrl(filename, type) {
        return `/uploads/${type}s/${filename}`;
    }

    /**
     * 生成缩略图（简化版本）
     */
    async generateThumbnail(imagePath) {
        try {
            // 这里可以集成sharp或jimp库来生成缩略图
            // 目前返回原图URL，实际项目中应该生成真正的缩略图
            const filename = path.basename(imagePath);
            const type = this.getFileType(filename);
            return this.generateFileUrl(filename, type);
        } catch (error) {
            console.error('❌ 缩略图生成失败:', error);
            return null;
        }
    }

    /**
     * 获取图片尺寸（简化版本）
     */
    async getImageDimensions(imagePath) {
        try {
            // 这里可以使用image-size库获取真实尺寸
            // 目前返回默认值
            return { width: 800, height: 600 };
        } catch (error) {
            console.error('❌ 获取图片尺寸失败:', error);
            return { width: 0, height: 0 };
        }
    }

    /**
     * 获取音频时长（简化版本）
     */
    async getAudioDuration(audioPath) {
        try {
            // 这里可以使用ffprobe或node-ffmpeg获取音频时长
            // 目前返回默认值
            return 30; // 30秒
        } catch (error) {
            console.error('❌ 获取音频时长失败:', error);
            return 0;
        }
    }

    /**
     * 删除文件
     */
    async deleteFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ 文件删除成功: ${filePath}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ 文件删除失败:', error);
            throw error;
        }
    }

    /**
     * 获取文件信息
     */
    async getFileInfo(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('文件不存在');
            }

            const stats = fs.statSync(filePath);
            const filename = path.basename(filePath);
            const type = this.getFileType(filename);

            return {
                filename,
                size: stats.size,
                type,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                url: this.generateFileUrl(filename, type)
            };
        } catch (error) {
            console.error('❌ 获取文件信息失败:', error);
            throw error;
        }
    }

    /**
     * 清理临时文件
     */
    async cleanupTempFiles(olderThanHours = 24) {
        try {
            const tempDir = path.join(this.uploadDir, 'temp');
            const files = fs.readdirSync(tempDir);
            const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
            
            let deletedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime.getTime() < cutoffTime) {
                    await this.deleteFile(filePath);
                    deletedCount++;
                }
            }
            
            console.log(`🧹 清理了 ${deletedCount} 个临时文件`);
            return deletedCount;
        } catch (error) {
            console.error('❌ 清理临时文件失败:', error);
            return 0;
        }
    }

    /**
     * 验证文件类型和大小
     */
    validateFile(file, allowedType = null) {
        const fileType = this.getFileType(file.originalname);
        
        // 检查文件类型
        if (allowedType && fileType !== allowedType) {
            throw new Error(`期望文件类型: ${allowedType}, 实际类型: ${fileType}`);
        }
        
        // 检查文件大小
        if (file.size > this.maxFileSize[fileType]) {
            const maxSizeMB = (this.maxFileSize[fileType] / 1024 / 1024).toFixed(1);
            throw new Error(`文件大小超过限制: ${maxSizeMB}MB`);
        }
        
        return true;
    }

    /**
     * 获取支持的文件类型信息
     */
    getSupportedTypes() {
        return {
            types: this.allowedTypes,
            maxSizes: this.maxFileSize,
            maxSizesFormatted: Object.fromEntries(
                Object.entries(this.maxFileSize).map(([type, size]) => [
                    type,
                    `${(size / 1024 / 1024).toFixed(1)}MB`
                ])
            )
        };
    }
}

module.exports = FileManager;
