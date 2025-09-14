/**
 * 增强版文件上传管理器
 * 
 * 功能特性:
 * - 事务性文件操作 (数据库+文件系统)
 * - 自动错误回滚
 * - 文件完整性验证
 * - 重复文件检测
 * - 存储空间管理
 * - 自动清理机制
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class EnhancedFileManager {
    constructor(database) {
        this.database = database;
        this.uploadsDir = path.join(__dirname, '../../uploads');
        this.config = {
            maxFileSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: {
                image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                document: ['.pdf', '.doc', '.docx', '.txt'],
                audio: ['.mp3', '.wav', '.ogg'],
                video: ['.mp4', '.webm', '.avi']
            },
            thumbnailSizes: [150, 300, 600], // 缩略图尺寸
            enableCompression: true,
            enableWebP: true
        };
    }

    /**
     * 事务性文件上传
     */
    async uploadFileTransaction(fileBuffer, originalName, options = {}) {
        const transaction = {
            fileId: null,
            tempPath: null,
            finalPath: null,
            dbRecord: false,
            thumbnails: []
        };

        try {
            // 1. 生成文件ID和基础信息
            transaction.fileId = this.generateFileId();
            const fileInfo = await this.prepareFileInfo(fileBuffer, originalName, transaction.fileId);
            
            // 2. 验证文件
            await this.validateFile(fileBuffer, fileInfo);
            
            // 3. 检查重复文件
            const existingFile = await this.checkDuplicate(fileInfo.hash);
            if (existingFile && !options.allowDuplicate) {
                console.log(`📋 发现重复文件，返回已存在的文件: ${existingFile.id}`);
                return existingFile;
            }

            // 4. 创建临时文件
            transaction.tempPath = await this.createTempFile(fileBuffer, fileInfo);
            
            // 5. 数据库事务开始
            await this.database.runAsync('BEGIN TRANSACTION');
            
            // 6. 保存文件记录到数据库
            await this.saveFileRecord(fileInfo);
            transaction.dbRecord = true;
            
            // 7. 移动文件到最终位置
            transaction.finalPath = await this.moveToFinalLocation(transaction.tempPath, fileInfo);
            
            // 8. 生成缩略图(如果是图片)
            if (fileInfo.type === 'image') {
                transaction.thumbnails = await this.generateThumbnails(transaction.finalPath, fileInfo);
            }
            
            // 9. 提交事务
            await this.database.runAsync('COMMIT');
            
            console.log(`✅ 文件上传成功: ${fileInfo.originalName} -> ${fileInfo.id}`);
            
            return {
                success: true,
                file: fileInfo,
                thumbnails: transaction.thumbnails
            };

        } catch (error) {
            console.error('❌ 文件上传事务失败:', error);
            
            // 回滚所有操作
            await this.rollbackTransaction(transaction);
            
            throw new Error(`文件上传失败: ${error.message}`);
        }
    }

    /**
     * 生成唯一文件ID
     */
    generateFileId() {
        return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 准备文件信息
     */
    async prepareFileInfo(fileBuffer, originalName, fileId) {
        const ext = path.extname(originalName).toLowerCase();
        const type = this.getFileType(originalName);
        const hash = this.calculateHash(fileBuffer);
        const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
        
        return {
            id: fileId,
            originalName,
            filename,
            type,
            ext,
            size: fileBuffer.length,
            hash,
            mimetype: this.getMimeType(originalName),
            uploadedAt: new Date().toISOString(),
            url: `/uploads/${type}/${filename}`
        };
    }

    /**
     * 计算文件哈希
     */
    calculateHash(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * 验证文件
     */
    async validateFile(fileBuffer, fileInfo) {
        // 文件大小检查
        if (fileBuffer.length > this.config.maxFileSize) {
            throw new Error(`文件大小超出限制 (${this.config.maxFileSize / 1024 / 1024}MB)`);
        }

        // 文件类型检查
        const allowedExts = this.config.allowedTypes[fileInfo.type];
        if (!allowedExts || !allowedExts.includes(fileInfo.ext)) {
            throw new Error(`不支持的文件类型: ${fileInfo.ext}`);
        }

        // 文件内容验证(检查文件头)
        await this.validateFileHeader(fileBuffer, fileInfo.type);
    }

    /**
     * 验证文件头
     */
    async validateFileHeader(buffer, type) {
        if (type === 'image') {
            const header = buffer.slice(0, 10);
            const signatures = {
                jpg: [0xFF, 0xD8, 0xFF],
                png: [0x89, 0x50, 0x4E, 0x47],
                gif: [0x47, 0x49, 0x46, 0x38],
                webp: [0x57, 0x45, 0x42, 0x50]
            };

            const isValid = Object.values(signatures).some(signature =>
                signature.every((byte, i) => header[i] === byte)
            );

            if (!isValid) {
                throw new Error('文件头验证失败，可能不是有效的图片文件');
            }
        }
    }

    /**
     * 检查重复文件
     */
    async checkDuplicate(hash) {
        try {
            const existing = await this.database.getAsync(
                'SELECT * FROM uploaded_files WHERE file_hash = ?',
                [hash]
            );
            return existing;
        } catch (error) {
            // 如果file_hash列不存在，忽略错误
            return null;
        }
    }

    /**
     * 创建临时文件
     */
    async createTempFile(buffer, fileInfo) {
        const tempDir = path.join(this.uploadsDir, 'temp');
        await this.ensureDirectory(tempDir);
        
        const tempPath = path.join(tempDir, `temp_${fileInfo.id}`);
        await fs.writeFile(tempPath, buffer);
        
        return tempPath;
    }

    /**
     * 保存文件记录到数据库
     */
    async saveFileRecord(fileInfo) {
        await this.database.runAsync(`
            INSERT INTO uploaded_files 
            (id, original_name, filename, file_path, file_size, mime_type, file_hash, uploader_id, upload_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            fileInfo.id,
            fileInfo.originalName,
            fileInfo.filename,
            fileInfo.url,
            fileInfo.size,
            fileInfo.mimetype,
            fileInfo.hash,
            'system',
            fileInfo.uploadedAt
        ]);
    }

    /**
     * 移动文件到最终位置
     */
    async moveToFinalLocation(tempPath, fileInfo) {
        const finalDir = path.join(this.uploadsDir, fileInfo.type);
        await this.ensureDirectory(finalDir);
        
        const finalPath = path.join(finalDir, fileInfo.filename);
        await fs.rename(tempPath, finalPath);
        
        return finalPath;
    }

    /**
     * 生成缩略图
     */
    async generateThumbnails(imagePath, fileInfo) {
        const thumbnails = [];
        
        try {
            // 这里可以使用 sharp 或其他图像处理库
            // 暂时返回空数组，后续实现
            console.log(`🖼️  TODO: 生成缩略图 ${imagePath}`);
            return thumbnails;
        } catch (error) {
            console.error('❌ 生成缩略图失败:', error);
            return thumbnails;
        }
    }

    /**
     * 回滚事务
     */
    async rollbackTransaction(transaction) {
        try {
            // 回滚数据库事务
            if (transaction.dbRecord) {
                await this.database.runAsync('ROLLBACK');
            }
            
            // 删除临时文件
            if (transaction.tempPath) {
                await fs.unlink(transaction.tempPath).catch(() => {});
            }
            
            // 删除最终文件
            if (transaction.finalPath) {
                await fs.unlink(transaction.finalPath).catch(() => {});
            }
            
            // 删除缩略图
            for (const thumb of transaction.thumbnails) {
                await fs.unlink(thumb.path).catch(() => {});
            }
            
            console.log('🔄 事务回滚完成');
        } catch (error) {
            console.error('❌ 事务回滚失败:', error);
        }
    }

    /**
     * 确保目录存在
     */
    async ensureDirectory(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * 获取文件类型
     */
    getFileType(filename) {
        const ext = path.extname(filename).toLowerCase();
        
        for (const [type, extensions] of Object.entries(this.config.allowedTypes)) {
            if (extensions.includes(ext)) {
                return type;
            }
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
     * 清理孤立文件
     */
    async cleanupOrphanedFiles() {
        console.log('🧹 开始清理孤立文件...');
        
        try {
            // 获取数据库中的所有文件记录
            const dbFiles = await this.database.allAsync(
                'SELECT filename, file_path FROM uploaded_files'
            );
            
            const dbFilenames = new Set(dbFiles.map(f => f.filename));
            
            // 扫描uploads目录
            const types = Object.keys(this.config.allowedTypes);
            let cleanedCount = 0;
            
            for (const type of types) {
                const typeDir = path.join(this.uploadsDir, type);
                
                try {
                    const files = await fs.readdir(typeDir);
                    
                    for (const file of files) {
                        if (!dbFilenames.has(file)) {
                            const filePath = path.join(typeDir, file);
                            await fs.unlink(filePath);
                            cleanedCount++;
                            console.log(`🗑️  删除孤立文件: ${file}`);
                        }
                    }
                } catch (error) {
                    // 目录不存在或其他错误，跳过
                }
            }
            
            console.log(`✅ 清理完成，删除了 ${cleanedCount} 个孤立文件`);
            
        } catch (error) {
            console.error('❌ 清理孤立文件失败:', error);
        }
    }

    /**
     * 获取存储统计信息
     */
    async getStorageStats() {
        try {
            const stats = await this.database.getAsync(`
                SELECT 
                    COUNT(*) as total_files,
                    SUM(file_size) as total_size,
                    AVG(file_size) as avg_size
                FROM uploaded_files
            `);
            
            const typeStats = await this.database.allAsync(`
                SELECT 
                    mime_type,
                    COUNT(*) as count,
                    SUM(file_size) as size
                FROM uploaded_files
                GROUP BY mime_type
                ORDER BY size DESC
            `);
            
            return {
                overall: stats,
                byType: typeStats
            };
        } catch (error) {
            console.error('❌ 获取存储统计失败:', error);
            return null;
        }
    }
}

module.exports = EnhancedFileManager;