/**
 * Modal组件单元测试
 */

describe('Modal组件测试', () => {
    let modalElement;
    let modal;
    
    beforeEach(() => {
        // 创建模态框HTML结构
        modalElement = document.createElement('div');
        modalElement.className = 'modal';
        modalElement.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>测试标题</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <p>测试内容</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline modal-close">取消</button>
                    <button class="btn btn-primary">确定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalElement);
        
        // 确保Modal组件加载
        if (!window.Modal) {
            throw new Error('Modal组件未加载');
        }
        
        // 创建Modal实例
        modal = new window.Modal(modalElement, {
            eventBus: window.EventBus
        });
    });
    
    afterEach(() => {
        // 清理DOM
        if (modalElement && modalElement.parentNode) {
            modalElement.parentNode.removeChild(modalElement);
        }
        
        // 销毁模态框实例
        if (modal) {
            modal.destroy();
        }
    });
    
    describe('基本功能', () => {
        it('应该正确初始化', () => {
            expect(modal).toBeDefined();
            expect(modal.element).toBe(modalElement);
            expect(modal.isVisible).toBe(false);
        });
        
        it('应该显示模态框', () => {
            modal.show();
            
            expect(modal.isVisible).toBe(true);
            expect(modalElement.classList.contains('show')).toBe(true);
            expect(modalElement.style.display).toBe('flex');
        });
        
        it('应该隐藏模态框', () => {
            modal.show();
            modal.hide();
            
            expect(modal.isVisible).toBe(false);
            expect(modalElement.classList.contains('show')).toBe(false);
            expect(modalElement.style.display).toBe('none');
        });
        
        it('应该切换显示状态', () => {
            // 初始状态是隐藏的
            expect(modal.isVisible).toBe(false);
            
            modal.toggle();
            expect(modal.isVisible).toBe(true);
            
            modal.toggle();
            expect(modal.isVisible).toBe(false);
        });
    });
    
    describe('关闭按钮', () => {
        it('应该通过关闭按钮关闭模态框', () => {
            modal.show();
            
            const closeButton = modalElement.querySelector('.modal-close');
            closeButton.click();
            
            expect(modal.isVisible).toBe(false);
        });
        
        it('应该支持多个关闭按钮', () => {
            modal.show();
            
            const closeButtons = modalElement.querySelectorAll('.modal-close');
            expect(closeButtons.length).toBe(2);
            
            // 点击第二个关闭按钮
            closeButtons[1].click();
            
            expect(modal.isVisible).toBe(false);
        });
    });
    
    describe('背景点击关闭', () => {
        it('应该通过点击背景关闭模态框', () => {
            modal.show();
            
            // 模拟点击模态框背景
            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                target: modalElement
            });
            
            modalElement.dispatchEvent(event);
            
            expect(modal.isVisible).toBe(false);
        });
        
        it('不应该通过点击内容区域关闭模态框', () => {
            modal.show();
            
            const content = modalElement.querySelector('.modal-content');
            content.click();
            
            expect(modal.isVisible).toBe(true);
        });
        
        it('应该可以禁用背景点击关闭', () => {
            modal.setOption('closeOnOverlayClick', false);
            modal.show();
            
            modalElement.click();
            
            expect(modal.isVisible).toBe(true);
        });
    });
    
    describe('ESC键关闭', () => {
        it('应该通过ESC键关闭模态框', () => {
            modal.show();
            
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27
            });
            
            document.dispatchEvent(escEvent);
            
            expect(modal.isVisible).toBe(false);
        });
        
        it('应该可以禁用ESC键关闭', () => {
            modal.setOption('closeOnEsc', false);
            modal.show();
            
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape'
            });
            
            document.dispatchEvent(escEvent);
            
            expect(modal.isVisible).toBe(true);
        });
    });
    
    describe('事件系统', () => {
        it('应该触发show事件', () => {
            let showEventFired = false;
            
            modal.on('show', () => {
                showEventFired = true;
            });
            
            modal.show();
            
            expect(showEventFired).toBe(true);
        });
        
        it('应该触发hide事件', () => {
            let hideEventFired = false;
            
            modal.on('hide', () => {
                hideEventFired = true;
            });
            
            modal.show();
            modal.hide();
            
            expect(hideEventFired).toBe(true);
        });
        
        it('应该触发shown事件', (done) => {
            modal.on('shown', () => {
                expect(modal.isVisible).toBe(true);
                done();
            });
            
            modal.show();
        });
        
        it('应该触发hidden事件', (done) => {
            modal.on('hidden', () => {
                expect(modal.isVisible).toBe(false);
                done();
            });
            
            modal.show();
            modal.hide();
        });
        
        it('应该可以阻止显示', () => {
            modal.on('beforeShow', (event) => {
                event.preventDefault();
            });
            
            modal.show();
            
            expect(modal.isVisible).toBe(false);
        });
        
        it('应该可以阻止隐藏', () => {
            modal.show();
            
            modal.on('beforeHide', (event) => {
                event.preventDefault();
            });
            
            modal.hide();
            
            expect(modal.isVisible).toBe(true);
        });
    });
    
    describe('内容操作', () => {
        it('应该设置标题', () => {
            const newTitle = '新的标题';
            modal.setTitle(newTitle);
            
            const titleElement = modalElement.querySelector('.modal-header h3');
            expect(titleElement.textContent).toBe(newTitle);
        });
        
        it('应该设置内容', () => {
            const newContent = '<p>新的内容</p>';
            modal.setContent(newContent);
            
            const bodyElement = modalElement.querySelector('.modal-body');
            expect(bodyElement.innerHTML).toBe(newContent);
        });
        
        it('应该设置页脚', () => {
            const newFooter = '<button>新按钮</button>';
            modal.setFooter(newFooter);
            
            const footerElement = modalElement.querySelector('.modal-footer');
            expect(footerElement.innerHTML).toBe(newFooter);
        });
    });
    
    describe('大小控制', () => {
        it('应该设置模态框大小', () => {
            modal.setSize('large');
            
            const content = modalElement.querySelector('.modal-content');
            expect(content.classList.contains('modal-large')).toBe(true);
        });
        
        it('应该支持自定义大小', () => {
            modal.setSize('custom', { width: '800px', height: '600px' });
            
            const content = modalElement.querySelector('.modal-content');
            expect(content.style.width).toBe('800px');
            expect(content.style.height).toBe('600px');
        });
    });
    
    describe('动画效果', () => {
        it('应该支持渐入动画', (done) => {
            modal.setOption('animation', 'fade');
            modal.show();
            
            setTimeout(() => {
                expect(modalElement.classList.contains('fade-in')).toBe(true);
                done();
            }, 50);
        });
        
        it('应该支持缩放动画', (done) => {
            modal.setOption('animation', 'scale');
            modal.show();
            
            setTimeout(() => {
                expect(modalElement.classList.contains('scale-in')).toBe(true);
                done();
            }, 50);
        });
        
        it('应该可以禁用动画', () => {
            modal.setOption('animation', false);
            modal.show();
            
            expect(modalElement.classList.contains('no-animation')).toBe(true);
        });
    });
    
    describe('焦点管理', () => {
        it('应该在显示时聚焦到模态框', () => {
            modal.show();
            
            expect(document.activeElement.closest('.modal')).toBe(modalElement);
        });
        
        it('应该在隐藏时恢复焦点', () => {
            const button = document.createElement('button');
            document.body.appendChild(button);
            button.focus();
            
            modal.show();
            modal.hide();
            
            expect(document.activeElement).toBe(button);
            
            document.body.removeChild(button);
        });
        
        it('应该限制Tab键在模态框内', () => {
            modal.show();
            
            const tabEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                code: 'Tab',
                keyCode: 9
            });
            
            // 模拟Tab键事件不应该跳出模态框
            document.dispatchEvent(tabEvent);
            
            expect(document.activeElement.closest('.modal')).toBe(modalElement);
        });
    });
    
    describe('静态方法', () => {
        afterEach(() => {
            // 清理静态创建的模态框
            const modals = document.querySelectorAll('.modal.auto-created');
            modals.forEach(modal => modal.remove());
        });
        
        it('应该创建确认对话框', async () => {
            const promise = window.Modal.confirm('确认删除吗？');
            
            // 检查模态框是否已创建
            const confirmModal = document.querySelector('.modal.auto-created');
            expect(confirmModal).toBeTruthy();
            
            // 模拟点击确定
            const confirmButton = confirmModal.querySelector('.btn-primary');
            confirmButton.click();
            
            const result = await promise;
            expect(result).toBe(true);
        });
        
        it('应该创建警告对话框', () => {
            window.Modal.alert('这是一个警告');
            
            const alertModal = document.querySelector('.modal.auto-created');
            expect(alertModal).toBeTruthy();
            expect(alertModal.textContent).toContain('这是一个警告');
        });
        
        it('应该创建提示对话框', async () => {
            const promise = window.Modal.prompt('请输入姓名:', '默认值');
            
            const promptModal = document.querySelector('.modal.auto-created');
            expect(promptModal).toBeTruthy();
            
            const input = promptModal.querySelector('input[type="text"]');
            expect(input.value).toBe('默认值');
            
            // 修改输入值并确认
            input.value = '新值';
            const confirmButton = promptModal.querySelector('.btn-primary');
            confirmButton.click();
            
            const result = await promise;
            expect(result).toBe('新值');
        });
    });
    
    describe('多模态框管理', () => {
        let secondModal;
        let secondElement;
        
        beforeEach(() => {
            secondElement = document.createElement('div');
            secondElement.className = 'modal';
            secondElement.innerHTML = modalElement.innerHTML;
            document.body.appendChild(secondElement);
            
            secondModal = new window.Modal(secondElement);
        });
        
        afterEach(() => {
            if (secondElement && secondElement.parentNode) {
                secondElement.parentNode.removeChild(secondElement);
            }
            if (secondModal) {
                secondModal.destroy();
            }
        });
        
        it('应该管理多个模态框的层级', () => {
            modal.show();
            secondModal.show();
            
            expect(parseInt(modalElement.style.zIndex)).toBeLessThan(
                parseInt(secondElement.style.zIndex)
            );
        });
        
        it('应该正确处理ESC键在多模态框中', () => {
            modal.show();
            secondModal.show();
            
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape'
            });
            
            document.dispatchEvent(escEvent);
            
            // 只有最顶层的模态框应该关闭
            expect(modal.isVisible).toBe(true);
            expect(secondModal.isVisible).toBe(false);
        });
    });
    
    describe('响应式设计', () => {
        it('应该在移动设备上全屏显示', () => {
            // 模拟移动设备视口
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 480
            });
            
            modal.show();
            
            const content = modalElement.querySelector('.modal-content');
            expect(content.classList.contains('modal-fullscreen')).toBe(true);
        });
    });
    
    describe('销毁和清理', () => {
        it('应该正确销毁模态框', () => {
            modal.show();
            modal.destroy();
            
            // 检查事件监听器是否被移除
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape'
            });
            
            document.dispatchEvent(escEvent);
            
            // 模态框应该仍然可见，因为已经被销毁
            expect(modalElement.style.display).not.toBe('none');
        });
        
        it('应该移除所有事件监听器', () => {
            let eventFired = false;
            
            modal.on('show', () => {
                eventFired = true;
            });
            
            modal.destroy();
            modal.trigger('show');
            
            expect(eventFired).toBe(false);
        });
    });
});