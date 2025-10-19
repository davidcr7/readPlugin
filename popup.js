document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const saveScheduleBtn = document.getElementById('saveScheduleBtn');
  const intervalInput = document.getElementById('interval');
  const durationSelect = document.getElementById('duration');
  const startModeSelect = document.getElementById('startMode');
  const scheduleTypeSelect = document.getElementById('scheduleType');
  const smartIntervalModeSelect = document.getElementById('smartIntervalMode');
  const smartIntervalSettings = document.getElementById('smartIntervalSettings');
  const minIntervalInput = document.getElementById('minInterval');
  const maxIntervalInput = document.getElementById('maxInterval');
  const statusDiv = document.getElementById('status');

  // 定时类型组
  const durationGroup = document.getElementById('durationGroup');
  const dailyGroup = document.getElementById('dailyGroup');
  const weeklyGroup = document.getElementById('weeklyGroup');
  const monthlyGroup = document.getElementById('monthlyGroup');

  // 从存储中加载设置
  chrome.storage.local.get([
    'autoReading', 'interval', 'duration', 'startMode', 'scheduleType',
    'dailyTime', 'dailyDuration', 'weeklyDay', 'weeklyTime', 'weeklyDuration',
    'monthlyDay', 'monthlyTime', 'monthlyDuration',
    'smartIntervalMode', 'minInterval', 'maxInterval'
  ], function(result) {
    if (result.interval) {
      intervalInput.value = result.interval;
    }
    if (result.duration) {
      durationSelect.value = result.duration;
    }
    if (result.startMode) {
      startModeSelect.value = result.startMode;
      updateStartModeUI(result.startMode);
    }
    if (result.scheduleType) {
      scheduleTypeSelect.value = result.scheduleType;
      showScheduleGroup(result.scheduleType);
    }
    if (result.dailyTime) {
      document.getElementById('dailyTime').value = result.dailyTime;
    }
    if (result.dailyDuration) {
      document.getElementById('dailyDuration').value = result.dailyDuration;
    }
    if (result.weeklyDay !== undefined) {
      document.getElementById('weeklyDay').value = result.weeklyDay;
    }
    if (result.weeklyTime) {
      document.getElementById('weeklyTime').value = result.weeklyTime;
    }
    if (result.weeklyDuration) {
      document.getElementById('weeklyDuration').value = result.weeklyDuration;
    }
    if (result.monthlyDay) {
      document.getElementById('monthlyDay').value = result.monthlyDay;
    }
    if (result.monthlyTime) {
      document.getElementById('monthlyTime').value = result.monthlyTime;
    }
    if (result.monthlyDuration) {
      document.getElementById('monthlyDuration').value = result.monthlyDuration;
    }
    if (result.smartIntervalMode) {
      smartIntervalModeSelect.value = result.smartIntervalMode;
      toggleSmartIntervalSettings(result.smartIntervalMode);
    }
    if (result.minInterval) {
      minIntervalInput.value = result.minInterval;
    }
    if (result.maxInterval) {
      maxIntervalInput.value = result.maxInterval;
    }
    if (result.autoReading) {
      updateStatus(true);
    }
  });

  // 启动方式切换
  startModeSelect.addEventListener('change', function() {
    updateStartModeUI(this.value);
  });

  // 定时类型切换
  scheduleTypeSelect.addEventListener('change', function() {
    showScheduleGroup(this.value);
  });

  // 智能翻页模式切换
  smartIntervalModeSelect.addEventListener('change', function() {
    toggleSmartIntervalSettings(this.value);
  });

  startBtn.addEventListener('click', function() {
    const interval = parseFloat(intervalInput.value);
    const startMode = startModeSelect.value;
    const scheduleType = scheduleTypeSelect.value;
    
    if (interval < 0.5) {
      alert('翻页间隔不能小于0.5秒');
      return;
    }

    let scheduleData = {
      type: scheduleType,
      interval: interval
    };

    // 根据定时类型收集数据
    switch (scheduleType) {
      case 'duration':
        scheduleData.duration = parseInt(durationSelect.value);
        break;
      case 'daily':
        scheduleData.dailyTime = document.getElementById('dailyTime').value;
        scheduleData.dailyDuration = parseInt(document.getElementById('dailyDuration').value);
        break;
      case 'weekly':
        scheduleData.weeklyDay = parseInt(document.getElementById('weeklyDay').value);
        scheduleData.weeklyTime = document.getElementById('weeklyTime').value;
        scheduleData.weeklyDuration = parseInt(document.getElementById('weeklyDuration').value);
        break;
      case 'monthly':
        scheduleData.monthlyDay = parseInt(document.getElementById('monthlyDay').value);
        scheduleData.monthlyTime = document.getElementById('monthlyTime').value;
        scheduleData.monthlyDuration = parseInt(document.getElementById('monthlyDuration').value);
        break;
    }

    // 保存设置
    const smartSettings = {
      enabled: smartIntervalModeSelect.value !== 'fixed',
      mode: smartIntervalModeSelect.value,
      baseInterval: interval,
      minInterval: parseFloat(minIntervalInput.value),
      maxInterval: parseFloat(maxIntervalInput.value)
    };

    chrome.storage.local.set({
      interval: interval,
      startMode: startMode,
      scheduleType: scheduleType,
      duration: scheduleData.duration,
      dailyTime: scheduleData.dailyTime,
      dailyDuration: scheduleData.dailyDuration,
      weeklyDay: scheduleData.weeklyDay,
      weeklyTime: scheduleData.weeklyTime,
      weeklyDuration: scheduleData.weeklyDuration,
      monthlyDay: scheduleData.monthlyDay,
      monthlyTime: scheduleData.monthlyTime,
      monthlyDuration: scheduleData.monthlyDuration,
      smartIntervalMode: smartIntervalModeSelect.value,
      minInterval: smartSettings.minInterval,
      maxInterval: smartSettings.maxInterval
    });

    // 根据启动方式执行相应操作
    if (startMode === 'immediate' || startMode === 'both') {
      // 立即启动
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('weread.qq.com')) {
          // 合并智能翻页设置和阅读计划
          const combinedData = {
            ...scheduleData,
            smartSettings: smartSettings
          };
          
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'startAutoReading',
            schedule: combinedData
          }, function(response) {
            if (response && response.success) {
              updateStatus(true);
              chrome.storage.local.set({autoReading: true});
            }
          });
        } else {
          alert('请在微信读书页面使用此功能');
        }
      });
    } else {
      // 仅保存定时设置，不立即启动
      alert('定时设置已保存，将在设定时间自动启动');
      updateStatus(false);
      chrome.storage.local.set({autoReading: false});
    }
  });

  stopBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('weread.qq.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'stopAutoReading'
        }, function(response) {
          if (response && response.success) {
            updateStatus(false);
            chrome.storage.local.set({autoReading: false});
          }
        });
      }
    });
  });

  saveScheduleBtn.addEventListener('click', function() {
    const interval = parseFloat(intervalInput.value);
    const scheduleType = scheduleTypeSelect.value;
    
    if (interval < 0.5) {
      alert('翻页间隔不能小于0.5秒');
      return;
    }

    let scheduleData = {
      type: scheduleType,
      interval: interval
    };

    // 根据定时类型收集数据
    switch (scheduleType) {
      case 'duration':
        scheduleData.duration = parseInt(durationSelect.value);
        break;
      case 'daily':
        scheduleData.dailyTime = document.getElementById('dailyTime').value;
        scheduleData.dailyDuration = parseInt(document.getElementById('dailyDuration').value);
        break;
      case 'weekly':
        scheduleData.weeklyDay = parseInt(document.getElementById('weeklyDay').value);
        scheduleData.weeklyTime = document.getElementById('weeklyTime').value;
        scheduleData.weeklyDuration = parseInt(document.getElementById('weeklyDuration').value);
        break;
      case 'monthly':
        scheduleData.monthlyDay = parseInt(document.getElementById('monthlyDay').value);
        scheduleData.monthlyTime = document.getElementById('monthlyTime').value;
        scheduleData.monthlyDuration = parseInt(document.getElementById('monthlyDuration').value);
        break;
    }

    // 保存设置
    const smartSettings = {
      enabled: smartIntervalModeSelect.value !== 'fixed',
      mode: smartIntervalModeSelect.value,
      baseInterval: interval,
      minInterval: parseFloat(minIntervalInput.value),
      maxInterval: parseFloat(maxIntervalInput.value)
    };

    chrome.storage.local.set({
      interval: interval,
      startMode: 'scheduled',
      scheduleType: scheduleType,
      duration: scheduleData.duration,
      dailyTime: scheduleData.dailyTime,
      dailyDuration: scheduleData.dailyDuration,
      weeklyDay: scheduleData.weeklyDay,
      weeklyTime: scheduleData.weeklyTime,
      weeklyDuration: scheduleData.weeklyDuration,
      monthlyDay: scheduleData.monthlyDay,
      monthlyTime: scheduleData.monthlyTime,
      monthlyDuration: scheduleData.monthlyDuration,
      smartIntervalMode: smartIntervalModeSelect.value,
      minInterval: smartSettings.minInterval,
      maxInterval: smartSettings.maxInterval
    });

    alert('定时设置已保存，将在设定时间自动启动');
  });

  function showScheduleGroup(type) {
    // 隐藏所有组
    durationGroup.style.display = 'none';
    dailyGroup.style.display = 'none';
    weeklyGroup.style.display = 'none';
    monthlyGroup.style.display = 'none';

    // 显示选中的组
    switch (type) {
      case 'duration':
        durationGroup.style.display = 'flex';
        break;
      case 'daily':
        dailyGroup.style.display = 'flex';
        break;
      case 'weekly':
        weeklyGroup.style.display = 'flex';
        break;
      case 'monthly':
        monthlyGroup.style.display = 'flex';
        break;
    }
  }

  function updateStartModeUI(mode) {
    switch (mode) {
      case 'immediate':
        startBtn.textContent = '开始自动阅读';
        saveScheduleBtn.style.display = 'none';
        break;
      case 'scheduled':
        startBtn.textContent = '开始自动阅读';
        saveScheduleBtn.style.display = 'block';
        break;
      case 'both':
        startBtn.textContent = '立即开始并设置定时';
        saveScheduleBtn.style.display = 'none';
        break;
    }
  }

  function toggleSmartIntervalSettings(mode) {
    if (mode === 'fixed') {
      smartIntervalSettings.style.display = 'none';
    } else {
      smartIntervalSettings.style.display = 'block';
    }
  }

  function updateStatus(isRunning) {
    if (isRunning) {
      statusDiv.textContent = '自动阅读中...';
      statusDiv.className = 'status running';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusDiv.textContent = '已停止';
      statusDiv.className = 'status stopped';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  // 初始化按钮状态和显示
  updateStatus(false);
  updateStartModeUI(startModeSelect.value);
  showScheduleGroup(scheduleTypeSelect.value);
  toggleSmartIntervalSettings(smartIntervalModeSelect.value);
});