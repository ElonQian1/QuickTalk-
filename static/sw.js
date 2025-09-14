const CACHE_NAME = 'quicktalk-v1.0.0';
const urlsToCache = [
  '/mobile-customer-enhanced.html',
  '/css/enhanced-mobile-customer-service.css',
  '/js/enhanced-mobile-customer-service.js',
  '/style.css',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 安装事件 - 缓存资源
self.addEventListener('install', event => {
  console.log('Service Worker 安装中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('缓存已打开');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('所有资源已缓存');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('缓存资源失败:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  console.log('Service Worker 激活中...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker 已激活');
      return self.clients.claim();
    })
  );
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  // 只处理GET请求
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果缓存中有，直接返回
        if (response) {
          console.log('从缓存返回:', event.request.url);
          return response;
        }

        // 否则从网络获取
        return fetch(event.request)
          .then(response => {
            // 检查响应是否有效
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 克隆响应
            const responseToCache = response.clone();

            // 缓存新的响应
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.error('网络请求失败:', error);
            
            // 如果是HTML请求且网络失败，返回离线页面
            if (event.request.destination === 'document') {
              return caches.match('/mobile-customer-enhanced.html');
            }
            
            // 其他情况返回错误
            throw error;
          });
      })
  );
});

// 消息处理
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 推送通知
self.addEventListener('push', event => {
  console.log('收到推送消息');
  
  const options = {
    body: event.data ? event.data.text() : '您有新消息',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '查看消息',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: '关闭',
        icon: '/icons/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('QuickTalk 客服', options)
  );
});

// 通知点击处理
self.addEventListener('notificationclick', event => {
  console.log('通知被点击:', event.notification.tag);
  event.notification.close();

  if (event.action === 'explore') {
    // 打开应用
    event.waitUntil(
      clients.openWindow('/mobile-customer-enhanced.html')
    );
  } else if (event.action === 'close') {
    // 关闭通知
    console.log('用户选择关闭通知');
  } else {
    // 默认行为 - 打开应用
    event.waitUntil(
      clients.openWindow('/mobile-customer-enhanced.html')
    );
  }
});

// 后台同步
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('后台同步触发');
    event.waitUntil(doBackgroundSync());
  }
});

// 后台同步处理函数
function doBackgroundSync() {
  return new Promise((resolve, reject) => {
    // 这里可以处理离线时的消息同步
    console.log('执行后台同步任务');
    
    // 获取离线存储的消息
    const offlineMessages = getOfflineMessages();
    
    if (offlineMessages.length > 0) {
      // 发送离线消息
      return sendOfflineMessages(offlineMessages)
        .then(() => {
          console.log('离线消息同步完成');
          clearOfflineMessages();
          resolve();
        })
        .catch(error => {
          console.error('离线消息同步失败:', error);
          reject(error);
        });
    } else {
      resolve();
    }
  });
}

// 获取离线消息
function getOfflineMessages() {
  try {
    const messages = localStorage.getItem('offlineMessages');
    return messages ? JSON.parse(messages) : [];
  } catch (error) {
    console.error('获取离线消息失败:', error);
    return [];
  }
}

// 发送离线消息
function sendOfflineMessages(messages) {
  const promises = messages.map(message => {
    return fetch('/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });
  });
  
  return Promise.all(promises);
}

// 清除离线消息
function clearOfflineMessages() {
  try {
    localStorage.removeItem('offlineMessages');
  } catch (error) {
    console.error('清除离线消息失败:', error);
  }
}

console.log('Service Worker 脚本已加载');