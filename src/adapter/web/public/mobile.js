// ============================================
// 移动端适配
// ============================================

// 检测是否为触摸设备
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
const isMobile = window.innerWidth <= 768;

// 移动端初始化
function initMobile() {
  if (!isMobile) return;

  // 添加移动端特定样式
  const mobileStyle = document.createElement('style');
  mobileStyle.textContent = `
    /* 隐藏滚动条但保留滚动功能 */
    .chat-messages::-webkit-scrollbar,
    .memory-list::-webkit-scrollbar,
    .tools-list::-webkit-scrollbar {
      display: none;
    }

    /* 优化触摸反馈 */
    .nav-item,
    .btn,
    .memory-item,
    .tool-item {
      -webkit-tap-highlight-color: transparent;
    }

    /* 优化输入框 */
    input, textarea, select {
      font-size: 16px !important;
    }

    /* 禁用文本选择（提升触摸体验） */
    .nav-item, .btn {
      user-select: none;
      -webkit-user-select: none;
    }
  `;
  document.head.appendChild(mobileStyle);

  // 添加滑动返回手势支持
  let touchStartX = 0;
  let touchEndX = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const swipeThreshold = 100;
    const diff = touchEndX - touchStartX;

    // 从屏幕左边缘右滑 -> 切换到上一个标签
    if (touchStartX < 50 && diff > swipeThreshold) {
      const tabs = ['chat', 'monitor', 'memory', 'bayesian', 'tools', 'debug', 'reflection', 'metacognition'];
      const currentIndex = tabs.indexOf(currentTab);
      if (currentIndex > 0) {
        switchToTab(tabs[currentIndex - 1]);
      }
    }

    // 左滑 -> 切换到下一个标签
    if (diff < -swipeThreshold) {
      const tabs = ['chat', 'monitor', 'memory', 'bayesian', 'tools', 'debug', 'reflection', 'metacognition'];
      const currentIndex = tabs.indexOf(currentTab);
      if (currentIndex < tabs.length - 1) {
        switchToTab(tabs[currentIndex + 1]);
      }
    }
  }

  // 添加双击顶部返回功能
  let lastTapTime = 0;
  document.querySelector('.page-header')?.addEventListener('click', () => {
    const currentTime = new Date().getTime();
    if (currentTime - lastTapTime < 300) {
      // 双击返回顶部
      document.querySelector('.main')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    lastTapTime = currentTime;
  });
}

// 切换到指定标签
function switchToTab(tabName) {
  const navItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (navItem) {
    navItem.click();
  }
}

// 监听屏幕方向变化
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    // 重新计算布局
    if (currentTab === 'chat') {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }, 300);
});

// 监听窗口大小变化
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const newIsMobile = window.innerWidth <= 768;
    if (newIsMobile !== isMobile) {
      location.reload(); // 切换设备类型时刷新页面
    }
  }, 250);
});

// 防止iOS橡皮筋效果
if (isTouchDevice) {
  document.body.addEventListener('touchmove', (e) => {
    if (e.target.closest('.chat-messages') ||
        e.target.closest('.memory-list') ||
        e.target.closest('.tools-list') ||
        e.target.closest('pre')) {
      // 允许这些区域滚动
      return;
    }
    // 阻止默认滚动行为
    if (e.target === document.body) {
      e.preventDefault();
    }
  }, { passive: false });
}

// 初始化移动端
initMobile();

// 导出移动端相关函数供全局使用
window.switchToTab = switchToTab;
