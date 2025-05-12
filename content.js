// 移除聊天按钮和聊天窗口创建代码
// 移除之前添加的样式（可能会在popup中使用）
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = chrome.runtime.getURL('content.css');
document.head.appendChild(style);

// 当前会话的消息记录(用于API请求)
let currentConversation = [];
// 是否已经发送过网页内容
let hasWebPageContext = false;

// 从网页提取内容的函数
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
  // 排除脚本、样式、导航等非主要内容
  const excludeSelectors = [
    'header', 'footer', 'nav', 'aside', '.sidebar', '.menu', '.navigation',
    '.nav', '.footer', '.header', 'script', 'style', 'noscript'
  ];
  
  const excludeElements = Array.from(document.querySelectorAll(excludeSelectors.join(',')));
  
  // 收集页面所有段落
  const paragraphs = Array.from(document.querySelectorAll('p'));
  let content = '';
  
  paragraphs.forEach(p => {
    // 检查段落是否在排除元素内
    let isExcluded = false;
    for (const excludeEl of excludeElements) {
      if (excludeEl.contains(p)) {
        isExcluded = true;
        break;
      }
    }
    
    if (!isExcluded && p.innerText.trim().length > 0) {
      content += p.innerText.trim() + '\n\n';
    }
  });
  
  // 如果没有找到足够的内容，回退到 body
  if (content.length < 100) {
    // 获取 body 内容但排除脚本、样式等
    const bodyClone = document.body.cloneNode(true);
    excludeSelectors.forEach(selector => {
      const elements = bodyClone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    content = bodyClone.innerText;
  }
  
  return content.trim();
}

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    sendResponse({content: extractPageContent()});
  }
  return true;
}); 