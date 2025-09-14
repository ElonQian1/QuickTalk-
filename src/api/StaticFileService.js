/**
 * 静态文件服务中间件
 * 用于提供上传的文件访问服务
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

/**
 * 设置静态文件服务
 */
function setupStaticFileServing(app) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    
    // 确保上传目录存在
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('📁 创建上传目录:', uploadsDir);
    }

    // 设置静态文件服务
    app.use('/uploads', express.static(uploadsDir, {
        maxAge: '7d', // 缓存7天
        setHeaders: (res, filePath) => {
            // 根据文件类型设置响应头
            const ext = path.extname(filePath).toLowerCase();
            
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                res.setHeader('Content-Type', getImageMimeType(ext));
            } else if (['.pdf'].includes(ext)) {
                res.setHeader('Content-Type', 'application/pdf');
            } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
                res.setHeader('Content-Type', getAudioMimeType(ext));
            } else if (['.mp4', '.webm', '.avi'].includes(ext)) {
                res.setHeader('Content-Type', getVideoMimeType(ext));
            }
            
            // 设置跨域访问
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        }
    }));

    console.log('📁 静态文件服务已设置: /uploads -> ' + uploadsDir);
}

/**
 * 获取图片MIME类型
 */
function getImageMimeType(ext) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
}

/**
 * 获取音频MIME类型
 */
function getAudioMimeType(ext) {
    const mimeTypes = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg'
    };
    return mimeTypes[ext] || 'audio/mpeg';
}

/**
 * 获取视频MIME类型
 */
function getVideoMimeType(ext) {
    const mimeTypes = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.avi': 'video/x-msvideo'
    };
    return mimeTypes[ext] || 'video/mp4';
}

module.exports = {
    setupStaticFileServing
};