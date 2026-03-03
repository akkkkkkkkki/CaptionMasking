// ============================================
// Vocab Hunter - 主世界拦截器
// 运行在 MAIN world，绕过 CSP 限制
// 可动态开关，避免干扰视频播放
// ============================================

console.log("��� [Step 2] 主世界拦截器开始执行");

// 保存原始函数
const _fetch = window.fetch;
const _open = XMLHttpRequest.prototype.open;
const _send = XMLHttpRequest.prototype.send;

// 拦截器开关状态 - 从 localStorage 读取
let interceptorEnabled = localStorage.getItem('vocabHunterInterceptor') === 'true';
console.log("📌 [初始状态] 拦截器:", interceptorEnabled ? "开启" : "关闭");

console.log("🔧 [Step 3] 开始劫持 fetch...");

// 劫持 fetch
window.fetch = function(...args) {
  const url = args[0];

  // 只在开启时拦截字幕请求
  if (interceptorEnabled && url && (url.includes('timedtext') || url.includes('caption'))) {
    console.log("🔍 [拦截] 字幕请求:", url);

    return _fetch.apply(this, args).then(response => {
      console.log("✨ [命中] 字幕请求！");
      response.clone().text().then(data => {
        console.log("📦 [数据] 长度:", data.length);
        window.postMessage({ type: 'SUB_DATA', data: data }, '*');
      });
      return response;
    });
  }

  // 其他请求或关闭时直接透传
  return _fetch.apply(this, args);
};

console.log("🔧 [Step 4] 开始劫持 XMLHttpRequest...");

// 劫持 XHR
XMLHttpRequest.prototype.open = function(...args) {
  this._url = args[1];
  // 只在开启时记录字幕相关的请求
  if (interceptorEnabled && this._url && (this._url.includes('timedtext') || this._url.includes('caption'))) {
    console.log("🔍 [拦截] XHR 字幕请求:", this._url);
  }
  return _open.apply(this, args);
};

XMLHttpRequest.prototype.send = function(...args) {
  this.addEventListener('load', function() {
    if (interceptorEnabled && this._url && (this._url.includes('timedtext') || this._url.includes('caption'))) {
      console.log("✨ [命中] 字幕请求（XHR）！");
      console.log("📦 [数据] 长度:", this.responseText.length);
      window.postMessage({ type: 'SUB_DATA', data: this.responseText }, '*');
    }
  });
  return _send.apply(this, args);
};

// 监听开关命令
window.addEventListener('message', (event) => {
  if (event.source === window && event.data.type === 'TOGGLE_INTERCEPTOR') {
    interceptorEnabled = !interceptorEnabled;
    localStorage.setItem('vocabHunterInterceptor', interceptorEnabled);
    console.log(interceptorEnabled ? "🟢 [拦截器] 已开启" : "🔴 [拦截器] 已关闭");
    window.postMessage({ type: 'INTERCEPTOR_STATUS', enabled: interceptorEnabled }, '*');
  }
  else if (event.source === window && event.data.type === 'GET_INTERCEPTOR_STATUS') {
    window.postMessage({ type: 'INTERCEPTOR_STATUS', enabled: interceptorEnabled }, '*');
  }
});

// 页面加载时通知 content script 当前状态
window.postMessage({ type: 'INTERCEPTOR_INIT', enabled: interceptorEnabled }, '*');

console.log("✅ [Step 5] 拦截器安装完成");
