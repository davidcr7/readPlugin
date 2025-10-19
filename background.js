// 后台脚本，处理插件的生命周期和跨标签页通信
chrome.runtime.onInstalled.addListener(() => {
  console.log('微信读书自动阅读器已安装');
  
  // 设置默认配置
  chrome.storage.local.set({
    interval: 1,
    duration: 0,
    startMode: 'immediate',
    autoReading: false,
    smartIntervalMode: 'fixed',
    minInterval: 0.5,
    maxInterval: 10
  });
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('weread.qq.com')) {
    // 页面加载完成，可以注入内容脚本
    console.log('微信读书页面已加载');
  }
});

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // 如果微信读书页面关闭，停止自动阅读
  chrome.storage.local.set({autoReading: false});
});