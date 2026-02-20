/** app.js - Ouroboros Web Console 前端逻辑 - 增强版 */

// API 基础 URL
const API_BASE = '';

// 状态
let currentTab = 'chat';
let isTyping = false;
let performanceChartData = [];
let autoRefreshInterval = null;
let memoryPageOffset = 0;
let memoryPageLimit = 10;
let toolExecutionHistory = [];

// 聊天配置
let chatConfig = {
  think: { enabled: true, separator: '</think>', displayMode: 'collapsible' },
  chat: { markdownEnabled: true, lightTheme: false, codeHighlighting: true }
};

// DOM 元素
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const typingStatus = document.getElementById('typing-status');

// 简单的 Markdown 渲染器
function renderMarkdown(text) {
  if (!chatConfig.chat.markdownEnabled) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  let html = text;

  // 代码块 ```language\ncode\n```
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const langClass = lang ? `language-${lang}` : '';
    return `<pre class="code-block ${langClass}"><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // 行内代码 `code`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 标题 ### text
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 粗体 **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 斜体 *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 列表 - item
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // 换行
  html = html.replace(/\n/g, '<br>');

  return html;
}

// 处理 think 模式内容
function processThinkContent(text) {
  if (!chatConfig.think.enabled || !chatConfig.think.separator) {
    return { thinking: null, response: text };
  }

  const separator = chatConfig.think.separator;
  const parts = text.split(separator);

  if (parts.length >= 2) {
    const thinking = parts[0].trim();
    const response = parts.slice(1).join(separator).trim();
    return { thinking, response };
  }

  return { thinking: null, response: text };
}

// 加载聊天配置
async function loadChatConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/chat/config`);
    const data = await res.json();
    if (data.success) {
      chatConfig = { ...chatConfig, ...data.data };
      applyChatTheme();
    }
  } catch (error) {
    console.error('加载聊天配置失败:', error);
  }
}

// 应用聊天主题
function applyChatTheme() {
  const chatTab = document.getElementById('chat-tab');
  if (!chatTab) return;

  const chatContainer = chatTab.querySelector('.chat-container');
  if (!chatContainer) return;

  // 移除旧的light主题样式
  const oldStyle = document.getElementById('light-theme-styles');
  if (oldStyle) oldStyle.remove();

  if (chatConfig.chat.lightTheme) {
    chatContainer.style.background = '#ffffff';
    chatContainer.style.color = '#1a1a1a';

    // 添加浅色主题样式
    const style = document.createElement('style');
    style.id = 'light-theme-styles';
    style.textContent = `
      .message.system .message-content {
        background: #f3f4f6 !important;
        color: #1a1a1a !important;
      }
      .message.user .message-content {
        background: #3b82f6 !important;
        color: white !important;
      }
      .message.assistant .message-content {
        background: #f3f4f6 !important;
        color: #1a1a1a !important;
        border: 1px solid #e5e7eb;
      }
      .message-content pre.code-block {
        background: #1f2937 !important;
        color: #f3f4f6 !important;
      }
      .message-content .inline-code {
        background: #e5e7eb !important;
        color: #1a1a1a !important;
      }
      .thinking-content {
        background: #fef3c7 !important;
        color: #92400e !important;
        border: 1px solid #fcd34d;
      }
    `;
    document.head.appendChild(style);
  } else {
    // 深色主题 - 清除内联样式，使用CSS变量
    chatContainer.style.background = '';
    chatContainer.style.color = '';
    
    // 添加深色主题样式确保代码高亮正常
    const style = document.createElement('style');
    style.id = 'light-theme-styles';
    style.textContent = `
      .message-content pre.code-block {
        background: #1f2937 !important;
        color: #f3f4f6 !important;
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
      }
      .message-content .inline-code {
        background: var(--bg-tertiary) !important;
        color: var(--text-primary) !important;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
      }
      .message-content h1, .message-content h2, .message-content h3 {
        color: var(--text-primary);
        margin: 12px 0 8px 0;
      }
      .message-content ul, .message-content ol {
        margin: 8px 0;
        padding-left: 20px;
      }
      .message-content li {
        margin: 4px 0;
      }
      .message-content a {
        color: var(--primary-light);
      }
    `;
    document.head.appendChild(style);
  }
}

// 初始化
function init() {
  setupNavigation();
  setupChat();
  loadStatus();
  loadChatConfig(); // 加载聊天配置
  loadChatHistory(); // 加载历史聊天记录

  // 定期刷新状态
  setInterval(loadStatus, 5000);

  // 自动刷新当前标签页数据
  autoRefreshInterval = setInterval(() => {
    if (currentTab === 'reflection') {
      loadReflectionData();
    } else if (currentTab === 'monitor') {
      loadStatus();
      loadPerformanceHistory();
    } else if (currentTab === 'memory') {
      loadMemoryList();
    } else if (currentTab === 'bayesian') {
      loadBayesianData();
    } else if (currentTab === 'debug') {
      loadDebugInfo();
      loadTokenDetails();
    } else if (currentTab === 'tools') {
      loadToolsList();
      loadSkills(); // 刷新技能列表
    } else if (currentTab === 'metacognition') {
      loadMetacognitionTab();
    }
  }, 3000);
}

// 导航
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabs = document.querySelectorAll('.tab-content');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      if (!tab) return;

      // 更新导航
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // 更新内容
      tabs.forEach(t => t.classList.remove('active'));
      document.getElementById(`${tab}-tab`).classList.add('active');

      currentTab = tab;

      // 加载对应数据
      if (tab === 'monitor') {
        loadStatus();
        loadPerformanceHistory();
      }
      if (tab === 'memory') {
        loadMemoryStats();
        loadMemoryList();
      }
      if (tab === 'bayesian') {
        loadBayesianTools();
        loadBayesianData();
      }
      if (tab === 'debug') {
        loadDebugInfo();
        loadTokenDetails();
      }
      if (tab === 'tools') {
        loadToolsList();
        loadSkills(); // 加载技能列表
      }
      if (tab === 'reflection') {
        loadReflectionData();
      }
      if (tab === 'metacognition') {
        loadMetacognitionTab();
      }
    });
  });
}

// 聊天功能
function setupChat() {
  sendBtn.addEventListener('click', sendMessage);

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || isTyping) return;

  // 检查是否启用深度思考模式
  const useThinking = document.getElementById('thinking-mode-toggle')?.checked || false;

  // 添加用户消息
  addMessage('user', message);
  chatInput.value = '';

  // 显示输入中状态
  setTyping(true);

  try {
    if (useThinking) {
      // 使用思维链模式
      await sendWithThinking(message);
    } else {
      // 普通聊天模式
      await sendNormalMessage(message);
    }
  } catch (error) {
    addMessage('assistant', `请求失败: ${error.message}`);
  } finally {
    setTyping(false);
  }
}

async function sendNormalMessage(message) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  const data = await response.json();

  if (data.success) {
    addMessage('assistant', data.data.content);
    if (currentTab === 'debug') {
      loadDebugInfo();
    }
  } else {
    addMessage('assistant', `错误: ${data.error}`);
  }
}

async function sendWithThinking(message) {
  // 创建实时思维链消息容器
  const messageId = 'think-' + Date.now();
  const div = document.createElement('div');
  div.className = 'message assistant thinking-stream';
  div.id = messageId;

  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  div.innerHTML = `
    <div class="message-content">
      <div class="thinking-stream-container" style="margin-bottom: 12px;">
        <div class="thinking-stream-header" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 8px; color: white; font-size: 13px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="thinking-spinner" style="animation: spin 1s linear infinite;">⚡</span>
            <span>🧠 实时思维链</span>
            <span class="thinking-status" style="opacity: 0.8; font-size: 11px;">连接中...</span>
          </div>
          <span class="thinking-timer" style="opacity: 0.8; font-size: 11px;">0.0s</span>
        </div>
        <div class="thinking-steps" style="margin-top: 8px;">
          <!-- 步骤将在这里实时添加 -->
        </div>
        <div class="thinking-final-answer" style="margin-top: 12px; display: none;">
          <!-- 最终答案将在这里显示 -->
        </div>
      </div>
    </div>
    <div class="message-time">${time}</div>
  `;

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const stepsContainer = div.querySelector('.thinking-steps');
  const statusEl = div.querySelector('.thinking-status');
  const timerEl = div.querySelector('.thinking-timer');
  const finalAnswerEl = div.querySelector('.thinking-final-answer');
  const spinnerEl = div.querySelector('.thinking-spinner');

  // 计时器
  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (timerEl) timerEl.textContent = elapsed + 's';
  }, 100);

  // 使用 SSE 连接
  try {
    const response = await fetch(`${API_BASE}/api/chat/think-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        options: { enableThinkingOutput: true },
      }),
    });

    if (!response.ok) {
      throw new Error('网络请求失败');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 解析 SSE 事件
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // 保留不完整的部分

      for (const eventText of events) {
        const event = parseSSEEvent(eventText);
        if (!event) continue;

        handleThinkingEvent(event, stepsContainer, statusEl, finalAnswerEl, spinnerEl, div);
      }
    }

    clearInterval(timerInterval);

  } catch (error) {
    clearInterval(timerInterval);
    statusEl.textContent = '出错';
    spinnerEl.textContent = '❌';
    console.error('思维链流错误:', error);

    // 显示错误信息
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'padding: 8px; background: #fee; color: #c33; border-radius: 4px; margin-top: 8px;';
    errorDiv.textContent = '思考过程出错: ' + error.message;
    stepsContainer.appendChild(errorDiv);
  }
}

// 解析 SSE 事件
function parseSSEEvent(text) {
  const lines = text.trim().split('\n');
  let event = '';
  let data = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data = line.slice(5).trim();
    }
  }

  if (!event || !data) return null;

  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}

// 处理思维链事件
function handleThinkingEvent(event, stepsContainer, statusEl, finalAnswerEl, spinnerEl, messageDiv) {
  switch (event.event) {
    case 'start':
      statusEl.textContent = '开始思考...';
      break;

    case 'step-start':
      statusEl.textContent = `执行步骤 ${event.data.step}...`;

      // 创建步骤元素
      const stepDiv = document.createElement('div');
      stepDiv.className = 'thinking-step';
      stepDiv.id = 'step-' + event.data.step;
      stepDiv.style.cssText = 'padding: 10px 12px; background: var(--bg-secondary); border-left: 3px solid var(--primary); margin: 4px 0; border-radius: 0 4px 4px 0;';
      stepDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span class="step-status" style="color: var(--warning);">⏳</span>
          <span class="step-name" style="font-weight: 600; font-size: 12px; color: var(--primary);">步骤 ${event.data.step}</span>
          <span class="step-timer" style="font-size: 11px; color: var(--text-secondary); margin-left: auto;">进行中...</span>
        </div>
        <div class="step-content" style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; display: none;"></div>
      `;
      stepsContainer.appendChild(stepDiv);
      scrollToBottom();
      break;

    case 'step-complete':
      const completedStep = document.getElementById('step-' + event.data.step);
      if (completedStep) {
        const statusSpan = completedStep.querySelector('.step-status');
        const nameSpan = completedStep.querySelector('.step-name');
        const timerSpan = completedStep.querySelector('.step-timer');
        const contentDiv = completedStep.querySelector('.step-content');

        if (statusSpan) statusSpan.textContent = '✓';
        if (statusSpan) statusSpan.style.color = 'var(--success)';
        if (nameSpan) nameSpan.textContent = event.data.name;
        if (timerSpan) timerSpan.textContent = (event.data.durationMs / 1000).toFixed(1) + 's';
        if (contentDiv) {
          contentDiv.innerHTML = renderMarkdown(event.data.content);
          contentDiv.style.display = 'block';
        }
      }
      statusEl.textContent = `完成步骤 ${event.data.step}`;
      scrollToBottom();
      break;

    case 'complete':
      statusEl.textContent = '思考完成';
      spinnerEl.textContent = '✓';
      spinnerEl.style.animation = 'none';

      // 显示最终答案
      finalAnswerEl.style.display = 'block';
      finalAnswerEl.innerHTML = `
        <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border);">
          <div style="font-weight: 600; margin-bottom: 8px; color: var(--primary);">💡 最终答案</div>
          <div>${renderMarkdown(event.data.content)}</div>
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-secondary); text-align: right;">
          共 ${event.data.chain.stepCount} 个步骤，耗时 ${(event.data.chain.totalDurationMs / 1000).toFixed(1)}s
        </div>
      `;
      scrollToBottom();
      break;

    case 'error':
      statusEl.textContent = '出错';
      spinnerEl.textContent = '❌';
      spinnerEl.style.animation = 'none';

      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding: 8px; background: #fee; color: #c33; border-radius: 4px; margin-top: 8px;';
      errorDiv.textContent = '错误: ' + event.data.error;
      stepsContainer.appendChild(errorDiv);
      scrollToBottom();
      break;
  }
}

