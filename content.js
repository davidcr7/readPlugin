class WeReadAutoReader {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.startTime = null;
    this.duration = 0;
    this.pageCount = 0;
    this.smartInterval = {
      enabled: false,
      mode: 'fixed', // 'wordCount', 'imageAnalysis', 'fixed'
      baseInterval: 1,
      minInterval: 0.5,
      maxInterval: 10
    };
    
    this.init();
  }

  init() {
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'startAutoReading':
          this.startWithSchedule(request.schedule);
          sendResponse({success: true});
          break;
        case 'stopAutoReading':
          this.stop();
          sendResponse({success: true});
          break;
        case 'getStatus':
          sendResponse({
            isRunning: this.isRunning,
            pageCount: this.pageCount,
            scheduleType: this.scheduleType
          });
          break;
        case 'updateSmartInterval':
          this.updateSmartIntervalSettings(request.settings);
          sendResponse({success: true});
          break;
      }
      return true;
    });

    // 恢复之前的阅读状态
    chrome.storage.local.get(['autoReading', 'scheduleType'], (result) => {
      if (result.autoReading && result.scheduleType) {
        chrome.storage.local.get([
          'interval', 'duration', 'dailyTime', 'dailyDuration',
          'weeklyDay', 'weeklyTime', 'weeklyDuration',
          'monthlyDay', 'monthlyTime', 'monthlyDuration'
        ], (settings) => {
          const schedule = {
            type: result.scheduleType,
            interval: settings.interval
          };

          switch (result.scheduleType) {
            case 'duration':
              schedule.duration = settings.duration;
              break;
            case 'daily':
              schedule.dailyTime = settings.dailyTime;
              schedule.dailyDuration = settings.dailyDuration;
              break;
            case 'weekly':
              schedule.weeklyDay = settings.weeklyDay;
              schedule.weeklyTime = settings.weeklyTime;
              schedule.weeklyDuration = settings.weeklyDuration;
              break;
            case 'monthly':
              schedule.monthlyDay = settings.monthlyDay;
              schedule.monthlyTime = settings.monthlyTime;
              schedule.monthlyDuration = settings.monthlyDuration;
              break;
          }

          this.startWithSchedule(schedule);
        });
      }
    });
  }

  startWithSchedule(schedule) {
    if (this.isRunning) {
      this.stop();
    }

    // 处理智能翻页设置
    if (schedule.smartSettings) {
      this.updateSmartIntervalSettings(schedule.smartSettings);
    }

    this.scheduleType = schedule.type;
    this.isRunning = true;
    this.interval = schedule.interval * 1000; // 转换为毫秒
    this.pageCount = 0;

    console.log(`开始自动阅读，类型: ${schedule.type}，间隔: ${schedule.interval}秒`);

    switch (schedule.type) {
      case 'duration':
        this.startDurationMode(schedule.duration);
        break;
      case 'daily':
        this.startDailyMode(schedule.dailyTime, schedule.dailyDuration);
        break;
      case 'weekly':
        this.startWeeklyMode(schedule.weeklyDay, schedule.weeklyTime, schedule.weeklyDuration);
        break;
      case 'monthly':
        this.startMonthlyMode(schedule.monthlyDay, schedule.monthlyTime, schedule.monthlyDuration);
        break;
    }
  }

  startDurationMode(duration) {
    this.duration = duration;
    this.startTime = Date.now();

    console.log(`固定时长模式，时长: ${duration === 0 ? '无限' : duration + '秒'}`);

    this.startAutoReading();

    // 立即执行第一次翻页
    this.turnPage();
  }

  startAutoReading() {
    const performTurnPage = () => {
      if (!this.isRunning) return;

      this.turnPage();
      
      // 检查是否到达设定的时长
      if (this.duration > 0) {
        const elapsed = (Date.now() - this.startTime) / 1000;
        if (elapsed >= this.duration) {
          console.log('自动阅读时间到，停止阅读');
          this.stop();
          return;
        }
      }

      // 计算下一次翻页的间隔
      const nextInterval = this.calculateNextInterval();
      
      // 设置下一次翻页
      setTimeout(performTurnPage, nextInterval * 1000);
    };

    // 开始第一次翻页
    setTimeout(performTurnPage, this.calculateNextInterval() * 1000);
  }

  startDailyMode(dailyTime, dailyDuration) {
    console.log(`按天模式，每天 ${dailyTime} 开始，持续 ${dailyDuration} 分钟`);
    this.startScheduledMode('daily', dailyTime, dailyDuration);
  }

  startWeeklyMode(weeklyDay, weeklyTime, weeklyDuration) {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    console.log(`按星期模式，每周${days[weeklyDay]} ${weeklyTime} 开始，持续 ${weeklyDuration} 分钟`);
    this.startScheduledMode('weekly', weeklyTime, weeklyDuration, weeklyDay);
  }

  startMonthlyMode(monthlyDay, monthlyTime, monthlyDuration) {
    console.log(`按月模式，每月${monthlyDay}日 ${monthlyTime} 开始，持续 ${monthlyDuration} 分钟`);
    this.startScheduledMode('monthly', monthlyTime, monthlyDuration, monthlyDay);
  }

  startScheduledMode(type, targetTime, durationMinutes, extraParam = null) {
    this.checkSchedule(type, targetTime, durationMinutes, extraParam);
    
    // 每分钟检查一次是否到达预定时间
    this.scheduleCheckId = setInterval(() => {
      this.checkSchedule(type, targetTime, durationMinutes, extraParam);
    }, 60000); // 每分钟检查一次
  }

  checkSchedule(type, targetTime, durationMinutes, extraParam = null) {
    const now = new Date();
    const [targetHour, targetMinute] = targetTime.split(':').map(Number);
    
    let shouldStart = false;

    switch (type) {
      case 'daily':
        // 每天检查当前时间是否匹配
        shouldStart = now.getHours() === targetHour && now.getMinutes() === targetMinute;
        break;
      case 'weekly':
        // 每周检查星期和当前时间是否匹配
        shouldStart = now.getDay() === extraParam && 
                     now.getHours() === targetHour && 
                     now.getMinutes() === targetMinute;
        break;
      case 'monthly':
        // 每月检查日期和当前时间是否匹配
        shouldStart = now.getDate() === extraParam && 
                     now.getHours() === targetHour && 
                     now.getMinutes() === targetMinute;
        break;
    }

    if (shouldStart && !this.isReading) {
      console.log(`定时时间到，开始阅读 ${durationMinutes} 分钟`);
      this.startReadingSession(durationMinutes);
    }
  }

  startReadingSession(durationMinutes) {
    this.isReading = true;
    this.sessionStartTime = Date.now();
    this.sessionDuration = durationMinutes * 60 * 1000; // 转换为毫秒

    console.log(`开始阅读会话，持续 ${durationMinutes} 分钟`);

    this.startAutoReading();

    // 立即执行第一次翻页
    this.turnPage();
  }

  stopReadingSession() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isReading = false;
    console.log(`阅读会话结束，本次会话阅读了 ${this.pageCount} 页`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.scheduleCheckId) {
      clearInterval(this.scheduleCheckId);
      this.scheduleCheckId = null;
    }
    this.isRunning = false;
    this.isReading = false;
    console.log(`停止自动阅读，共阅读了 ${this.pageCount} 页`);
    
    // 更新存储状态
    chrome.storage.local.set({autoReading: false});
  }

  calculateNextInterval() {
    if (!this.smartInterval.enabled || this.smartInterval.mode === 'fixed') {
      return this.interval / 1000; // 返回秒数
    }

    let calculatedInterval = this.smartInterval.baseInterval;

    if (this.smartInterval.mode === 'wordCount') {
      calculatedInterval = this.calculateIntervalByWordCount();
    } else if (this.smartInterval.mode === 'imageAnalysis') {
      calculatedInterval = this.calculateIntervalByImageAnalysis();
    }

    // 确保间隔在最小和最大范围内
    return Math.max(
      this.smartInterval.minInterval,
      Math.min(this.smartInterval.maxInterval, calculatedInterval)
    );
  }

  calculateIntervalByWordCount() {
    const textContent = this.getCurrentPageText();
    if (!textContent) return this.smartInterval.baseInterval;

    const wordCount = textContent.trim().split(/\s+/).length;
    const charCount = textContent.length;

    // 基于字数和字符数计算阅读时间
    // 假设平均阅读速度：200字/分钟，即约3.3字/秒
    const readingTimeSeconds = Math.max(wordCount / 3.3, charCount / 10);

    // 添加基础间隔作为缓冲
    return Math.max(this.smartInterval.baseInterval, readingTimeSeconds);
  }

  calculateIntervalByImageAnalysis() {
    const imageInfo = this.analyzeCurrentPageImages();
    if (!imageInfo.hasImages) {
      return this.calculateIntervalByWordCount();
    }

    // 如果有图片，增加阅读时间
    let baseInterval = this.calculateIntervalByWordCount();
    
    // 根据图片数量和大小调整时间
    if (imageInfo.largeImages > 0) {
      baseInterval += imageInfo.largeImages * 2; // 每张大图增加2秒
    }
    if (imageInfo.mediumImages > 0) {
      baseInterval += imageInfo.mediumImages * 1; // 每张中等图增加1秒
    }
    if (imageInfo.complexImages > 0) {
      baseInterval += imageInfo.complexImages * 3; // 每张复杂图增加3秒
    }

    return baseInterval;
  }

  getCurrentPageText() {
    // 尝试获取当前页面的文本内容
    const selectors = [
      '.reader_content',
      '.readerContent',
      '.wr_pageContainer',
      '.wr_readerContent',
      '.app_content',
      '.reader-page'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent;
      }
    }

    // 如果没有找到特定元素，尝试获取body文本
    return document.body.textContent || '';
  }

  analyzeCurrentPageImages() {
    const images = document.querySelectorAll('img');
    let largeImages = 0;
    let mediumImages = 0;
    let complexImages = 0;
    let hasImages = false;

    images.forEach(img => {
      if (img.offsetWidth > 0 && img.offsetHeight > 0) {
        hasImages = true;
        const area = img.offsetWidth * img.offsetHeight;
        
        if (area > 100000) { // 大图
          largeImages++;
        } else if (area > 25000) { // 中等图
          mediumImages++;
        }

        // 检查图片复杂度（基于文件大小和文件名）
        const src = img.src.toLowerCase();
        if (src.includes('chart') || src.includes('graph') || src.includes('diagram') || 
            src.includes('map') || src.includes('table')) {
          complexImages++;
        }
      }
    });

    return {
      hasImages,
      totalImages: images.length,
      largeImages,
      mediumImages,
      complexImages
    };
  }

  updateSmartIntervalSettings(settings) {
    this.smartInterval = {
      ...this.smartInterval,
      ...settings
    };
    console.log('智能翻页设置已更新:', this.smartInterval);
  }

  turnPage() {
    if (!this.isRunning) return;

    // 尝试多种翻页方式
    const pageTurned = this.tryNextPage() || this.trySwipe() || this.tryClickNext();
    
    if (pageTurned) {
      this.pageCount++;
      console.log(`已翻页 ${this.pageCount} 次`);
    } else {
      console.log('无法找到翻页元素');
    }
  }

  tryNextPage() {
    // 方法1: 模拟键盘右箭头键
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      code: 'ArrowRight',
      keyCode: 39,
      which: 39,
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(event);
    
    // 等待一小段时间让页面响应
    setTimeout(() => {
      const eventUp = new KeyboardEvent('keyup', {
        key: 'ArrowRight',
        code: 'ArrowRight',
        keyCode: 39,
        which: 39,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(eventUp);
    }, 100);

    return true;
  }

  trySwipe() {
    // 方法2: 模拟触摸滑动
    const touchStart = new TouchEvent('touchstart', {
      touches: [new Touch({
        identifier: 1,
        target: document.body,
        clientX: window.innerWidth - 100,
        clientY: window.innerHeight / 2
      })],
      bubbles: true,
      cancelable: true
    });

    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [new Touch({
        identifier: 1,
        target: document.body,
        clientX: 100,
        clientY: window.innerHeight / 2
      })],
      bubbles: true,
      cancelable: true
    });

    document.body.dispatchEvent(touchStart);
    setTimeout(() => {
      document.body.dispatchEvent(touchEnd);
    }, 50);

    return true;
  }

  tryClickNext() {
    // 方法3: 查找并点击下一页按钮
    const selectors = [
      '.readerFooter_button',
      '.readerTopBar_right',
      '.readerControls_next',
      '.next-button',
      '[data-action="next"]',
      'button:contains("下一页")'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        element.click();
        return true;
      }
    }

    // 方法4: 点击页面右侧区域
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: window.innerWidth - 50,
      clientY: window.innerHeight / 2
    });
    
    document.elementFromPoint(window.innerWidth - 50, window.innerHeight / 2)?.dispatchEvent(clickEvent);
    
    return true;
  }

  // 获取当前阅读状态
  getStatus() {
    return {
      isRunning: this.isRunning,
      isReading: this.isReading,
      pageCount: this.pageCount,
      scheduleType: this.scheduleType,
      elapsedTime: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
      sessionElapsedTime: this.sessionStartTime ? (Date.now() - this.sessionStartTime) / 1000 : 0
    };
  }
}

// 初始化自动阅读器
const autoReader = new WeReadAutoReader();