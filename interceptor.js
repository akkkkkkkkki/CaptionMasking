// ============================================
// Vocab Hunter - 主世界拦截器
// 运行在 MAIN world，绕过 CSP 限制
// 自动拦截字幕请求，不影响视频播放
// ============================================

console.log("🎯 [Step 2] 主世界拦截器开始执行");

// 保存原始函数
const _fetch = window.fetch;
const _open = XMLHttpRequest.prototype.open;
const _send = XMLHttpRequest.prototype.send;

console.log("🔧 [Step 3] 开始劫持 fetch...");

// 劫持 fetch
window.fetch = function(...args) {
  const url = args[0];

  // 检查是否是字幕请求（更精确的匹配）
  const isSubtitleRequest = url && typeof url === 'string' &&
    (url.includes('/api/timedtext') || url.includes('&kind=asr'));

  if (isSubtitleRequest) {
    console.log("🔍 [拦截] 字幕请求:", url);

    return _fetch.apply(this, args).then(response => {
      // 确保响应成功
      if (response.ok) {
        console.log("✨ [命中] 字幕请求！");
        // 异步处理，不阻塞主流程
        const cloned = response.clone();
        cloned.text().then(data => {
          console.log("📦 [数据] 长度:", data.length);
          window.postMessage({ type: 'SUB_DATA', data: data }, '*');
        }).catch(err => {
          console.warn("⚠️ [警告] 字幕数据读取失败:", err);
        });
      }
      return response;
    }).catch(err => {
      console.error("❌ [错误] 字幕请求失败:", err);
      throw err;
    });
  }

  // 其他请求���接透传
  return _fetch.apply(this, args);
};

console.log("🔧 [Step 4] 开始劫持 XMLHttpRequest...");

// 劫持 XHR
XMLHttpRequest.prototype.open = function(...args) {
  this._url = args[1];
  return _open.apply(this, args);
};

XMLHttpRequest.prototype.send = function(...args) {
  const url = this._url;
  const isSubtitleRequest = url && typeof url === 'string' &&
    (url.includes('/api/timedtext') || url.includes('&kind=asr'));

  if (isSubtitleRequest) {
    console.log("🔍 [拦截] XHR 字幕请求:", url);
    this.addEventListener('load', function() {
      if (this.status === 200 && this.responseText) {
        console.log("✨ [命中] 字幕请求（XHR）！");
        console.log("📦 [数据] 长度:", this.responseText.length);
        window.postMessage({ type: 'SUB_DATA', data: this.responseText }, '*');
      }
    });
  }

  return _send.apply(this, args);
};

console.log("✅ [Step 5] 拦截器安装完成");
