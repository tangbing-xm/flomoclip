// contentScript.js - FlomoClip内容脚本

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    // 获取选中的文本内容
    const selectedText = window.getSelection().toString();
    sendResponse({ selectedText: selectedText });
  } else if (request.action === 'getPageInfo') {
    // 获取页面信息（标题、URL等）
    const pageInfo = {
      title: document.title,
      url: window.location.href,
      favicon: getFaviconUrl()
    };
    sendResponse({ pageInfo: pageInfo });
  } else if (request.action === 'getSelectedImage') {
    // 获取选中的图片
    const images = document.querySelectorAll('img');
    const selectedImages = Array.from(images).filter(img => {
      const rect = img.getBoundingClientRect();
      const selection = window.getSelection();
      if (!selection.rangeCount) return false;
      
      const range = selection.getRangeAt(0);
      const selectionRect = range.getBoundingClientRect();
      
      return (
        rect.left <= selectionRect.right &&
        rect.right >= selectionRect.left &&
        rect.top <= selectionRect.bottom &&
        rect.bottom >= selectionRect.top
      );
    });
    
    const imageUrls = selectedImages.map(img => img.src);
    sendResponse({ imageUrls: imageUrls });
  }
  
  // 返回true表示异步响应
  return true;
});

// 获取页面favicon的URL
function getFaviconUrl() {
  const favicon = document.querySelector('link[rel="icon"]') || 
                 document.querySelector('link[rel="shortcut icon"]');
  
  if (favicon) {
    return favicon.href;
  }
  
  // 默认尝试网站根目录下的favicon
  return window.location.origin + '/favicon.ico';
}

// 创建浮动按钮功能
let floatingButton = null;

// 当用户选择文本时显示浮动按钮
document.addEventListener('mouseup', (event) => {
  const selection = window.getSelection();
  
  // 移除旧的浮动按钮
  if (floatingButton) {
    document.body.removeChild(floatingButton);
    floatingButton = null;
  }
  
  // 检查是否有文本被选中
  if (selection.toString().trim() !== '') {
    // 创建浮动按钮
    floatingButton = document.createElement('div');
    floatingButton.id = 'flomo-clip-button';
    floatingButton.innerHTML = `
      <div class="flomo-clip-icon">📋</div>
    `;
    
    // 设置浮动按钮样式
    floatingButton.style.position = 'absolute';
    floatingButton.style.left = `${event.pageX}px`;
    floatingButton.style.top = `${event.pageY - 40}px`;
    floatingButton.style.background = '#4a4a4a';
    floatingButton.style.color = 'white';
    floatingButton.style.padding = '8px';
    floatingButton.style.borderRadius = '4px';
    floatingButton.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    floatingButton.style.zIndex = '9999';
    floatingButton.style.cursor = 'pointer';
    floatingButton.style.fontSize = '16px';
    
    // 添加点击事件，保存选中内容到Flomo
    floatingButton.addEventListener('click', () => {
      const selectedText = selection.toString();
      
      // 发送消息到背景脚本
      chrome.runtime.sendMessage({
        action: 'saveSelectedText',
        text: selectedText
      });
      
      // 移除浮动按钮
      document.body.removeChild(floatingButton);
      floatingButton = null;
    });
    
    // 添加到页面中
    document.body.appendChild(floatingButton);
    
    // 设置自动隐藏定时器
    setTimeout(() => {
      if (floatingButton && document.body.contains(floatingButton)) {
        document.body.removeChild(floatingButton);
        floatingButton = null;
      }
    }, 3000);
  }
});

// 在页面点击时检查是否需要隐藏浮动按钮
document.addEventListener('click', (event) => {
  if (floatingButton && !floatingButton.contains(event.target)) {
    document.body.removeChild(floatingButton);
    floatingButton = null;
  }
}); 