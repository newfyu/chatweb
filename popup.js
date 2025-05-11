document.addEventListener('DOMContentLoaded', function() {
  // 初始化UI元素
  const chatPanel = document.getElementById('chatPanel');
  const settingsPanel = document.getElementById('settingsPanel');
  const chatMessages = document.getElementById('chatMessages');
  const userInput = document.getElementById('userInput');
  const sendButton = document.getElementById('sendButton');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsIcon = document.getElementById('settingsIcon');
  const backIcon = document.getElementById('backIcon');
  const backToChat = document.getElementById('backToChat');
  const apiEndpoint = document.getElementById('apiEndpoint');
  const apiKey = document.getElementById('apiKey');
  const modelName = document.getElementById('modelName');
  const temperature = document.getElementById('temperature');
  const temperatureValue = document.getElementById('temperatureValue');
  const saveSettings = document.getElementById('saveSettings');
  const clearChat = document.getElementById('clearChat');

  // 当前会话的消息记录(用于API请求)
  let currentConversation = [];
  // 是否已经发送过网页内容
  let hasWebPageContext = false;
  // 当前页面URL
  let currentUrl = '';
  // 当前是否在设置面板
  let isInSettings = false;
  
  // 初始化清空按钮的可见性 - 根据当前激活的面板设置
  if (settingsPanel.classList.contains('active')) {
    clearChat.style.display = 'none';
    setButtonToBackMode();
  } else {
    clearChat.style.display = 'flex';
    setButtonToSettingsMode();
  }

  // 温度滑块值变化时更新显示
  temperature.addEventListener('input', function() {
    temperatureValue.textContent = this.value;
  });

  // 加载聊天历史记录
  loadChatHistory();

  // 加载设置
  chrome.storage.sync.get(['apiEndpoint', 'apiKey', 'modelName', 'temperature'], function(result) {
    apiEndpoint.value = result.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
    apiKey.value = result.apiKey || '';
    modelName.value = result.modelName || 'gpt-3.5-turbo';
    
    if (result.temperature !== undefined) {
      temperature.value = result.temperature;
      temperatureValue.textContent = result.temperature;
    } else {
      temperature.value = 0.7;
      temperatureValue.textContent = "0.7";
    }
  });

  // 保存设置
  saveSettings.addEventListener('click', function() {
    chrome.storage.sync.set({
      apiEndpoint: apiEndpoint.value,
      apiKey: apiKey.value,
      modelName: modelName.value,
      temperature: temperature.value
    }, function() {
      showChatPanel();
    });
  });

  // 设置/返回按钮点击处理
  settingsBtn.addEventListener('click', function() {
    if (isInSettings) {
      showChatPanel();
    } else {
      showSettingsPanel();
    }
  });

  // 返回聊天面板（底部返回按钮）
  backToChat.addEventListener('click', function() {
    showChatPanel();
  });

  // 切换到聊天面板
  function showChatPanel() {
    chatPanel.classList.add('active');
    settingsPanel.classList.remove('active');
    clearChat.style.display = 'flex';
    setButtonToSettingsMode();
    isInSettings = false;
  }

  // 切换到设置面板
  function showSettingsPanel() {
    settingsPanel.classList.add('active');
    chatPanel.classList.remove('active');
    clearChat.style.display = 'none';
    setButtonToBackMode();
    isInSettings = true;
  }

  // 设置按钮为设置模式
  function setButtonToSettingsMode() {
    settingsIcon.style.display = 'block';
    backIcon.style.display = 'none';
    settingsBtn.title = '设置';
  }

  // 设置按钮为返回模式
  function setButtonToBackMode() {
    settingsIcon.style.display = 'none';
    backIcon.style.display = 'block';
    settingsBtn.title = '返回';
  }

  // 清空聊天历史
  clearChat.addEventListener('click', clearChatHistory);

  // 发送消息
  sendButton.addEventListener('click', sendMessage);
  userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function clearChatHistory() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) return;
      
      currentUrl = tabs[0].url;
      if (!currentUrl) return;
      
      // 清空UI
      chatMessages.innerHTML = '';
      
      // 清空存储的聊天记录
      chrome.storage.local.get(['chatHistory', 'conversationState'], function(result) {
        let chatHistory = result.chatHistory || {};
        let conversationState = result.conversationState || {};
        
        // 删除当前URL的记录
        if (chatHistory[currentUrl]) {
          delete chatHistory[currentUrl];
        }
        
        if (conversationState[currentUrl]) {
          delete conversationState[currentUrl];
        }
        
        // 重置当前对话状态
        currentConversation = [];
        hasWebPageContext = false;
        
        // 更新存储
        chrome.storage.local.set({
          chatHistory: chatHistory,
          conversationState: conversationState
        });
      });
    });
  }

  function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // 添加用户消息到聊天窗口
    addMessage(message, 'user');
    userInput.value = '';

    // 获取当前标签页URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      currentUrl = tabs[0].url;
      
      // 如果是首次对话，需要获取网页内容
      if (!hasWebPageContext) {
        // 从当前活动标签页获取网页内容
        getPageContent(tabs[0].id, function(pageContent) {
          if (pageContent) {
            // 添加系统消息和网页内容
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
            askLLM(currentUrl);
          } else {
            const errorMsg = '无法获取页面内容。请确保您在有效的网页上。';
            addMessage(errorMsg, 'bot');
            saveChatMessage(currentUrl, errorMsg, 'bot');
          }
        });
      } else {
        // 如果已有上下文，只添加用户问题
        currentConversation.push({
          role: "user",
          content: message
        });
        
        askLLM(currentUrl);
      }
    });
  }

  // 获取页面内容的多种方法
  function getPageContent(tabId, callback) {
    // 先尝试使用content脚本获取内容
    chrome.tabs.sendMessage(tabId, {action: "getPageContent"}, function(response) {
      // 如果content脚本方式失败，尝试使用background脚本方式
      if (chrome.runtime.lastError || !response || !response.content) {
        chrome.runtime.sendMessage({action: "extractContent"}, function(bgResponse) {
          if (bgResponse && bgResponse.success && bgResponse.content) {
            callback(bgResponse.content);
          } else {
            // 如果两种方式都失败，尝试直接在页面上执行脚本
            chrome.scripting.executeScript({
              target: {tabId: tabId},
              function: function() {
                // 简单获取页面文本
                return document.body.innerText;
              }
            }, function(results) {
              if (results && results[0] && results[0].result) {
                callback(results[0].result);
              } else {
                callback(null);
              }
            });
          }
        });
      } else {
        callback(response.content);
      }
    });
  }

  function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(sender + '-message');
    
    // 如果是机器人消息，使用markdown-it渲染
    if (sender === 'bot') {
      try {
        // 初始化markdown-it
        const md = window.markdownit({
          html: false,         // 禁用HTML标签
          breaks: true,        // 将换行符转换为<br>
          linkify: true        // 自动将URL转换为链接
        });
        
        // 渲染markdown
        messageDiv.innerHTML = md.render(text);
        
        // 为所有链接添加target="_blank"以便在新窗口打开
        const links = messageDiv.querySelectorAll('a');
        links.forEach(link => {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        });
      } catch (error) {
        console.error('Markdown渲染失败:', error);
        messageDiv.textContent = text;
      }
    } else {
      // 用户消息保持为纯文本
      messageDiv.textContent = text;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
  }

  function askLLM(currentUrl) {
    // 显示加载消息
    const loadingId = 'loading-' + Date.now();
    const loadingElement = addMessage('正在思考...', 'bot');
    loadingElement.id = loadingId;

    // 保存用户问题到聊天历史
    saveChatMessage(currentUrl, currentConversation[currentConversation.length - 1].content, 'user');

    // 获取设置
    chrome.storage.sync.get(['apiEndpoint', 'apiKey', 'modelName', 'temperature'], function(result) {
      if (!result.apiKey) {
        const errorMsg = '请在设置中配置API密钥';
        
        try {
          // 初始化markdown-it
          const md = window.markdownit({
            html: false,
            breaks: true,
            linkify: true
          });
          
          loadingElement.innerHTML = md.render(errorMsg);
        } catch (error) {
          loadingElement.textContent = errorMsg;
        }
        
        saveChatMessage(currentUrl, errorMsg, 'bot');
        return;
      }

      // 获取温度参数，默认为0.7
      const tempValue = result.temperature !== undefined ? parseFloat(result.temperature) : 0.7;

      // 添加调试信息
      console.log('发送至API:', {
        endpoint: result.apiEndpoint,
        model: result.modelName,
        temperature: tempValue,
        messagesCount: currentConversation.length
      });

      fetch(result.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + result.apiKey
        },
        body: JSON.stringify({
          model: result.modelName,
          messages: currentConversation,
          temperature: tempValue
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
        
        try {
          // 初始化markdown-it
          const md = window.markdownit({
            html: false,
            breaks: true,
            linkify: true
          });
          
          loadingElement.innerHTML = md.render(answer);
          
          // 为所有链接添加target="_blank"以便在新窗口打开
          const links = loadingElement.querySelectorAll('a');
          links.forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          });
        } catch (error) {
          loadingElement.textContent = answer;
        }
        
        // 将AI回答添加到对话历史
        currentConversation.push({
          role: "assistant",
          content: answer
        });
        
        // 保存AI回答到聊天历史
        saveChatMessage(currentUrl, answer, 'bot');
      })
      .catch(error => {
        const errorMsg = '出错了: ' + error.message;
        
        try {
          // 初始化markdown-it
          const md = window.markdownit({
            html: false,
            breaks: true,
            linkify: true
          });
          
          loadingElement.innerHTML = md.render(errorMsg);
        } catch (error) {
          loadingElement.textContent = errorMsg;
        }
        
        saveChatMessage(currentUrl, errorMsg, 'bot');
      });
    });
  }
  
  // 保存聊天消息到历史记录
  function saveChatMessage(url, message, sender) {
    chrome.storage.local.get(['chatHistory', 'conversationState'], function(result) {
      // 保存聊天气泡历史
      let chatHistory = result.chatHistory || {};
      if (!chatHistory[url]) {
        chatHistory[url] = [];
      }
      
      chatHistory[url].push({
        text: message,
        sender: sender,
        timestamp: Date.now()
      });
      
      // 限制每个URL的历史记录数量，避免存储过多
      if (chatHistory[url].length > 100) {
        chatHistory[url] = chatHistory[url].slice(-100);
      }
      
      // 保存对话状态
      let conversationState = result.conversationState || {};
      conversationState[url] = {
        messages: currentConversation,
        hasWebPageContext: hasWebPageContext
      };
      
      chrome.storage.local.set({
        chatHistory: chatHistory,
        conversationState: conversationState
      });
    });
  }
  
  // 加载聊天历史记录
  function loadChatHistory() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) return;
      
      currentUrl = tabs[0].url;
      if (!currentUrl) return;
      
      chrome.storage.local.get(['chatHistory', 'conversationState'], function(result) {
        // 恢复聊天气泡
        const chatHistory = result.chatHistory || {};
        const urlHistory = chatHistory[currentUrl] || [];
        
        // 清空当前聊天窗口
        chatMessages.innerHTML = '';
        
        // 添加历史消息
        urlHistory.forEach(message => {
          addMessage(message.text, message.sender);
        });
        
        // 恢复对话状态
        const conversationState = result.conversationState || {};
        if (conversationState[currentUrl]) {
          currentConversation = conversationState[currentUrl].messages || [];
          hasWebPageContext = conversationState[currentUrl].hasWebPageContext || false;
        } else {
          currentConversation = [];
          hasWebPageContext = false;
        }
        
        // 滚动到底部
        if (urlHistory.length > 0) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      });
    });
  }
}); 