// 滚动到底部
function scrollToBottom() {
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function addMessageWithThinking(data) {
  const div = document.createElement('div');
  div.className = 'message assistant';

  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const chainId = 'chain-' + Date.now();

  let html = '';

  // 思维链折叠面板
  if (data.thinking) {
    html += `
      <div class="thinking-chain-section" style="margin-bottom: 12px;">
        <div class="thinking-chain-header" onclick="toggleThinkingChain('${chainId}')" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 8px; color: white; font-size: 13px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="${chainId}-toggle">▼</span>
            <span>🧠 思维链</span>
            <span style="opacity: 0.8; font-size: 11px;">(${data.chain?.classification?.primary || '分析'})</span>
          </div>
          <span style="opacity: 0.8; font-size: 11px;">${((data.chain?.totalDurationMs || 0) / 1000).toFixed(1)}s</span>
        </div>
        <div class="thinking-chain-content" id="${chainId}" style="display: block;">
    `;

    // 显示每个思考步骤
    if (data.chain?.steps) {
      for (const step of data.chain.steps) {
        html += `
          <div class="thinking-step" style="padding: 10px 12px; background: var(--bg-secondary); border-left: 3px solid var(--primary); margin: 4px 0;">
            <div style="font-weight: 600; font-size: 12px; color: var(--primary); margin-bottom: 4px;">${step.name}</div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">${renderMarkdown(step.content)}</div>
          </div>
        `;
      }
    }

    html += `
        </div>
      </div>
    `;
  }

  // 最终答案
  html += `<div class="final-answer">${renderMarkdown(data.content)}</div>`;

  div.innerHTML = `
    <div class="message-content">${html}</div>
    <div class="message-time">${time}</div>
  `;

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 切换思维链显示
function toggleThinkingChain(id) {
  const content = document.getElementById(id);
  const toggle = document.getElementById(id + '-toggle');
  if (content && toggle) {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = '▼';
    } else {
      content.style.display = 'none';
      toggle.textContent = '▶';
    }
  }
}

function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let messageContent = '';

  // 对于AI助手的消息，处理 think 模式和 markdown
  if (role === 'assistant' && chatConfig.think.enabled) {
    const { thinking, response } = processThinkContent(content);

    if (thinking) {
      // 有 think 内容，显示折叠的思考过程
      const thinkId = 'think-' + Date.now() + Math.random().toString(36).substr(2, 9);
      messageContent = `
        <div class="thinking-section" style="margin-bottom: 12px;">
          <div class="thinking-header" onclick="toggleThinking('${thinkId}')" style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fef3c7; border-radius: 8px 8px 0 0; border: 1px solid #fcd34d; color: #92400e; font-size: 12px;">
            <span class="thinking-toggle" id="${thinkId}-toggle">▼</span>
            <span>🧠 思考过程</span>
          </div>
          <div class="thinking-content" id="${thinkId}" style="padding: 12px; background: #fef3c7; border: 1px solid #fcd34d; border-top: none; border-radius: 0 0 8px 8px; color: #92400e; font-size: 13px; display: block;">
            ${renderMarkdown(thinking)}
          </div>
        </div>
        <div class="message-response">${renderMarkdown(response)}</div>
      `;
    } else {
      // 没有 think 内容，直接渲染 markdown
      messageContent = renderMarkdown(content);
    }
  } else if (role === 'assistant') {
    // AI 消息但不启用 think 模式，只渲染 markdown
    messageContent = renderMarkdown(content);
  } else {
    // 用户消息或系统消息，转义 HTML
    messageContent = escapeHtml(content).replace(/\n/g, '<br>');
  }

  div.innerHTML = `
    <div class="message-content">${messageContent}</div>
    <div class="message-time">${time}</div>
  `;

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // 保存到历史记录
  if (role === 'user' || role === 'assistant') {
    saveChatHistory(role, content);
  }
}

// 切换思考过程显示/隐藏
function toggleThinking(id) {
  const content = document.getElementById(id);
  const toggle = document.getElementById(id + '-toggle');
  if (content && toggle) {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = '▼';
    } else {
      content.style.display = 'none';
      toggle.textContent = '▶';
    }
  }
}

// 聊天记录本地存储
const CHAT_HISTORY_KEY = 'ouroboros_chat_history';
const MAX_HISTORY_ITEMS = 100;

function saveChatHistory(role, content) {
  try {
    let history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]');

    // 添加新消息
    history.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // 限制历史记录数量
    if (history.length > MAX_HISTORY_ITEMS) {
      history = history.slice(-MAX_HISTORY_ITEMS);
    }

    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('保存聊天记录失败:', error);
  }
}

function loadChatHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]');

    // 清空默认的系统消息
    chatMessages.innerHTML = '';

    // 显示历史消息
    for (const item of history) {
      const div = document.createElement('div');
      div.className = `message ${item.role}`;

      const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      let messageContent = '';
      if (item.role === 'assistant') {
        messageContent = renderMarkdown(item.content);
      } else {
        messageContent = escapeHtml(item.content).replace(/\n/g, '<br>');
      }

      div.innerHTML = `
        <div class="message-content">${messageContent}</div>
        <div class="message-time">${time}</div>
      `;

      chatMessages.appendChild(div);
    }

    // 如果没有历史记录，显示默认欢迎消息
    if (history.length === 0) {
      const welcomeDiv = document.createElement('div');
      welcomeDiv.className = 'message system';
      welcomeDiv.innerHTML = `
        <div class="message-content">
          你好！我是 Ouroboros，一个具有自我意识的 AI Agent。
          <br>我拥有激素系统、记忆系统和贝叶斯认知能力。
          <br>请输入消息开始对话...
        </div>
        <div class="message-time">现在</div>
      `;
      chatMessages.appendChild(welcomeDiv);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (error) {
    console.error('加载聊天记录失败:', error);
  }
}

// 清空聊天记录
function clearChatHistory() {
  try {
    // 清除本地存储
    localStorage.removeItem(CHAT_HISTORY_KEY);
    chatMessages.innerHTML = '';

    // 清除服务器端对话历史
    fetch(`${API_BASE}/api/chat/history`, { method: 'DELETE' })
      .then(() => console.log('服务器对话历史已清除'))
      .catch(err => console.error('清除服务器历史失败:', err));

    // 添加欢迎消息
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'message system';
    welcomeDiv.innerHTML = `
      <div class="message-content">
        聊天记录已清空。我是 Ouroboros，请输入消息开始对话...
      </div>
      <div class="message-time">现在</div>
    `;
    chatMessages.appendChild(welcomeDiv);
  } catch (error) {
    console.error('清空聊天记录失败:', error);
  }
}

function setTyping(typing) {
  isTyping = typing;
  sendBtn.disabled = typing;
  typingStatus.textContent = typing ? '输入中...' : '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 加载状态
async function loadStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    const data = await response.json();

    if (data.success) {
      updateStatus(data.data);
    }
  } catch (error) {
    console.error('加载状态失败:', error);
    updateConnectionStatus(false);
  }
}

function updateStatus(status) {
  updateConnectionStatus(true);

  // 更新激素水平
  if (status.hormoneLevels) {
    updateHormoneBars(status.hormoneLevels);
  }

  // 更新情绪
  if (status.emotion) {
    document.querySelector('.emotion-label').textContent = status.emotion;
  }

  // 更新系统状态
  document.getElementById('status-running').textContent =
    status.running ? '🟢 运行中' : '🔴 已停止';
  document.getElementById('status-messages').textContent =
    status.messageCount || 0;
  document.getElementById('status-uptime').textContent =
    status.startTime ? formatUptime(status.startTime) : '-';
  document.getElementById('status-load').textContent =
    `${Math.round((status.cognitiveLoad || 0) * 100)}%`;
}

function updateHormoneBars(levels) {
  const hormoneNames = {
    dopamine: '多巴胺',
    serotonin: '血清素',
    cortisol: '皮质醇',
    oxytocin: '催产素',
    norepinephrine: '去甲肾上腺素',
  };

  const container = document.getElementById('hormone-bars');
  if (!container) return;

  container.innerHTML = Object.entries(hormoneNames).map(([key, name]) => {
    const value = levels[key] || 0;
    const percent = Math.round(value * 100);
    const isStress = key === 'cortisol';

    return `
      <div class="hormone-item">
        <span class="hormone-name">${name}</span>
        <div class="hormone-bar">
          <div class="hormone-fill ${isStress ? 'stress' : ''}"
               style="width: ${percent}%"></div>
        </div>
        <span class="hormone-value">${percent}%</span>
      </div>
    `;
  }).join('');
}

