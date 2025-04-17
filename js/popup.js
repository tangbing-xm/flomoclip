// popup.js - FlomoClip弹出窗口脚本

// DOM元素
const elements = {
  // 导航按钮
  btnEditor: document.getElementById('btn-editor'),
  btnHistory: document.getElementById('btn-history'),
  btnSettings: document.getElementById('btn-settings'),
  
  // 页面容器
  editorPage: document.getElementById('editor-page'),
  historyPage: document.getElementById('history-page'),
  settingsPage: document.getElementById('settings-page'),
  
  // 编辑器元素
  editor: document.getElementById('editor'),
  tagInput: document.getElementById('tag-input'),
  tagsSuggestions: document.getElementById('tags-suggestions'),
  sourceInfo: document.getElementById('source-info'),
  btnSave: document.getElementById('btn-save'),
  btnClear: document.getElementById('btn-clear'),
  
  // 历史记录元素
  historyList: document.getElementById('history-list'),
  
  // 设置元素
  webhookUrl: document.getElementById('webhook-url'),
  loginStatus: document.getElementById('login-status'),
  autoAddLink: document.getElementById('auto-add-link'),
  autoAddTitle: document.getElementById('auto-add-title'),
  defaultTags: document.getElementById('default-tags'),
  defaultTagsList: document.getElementById('default-tags-list'),
  btnSyncOffline: document.getElementById('btn-sync-offline'),
  offlineCount: document.getElementById('offline-count'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnTestWebhook: document.getElementById('btn-test-webhook'),
  
  // 状态提示
  statusToast: document.getElementById('status-toast')
};

// 当前活动标签页信息
let currentTab = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 获取当前标签页信息
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs.length > 0) {
      currentTab = tabs[0];
      updateSourceInfo();
    }
  });
  
  // 加载存储的设置
  loadSettings();
  
  // 加载历史记录
  loadHistory();
  
  // 加载离线内容数量
  updateOfflineCount();
  
  // 检查是否有来自背景脚本的编辑内容
  chrome.storage.local.get('editContent', (data) => {
    if (data.editContent) {
      elements.editor.value = data.editContent;
      // 清除存储的编辑内容
      chrome.storage.local.remove('editContent');
    }
  });
  
  // 初始化导航事件监听器
  setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
  // 导航切换
  elements.btnEditor.addEventListener('click', () => switchPage('editor'));
  elements.btnHistory.addEventListener('click', () => switchPage('history'));
  elements.btnSettings.addEventListener('click', () => switchPage('settings'));
  
  // 编辑器按钮
  elements.btnSave.addEventListener('click', saveContent);
  elements.btnClear.addEventListener('click', clearEditor);
  
  // 标签输入
  elements.tagInput.addEventListener('keydown', handleTagInput);
  
  // 设置保存
  elements.btnSaveSettings.addEventListener('click', saveSettings);
  
  // 同步离线内容
  elements.btnSyncOffline.addEventListener('click', syncOfflineContent);
  
  // Webhook URL变更
  elements.webhookUrl.addEventListener('blur', validateWebhookUrl);
  
  // 测试Webhook
  if (elements.btnTestWebhook) {
    elements.btnTestWebhook.addEventListener('click', testWebhook);
  }
  
  // 添加标签按钮
  const btnAddTag = document.getElementById('btn-add-tag');
  if (btnAddTag) {
    btnAddTag.addEventListener('click', addDefaultTag);
  }
  
  // 默认标签输入框回车事件
  if (elements.defaultTags) {
    elements.defaultTags.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDefaultTag();
      }
    });
  }
}

// 切换页面
function switchPage(page) {
  // 移除所有导航按钮的active类
  elements.btnEditor.classList.remove('active');
  elements.btnHistory.classList.remove('active');
  elements.btnSettings.classList.remove('active');
  
  // 隐藏所有页面
  elements.editorPage.classList.remove('active');
  elements.historyPage.classList.remove('active');
  elements.settingsPage.classList.remove('active');
  
  // 激活选中的页面和按钮
  switch (page) {
    case 'editor':
      elements.btnEditor.classList.add('active');
      elements.editorPage.classList.add('active');
      break;
    case 'history':
      elements.btnHistory.classList.add('active');
      elements.historyPage.classList.add('active');
      loadHistory(); // 刷新历史记录
      break;
    case 'settings':
      elements.btnSettings.classList.add('active');
      elements.settingsPage.classList.add('active');
      break;
  }
}

