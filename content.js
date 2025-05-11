// 添加聊天按钮
const chatButton = document.createElement('div');
chatButton.id = 'web-chat-button';
chatButton.textContent = '💬';
chatButton.title = '打开网页聊天';
document.body.appendChild(chatButton);

// 创建聊天窗口
const chatContainer = document.createElement('div');
chatContainer.id = 'web-chat-container';
chatContainer.innerHTML = `
  <div class="web-chat-header">
    <span>胡聊网页助手</span>
    <div class="web-chat-controls">
      <button id="web-chat-clear" class="web-chat-icon-btn" title="清空聊天">+</button>
      <button id="web-chat-close" class="web-chat-icon-btn">×</button>
    </div>
  </div>
  <div id="web-chat-messages"></div>
  <div class="web-chat-input">
    <textarea id="web-chat-input" placeholder="输入您的问题..."></textarea>
    <button id="web-chat-send">↑</button>
  </div>
`;
document.body.appendChild(chatContainer);

// 添加样式
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = chrome.runtime.getURL('content.css');
document.head.appendChild(style);

// 聊天窗口逻辑
let isOpen = false;

// 当前会话的消息记录(用于API请求)
let currentConversation = [];
// 是否已经发送过网页内容
let hasWebPageContext = false;

chatButton.addEventListener('click', () => {
  isOpen = !isOpen;
  chatContainer.style.display = isOpen ? 'flex' : 'none';
  
  // 打开聊天窗口时加载历史记录
  if (isOpen) {
    loadChatHistory();
  }
});

document.getElementById('web-chat-close').addEventListener('click', () => {
  isOpen = false;
  chatContainer.style.display = 'none';
});

const chatMessages = document.getElementById('web-chat-messages');
const chatInput = document.getElementById('web-chat-input');
const chatSend = document.getElementById('web-chat-send');
const chatClear = document.getElementById('web-chat-clear');

// 清空聊天记录
chatClear.addEventListener('click', clearChatHistory);

// 在页面加载时立即加载历史记录和对话状态
loadChatHistory();

// 发送消息
chatSend.addEventListener('click', sendUserMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendUserMessage();
  }
});

function sendUserMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  addMessage(message, 'user');
  chatInput.value = '';
  
  // 保存用户消息到历史记录
  saveChatMessage(message, 'user');
  
  // 是否需要获取网页内容
  if (!hasWebPageContext) {
    const pageContent = extractPageContent();
    
    // 初始化对话，包含网页内容
    currentConversation = [
      {
        role: "system",
        content: "你是一个有帮助的助手。你将根据提供的网页内容回答用户的问题。只使用提供的内容回答，如果内容中没有相关信息，请说明你无法回答。"
      },
      {
        role: "user",
        content: `网页内容：${pageContent}\n\n用户问题：${message}`
      }
    ];
    hasWebPageContext = true;
  } else {
    // 如果已经有了网页内容上下文，只添加用户问题
    currentConversation.push({
      role: "user",
      content: message
    });
  }
  
  // 显示加载中消息
  addMessage('正在思考...', 'bot');
  const loadingElement = chatMessages.lastChild;
  
  // 获取设置
  chrome.storage.sync.get(['apiEndpoint', 'apiKey', 'modelName'], function(result) {
    if (!result.apiKey) {
      const errorMsg = '请在扩展设置中配置API密钥';
      loadingElement.textContent = errorMsg;
      saveChatMessage(errorMsg, 'bot');
      return;
    }
    
    // 发送到API
    fetch(result.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + result.apiKey
      },
      body: JSON.stringify({
        model: result.modelName || 'gpt-3.5-turbo',
        messages: currentConversation,
        temperature: 0.7
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('API请求失败: ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      const answer = data.choices[0].message.content;
      loadingElement.textContent = answer;
      
      // 将AI回答添加到对话历史
      currentConversation.push({
        role: "assistant",
        content: answer
      });
      
      saveChatMessage(answer, 'bot');
    })
    .catch(error => {
      const errorMsg = '出错了: ' + error.message;
      loadingElement.textContent = errorMsg;
      saveChatMessage(errorMsg, 'bot');
    });
  });
}

function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('web-chat-message');
  messageDiv.classList.add(sender + '-message');
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 清空聊天历史
function clearChatHistory() {
  const url = window.location.href;
  
  // 清空UI
  chatMessages.innerHTML = '';
  
  // 清空存储的聊天记录
  chrome.storage.local.get(['contentChatHistory', 'contentConversationState'], function(result) {
    let contentChatHistory = result.contentChatHistory || {};
    let contentConversationState = result.contentConversationState || {};
    
    // 删除当前URL的记录
    if (contentChatHistory[url]) {
      delete contentChatHistory[url];
    }
    
    if (contentConversationState[url]) {
      delete contentConversationState[url];
    }
    
    // 重置当前对话状态
    currentConversation = [];
    hasWebPageContext = false;
    
    // 更新存储
    chrome.storage.local.set({
      contentChatHistory: contentChatHistory,
      contentConversationState: contentConversationState
    });
  });
}

// 保存聊天消息到历史记录
function saveChatMessage(message, sender) {
  const url = window.location.href;
  chrome.storage.local.get(['contentChatHistory', 'contentConversationState'], function(result) {
    // 保存聊天气泡历史
    let contentChatHistory = result.contentChatHistory || {};
    if (!contentChatHistory[url]) {
      contentChatHistory[url] = [];
    }
    
    contentChatHistory[url].push({
      text: message,
      sender: sender,
      timestamp: Date.now()
    });
    
    // 限制每个URL的历史记录数量
    if (contentChatHistory[url].length > 100) {
      contentChatHistory[url] = contentChatHistory[url].slice(-100);
    }
    
    // 保存对话状态
    let contentConversationState = result.contentConversationState || {};
    contentConversationState[url] = {
      messages: currentConversation,
      hasWebPageContext: hasWebPageContext
    };
    
    chrome.storage.local.set({
      contentChatHistory: contentChatHistory,
      contentConversationState: contentConversationState
    });
  });
}

// 加载聊天历史记录
function loadChatHistory() {
  const url = window.location.href;
  chrome.storage.local.get(['contentChatHistory', 'contentConversationState'], function(result) {
    // 恢复聊天气泡
    const contentChatHistory = result.contentChatHistory || {};
    const urlHistory = contentChatHistory[url] || [];
    
    // 清空当前聊天窗口
    chatMessages.innerHTML = '';
    
    // 添加历史消息
    urlHistory.forEach(message => {
      addMessage(message.text, message.sender);
    });
    
    // 恢复对话状态
    const contentConversationState = result.contentConversationState || {};
    if (contentConversationState[url]) {
      currentConversation = contentConversationState[url].messages || [];
      hasWebPageContext = contentConversationState[url].hasWebPageContext || false;
    } else {
      currentConversation = [];
      hasWebPageContext = false;
    }
    
    // 滚动到底部
    if (urlHistory.length > 0) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
}

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