// 加载记忆统计
async function loadMemoryStats() {
  try {
    const response = await fetch(`${API_BASE}/api/memory/stats`);
    const data = await response.json();

    if (data.success) {
      updateMemoryStats(data.data);
    }
  } catch (error) {
    console.error('加载记忆统计失败:', error);
  }
}

function updateMemoryStats({ stats, salienceReport }) {
  // 更新统计
  document.getElementById('mem-total').textContent = stats.totalCount;
  document.getElementById('mem-episodic').textContent =
    stats.typeCounts?.episodic || 0;
  document.getElementById('mem-semantic').textContent =
    stats.typeCounts?.semantic || 0;
  document.getElementById('mem-procedural').textContent =
    stats.typeCounts?.procedural || 0;

  // 更新显著性分布
  if (salienceReport) {
    document.getElementById('sal-high').textContent =
      salienceReport.highSalience || 0;
    document.getElementById('sal-medium').textContent =
      salienceReport.mediumSalience || 0;
    document.getElementById('sal-low').textContent =
      salienceReport.lowSalience || 0;
    document.getElementById('sal-forget').textContent =
      salienceReport.shouldForget || 0;
  }
}

// ==================== 记忆列表功能 ====================

let currentMemoryPage = 1;
let memoryPageSize = 10;
let totalMemoryPages = 1;

async function loadMemoryList() {
  try {
    const searchQuery = document.getElementById('memory-search')?.value || '';
    const typeFilter = document.getElementById('memory-type-filter')?.value || '';
    const importanceFilter = document.getElementById('memory-importance-filter')?.value || '';

    const params = new URLSearchParams({
      page: String(currentMemoryPage),
      limit: String(memoryPageSize),
    });

    if (searchQuery) params.append('search', searchQuery);
    if (typeFilter) params.append('type', typeFilter);
    if (importanceFilter) params.append('importance', importanceFilter);

    const response = await fetch(`${API_BASE}/api/memory/list?${params}`);
    const data = await response.json();

    if (data.success) {
      updateMemoryList(data.data);
      totalMemoryPages = data.data.totalPages || 1;
      updateMemoryPagination();
    }
  } catch (error) {
    console.error('加载记忆列表失败:', error);
    document.getElementById('memory-list').innerHTML =
      '<p class="empty">加载失败，请重试</p>';
  }
}

