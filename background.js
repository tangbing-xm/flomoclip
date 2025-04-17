// background.js - FlomoClip背景服务工作脚本


// 扩展安装或更新时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('FlomoClip扩展已安装或更新');
  
  // 创建文本选择右键菜单
  chrome.contextMenus.create({
    id: 'saveToFlomo',
    title: '保存到Flomo',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'saveAndEditToFlomo',
    title: '保存并编辑到Flomo',
    contexts: ['selection']
  });
  
  // 创建图片右键菜单
  chrome.contextMenus.create({
    id: 'saveImageToFlomo',
    title: '保存图片到Flomo',
    contexts: ['image']
  });
  
  chrome.contextMenus.create({
    id: 'saveImageAndEditToFlomo',
    title: '保存图片并编辑到Flomo',
    contexts: ['image']
  });
  
  // 初始化存储默认设置
  chrome.storage.sync.get('flomoSettings', (data) => {
    if (!data.flomoSettings) {
      chrome.storage.sync.set({
        flomoSettings: {
          autoAddLink: true,
          autoAddTitle: true,
          defaultTags: [],
          // 预设Webhook URL
          webhookUrl: 'https://flomoapp.com/iwh/NTkyNTkx/ca8398dd3eb297702c173363355f36a7/',
          isLoggedIn: true
        }
      });
    }
  });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveToFlomo') {
    // 直接保存选中内容
    saveToFlomo(info.selectionText, tab, false);
  } else if (info.menuItemId === 'saveAndEditToFlomo') {
    // 打开编辑窗口
    saveToFlomo(info.selectionText, tab, true);
  } else if (info.menuItemId === 'saveImageToFlomo') {
    // 直接保存图片
    saveImageToFlomo(info.srcUrl, tab, false);
  } else if (info.menuItemId === 'saveImageAndEditToFlomo') {
    // 打开编辑窗口
    saveImageToFlomo(info.srcUrl, tab, true);
  }
});

// 处理快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-to-flomo') {
    // 获取当前标签页信息
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length === 0) return;
      
      // 执行内容脚本获取选中文本
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: getSelectedText
      }, (results) => {
        if (results && results[0] && results[0].result) {
          saveToFlomo(results[0].result, tabs[0], false);
        }
      });
    });
  }
});

// 获取选中文本的函数
function getSelectedText() {
  return window.getSelection().toString();
}

// 保存内容到Flomo
function saveToFlomo(text, tab, shouldEdit) {
  if (!text || text.trim() === '') {
    console.log('没有选中任何文本');
    return;
  }

  // 获取设置
  chrome.storage.sync.get('flomoSettings', (data) => {
    const settings = data.flomoSettings || {};
    
    let content = text;
    
    // 根据设置添加网页链接和标题
    if (settings.autoAddLink && tab.url) {
      content += `\n\n来源：[${tab.title || '网页'}](${tab.url})`;
    } else if (settings.autoAddTitle && tab.title) {
      content += `\n\n来源：${tab.title}`;
    }
    
    if (shouldEdit) {
      // 打开编辑窗口
      chrome.storage.local.set({ 'editContent': content }, () => {
        chrome.action.openPopup();
      });
    } else {
      // 直接发送到Flomo服务
      sendToFlomoWebhook(content);
    }
  });
}

// 发送内容到Flomo Webhook
function sendToFlomoWebhook(content) {
  chrome.storage.sync.get('flomoSettings', (data) => {
    const settings = data.flomoSettings || {};
    const webhookUrl = settings.webhookUrl;
    
    if (!webhookUrl) {
      console.error('未设置Flomo Webhook URL，请先设置');
      
      // 通知用户需要设置
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 3000);
      
      return;
    }
    
    console.log('背景脚本发送到Flomo，内容:', content);
    console.log('使用Webhook URL:', webhookUrl);
    
    // 发送请求到Flomo Webhook
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: content
      })
    })
    .then(response => {
      console.log('背景脚本响应状态:', response.status);
      console.log('响应头部:', [...response.headers.entries()]);
      
      // 如果状态码是200，默认视为成功
      const httpSuccess = response.status === 200;
      
      // 检查响应是否为JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json().then(data => {
          console.log('响应JSON数据:', data);
          return {
            originalResponse: response,
            data: data
          };
        });
      }
      
      // 非JSON响应，获取文本
      return response.text().then(text => {
        console.log('响应文本内容:', text);
        try {
          // 尝试解析为JSON
          const jsonData = JSON.parse(text);
          return {
            originalResponse: response,
            data: jsonData
          };
        } catch (e) {
          // 不是JSON，返回原始响应
          return {
            originalResponse: response,
            text: text,
            data: { code: httpSuccess ? 0 : -1 }
          };
        }
      });
    })
    .then(result => {
      const response = result.originalResponse;
      const data = result.data;
      
      console.log('背景脚本处理结果:', result);
      
      // 如果HTTP状态码为200，默认视为成功
      const httpSuccess = response.status === 200;
      
      // 检查API返回的code值（如果存在）
      const apiSuccess = data && (data.code === 0 || data.code === undefined && data.status !== 'error');
      
      // 综合判断是否成功
      const isSuccess = httpSuccess && (apiSuccess || !data);
      
      if (isSuccess) {
        // 保存成功，显示成功图标
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, 3000);
        
        // 保存到本地历史记录
        saveToHistory(content);
      } else {
        const errorMsg = data && data.message ? data.message : result.text || '未知错误';
        console.error('保存到Flomo失败:', errorMsg);
        
        // 显示错误图标
        chrome.action.setBadgeText({ text: '×' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, 3000);
      }
    })
    .catch(error => {
      console.error('发送到Flomo Webhook时出错:', error);
      
      // 离线模式：保存到本地
      saveOffline(content);
    });
  });
}

