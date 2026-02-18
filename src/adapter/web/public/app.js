/** app.js - Ouroboros Web Console 前端逻辑 */

// API 基础 URL
const API_BASE = '';

// 状态
let currentTab = 'chat';
let isTyping = false;

// DOM 元素
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const typingStatus = document.getElementById('typing-status');

// 初始化
function init() {
  setupNavigation();
  setupChat();
  loadStatus();
  
  // 定期刷新状态
  setInterval(loadStatus, 5000);
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
      if (tab === 'monitor') loadStatus();
      if (tab === 'memory') loadMemoryStats();
      if (tab === 'bayesian') loadBayesianTools();
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
  
  // 添加用户消息
  addMessage('user', message);
  chatInput.value = '';
  
  // 显示输入中状态
  setTyping(true);
  
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      addMessage('system', data.data.content);
    } else {
      addMessage('system', `错误: ${data.error}`);
    }
  } catch (error) {
    addMessage('system', `请求失败: ${error.message}`);
  } finally {
    setTyping(false);
  }
}

function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  div.innerHTML = `
    <div class="message-content">${escapeHtml(content)}</div>
    <div class="message-time">${time}</div>
  `;
  
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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