// 更新来源信息显示
function updateSourceInfo() {
  if (currentTab) {
    elements.sourceInfo.innerHTML = `
      <div>来源：<a href="${currentTab.url}" target="_blank">${currentTab.title}</a></div>
    `;
  }
}

// 加载设置
function loadSettings() {
  chrome.storage.sync.get('flomoSettings', (data) => {
    const settings = data.flomoSettings || {
      autoAddLink: true,
      autoAddTitle: true,
      defaultTags: [],
      webhookUrl: 'https://flomoapp.com/iwh/NTkyNTkx/ca8398dd3eb297702c173363355f36a7/',
      isLoggedIn: true
    };
    
    // 更新UI
    elements.autoAddLink.checked = settings.autoAddLink;
    elements.autoAddTitle.checked = settings.autoAddTitle;
    elements.webhookUrl.value = settings.webhookUrl;
    
    // 更新标签列表
    updateDefaultTagsList(settings.defaultTags);
    
    // 更新登录状态
    updateLoginStatus(settings.isLoggedIn);
    
    // 更新标签建议
    updateTagSuggestions(settings.defaultTags);
  });
}

// 保存设置
function saveSettings() {
  // 获取输入的标签
  const newDefaultTags = getDefaultTagsFromInput();
  
  const settings = {
    autoAddLink: elements.autoAddLink.checked,
    autoAddTitle: elements.autoAddTitle.checked,
    webhookUrl: elements.webhookUrl.value.trim(),
    isLoggedIn: !!elements.webhookUrl.value.trim(),
    defaultTags: newDefaultTags
  };
  
  chrome.storage.sync.set({ flomoSettings: settings }, () => {
    showToast('设置已保存', 'success');
    updateLoginStatus(settings.isLoggedIn);
    updateDefaultTagsList(settings.defaultTags);
    updateTagSuggestions(settings.defaultTags);
  });
}

// 验证Webhook URL
function validateWebhookUrl() {
  const webhookUrl = elements.webhookUrl.value.trim();
  
  if (!webhookUrl) {
    updateLoginStatus(false);
    return;
  }
  
  // 验证URL格式
  const isValid = webhookUrl.startsWith('https://flomoapp.com/iwh/');
  
  if (isValid) {
    updateLoginStatus(true);
  } else {
    showToast('Webhook URL格式不正确', 'error');
    updateLoginStatus(false);
  }
}

// 更新登录状态显示
function updateLoginStatus(isLoggedIn) {
  elements.loginStatus.className = 'login-status';
  
  if (isLoggedIn) {
    elements.loginStatus.classList.add('logged-in');
    elements.loginStatus.innerHTML = '<span>✓</span> 已连接';
  } else {
    elements.loginStatus.classList.add('logged-out');
    elements.loginStatus.innerHTML = '<span>!</span> 未连接';
  }
}

// 从输入框获取默认标签
function getDefaultTagsFromInput() {
  const tagsText = elements.defaultTags.value.trim();
  if (!tagsText) return [];
  
  // 将输入按空格分割，过滤空字符串，并添加#前缀
  return tagsText.split(/\s+/).filter(tag => tag).map(tag => {
    return tag.startsWith('#') ? tag : `#${tag}`;
  });
}

// 更新默认标签列表显示
function updateDefaultTagsList(tags) {
  elements.defaultTagsList.innerHTML = '';
  elements.defaultTags.value = tags.map(tag => tag.replace('#', '')).join(' ');
  
  tags.forEach(tag => {
    const tagElement = document.createElement('div');
    tagElement.className = 'default-tag';
    tagElement.innerHTML = `
      <span class="tag-text">${tag}</span>
      <span class="remove-tag" title="删除标签">×</span>
    `;
    
    // 添加删除标签的点击事件
    tagElement.querySelector('.remove-tag').addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      removeDefaultTag(tag);
    });
    
    elements.defaultTagsList.appendChild(tagElement);
  });
}

// 移除默认标签
function removeDefaultTag(tagToRemove) {
  console.log('正在删除标签:', tagToRemove);
  chrome.storage.sync.get('flomoSettings', (data) => {
    const settings = data.flomoSettings || {};
    const oldTags = settings.defaultTags || [];
    settings.defaultTags = oldTags.filter(tag => tag !== tagToRemove);
    
    console.log('删除前:', oldTags);
    console.log('删除后:', settings.defaultTags);
    
    chrome.storage.sync.set({ flomoSettings: settings }, () => {
      showToast(`标签 ${tagToRemove} 已删除`, 'success');
      updateDefaultTagsList(settings.defaultTags);
      updateTagSuggestions(settings.defaultTags);
    });
  });
}

