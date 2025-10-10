/**
 * 媒体处理模块
 * 负责文件上传、图片处理、语音录制等功能
 */

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  url: string;
  fileName: string;
  size: number;
  type: string;
}

export class MediaHandler {
  private static instance: MediaHandler;
  
  static getInstance(): MediaHandler {
    if (!MediaHandler.instance) {
      MediaHandler.instance = new MediaHandler();
    }
    return MediaHandler.instance;
  }

  /**
   * 验证文件类型和大小
   */
  validateFile(file: File, type: 'image' | 'file' | 'voice'): { valid: boolean; error?: string } {
    const maxSizes = {
      image: 10 * 1024 * 1024, // 10MB
      file: 50 * 1024 * 1024,  // 50MB
      voice: 10 * 1024 * 1024  // 10MB
    };

    const allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      file: [], // 允许所有类型
      voice: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm']
    };

    // 检查文件大小
    if (file.size > maxSizes[type]) {
      return {
        valid: false,
        error: `文件过大，最大支持 ${this.formatFileSize(maxSizes[type])}`
      };
    }

    // 检查文件类型
    if (type !== 'file' && allowedTypes[type].length > 0) {
      if (!allowedTypes[type].includes(file.type)) {
        return {
          valid: false,
          error: `不支持的文件类型: ${file.type}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 压缩图片
   */
  async compressImage(file: File, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // 计算压缩后的尺寸
        let { width, height } = img;
        const maxWidth = 1920;
        const maxHeight = 1080;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // 绘制图片
        ctx?.drawImage(img, 0, 0, width, height);

        // 转换为blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('图片压缩失败'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 上传文件（带进度回调）
   */
  async uploadFile(
    file: File,
    uploadUrl: string,
    additionalData: Record<string, string> = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    
    // 添加额外数据
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // 监听上传进度
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100)
          };
          onProgress(progress);
        }
      });

      // 监听响应
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve({
              url: result.url,
              fileName: file.name,
              size: file.size,
              type: file.type
            });
          } catch (error) {
            reject(new Error('响应解析失败'));
          }
        } else {
          reject(new Error(`上传失败: HTTP ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('上传超时'));
      });

      xhr.open('POST', uploadUrl);
      xhr.timeout = 60000; // 60秒超时
      xhr.send(formData);
    });
  }

  /**
   * 创建图片预览
   */
  createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      
      reader.onerror = () => {
        reject(new Error('图片预览生成失败'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * 获取文件图标
   */
  getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const iconMap: Record<string, string> = {
      // 图片
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
      // 文档
      pdf: '📄', doc: '📝', docx: '📝', txt: '📄',
      // 表格
      xls: '📊', xlsx: '📊', csv: '📊',
      // 演示
      ppt: '📽️', pptx: '📽️',
      // 压缩包
      zip: '🗜️', rar: '🗜️', '7z': '🗜️',
      // 音频
      mp3: '🎵', wav: '🎵', ogg: '🎵', m4a: '🎵',
      // 视频
      mp4: '🎬', avi: '🎬', mov: '🎬', wmv: '🎬',
      // 代码
      js: '📄', html: '📄', css: '📄', json: '📄'
    };
    
    return iconMap[extension || ''] || '📎';
  }
}

/**
 * 语音录制器
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;

  /**
   * 检查浏览器支持
   */
  isSupported(): boolean {
    try {
      return !!(
        navigator.mediaDevices && 
        typeof navigator.mediaDevices.getUserMedia === 'function' && 
        typeof window !== 'undefined' && 
        'MediaRecorder' in window &&
        typeof MediaRecorder === 'function'
      );
    } catch {
      return false;
    }
  }

  /**
   * 开始录制
   */
  async startRecording(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('当前浏览器不支持语音录制');
    }

    if (this.isRecording) {
      throw new Error('已在录制中');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      
      console.log('🎤 开始录制语音');
    } catch (error) {
      throw new Error('录制权限被拒绝或设备不可用');
    }
  }

  /**
   * 停止录制
   */
  async stopRecording(): Promise<File> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('未在录制中');
    }

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
          type: 'audio/webm',
          lastModified: Date.now()
        });
        
        this.cleanup();
        resolve(audioFile);
      };

      this.mediaRecorder!.onerror = (error) => {
        this.cleanup();
        reject(error);
      };

      this.mediaRecorder!.stop();
      this.isRecording = false;
      
      console.log('🎤 录制结束');
    });
  }

  /**
   * 取消录制
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
    this.cleanup();
    console.log('🎤 录制已取消');
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }

  /**
   * 获取录制状态
   */
  getRecordingState(): boolean {
    return this.isRecording;
  }
}