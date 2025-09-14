/**
 * UI 组件库索引文件
 * 统一导出所有UI组件，提供便捷的导入方式
 * 
 * 使用方式:
 * import { Modal, Form, Button } from './components/index.js';
 * 或
 * import * as Components from './components/index.js';
 */

// 导入所有组件
import Modal from './modal.js';
import Form from './form.js';
import Button from './button.js';
import Navigation from './navigation.js';
import Notification from './notification.js';

// 统一导出
export {
    Modal,
    Form,
    Button,
    Navigation,
    Notification
};

// 默认导出组件集合
export default {
    Modal,
    Form,
    Button,
    Navigation,
    Notification
};

// 全局注册所有组件（如果在浏览器环境中）
if (typeof window !== 'undefined') {
    // 创建组件命名空间
    window.QuickTalkComponents = {
        Modal,
        Form,
        Button,
        Navigation,
        Notification
    };
    
    // 也可以通过 window.Components 访问
    window.Components = window.QuickTalkComponents;
    
    console.log('[Components] UI组件库已加载完成');
    console.log('[Components] 可用组件:', Object.keys(window.QuickTalkComponents));
}