// 更新标签建议
function updateTagSuggestions(tags) {
  elements.tagsSuggestions.innerHTML = '';
  
  tags.forEach(tag => {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag-suggestion';
    tagElement.textContent = tag;
    
    // 点击标签建议，将其添加到编辑框
    tagElement.addEventListener('click', () => {
      addTagToEditor(tag);
    });
    
    elements.tagsSuggestions.appendChild(tagElement);
  });
}

// 添加标签到编辑框
function addTagToEditor(tag) {
  const currentContent = elements.editor.value;
  
  // 检查编辑框内容最后是否已有该标签
  if (currentContent.trim().endsWith(tag)) {
    return;
  }
  
  // 检查编辑框内容是否已有其他标签
  const hasOtherTags = /#[^\s]+/.test(currentContent);
  
  // 在内容后添加标签
  if (currentContent.trim() === '') {
    elements.editor.value = tag;
  } else if (hasOtherTags) {
    elements.editor.value = `${currentContent} ${tag}`;
  } else {
    elements.editor.value = `${currentContent}\n\n${tag}`;
  }
}

// 处理标签输入
function handleTagInput(event) {
  // 如果按下空格，添加当前输入的标签
  if (event.key === ' ' || event.key === 'Enter') {
    const tagText = elements.tagInput.value.trim();
    
    if (tagText) {
      const tag = tagText.startsWith('#') ? tagText : `#${tagText}`;
      addTagToEditor(tag);
      elements.tagInput.value = '';
    }
    
    if (event.key === 'Enter') {
      event.preventDefault();
    }
  }
}

// 保存内容到Flomo
function saveContent() {
  // 获取编辑器内容
  let content = elements.editor.value.trim();
  
  // 获取来源信息，确保将source-info中的链接添加到内容中
  const sourceInfoElement = elements.sourceInfo;
  if (sourceInfoElement && sourceInfoElement.textContent.trim() && !content.includes('来源：')) {
    const sourceLink = sourceInfoElement.querySelector('a');
    if (sourceLink) {
      const sourceLinkHtml = `\n\n来源：[${sourceLink.textContent}](${sourceLink.href})`;
      content += sourceLinkHtml;
    }
  }
  
  if (!content) {
    showToast('内容不能为空', 'error');
    return;
  }
  
  // 获取设置信息
  chrome.storage.sync.get('flomoSettings', (data) => {
    const settings = data.flomoSettings || {};
    
    if (!settings.webhookUrl) {
      showToast('请先在设置中添加Webhook URL', 'error');
      switchPage('settings');
      return;
    }
    
    // 显示保存中状态
    showToast('正在保存...', '');
    
    // 进行更详细的日志记录
    console.log('准备发送到Flomo，内容:', content);
    console.log('使用Webhook URL:', settings.webhookUrl);
    
    // 发送到Webhook
    fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: content
      })
    })
    .then(response => {
      console.log('Flomo API响应状态:', response.status);
      console.log('响应头部:', [...response.headers.entries()]);
      
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
            data: { code: response.status === 200 ? 0 : -1 }
          };
        }
      });
    })
    .then(result => {
      const response = result.originalResponse;
      const data = result.data;
      
      console.log('处理结果:', result);
      
      // 如果HTTP状态码为200，默认视为成功
      const httpSuccess = response.status === 200;
      
      // 检查API返回的code值（如果存在）
      const apiSuccess = data && (data.code === 0 || data.code === undefined && data.status !== 'error');
      
      // 综合判断是否成功
      const isSuccess = httpSuccess && (apiSuccess || !data);
      
      if (isSuccess) {
        // 先显示成功消息
        showToast('保存成功', 'success');
        // 然后保存到历史记录
        saveToHistory(content);
        // 最后清空编辑器
        clearEditor();
      } else {
        const errorMsg = data && data.message ? data.message : result.text || '未知错误';
        console.error('保存失败:', errorMsg);
        showToast(`保存失败: ${errorMsg}`, 'error');
      }
    })
    .catch(error => {
      console.error('发送到Flomo Webhook时出错:', error);
      showToast('网络错误，已保存到离线内容', 'error');
      saveOffline(content);
    });
  });
}