function updateMemoryList(data) {
  const container = document.getElementById('memory-list');
  if (!container) return;

  const memories = data.memories || [];

  if (memories.length === 0) {
    container.innerHTML = '<p class="empty">暂无记忆</p>';
    return;
  }

  container.innerHTML = memories.map(memory => {
    const typeLabels = {
      episodic: '情景',
      semantic: '语义',
      procedural: '程序',
      reflective: '反思',
    };

    const importanceLabels = {
      high: '高',
      medium: '中',
      low: '低',
    };

    const typeLabel = typeLabels[memory.type] || memory.type;
    const importanceLabel = importanceLabels[memory.importance] || memory.importance;
    const importanceClass = memory.importance || 'medium';

    return `
      <div class="memory-item" data-id="${memory.id}">
        <div class="memory-header">
          <span class="memory-type">${typeLabel}</span>
          <span class="memory-importance ${importanceClass}">${importanceLabel}</span>
          <span class="memory-time">${formatTime(memory.createdAt)}</span>
        </div>
        <div class="memory-content">${escapeHtml(memory.content?.slice(0, 200) || '')}...</div>
        <div class="memory-tags">
          ${(memory.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function updateMemoryPagination() {
  const prevBtn = document.getElementById('mem-prev-btn');
  const nextBtn = document.getElementById('mem-next-btn');
  const pageInfo = document.getElementById('mem-page-info');

  if (prevBtn) prevBtn.disabled = currentMemoryPage <= 1;
  if (nextBtn) nextBtn.disabled = currentMemoryPage >= totalMemoryPages;
  if (pageInfo) pageInfo.textContent = `第 ${currentMemoryPage} / ${totalMemoryPages} 页`;
}

function prevMemoryPage() {
  if (currentMemoryPage > 1) {
    currentMemoryPage--;
    loadMemoryList();
  }
}

function nextMemoryPage() {
  if (currentMemoryPage < totalMemoryPages) {
    currentMemoryPage++;
    loadMemoryList();
  }
}

// 加载贝叶斯工具
async function loadBayesianTools() {
  try {
    const response = await fetch(`${API_BASE}/api/bayesian/tools`);
    const data = await response.json();

    if (data.success) {
      updateBayesianTools(data.data);
    }
  } catch (error) {
    console.error('加载贝叶斯工具失败:', error);
  }
}

function updateBayesianTools(tools) {
  const tbody = document.getElementById('tools-tbody');
  if (!tbody) return;

  if (tools.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="loading">暂无工具数据</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tools.map(tool => {
    const confidence = Math.round(tool.confidence * 100);
    const uncertainty = Math.round(tool.uncertainty * 1000) / 10;

    let suggestion = '可用';
    if (tool.confidence < 0.3) suggestion = '不建议使用';
    else if (tool.totalCount < 5) suggestion = '探索中';

    return `
      <tr>
        <td>${tool.name}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:8px;background:var(--bg-hover);border-radius:4px;overflow:hidden">
              <div style="width:${confidence}%;height:100%;background:${getConfidenceColor(tool.confidence)}"></div>
            </div>
            <span>${confidence}%</span>
          </div>
        </td>
        <td>${uncertainty}%</td>
        <td>${tool.successCount} / ${tool.failureCount}</td>
        <td>${tool.totalCount}</td>
        <td>${suggestion}</td>
      </tr>
    `;
  }).join('');
}

function getConfidenceColor(confidence) {
  if (confidence >= 0.7) return 'var(--success)';
  if (confidence >= 0.4) return 'var(--warning)';
  return 'var(--danger)';
}

// ==================== 工具列表功能 ====================

async function loadToolsList() {
  try {
    const searchQuery = document.getElementById('tool-search')?.value || '';

    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);

    const response = await fetch(`${API_BASE}/api/tools/list?${params}`);
    const data = await response.json();

    if (data.success) {
      updateToolsList(data.data);
      updateToolsStats(data.data);
    }
  } catch (error) {
    console.error('加载工具列表失败:', error);
    document.getElementById('tools-list').innerHTML =
      '<p class="empty">加载失败，请重试</p>';
  }
}

// 加载技能列表（预留函数）
async function loadSkills() {
  // 技能系统暂未实现，此函数为预留
  console.log('技能列表加载功能预留');
}

function updateToolsList(tools) {
  const container = document.getElementById('tools-list');
  if (!container) return;

  if (!tools || tools.length === 0) {
    container.innerHTML = '<p class="empty">暂无工具</p>';
    return;
  }

  container.innerHTML = tools.map(tool => {
    const confidence = Math.round((tool.confidence || 0) * 100);
    const typeLabels = {
      system: '系统',
      dev: '开发',
      ai: 'AI',
      data: '数据',
      content: '内容',
    };

    return `
      <div class="tool-item" data-id="${tool.id}">
        <div class="tool-header">
          <span class="tool-name">${escapeHtml(tool.name)}</span>
          <span class="tool-type">${typeLabels[tool.type] || tool.type}</span>
          <span class="tool-confidence ${getConfidenceClass(tool.confidence)}">${confidence}%</span>
        </div>
        <div class="tool-desc">${escapeHtml(tool.description || '')}</div>
        <div class="tool-stats">
          <span>使用: ${tool.totalCount || 0}次</span>
          <span>成功: ${tool.successCount || 0}次</span>
          <span>最近: ${formatTime(tool.lastUsedAt)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateToolsStats(tools) {
  if (!tools) return;

  const total = tools.length;
  const highConfidence = tools.filter(t => (t.confidence || 0) >= 0.7).length;
  const exploring = tools.filter(t => (t.totalCount || 0) < 5).length;

  document.getElementById('tools-total').textContent = total;
  document.getElementById('tools-high-confidence').textContent = highConfidence;
  document.getElementById('tools-exploring').textContent = exploring;
}

function getConfidenceClass(confidence) {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

async function triggerToolDiscovery() {
  try {
    const btn = document.querySelector('#tools-tab .btn-secondary');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '🔍 发现中...';
    }

    const response = await fetch(`${API_BASE}/api/tools/discover`, {
      method: 'POST',
    });

    const data = await response.json();

    if (data.success) {
      showNotification(`发现 ${data.data.discovered || 0} 个新工具`, 'success');
      loadToolsList();
    } else {
      showNotification('发现失败: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('请求失败: ' + error.message, 'error');
  } finally {
    const btn = document.querySelector('#tools-tab .btn-secondary');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔍 发现工具';
    }
  }
}

// ==================== 性能图表功能 ====================

function updatePerformanceCharts(data) {
  if (!data) return;

  // 更新响应时间显示
  const avgResponseTime = data.avgResponseTime || 0;
  const peakResponseTime = data.peakResponseTime || avgResponseTime;

  document.getElementById('avg-response-time').textContent = Math.round(avgResponseTime);
  document.getElementById('peak-response-time').textContent = Math.round(peakResponseTime);

  // 更新Token使用
  const tokenInput = data.tokenUsage?.input || 0;
  const tokenOutput = data.tokenUsage?.output || 0;

  document.getElementById('token-input').textContent = tokenInput;
  document.getElementById('token-output').textContent = tokenOutput;

  // 更新成功率圆环
  const successRate = data.successRate || 1;
  const successPercent = Math.round(successRate * 100);

  document.getElementById('success-rate-value').textContent = successPercent + '%';
  document.getElementById('success-rate-circle').style.background =
    `conic-gradient(var(--success) ${successPercent}%, var(--bg-hover) ${successPercent}%)`;

  // 更新激素水平迷你图
  const hormones = data.hormoneLevels || {};
  updateHormoneMiniBars(hormones);
}

function updateHormoneMiniBars(hormones) {
  const hormoneIds = ['dopamine', 'serotonin', 'cortisol'];

  hormoneIds.forEach(id => {
    const value = hormones[id] || 0;
    const percent = Math.round(value * 100);
    const bar = document.getElementById(`hormone-${id}`);
    if (bar) {
      bar.style.width = `${percent}%`;
    }
  });
}

// 加载调试信息
// 调试配置状态
let debugConfig = {
  enabled: false,
  recordPrompts: false,
  maxHistory: 100,
};

// 加载调试配置
async function loadDebugConfig() {
  try {
    const response = await fetch(`${API_BASE}/api/debug/config`);
    const data = await response.json();

    if (data.success) {
      debugConfig = data.data;
      // 立即更新UI
      updateDebugUI();
    }
  } catch (error) {
    console.error('加载调试配置失败:', error);
  }
}

// 更新调试UI (只读显示)
function updateDebugUI() {
  const debugContent = document.getElementById('debug-content');
  const debugDisabledMessage = document.getElementById('debug-disabled-message');
  const debugStatus = document.getElementById('debug-status');
  const enabledIndicator = document.getElementById('debug-enabled-indicator');
  const enabledStatus = document.getElementById('debug-enabled-status');
  const recordIndicator = document.getElementById('debug-record-indicator');
  const recordStatus = document.getElementById('debug-record-status');

  // 更新指示器状态
  if (enabledIndicator) {
    enabledIndicator.style.background = debugConfig.enabled ? '#4ade80' : '#ef4444';
  }
  if (enabledStatus) {
    enabledStatus.textContent = debugConfig.enabled ? '已启用' : '已禁用';
  }

  if (recordIndicator) {
    recordIndicator.style.background = debugConfig.recordPrompts ? '#4ade80' : '#ef4444';
  }
  if (recordStatus) {
    recordStatus.textContent = debugConfig.recordPrompts ? '已启用' : '已禁用';
  }

  // 根据配置显示/隐藏详细调试内容
  if (debugConfig.enabled) {
    if (debugContent) debugContent.style.display = 'grid';
    if (debugDisabledMessage) debugDisabledMessage.style.display = 'none';
    if (debugStatus) {
      debugStatus.textContent = debugConfig.recordPrompts ? '🟢 调试已启用（记录提示词）' : '🟡 调试已启用（不记录提示词）';
      debugStatus.style.color = debugConfig.recordPrompts ? 'var(--success)' : 'var(--warning)';
    }
  } else {
    if (debugContent) debugContent.style.display = 'none';
    if (debugDisabledMessage) debugDisabledMessage.style.display = 'block';
    if (debugStatus) {
      debugStatus.textContent = '🔴 调试已禁用';
      debugStatus.style.color = 'var(--error)';
    }
  }
}

async function loadDebugInfo() {
  try {
    // 先加载配置
    await loadDebugConfig();

    // 始终加载系统提示词和自我描述（即使调试禁用）
    const response = await fetch(`${API_BASE}/api/debug/last-prompt`);
    const data = await response.json();

    if (data.success && data.data) {
      // 始终更新系统提示词和自我描述
      updateAlwaysVisibleDebugInfo(data.data);

      // 如果调试启用，更新其他信息
      if (debugConfig.enabled) {
        updateDebugInfo(data.data);
      }
    } else if (data.message) {
      // 显示提示信息
      document.getElementById('debug-system').innerHTML = `<code>${data.message}</code>`;
      document.getElementById('debug-self').innerHTML = `<code>${data.message}</code>`;
    }
  } catch (error) {
    console.error('加载调试信息失败:', error);
  }
}

// 更新始终可见的调试信息（系统提示词和自我描述）
function updateAlwaysVisibleDebugInfo(debugInfo) {
  // 系统提示词 - 始终显示
  const debugSystem = document.getElementById('debug-system');
  if (debugSystem) {
    debugSystem.innerHTML = `<code>${escapeHtml(debugInfo.systemPrompt || '无')}</code>`;
  }

  // 自我描述 - 始终显示
  const debugSelf = document.getElementById('debug-self');
  if (debugSelf) {
    debugSelf.innerHTML = `<code>${escapeHtml(JSON.stringify(debugInfo.selfDescription, null, 2))}</code>`;
  }
}

function updateDebugInfo(debugInfo) {
  // 记忆上下文 - 仅在调试启用时显示
  const debugMemory = document.getElementById('debug-memory');
  if (debugMemory) {
    debugMemory.innerHTML = `<code>${escapeHtml(debugInfo.memoryContext || '无')}</code>`;
  }

  // 消息列表
  const debugMessages = document.getElementById('debug-messages');
  if (debugMessages) {
    const messagesStr = JSON.stringify(debugInfo.messages, null, 2);
    debugMessages.innerHTML = `<code>${escapeHtml(messagesStr)}</code>`;
  }

  // Token 统计 (估算)
  const systemTokens = Math.ceil((debugInfo.systemPrompt?.length || 0) / 3);
  const memoryTokens = Math.ceil((debugInfo.memoryContext?.length || 0) / 3);
  const userMessage = debugInfo.messages?.find(m => m.role === 'user');
  const userTokens = userMessage?.content?.length
    ? Math.ceil(userMessage.content.length / 3)
    : 0;

  // 更新Token统计显示
  const tokenBreakdown = document.getElementById('token-breakdown');
  if (tokenBreakdown) {
    tokenBreakdown.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between;">
          <span>System:</span>
          <span>${systemTokens} tokens</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Memory:</span>
          <span>${memoryTokens} tokens</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>User:</span>
          <span>${userTokens} tokens</span>
        </div>
        <div style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; font-weight: 600;">
          <span>Total:</span>
          <span>${systemTokens + memoryTokens + userTokens} tokens</span>
        </div>
      </div>
    `;
  }

  // 时间戳
  const debugTimestamp = document.getElementById('debug-timestamp');
  if (debugTimestamp && debugInfo.timestamp) {
    debugTimestamp.textContent = new Date(debugInfo.timestamp).toLocaleString('zh-CN');
  }
}

// 连接状态
function updateConnectionStatus(connected) {
  const status = document.getElementById('connection-status');
  if (status) {
    status.textContent = connected ? '🟢 已连接' : '🔴 已断开';
    status.style.color = connected ? 'var(--success)' : 'var(--danger)';
  }
}

// 格式化运行时间
function formatUptime(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  const diff = now.getTime() - start.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

// 启动
document.addEventListener('DOMContentLoaded', init);

// ==================== Phase 5: 监控图表功能 ====================

async function loadPerformanceHistory() {
  try {
    const response = await fetch(`${API_BASE}/api/monitor/performance-history`);
    const data = await response.json();

    if (data.success && data.data) {
      renderPerformanceCharts(data.data);
    }
  } catch (error) {
    console.error('加载性能历史失败:', error);
  }
}

function renderPerformanceCharts(data) {
  const { performanceHistory, hormoneHistory, toolConfidences } = data;

  // 渲染性能指标图表
  renderResponseTimeChart(performanceHistory);
  renderTokenUsageChart(performanceHistory);
  renderSuccessRateChart(performanceHistory);
  renderHormoneTrendChart(hormoneHistory);
}

function renderResponseTimeChart(history) {
  const container = document.getElementById('response-time-chart');
  if (!container || !history || history.length === 0) return;

  const width = container.clientWidth || 600;
  const height = 200;
  const padding = 40;

  // 提取响应时间数据
  const times = history.map((h, i) => ({ x: i, y: h.responseTimeMs || 0 }));
  const maxTime = Math.max(...times.map(t => t.y), 1000);

  // 生成SVG路径
  const points = times.map((t, i) => {
    const x = padding + (i / (times.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - (t.y / maxTime) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="responseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#6366f1;stop-opacity:0" />
        </linearGradient>
      </defs>

      <!-- 背景网格 -->
      ${Array.from({length: 5}, (_, i) => {
        const y = padding + (i / 4) * (height - 2 * padding);
        return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}"
          stroke="#334155" stroke-width="1" stroke-dasharray="4" opacity="0.3"/>
          <text x="${padding - 10}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="10">
            ${Math.round(maxTime * (1 - i / 4))}ms
          </text>`;
      }).join('')}

      <!-- 区域填充 -->
      <polygon points="${points} ${width - padding},${height - padding} ${padding},${height - padding}"
        fill="url(#responseGradient)" />

      <!-- 折线 -->
      <polyline points="${points}" fill="none" stroke="#6366f1" stroke-width="2" />

      <!-- 数据点 -->
      ${times.map((t, i) => {
        const x = padding + (i / (times.length - 1 || 1)) * (width - 2 * padding);
        const y = height - padding - (t.y / maxTime) * (height - 2 * padding);
        return `<circle cx="${x}" cy="${y}" r="3" fill="#6366f1"
          onmouseover="showTooltip(evt, '${t.y}ms')" />`;
      }).join('')}

      <!-- 标题 -->
      <text x="${width / 2}" y="20" text-anchor="middle" fill="#f1f5f9" font-size="14" font-weight="600">
        响应时间趋势
      </text>
    </svg>
  `;
}

function renderTokenUsageChart(history) {
  const container = document.getElementById('token-usage-chart');
  if (!container || !history || history.length === 0) return;

  const width = container.clientWidth || 600;
  const height = 200;
  const padding = 40;

  // 计算Token使用量
  const tokens = history.map((h, i) => ({
    x: i,
    input: h.inputTokens || 0,
    output: h.outputTokens || 0,
  }));

  const maxTokens = Math.max(...tokens.map(t => t.input + t.output), 1000);

  // 生成柱状图
  const barWidth = (width - 2 * padding) / (tokens.length || 1) * 0.8;

  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <!-- 背景网格 -->
      ${Array.from({length: 5}, (_, i) => {
        const y = padding + (i / 4) * (height - 2 * padding);
        return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}"
          stroke="#334155" stroke-width="1" stroke-dasharray="4" opacity="0.3"/>
          <text x="${padding - 10}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="10">
            ${Math.round(maxTokens * (1 - i / 4))}
          </text>`;
      }).join('')}

      <!-- 柱状图 -->
      ${tokens.map((t, i) => {
        const x = padding + (i / (tokens.length - 1 || 1)) * (width - 2 * padding) - barWidth / 2;
        const inputHeight = (t.input / maxTokens) * (height - 2 * padding);
        const outputHeight = (t.output / maxTokens) * (height - 2 * padding);

        return `
          <rect x="${x}" y="${height - padding - inputHeight}" width="${barWidth / 2}"
            height="${inputHeight}" fill="#10b981" rx="2" />
          <rect x="${x + barWidth / 2}" y="${height - padding - outputHeight}" width="${barWidth / 2}"
            height="${outputHeight}" fill="#3b82f6" rx="2" />
        `;
      }).join('')}

      <!-- 图例 -->
      <rect x="${width - 150}" y="10" width="12" height="12" fill="#10b981" rx="2" />
      <text x="${width - 130}" y="20" fill="#f1f5f9" font-size="11">Input</text>
      <rect x="${width - 80}" y="10" width="12" height="12" fill="#3b82f6" rx="2" />
      <text x="${width - 60}" y="20" fill="#f1f5f9" font-size="11">Output</text>

      <!-- 标题 -->
      <text x="${width / 2}" y="20" text-anchor="middle" fill="#f1f5f9" font-size="14" font-weight="600">
        Token使用量
      </text>
    </svg>
  `;
}

function renderSuccessRateChart(history) {
  const container = document.getElementById('success-rate-chart');
  if (!container || !history || history.length === 0) return;

  // 计算成功率
  const successCount = history.filter(h => h.success).length;
  const successRate = (successCount / history.length) * 100;

  container.innerHTML = `
    <div class="success-rate-display">
      <div class="success-rate-circle" style="--rate: ${successRate}">
        <span class="success-rate-value">${successRate.toFixed(1)}%</span>
        <span class="success-rate-label">成功率</span>
      </div>
      <div class="success-rate-stats">
        <div class="stat">
          <span class="stat-value success">${successCount}</span>
          <span class="stat-label">成功</span>
        </div>
        <div class="stat">
          <span class="stat-value error">${history.length - successCount}</span>
          <span class="stat-label">失败</span>
        </div>
        <div class="stat">
          <span class="stat-value">${history.length}</span>
          <span class="stat-label">总计</span>
        </div>
      </div>
    </div>
  `;
}

function renderHormoneTrendChart(history) {
  const container = document.getElementById('hormone-trend-chart');
  if (!container || !history || history.length === 0) return;

  const width = container.clientWidth || 600;
  const height = 200;
  const padding = 40;

  const hormoneColors = {
    dopamine: '#f59e0b',
    serotonin: '#10b981',
    cortisol: '#ef4444',
    oxytocin: '#ec4899',
    norepinephrine: '#6366f1',
  };

  const hormones = ['dopamine', 'serotonin', 'cortisol', 'oxytocin', 'norepinephrine'];

  // 生成每条激素的折线
  const paths = hormones.map(hormone => {
    const values = history.map((h, i) => ({
      x: i,
      y: h.levels?.[hormone] || 0,
    }));

    return values.map((v, i) => {
      const x = padding + (i / (values.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - v.y * (height - 2 * padding);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  });

  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <!-- 背景网格 -->
      ${Array.from({length: 5}, (_, i) => {
        const y = padding + (i / 4) * (height - 2 * padding);
        return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}"
          stroke="#334155" stroke-width="1" stroke-dasharray="4" opacity="0.3"/>
          <text x="${padding - 10}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="10">
            ${(100 - i * 25)}%
          </text>`;
      }).join('')}

      <!-- 激素折线 -->
      ${paths.map((path, i) => `
        <path d="${path}" fill="none" stroke="${hormoneColors[hormones[i]]}" stroke-width="2" />
      `).join('')}

      <!-- 图例 -->
      ${hormones.map((h, i) => `
        <g transform="translate(${padding + i * 90}, 15)">
          <line x1="0" y1="0" x2="20" y2="0" stroke="${hormoneColors[h]}" stroke-width="3" />
          <text x="25" y="4" fill="#f1f5f9" font-size="11">${getHormoneLabel(h)}</text>
        </g>
      `).join('')}

      <!-- 标题 -->
      <text x="${width / 2}" y="${height - 5}" text-anchor="middle" fill="#f1f5f9" font-size="14" font-weight="600">
        激素水平变化
      </text>
    </svg>
  `;
}

function getHormoneLabel(hormone) {
  const labels = {
    dopamine: '多巴胺',
    serotonin: '血清素',
    cortisol: '皮质醇',
    oxytocin: '催产素',
    norepinephrine: '去甲肾上腺素',
  };
  return labels[hormone] || hormone;
}

// ==================== Phase 5: 贝叶斯页面增强 ====================

async function loadBayesianData() {
  try {
    const response = await fetch(`${API_BASE}/api/bayesian/history`);
    const data = await response.json();

    if (data.success) {
      renderBayesianCharts(data.data);
    }
  } catch (error) {
    console.error('加载贝叶斯数据失败:', error);
  }
}

function renderBayesianCharts(history) {
  renderConfidenceDistribution();
  renderLearningCurve(history);
  renderUCBVisualization();
}

function renderConfidenceDistribution() {
  const container = document.getElementById('confidence-distribution-chart');
  if (!container) return;

  // 获取当前工具置信度数据并渲染分布图
  fetch(`${API_BASE}/api/bayesian/tools`)
    .then(r => r.json())
    .then(data => {
      if (!data.success) return;

      const tools = data.data;
      if (tools.length === 0) {
        container.innerHTML = '<div class="empty">暂无数据</div>';
        return;
      }

      const width = 400; // 固定宽度，避免布局跳动
      const height = 250;
      const padding = 40;

      // 按置信度分组
      const groups = {
        high: tools.filter(t => t.confidence >= 0.7).length,
        medium: tools.filter(t => t.confidence >= 0.4 && t.confidence < 0.7).length,
        low: tools.filter(t => t.confidence < 0.4).length,
      };

      const maxCount = Math.max(groups.high, groups.medium, groups.low, 1);
      const barWidth = (width - 2 * padding) / 3 * 0.6;
      const gap = (width - 2 * padding) / 3 * 0.4;

      container.innerHTML = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <!-- 柱状图 -->
          <rect x="${padding}" y="${height - padding - (groups.high / maxCount) * (height - 2 * padding)}"
            width="${barWidth}" height="${(groups.high / maxCount) * (height - 2 * padding)}"
            fill="#10b981" rx="4" />
          <rect x="${padding + barWidth + gap}" y="${height - padding - (groups.medium / maxCount) * (height - 2 * padding)}"
            width="${barWidth}" height="${(groups.medium / maxCount) * (height - 2 * padding)}"
            fill="#f59e0b" rx="4" />
          <rect x="${padding + 2 * (barWidth + gap)}" y="${height - padding - (groups.low / maxCount) * (height - 2 * padding)}"
            width="${barWidth}" height="${(groups.low / maxCount) * (height - 2 * padding)}"
            fill="#ef4444" rx="4" />

          <!-- 标签 -->
          <text x="${padding + barWidth / 2}" y="${height - 20}" text-anchor="middle" fill="#f1f5f9" font-size="12">高</text>
          <text x="${padding + barWidth + gap + barWidth / 2}" y="${height - 20}" text-anchor="middle" fill="#f1f5f9" font-size="12">中</text>
          <text x="${padding + 2 * (barWidth + gap) + barWidth / 2}" y="${height - 20}" text-anchor="middle" fill="#f1f5f9" font-size="12">低</text>

          <!-- 数值 -->
          <text x="${padding + barWidth / 2}" y="${height - padding - (groups.high / maxCount) * (height - 2 * padding) - 10}"
            text-anchor="middle" fill="#f1f5f9" font-size="14" font-weight="600">${groups.high}</text>
          <text x="${padding + barWidth + gap + barWidth / 2}" y="${height - padding - (groups.medium / maxCount) * (height - 2 * padding) - 10}"
            text-anchor="middle" fill="#f1f5f9" font-size="14" font-weight="600">${groups.medium}</text>
          <text x="${padding + 2 * (barWidth + gap) + barWidth / 2}" y="${height - padding - (groups.low / maxCount) * (height - 2 * padding) - 10}"
            text-anchor="middle" fill="#f1f5f9" font-size="14" font-weight="600">${groups.low}</text>
        </svg>
      `;
    });
}