// 保存内容到本地历史记录
function saveToHistory(content) {
  chrome.storage.local.get('history', (data) => {
    const history = data.history || [];
    history.unshift({
      content: content,
      timestamp: new Date().toISOString()
    });
    
    // 最多保存50条历史记录
    if (history.length > 50) {
      history.pop();
    }
    
    chrome.storage.local.set({ 'history': history });
  });
}

// 离线保存内容
function saveOffline(content) {
  chrome.storage.local.get('offlineContents', (data) => {
    const offlineContents = data.offlineContents || [];
    offlineContents.push({
      content: content,
      timestamp: new Date().toISOString()
    });
    
    chrome.storage.local.set({ 'offlineContents': offlineContents });
    
    // 设置离线标志
    chrome.action.setBadgeText({ text: '⚠' });
    chrome.action.setBadgeBackgroundColor({ color: '#FFC107' });
    
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
  });
}

// 监听来自内容脚本或弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveSelectedText') {
    // 获取当前标签页信息
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length > 0) {
        saveToFlomo(message.text, tabs[0], false);
      }
    });
  } else if (message.action === 'captureVisibleTab') {
    // 截取当前标签页可见区域
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl) => {
      sendResponse({imageData: dataUrl});
    });
    return true; // 表示异步响应
  } else if (message.action === 'getSelectedImage') {
    // 获取当前标签页
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({error: '无法获取当前标签页'});
        return;
      }
      
      // 在当前标签页执行内容脚本获取选中图片
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: getSelectedImages
      }, (results) => {
        if (chrome.runtime.lastError) {
          sendResponse({error: chrome.runtime.lastError.message});
          return;
        }
        
        if (results && results[0] && results[0].result) {
          sendResponse({imageUrls: results[0].result});
        } else {
          sendResponse({imageUrls: []});
        }
      });
    });
    return true; // 表示异步响应
  }
});

// 获取选中的图片的函数
function getSelectedImages() {
  const images = document.querySelectorAll('img');
  const selection = window.getSelection();
  
  // 如果没有选择，则返回空数组
  if (!selection || !selection.rangeCount) return [];
  
  const selectionRange = selection.getRangeAt(0);
  const selectionRect = selectionRange.getBoundingClientRect();
  
  // 找出与选择区域重叠的图片
  const selectedImages = Array.from(images).filter(img => {
    const imgRect = img.getBoundingClientRect();
    
    return (
      imgRect.left < selectionRect.right &&
      imgRect.right > selectionRect.left &&
      imgRect.top < selectionRect.bottom &&
      imgRect.bottom > selectionRect.top
    );
  });
  
  // 返回图片URL数组
  return selectedImages.map(img => img.src);
}

// 保存图片到Flomo
function saveImageToFlomo(imageUrl, tab, shouldEdit) {
  if (!imageUrl) {
    console.log('没有选中任何图片');
    return;
  }

  // 获取设置
  chrome.storage.sync.get('flomoSettings', (data) => {
    const settings = data.flomoSettings || {};
    
    // 提取文件名作为图片描述
    const imageName = imageUrl.split('/').pop().split('?')[0]; // 提取文件名
    // 使用简短的占位符
    const imageDisplayText = `图片: ${imageName}`;
    
    let content = imageDisplayText;
    
    // 根据设置添加网页链接和标题
    if (settings.autoAddLink && tab.url) {
      content += `\n\n来源：[${tab.title || '网页'}](${tab.url})`;
    } else if (settings.autoAddTitle && tab.title) {
      content += `\n\n来源：${tab.title}`;
    }
    
    if (shouldEdit) {
      // 打开编辑窗口
      chrome.storage.local.set({ 
        'editContent': content,
        'editImageUrl': imageUrl  // 存储图片URL以便弹出窗口加载
      }, () => {
        chrome.action.openPopup();
      });
    } else {
      // 在发送前构建完整的Markdown
      const fullContent = content.replace(imageDisplayText, `![${imageName}](${imageUrl})`);
      // 直接发送到Flomo服务
      sendToFlomoWebhook(fullContent);
    }
  });
} 