// 保存到历史记录
function saveToHistory(content) {
  chrome.storage.local.get('history', (data) => {
    const history = data.history || [];
    history.unshift({
      content: content,
      timestamp: new Date().toISOString(),
      source: currentTab ? {
        title: currentTab.title,
        url: currentTab.url
      } : null
    });
    
    // 限制历史记录数量
    if (history.length > 50) {
      history.pop();
    }
    
    chrome.storage.local.set({ 'history': history });
  });
}

// 离线保存
function saveOffline(content) {
  chrome.storage.local.get('offlineContents', (data) => {
    const offlineContents = data.offlineContents || [];
    offlineContents.push({
      content: content,
      timestamp: new Date().toISOString(),
      source: currentTab ? {
        title: currentTab.title,
        url: currentTab.url
      } : null
    });
    
    chrome.storage.local.set({ 'offlineContents': offlineContents }, () => {
      updateOfflineCount();
    });
  });
}

// 更新离线内容数量
function updateOfflineCount() {
  chrome.storage.local.get('offlineContents', (data) => {
    const count = data.offlineContents ? data.offlineContents.length : 0;
    elements.offlineCount.textContent = `当前有 ${count} 条离线内容`;
    
    // 禁用/启用同步按钮
    elements.btnSyncOffline.disabled = count === 0;
  });
}

// 同步离线内容
function syncOfflineContent() {
  chrome.storage.local.get(['offlineContents', 'flomoSettings'], (data) => {
    const offlineContents = data.offlineContents || [];
    const settings = data.flomoSettings || {};
    
    if (offlineContents.length === 0) {
      showToast('没有需要同步的离线内容', 'error');
      return;
    }
    
    if (!settings.webhookUrl) {
      showToast('请先在设置中添加Webhook URL', 'error');
      switchPage('settings');
      return;
    }
    
    // 显示同步中状态
    showToast('正在同步离线内容...', '');
    
    // 创建同步队列
    const syncQueue = [...offlineContents];
    let successCount = 0;
    let failedCount = 0;
    
    // 递归处理同步队列
    function processQueue() {
      if (syncQueue.length === 0) {
        // 全部处理完成
        showToast(`同步完成：${successCount}个成功，${failedCount}个失败`, successCount > 0 ? 'success' : 'error');
        updateOfflineCount();
        return;
      }
      
      const item = syncQueue.shift();
      console.log('同步内容:', item.content);
      
      fetch(settings.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: item.content
        })
      })
      .then(response => {
        console.log('同步API响应状态:', response.status);
        console.log('同步响应头:', [...response.headers.entries()]);
        
        // 如果状态码是200，默认视为成功
        const httpSuccess = response.status === 200;
        
        // 检查响应是否为JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json().then(data => {
            console.log('同步响应JSON:', data);
            return {
              originalResponse: response,
              data: data
            };
          });
        }
        
        // 非JSON响应，获取文本
        return response.text().then(text => {
          console.log('同步响应文本内容:', text);
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
        
        console.log('同步处理结果:', result);
        
        // 如果HTTP状态码为200，默认视为成功
        const httpSuccess = response.status === 200;
        
        // 检查API返回的code值（如果存在）
        const apiSuccess = data && (data.code === 0 || data.code === undefined && data.status !== 'error');
        
        // 综合判断是否成功
        const isSuccess = httpSuccess && (apiSuccess || !data);
        
        if (isSuccess) {
          // 同步成功，保存到历史记录
          console.log('同步成功');
          saveToHistory(item.content);
          successCount++;
          
          // 从离线内容中移除
          chrome.storage.local.get('offlineContents', (data) => {
            let updatedOfflineContents = data.offlineContents || [];
            updatedOfflineContents = updatedOfflineContents.filter(content => 
              content.timestamp !== item.timestamp
            );
            
            chrome.storage.local.set({ 'offlineContents': updatedOfflineContents }, () => {
              // 处理下一个
              processQueue();
            });
          });
        } else {
          const errorMsg = data && data.message ? data.message : result.text || '未知错误';
          console.error('同步失败:', errorMsg);
          failedCount++;
          processQueue();
        }
      })
      .catch(error => {
        console.error('同步内容时出错:', error);
        failedCount++;
        processQueue();
      });
    }
    
    // 开始处理队列
    processQueue();
  });
}