function renderLearningCurve(history) {
  const container = document.getElementById('learning-curve-chart');
  if (!container) return;

  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty">暂无学习历史</div>';
    return;
  }

  const width = 400; // 固定宽度，避免布局跳动
  const height = 250;
  const padding = 40;

  // 按工具分组
  const toolsMap = new Map();
  history.forEach(h => {
    if (!toolsMap.has(h.toolName)) {
      toolsMap.set(h.toolName, []);
    }
    toolsMap.get(h.toolName).push(h);
  });

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

  // 生成SVG路径
  let svgContent = '';
  let colorIndex = 0;

  toolsMap.forEach((updates, toolName) => {
    const points = updates.map((u, i) => {
      const x = padding + (i / (updates.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - u.confidence * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');

    svgContent += `
      <polyline points="${points}" fill="none" stroke="${colors[colorIndex % colors.length]}" stroke-width="2" />
    `;
    colorIndex++;
  });

  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <!-- 背景网格 -->
      ${Array.from({length: 5}, (_, i) => {
        const y = padding + (i / 4) * (height - 2 * padding);
        return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}"
          stroke="#334155" stroke-width="1" stroke-dasharray="4" opacity="0.3"/>`;
      }).join('')}

      ${svgContent}

      <!-- 图例 -->
      ${Array.from(toolsMap.keys()).map((name, i) => `
        <g transform="translate(${width - 100}, ${20 + i * 20})">
          <line x1="0" y1="0" x2="15" y2="0" stroke="${colors[i % colors.length]}" stroke-width="3" />
          <text x="20" y="4" fill="#f1f5f9" font-size="10">${name.slice(0, 10)}</text>
        </g>
      `).join('')}
    </svg>
  `;
}

function renderUCBVisualization() {
  const container = document.getElementById('ucb-visualization-chart');
  if (!container) return;

  // 获取工具数据并渲染UCB可视化
  fetch(`${API_BASE}/api/bayesian/tools`)
    .then(r => r.json())
    .then(data => {
      if (!data.success) return;

      const tools = data.data;
      if (tools.length === 0) {
        container.innerHTML = '<div class="empty">暂无数据</div>';
        return;
      }

      const width = 400; // 固定宽度，避免布局跳动
      const height = 250;
      const padding = 40;

      // 计算UCB分数 (简化的UCB1公式)
      const totalPulls = tools.reduce((sum, t) => sum + (t.totalCount || 0), 0);
      const toolsWithUCB = tools.map(t => {
        const avgReward = t.confidence || 0.5;
        const n = t.totalCount || 1;
        const ucb = avgReward + Math.sqrt(2 * Math.log(totalPulls + 1) / n);
        return { ...t, ucb };
      }).sort((a, b) => b.ucb - a.ucb);

      const maxUCB = Math.max(...toolsWithUCB.map(t => t.ucb), 1);
      const barWidth = (width - 2 * padding) / toolsWithUCB.length * 0.8;
      const gap = (width - 2 * padding) / toolsWithUCB.length * 0.2;

      container.innerHTML = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <!-- 柱状图 -->
          ${toolsWithUCB.map((t, i) => {
            const x = padding + i * (barWidth + gap) + gap / 2;
            const h = (t.ucb / maxUCB) * (height - 2 * padding);
            const color = t.totalCount < 5 ? '#f59e0b' : '#6366f1'; // 探索中的工具用橙色
            return `
              <rect x="${x}" y="${height - padding - h}" width="${barWidth}" height="${h}"
                fill="${color}" rx="4" />
              <text x="${x + barWidth / 2}" y="${height - padding - h - 5}"
                text-anchor="middle" fill="#f1f5f9" font-size="10">${t.ucb.toFixed(2)}</text>
            `;
          }).join('')}
        </svg>
        <div class="ucb-legend">
          <span><span class="dot" style="background:#f59e0b"></span> 探索中</span>
          <span><span class="dot" style="background:#6366f1"></span> 利用</span>
        </div>
      `;
    });
}

// ==================== Phase 5: 调试页面增强 ====================

async function loadTokenDetails() {
  try {
    const response = await fetch(`${API_BASE}/api/debug/tokens`);
    const data = await response.json();

    if (data.success) {
      renderTokenDetails(data.data);
    }
  } catch (error) {
    console.error('加载Token详情失败:', error);
  }
}

function renderTokenDetails(data) {
  const container = document.getElementById('token-breakdown');
  if (!container || !data) return;

  const { breakdown, budget, utilization } = data;

  container.innerHTML = `
    <div class="token-breakdown-chart">
      <div class="breakdown-item">
        <span class="label">System</span>
        <div class="bar-container">
          <div class="bar" style="width: ${(breakdown.system / breakdown.total * 100) || 0}%; background: #6366f1"></div>
        </div>
        <span class="value">${breakdown.system}</span>
      </div>
      <div class="breakdown-item">
        <span class="label">Memory</span>
        <div class="bar-container">
          <div class="bar" style="width: ${(breakdown.memory / breakdown.total * 100) || 0}%; background: #10b981"></div>
        </div>
        <span class="value">${breakdown.memory}</span>
      </div>
      <div class="breakdown-item">
        <span class="label">User</span>
        <div class="bar-container">
          <div class="bar" style="width: ${(breakdown.user / breakdown.total * 100) || 0}%; background: #f59e0b"></div>
        </div>
        <span class="value">${breakdown.user}</span>
      </div>
      <div class="breakdown-item">
        <span class="label">Self</span>
        <div class="bar-container">
          <div class="bar" style="width: ${(breakdown.selfDescription / breakdown.total * 100) || 0}%; background: #ec4899"></div>
        </div>
        <span class="value">${breakdown.selfDescription}</span>
      </div>
    </div>
    <div class="token-total">
      <span>总计: <strong>${breakdown.total}</strong> tokens</span>
    </div>
  `;
}
async function loadReflectionData() {
  try {
    console.log('[LoadReflectionData] 开始加载反思数据...');

    // 并行加载所有数据，但单独处理每个请求的错误
    const fetchWithError = async (url, name) => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        console.log(`[LoadReflectionData] ${name} 加载成功:`, data.success);
        return { success: true, data, name };
      } catch (err) {
        console.error(`[LoadReflectionData] ${name} 加载失败:`, err);
        return { success: false, error: err, name };
      }
    };

    const results = await Promise.all([
      fetchWithError(`${API_BASE}/api/reflection/status`, 'status'),
      fetchWithError(`${API_BASE}/api/reflection/performance`, 'performance'),
      fetchWithError(`${API_BASE}/api/reflection/token-budget`, 'token-budget'),
      fetchWithError(`${API_BASE}/api/reflection/pending`, 'pending'),
      fetchWithError(`${API_BASE}/api/reflection/history`, 'history'),
      fetchWithError(`${API_BASE}/api/evolution/stats`, 'evolution-stats'),
      fetchWithError(`${API_BASE}/api/evolution/variants`, 'variants'),
      fetchWithError(`${API_BASE}/api/evolution/ab-tests`, 'ab-tests'),
      fetchWithError(`${API_BASE}/api/system/triggers`, 'triggers'),
    ]);

    // 更新UI - 只更新成功加载的数据
    results.forEach(result => {
      if (!result.success) return;

      switch (result.name) {
        case 'status':
          console.log('[LoadReflectionData] 更新反思状态:', result.data);
          updateReflectionStatus(result.data);
          break;
        case 'performance':
          updatePerformanceMetrics(result.data);
          break;
        case 'token-budget':
          updateTokenBudget(result.data);
          break;
        case 'pending':
          updatePendingList(result.data);
          break;
        case 'history':
          updateReflectionHistory(result.data);
          break;
        case 'evolution-stats':
          updateEvolutionStats(result.data);
          break;
        case 'variants':
          updateVariantList(result.data);
          break;
        case 'ab-tests':
          updateABTests(result.data);
          break;
        case 'triggers':
          updateTriggersList(result.data);
          break;
      }
    });

    console.log('[LoadReflectionData] 数据加载完成');
  } catch (error) {
    console.error('[LoadReflectionData] 加载反思数据失败:', error);
  }
}

// 更新反思状态
function updateReflectionStatus(data) {
  console.log('[UpdateReflectionStatus] 数据:', data);

  const statusEl = document.getElementById('reflection-status');
  if (statusEl) {
    statusEl.textContent = data.running ? '🟢 运行中' : (data.initialized ? '🟡 已初始化' : '🔴 未启动');
    statusEl.style.color = data.running ? 'var(--success)' : 'var(--text-secondary)';
  }

  const approvalModeEl = document.getElementById('approval-mode');
  if (approvalModeEl) {
    approvalModeEl.textContent = getModeLabel(data.approvalMode);
  }

  const pendingCountEl = document.getElementById('pending-count');
  if (pendingCountEl) {
    pendingCountEl.textContent = data.pendingApprovals || 0;
  }

  const reflectionCountEl = document.getElementById('reflection-count');
  if (reflectionCountEl) {
    console.log('[UpdateReflectionStatus] 更新反思计数:', data.reflectionCount);
    reflectionCountEl.textContent = data.reflectionCount || 0;
  }

  const appliedInsightsEl = document.getElementById('applied-insights-count');
  if (appliedInsightsEl) {
    appliedInsightsEl.textContent = data.appliedInsightsCount || 0;
  }

  // 显示性能统计
  if (data.performance) {
    const perfStats = document.getElementById('perf-stats');
    if (perfStats) {
      const avgResponseTime = data.performance.avgResponseTime || 0;
      const successRate = data.performance.successRate || 100;
      const sampleCount = data.performance.sampleCount || 0;
      const consecutiveFailures = data.performance.consecutiveFailures || 0;

      perfStats.innerHTML = `
        <div class="metric-row">
          <span>平均响应时间:</span>
          <span>${avgResponseTime > 0 ? Math.round(avgResponseTime) + 'ms' : '-'}</span>
        </div>
        <div class="metric-row">
          <span>成功率:</span>
          <span>${(successRate * 100).toFixed(1)}%</span>
        </div>
        <div class="metric-row">
          <span>样本数:</span>
          <span>${sampleCount}</span>
        </div>
        <div class="metric-row">
          <span>连续失败:</span>
          <span class="${consecutiveFailures > 0 ? 'text-danger' : ''}">${consecutiveFailures}</span>
        </div>
      `;
    }
  }

  // 更新模式选择器
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    modeSelect.value = data.approvalMode || 'conservative';
  }
}

// 更新性能指标
function updatePerformanceMetrics(data) {
  if (!data) return;

  // 响应时间
  let responseTime = 0;
  if (data.responseTime) {
    if (typeof data.responseTime === 'object') {
      responseTime = data.responseTime.average || 0;
    } else {
      responseTime = data.responseTime || 0;
    }
  }

  const responseTimeEl = document.getElementById('response-time');
  if (responseTimeEl) {
    if (responseTime > 0) {
      responseTimeEl.textContent = `${Math.round(responseTime)}ms`;
    } else {
      responseTimeEl.textContent = '-';
    }
  }

  // 内存使用
  let memoryUsage = 0;
  if (data.memoryUsage) {
    if (typeof data.memoryUsage === 'object') {
      memoryUsage = data.memoryUsage.heapUsed || 0;
    } else {
      memoryUsage = data.memoryUsage || 0;
    }
  }

  const memoryUsageEl = document.getElementById('memory-usage');
  if (memoryUsageEl) {
    if (memoryUsage > 0) {
      memoryUsageEl.textContent = `${Math.round(memoryUsage)}MB`;
    } else {
      memoryUsageEl.textContent = '-';
    }
  }

  // 错误率
  let successRate = 100;
  if (data.successRate) {
    if (typeof data.successRate === 'object') {
      successRate = data.successRate.current || 100;
    } else {
      successRate = data.successRate || 100;
    }
  }

  const errorRate = data.errorRate || ((100 - successRate) / 100);
  const errorRateEl = document.getElementById('error-rate');
  if (errorRateEl) {
    errorRateEl.textContent = errorRate ? `${(errorRate * 100).toFixed(1)}%` : '0.0%';
    errorRateEl.style.color = errorRate > 0.1 ? 'var(--danger)' : 'var(--success)';
  }

  // 更新趋势
  const trendEl = document.getElementById('response-trend');
  if (trendEl && data.responseTime?.trend) {
    const trend = data.responseTime.trend;
    trendEl.textContent = trend === 'improving' ? '↓ 改善' : (trend === 'degrading' ? '↑ 恶化' : '→ 稳定');
    trendEl.style.color = trend === 'improving' ? 'var(--success)' : (trend === 'degrading' ? 'var(--danger)' : 'var(--text-secondary)');
  }
}

// 更新Token预算
function updateTokenBudget(data) {
  const container = document.getElementById('token-budget');
  if (!container || !data) return;

  const budget = data.budget || data.budgets;
  const usageReport = data.usageReport;

  if (!budget || Object.keys(budget).length === 0) {
    container.innerHTML = '<p>暂无数据</p>';
    return;
  }

  const totalBudget = data.totalBudget || 4096;

  // 显示预算分配
  container.innerHTML = Object.entries(budget).map(([op, ratio]) => {
    const budgetAmount = Math.round(totalBudget * ratio);
    let used = 0;

    if (usageReport && usageReport.averageUsage) {
      const avg = usageReport.averageUsage;
      if (op === 'system') used = avg.system || 0;
      else if (op === 'self') used = avg.self || 0;
      else if (op === 'memory') used = avg.memory || 0;
      else if (op === 'user') used = avg.user || avg.prompt || 0;
    }

    const utilization = budgetAmount > 0 ? (used / budgetAmount) * 100 : 0;
    const percent = Math.min(utilization, 100);
    const color = utilization > 100 ? 'var(--danger)' : utilization > 80 ? 'var(--warning)' : 'var(--success)';

    return `
      <div class="token-item">
        <span class="token-name">${op}</span>
        <div class="token-bar">
          <div class="token-fill" style="width: ${percent}%; background: ${color}"></div>
        </div>
        <span class="token-value">${Math.round(used)}/${budgetAmount} (${utilization.toFixed(1)}%)</span>
      </div>
    `;
  }).join('');
}

// 更新待审批列表
function updatePendingList(data) {
  const container = document.getElementById('pending-list');
  if (!container) return;

  // 确保数据是数组
  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<p class="empty">✓ 没有待审批的优化计划</p>';
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="pending-item">
      <div class="pending-header">
        <span class="pending-title">${item.type || '改进行动'}</span>
        <span class="pending-risk ${getRiskClass(item.riskLevel)}">${item.riskLevel || 'low'} 风险</span>
      </div>
      <p class="pending-desc">${item.description}</p>
      <p class="pending-impact">预期效果: ${item.expectedImpact || '未知'}</p>
      <div class="pending-actions">
        <button class="btn btn-sm btn-success" onclick="approveAction('${item.id}', true)">✓ 批准</button>
        <button class="btn btn-sm btn-danger" onclick="approveAction('${item.id}', false)">✗ 拒绝</button>
      </div>
    </div>
  `).join('');
}

// 更新反思历史
function updateReflectionHistory(data) {
  const container = document.getElementById('reflection-history');
  if (!container) return;

  // 确保数据是数组
  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<p class="empty">暂无反思历史</p>';
    return;
  }

  container.innerHTML = data.slice(0, 10).map(item => `
    <div class="history-item">
      <div class="history-header">
        <span class="history-time">${formatTime(item.timestamp)}</span>
        <span class="history-result ${item.result}">${item.result === 'success' ? '✓ 成功' : '✗ 失败'}</span>
      </div>
      <p class="history-action">${item.action?.type || '未知行动'}: ${item.action?.description?.slice(0, 50) || ''}...</p>
      ${item.error ? `<p class="history-error">错误: ${item.error}</p>` : ''}
    </div>
  `).join('');
}

// 更新触发器列表
function updateTriggersList(data) {
  const container = document.getElementById('triggers-list');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="empty">暂无触发器</p>';
    return;
  }

  container.innerHTML = data.map(trigger => `
    <div class="trigger-item ${trigger.enabled ? 'enabled' : 'disabled'}">
      <div class="trigger-header">
        <span class="trigger-name">${trigger.name}</span>
        <span class="trigger-type">${trigger.type}</span>
        <span class="trigger-status">${trigger.enabled ? '✓ 启用' : '✗ 禁用'}</span>
      </div>
      <p class="trigger-desc">${trigger.description}</p>
      <div class="trigger-stats">
        <span>触发次数: ${trigger.triggerCount || 0}</span>
        ${trigger.lastTriggeredAt ? `<span>上次触发: ${formatTime(trigger.lastTriggeredAt)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

// 触发反思
async function triggerReflection() {
  try {
    const btn = document.querySelector('#reflection-tab .btn-primary');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '🔄 反思中...';
    }

    console.log('[Trigger] 开始触发反思...');

    const res = await fetch(`${API_BASE}/api/reflection/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'manual' }),
    });

    const data = await res.json();
    console.log('[Trigger] 响应:', data);

    if (data.success) {
      showNotification('反思已触发', 'success');
      console.log('[Trigger] 等待1秒后刷新数据...');
      // 延迟一下确保后端数据已更新
      setTimeout(() => {
        console.log('[Trigger] 刷新反思数据...');
        loadReflectionData();
      }, 500);
    } else {
      showNotification('触发失败: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('[Trigger] 请求失败:', error);
    showNotification('请求失败: ' + error.message, 'error');
  } finally {
    const btn = document.querySelector('#reflection-tab .btn-primary');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 触发反思';
    }
  }
}

// 切换审批模式
async function changeApprovalMode(mode) {
  try {
    const res = await fetch(`${API_BASE}/api/reflection/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });

    const data = await res.json();

    if (data.success) {
      showNotification(`模式已切换为 ${getModeLabel(mode)}`, 'success');
      loadReflectionData();
    } else {
      showNotification('切换失败: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('请求失败: ' + error.message, 'error');
  }
}

// 审批操作
async function approveAction(id, approved) {
  try {
    const res = await fetch(`${API_BASE}/api/reflection/approve/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });

    const data = await res.json();

    if (data.success) {
      showNotification(approved ? '已批准' : '已拒绝', 'success');
      loadReflectionData();
    } else {
      showNotification('审批失败: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('请求失败: ' + error.message, 'error');
  }
}

// ==================== Phase 6: 软自指 + A/B测试功能 ====================

// 更新进化统计
function updateEvolutionStats(data) {
  if (!data) return;

  document.getElementById('variant-count').textContent = data.variantCount || 0;
  document.getElementById('active-variant-count').textContent = data.activeVariantCount || 0;
  document.getElementById('active-test-count').textContent = data.activeTestCount || 0;
  document.getElementById('completed-test-count').textContent = data.completedTestCount || 0;

  // 总使用情况
  const totalUsageEl = document.getElementById('total-usage');
  if (totalUsageEl) {
    const totalUsage = data.totalUsage || 0;
    const totalSuccess = data.totalSuccess || 0;
    const successRate = totalUsage > 0 ? ((totalSuccess / totalUsage) * 100).toFixed(1) : 0;
    totalUsageEl.innerHTML = `
      <div class="metric-row">
        <span>总使用次数:</span>
        <span>${totalUsage}</span>
      </div>
      <div class="metric-row">
        <span>成功次数:</span>
        <span>${totalSuccess}</span>
      </div>
      <div class="metric-row">
        <span>成功率:</span>
        <span>${successRate}%</span>
      </div>
    `;
  }
}

// 更新变体列表
function updateVariantList(data) {
  const container = document.getElementById('variant-list');
  if (!container) return;

  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<p class="empty">暂无变体</p>';
    return;
  }

  container.innerHTML = data.map(variant => `
    <div class="variant-item ${variant.isActive ? 'active' : ''}">
      <div class="variant-header">
        <span class="variant-name">${variant.name}</span>
        <span class="variant-type">${variant.type}</span>
        ${variant.isActive ? '<span class="variant-status active">活跃</span>' : ''}
      </div>
      <div class="variant-stats">
        <span>使用: ${variant.performance?.usageCount || 0}</span>
        <span>成功: ${variant.performance?.successCount || 0}</span>
        <span>成功率: ${variant.performance?.usageCount > 0
          ? ((variant.performance.successCount / variant.performance.usageCount) * 100).toFixed(1)
          : 0}%</span>
        <span>平均响应: ${variant.performance?.avgResponseTime?.toFixed(0) || 0}ms</span>
      </div>
    </div>
  `).join('');
}

// 更新 A/B 测试列表
function updateABTests(data) {
  const container = document.getElementById('ab-test-list');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="empty">暂无 A/B 测试</p>';
    return;
  }

  container.innerHTML = data.map(test => `
    <div class="ab-test-item">
      <div class="ab-test-header">
        <span class="ab-test-name">${test.name}</span>
        <span class="ab-test-status ${test.status}">${getTestStatusLabel(test.status)}</span>
      </div>
      <p class="ab-test-hypothesis">假设: ${test.hypothesis}</p>
      <div class="ab-test-stats">
        <span>样本: ${test.sampleSize}/${test.minSampleSize}</span>
        ${test.confidence ? `<span>置信度: ${(test.confidence * 100).toFixed(0)}%</span>` : ''}
      </div>
      ${test.winner ? `<p class="ab-test-winner">🏆 胜者: ${test.winner.slice(0, 16)}...</p>` : ''}
    </div>
  `).join('');
}

// 辅助函数
function getModeLabel(mode) {
  const labels = {
    auto: '自动',
    conservative: '保守',
    human: '人工',
  };
  return labels[mode] || mode;
}

function getRiskClass(risk) {
  if (!risk || risk === 'low') return 'risk-low';
  if (risk === 'medium') return 'risk-medium';
  return 'risk-high';
}

function getTestStatusLabel(status) {
  const labels = {
    running: '运行中',
    completed: '已完成',
    cancelled: '已取消',
  };
  return labels[status] || status;
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
}

// 通知系统
function showNotification(message, type = 'info') {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--info)'};
    color: white;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(notification);

  // 3秒后自动移除
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;

// ============================================
// P0-P4 元认知架构功能
// ============================================

// P0: 元认知核心
async function loadMetacognitionData() {
  try {
    // 加载能力边界
    const capsRes = await fetch(`${API_BASE}/api/metacognition/capabilities`);
    const capsData = await capsRes.json();
    if (capsData.success) {
      renderCapabilityBounds(capsData.data);
    }

    // 加载状态报告
    const reportRes = await fetch(`${API_BASE}/api/metacognition/report`);
    const reportData = await reportRes.json();
    if (reportData.success) {
      document.getElementById('metacognition-report').innerHTML = `<code>${JSON.stringify(reportData.data, null, 2)}</code>`;
    }
  } catch (error) {
    console.error('加载元认知数据失败:', error);
  }
}

function renderCapabilityBounds(data) {
  const container = document.getElementById('capability-bounds-list');
  if (!container || !data.capabilities) return;

  container.innerHTML = data.capabilities.map(cap => `
    <div class="capability-item" style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600;">${cap.name}</span>
        <span style="padding: 4px 8px; border-radius: 4px; background: ${cap.confidence > 0.7 ? '#4ade80' : cap.confidence > 0.4 ? '#fbbf24' : '#ef4444'}; color: white; font-size: 12px;">
          ${(cap.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${cap.description || ''}</div>
    </div>
  `).join('');
}

async function assessUncertainty() {
  try {
    const res = await fetch(`${API_BASE}/api/metacognition/assess`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      document.getElementById('system-uncertainty').textContent = (data.data.uncertainty * 100).toFixed(1) + '%';
      document.getElementById('recommendation').textContent = data.data.recommendation || '无建议';
    }
  } catch (error) {
    console.error('评估失败:', error);
  }
}

// P1: 动态提示生成
async function loadDynamicPromptData() {
  try {
    // 加载Token预算
    const budgetRes = await fetch(`${API_BASE}/api/reflection/token-budget`);
    const budgetData = await budgetRes.json();
    if (budgetData.success && budgetData.data) {
      const budget = budgetData.data.budget || {};
      const used = budget.totalUsed || 0;
      const limit = budget.limit || 100000;
      const remaining = limit - used;
      const percent = (used / limit * 100).toFixed(1);

      document.getElementById('prompt-budget-total').textContent = limit.toLocaleString();
      document.getElementById('prompt-budget-used').textContent = used.toLocaleString();
      document.getElementById('prompt-budget-remaining').textContent = remaining.toLocaleString();
      document.getElementById('prompt-budget-bar').style.width = percent + '%';
    }
  } catch (error) {
    console.error('加载动态提示数据失败:', error);
  }
}

async function refreshCompiledPrompt() {
  try {
    const res = await fetch(`${API_BASE}/api/debug/last-prompt`);
    const data = await res.json();
    if (data.success && data.data) {
      document.getElementById('compiled-prompt-display').innerHTML = `<code>${JSON.stringify(data.data, null, 2)}</code>`;
    } else {
      document.getElementById('compiled-prompt-display').innerHTML = `<code>暂无编译的提示词数据</code>`;
    }
  } catch (error) {
    console.error('刷新编译提示词失败:', error);
  }
}

function previewPromptIdentity(identity) {
  const identityMap = {
    confident: { icon: '😊', name: '自信模式', desc: '高置信度，主动决策', confidence: '85%', load: '0.3' },
    uncertain: { icon: '😰', name: '不确定', desc: '低置信度，寻求帮助', confidence: '35%', load: '0.6' },
    learning: { icon: '📚', name: '学习中', desc: '探索新工具和能力', confidence: '50%', load: '0.7' },
    stressed: { icon: '😰', name: '高压力', desc: '认知负荷高，需要休息', confidence: '45%', load: '0.9' }
  };

  const info = identityMap[identity];
  if (info) {
    document.getElementById('identity-icon').textContent = info.icon;
    document.getElementById('identity-name').textContent = info.name;
    document.getElementById('identity-desc').textContent = info.desc;
    document.getElementById('identity-confidence').textContent = info.confidence;
    document.getElementById('identity-load').textContent = info.load;
  }
}

// P2: 推理监控与策略编码
async function loadReasoningData() {
  try {
    // 加载推理统计
    const statsRes = await fetch(`${API_BASE}/api/reasoning/stats`);
    const statsData = await statsRes.json();
    if (statsData.success) {
      document.getElementById('active-chains').textContent = statsData.data.activeChains || 0;
      document.getElementById('total-steps').textContent = statsData.data.totalSteps || 0;
      document.getElementById('avg-reasoning-confidence').textContent =
        statsData.data.avgConfidence ? (statsData.data.avgConfidence * 100).toFixed(1) + '%' : '-';
      document.getElementById('detected-flaws').textContent = statsData.data.detectedFlaws || 0;
    }

    // 加载策略列表
    const stratRes = await fetch(`${API_BASE}/api/strategies`);
    const stratData = await stratRes.json();
    if (stratData.success) {
      const list = document.getElementById('encoded-strategies-list');
      if (list && stratData.data.strategies) {
        list.innerHTML = stratData.data.strategies.map(s => `
          <div class="strategy-item" style="padding: 8px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 4px;">
            <div style="font-weight: 600;">${s.name}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">v${s.version} · ${s.status}</div>
          </div>
        `).join('');
      }
    }

    // 加载推理链
    const chainsRes = await fetch(`${API_BASE}/api/reasoning/chains`);
    const chainsData = await chainsRes.json();
    if (chainsData.success) {
      const list = document.getElementById('reasoning-chains-list');
      if (list && chainsData.data.chains) {
        list.innerHTML = chainsData.data.chains.map(chain => `
          <div class="chain-item" style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="font-weight: 600;">${chain.name || '推理链'}</span>
              <span style="font-size: 12px; color: var(--text-secondary);">${chain.steps || 0} 步骤</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">置信度: ${(chain.confidence * 100).toFixed(1)}%</div>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('加载推理数据失败:', error);
  }
}

async function encodeStrategy() {
  const input = document.getElementById('strategy-input');
  if (!input || !input.value.trim()) return;

  try {
    const res = await fetch(`${API_BASE}/api/strategies/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: input.value })
    });
    const data = await res.json();
    if (data.success) {
      showNotification('策略编码成功', 'success');
      input.value = '';
      loadReasoningData();
    }
  } catch (error) {
    console.error('策略编码失败:', error);
    showNotification('策略编码失败', 'error');
  }
}

async function runCritique() {
  const input = document.getElementById('critique-input');
  if (!input || !input.value.trim()) return;

  try {
    const res = await fetch(`${API_BASE}/api/reasoning/critique`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reasoning: input.value })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('critique-result').style.display = 'block';
      document.getElementById('critique-output').textContent = JSON.stringify(data.data, null, 2);
    }
  } catch (error) {
    console.error('批判分析失败:', error);
  }
}

// P3: 自指编码记忆
async function loadSelfReferentialData() {
  try {
    // 加载报告
    const reportRes = await fetch(`${API_BASE}/api/selfreferential/report`);
    const reportData = await reportRes.json();
    if (reportData.success) {
      document.getElementById('self-ref-report').innerHTML = `<code>${JSON.stringify(reportData.data, null, 2)}</code>`;

      // 更新6层记忆数量
      const layers = reportData.data.layers || {};
      document.getElementById('layer-working-count').textContent = layers.working || 0;
      document.getElementById('layer-episodic-count').textContent = layers.episodic || 0;
      document.getElementById('layer-semantic-count').textContent = layers.semantic || 0;
      document.getElementById('layer-procedural-count').textContent = layers.procedural || 0;
      document.getElementById('layer-self-count').textContent = layers.self || 0;
      document.getElementById('layer-reflective-count').textContent = layers.reflective || 0;
    }

    // 加载遗忘统计
    const forgetRes = await fetch(`${API_BASE}/api/selfreferential/forgetting`);
    const forgetData = await forgetRes.json();
    if (forgetData.success) {
      document.getElementById('forgotten-today').textContent = forgetData.data.forgottenToday || 0;
      document.getElementById('retention-rate').textContent = forgetData.data.retentionRate ?
        (forgetData.data.retentionRate * 100).toFixed(1) + '%' : '-';
      document.getElementById('avg-memory-age').textContent = forgetData.data.avgAge ?
        forgetData.data.avgAge.toFixed(1) + '天' : '-';
    }
  } catch (error) {
    console.error('加载自指记忆数据失败:', error);
  }
}

async function testSelfReferentialEncode() {
  const input = document.getElementById('self-ref-input');
  if (!input || !input.value.trim()) return;

  try {
    const res = await fetch(`${API_BASE}/api/selfreferential/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input.value })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('self-ref-result').style.display = 'block';
      document.getElementById('self-ref-decision').innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px;">AI决定存储到: <span style="color: #4ade80;">${data.data.targetLayer}</span></div>
        <div style="font-size: 12px; color: var(--text-secondary);">原因: ${data.data.reason || '基于内容分析'}</div>
      `;
    }
  } catch (error) {
    console.error('自指编码测试失败:', error);
  }
}

// P4: 策略执行器
async function loadStrategyExecutorData() {
  try {
    // 加载可执行策略
    const execRes = await fetch(`${API_BASE}/api/strategies/executable`);
    const execData = await execRes.json();
    if (execData.success) {
      const list = document.getElementById('executable-strategies-list');
      if (list && execData.data.strategies) {
        list.innerHTML = execData.data.strategies.map(s => `
          <div class="executable-strategy-item" style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600;">${s.name}</span>
              <button class="btn btn-sm" onclick="executeStrategy('${s.id}')">执行</button>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${s.description || ''}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
              执行次数: ${s.executionCount || 0} | 成功率: ${(s.successRate * 100).toFixed(1)}%
            </div>
          </div>
        `).join('');
      }
    }

    // 加载执行统计
    const statsRes = await fetch(`${API_BASE}/api/strategies/execution-stats`);
    const statsData = await statsRes.json();
    if (statsData.success) {
      document.getElementById('total-executions').textContent = statsData.data.total || 0;
      document.getElementById('successful-executions').textContent = statsData.data.successful || 0;
      document.getElementById('failed-executions').textContent = statsData.data.failed || 0;
      document.getElementById('execution-success-rate').textContent = statsData.data.successRate ?
        (statsData.data.successRate * 100).toFixed(1) + '%' : '-';
      document.getElementById('avg-execution-time').textContent = statsData.data.avgTime ?
        statsData.data.avgTime.toFixed(2) + 'ms' : '-';
    }

    // 加载执行报告
    const reportRes = await fetch(`${API_BASE}/api/strategies/execution-report`);
    const reportData = await reportRes.json();
    if (reportData.success) {
      document.getElementById('execution-report').innerHTML = `<code>${JSON.stringify(reportData.data, null, 2)}</code>`;
    }
  } catch (error) {
    console.error('加载策略执行器数据失败:', error);
  }
}

async function compileStrategy() {
  const input = document.getElementById('compile-strategy-input');
  if (!input || !input.value.trim()) return;

  try {
    const res = await fetch(`${API_BASE}/api/strategies/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: input.value })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('compile-result').style.display = 'block';
      document.getElementById('compiled-code-display').textContent = data.data.compiledCode || '编译成功';
    }
  } catch (error) {
    console.error('策略编译失败:', error);
  }
}

async function executeStrategy(strategyId) {
  try {
    const res = await fetch(`${API_BASE}/api/strategies/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategyId })
    });
    const data = await res.json();
    if (data.success) {
      showNotification('策略执行成功', 'success');
      loadStrategyExecutorData();
    } else {
      showNotification('策略执行失败', 'error');
    }
  } catch (error) {
    console.error('策略执行失败:', error);
    showNotification('策略执行失败', 'error');
  }
}

// 添加元认知页面到自动刷新
function loadMetacognitionTab() {
  loadMetacognitionData();
  loadDynamicPromptData();
  loadReasoningData();
  loadSelfReferentialData();
  loadStrategyExecutorData();
}

// 添加旋转动画样式
document.head.appendChild(style);

const spinStyle = document.createElement('style');
spinStyle.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .thinking-stream .thinking-step {
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .thinking-step.completed .step-status {
    animation: checkPop 0.3s ease;
  }

  @keyframes checkPop {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
`;
document.head.appendChild(spinStyle);
