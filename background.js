// 当扩展安装或更新时初始化默认设置
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.sync.get(['apiEndpoint', 'apiKey', 'modelName'], function(result) {
    if (!result.apiEndpoint) {
      chrome.storage.sync.set({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        modelName: 'gpt-3.5-turbo'
      });
    }
  });
  
  // 创建右键菜单
  chrome.contextMenus.create({
    id: "extractContent",
    title: "提取并分析此页面内容",
    contexts: ["page"]
  });
});

// 注册可访问的资源
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getExtensionInfo") {
    sendResponse({
      extensionId: chrome.runtime.id
    });
  }
  return true;
});

// 确保内容脚本已注入
chrome.action.onClicked.addListener(function(tab) {
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
    // 浏览器特殊页面不能注入脚本
    return;
  }
  
  // 尝试执行内容脚本
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['content.js']
  });
});

// 处理内容提取请求
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "extractContent") {
    // 在当前标签页执行内容提取
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        sendResponse({success: false, error: "没有活动标签页"});
        return;
      }
      
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: function() {
          // 从页面提取内容
          function extractPageContent() {
            // 主要内容选择器，按优先级排序
            const contentSelectors = [
              'article', 'main', '.content', '.article', '.post', 
              '#content', '#main', '.main', '.body', '.entry-content'
            ];
            
            // 尝试获取主要内容
            for (const selector of contentSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                return element.innerText;
              }
            }
            
            // 如果没有找到主要内容，获取可见文本内容
            const excludeSelectors = [
              'header', 'footer', 'nav', 'aside', '.sidebar', '.menu', '.navigation',
              '.nav', '.footer', '.header', 'script', 'style', 'noscript'
            ];
            
            let content = '';
            const paragraphs = Array.from(document.querySelectorAll('p'));
            
            if (paragraphs.length > 0) {
              paragraphs.forEach(p => {
                if (p.innerText.trim().length > 0) {
                  content += p.innerText.trim() + '\n\n';
                }
              });
            } else {
              // 如果没有段落，获取所有可见文本
              content = document.body.innerText;
            }
            
            return content.trim();
          }
          
          return {content: extractPageContent()};
        }
      }, function(results) {
        if (chrome.runtime.lastError) {
          sendResponse({success: false, error: chrome.runtime.lastError.message});
          return;
        }
        
        if (results && results[0] && results[0].result) {
          sendResponse({success: true, content: results[0].result.content});
        } else {
          sendResponse({success: false, error: "无法提取内容"});
        }
      });
    });
    
    return true; // 表示将异步发送响应
  }
}); 