// 加载历史记录
function loadHistory() {
  chrome.storage.local.get('history', (data) => {
    const history = data.history || [];
    
    if (history.length === 0) {
      elements.historyList.innerHTML = `
        <div class="empty-state">
          <p>暂无历史记录</p>
        </div>
      `;
      return;
    }
    
    elements.historyList.innerHTML = '';
    
    history.forEach(item => {
      const date = new Date(item.timestamp);
      const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <div class="history-content">${item.content}</div>
        <div class="history-meta">
          <div class="history-date">${formattedDate}</div>
          ${item.source ? `<div class="history-source">${item.source.title}</div>` : ''}
        </div>
      `;
      
      // 点击历史记录项，将内容加载到编辑器
      historyItem.addEventListener('click', () => {
        elements.editor.value = item.content;
        switchPage('editor');
      });
      
      elements.historyList.appendChild(historyItem);
    });
  });
}

// 清空编辑器内容
function clearEditor() {
  elements.editor.value = '';
}

// 显示状态提示
function showToast(message, type = '') {
  elements.statusToast.textContent = message;
  elements.statusToast.className = 'status-toast';
  
  if (type) {
    elements.statusToast.classList.add(type);
  }
  
  elements.statusToast.classList.add('show');
  
  // 减少提示显示时间
  setTimeout(() => {
    elements.statusToast.classList.remove('show');
  }, 3000); // 从5秒改为3秒
}

// 测试Webhook URL
function testWebhook() {
  const webhookUrl = elements.webhookUrl.value.trim();
  
  if (!webhookUrl) {
    showToast('请先输入Webhook URL', 'error');
    return;
  }
  
  showToast('正在测试Webhook连接...', '');
  console.log('测试Webhook:', webhookUrl);
  
  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: `测试消息 - FlomoClip连接测试 - ${new Date().toLocaleString()}`
    })
  })
  .then(response => {
    console.log('测试响应状态:', response.status);
    console.log('测试响应头:', [...response.headers.entries()]);
    
    // 如果状态码是200，默认视为成功
    const httpSuccess = response.status === 200;
    
    // 检查响应是否为JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json().then(data => {
        console.log('测试响应JSON:', data);
        return { 
          success: httpSuccess && (data.code === 0 || data.code === undefined && data.status !== 'error'),
          data: data,
          message: data.message || ''
        };
      });
    }
    
    // 非JSON响应，检查状态码
    return response.text().then(text => {
      console.log('测试响应文本:', text);
      try {
        // 尝试解析为JSON
        const jsonData = JSON.parse(text);
        return { 
          success: httpSuccess && (jsonData.code === 0 || jsonData.code === undefined),
          data: jsonData,
          message: jsonData.message || ''
        };
      } catch (e) {
        // 纯文本响应
        return { 
          success: httpSuccess,
          text: text,
          message: httpSuccess ? '连接成功' : text || response.statusText
        };
      }
    });
  })
  .then(result => {
    if (result.success) {
      showToast('Webhook连接测试成功！内容已发送到Flomo', 'success');
      updateLoginStatus(true);
    } else {
      const errorMsg = result.message || '未知错误';
      showToast(`Webhook测试失败: ${errorMsg}`, 'error');
      updateLoginStatus(false);
    }
  })
  .catch(error => {
    console.error('测试Webhook时出错:', error);
    showToast('测试失败: 网络错误', 'error');
    updateLoginStatus(false);
  });
}

// 添加默认标签
function addDefaultTag() {
  const tagText = elements.defaultTags.value.trim();
  if (!tagText) return;
  
  // 获取现有标签
  chrome.storage.sync.get('flomoSettings', (data) => {
    const settings = data.flomoSettings || {};
    const currentTags = settings.defaultTags || [];
    
    // 解析输入的标签
    const newTags = tagText.split(/\s+/).filter(tag => tag).map(tag => 
      tag.startsWith('#') ? tag : `#${tag}`
    );
    
    // 检查标签是否已存在
    const uniqueNewTags = newTags.filter(tag => !currentTags.includes(tag));
    
    if (uniqueNewTags.length === 0) {
      showToast('标签已存在', 'error');
      return;
    }
    
    // 合并标签
    const updatedTags = [...currentTags, ...uniqueNewTags];
    settings.defaultTags = updatedTags;
    
    // 保存设置
    chrome.storage.sync.set({ flomoSettings: settings }, () => {
      showToast(`已添加 ${uniqueNewTags.length} 个标签`, 'success');
      // 清空输入框
      elements.defaultTags.value = '';
      // 更新UI
      updateDefaultTagsList(settings.defaultTags);
      updateTagSuggestions(settings.defaultTags);
    });
  });
} 