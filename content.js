// ============================================
// Vocab Hunter - Content Script
// 接收来自主世界（interceptor.js）的字幕数据
// ============================================

console.log("🚀 [Step 1] Content script 开始执行");

// 接收来自主世界的消息
let lastData = null;
window.addEventListener('message', (event) => {
  if (event.source === window && event.data.type === 'SUB_DATA') {
    lastData = event.data.data;
    console.log("💾 [Step 6] 字幕数据已缓存，长度:", lastData.length);
  }
});

// 响应插件命令
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("📨 [收到命令]", request.action);

  if (request.action === "TOGGLE_MASK") {
    toggleMask();
    sendResponse({ ok: true });
  }
  else if (request.action === "SCAN_FULL") {
    if (lastData) {
      console.log("🔄 [解析] 开始提取单词...");
      const words = parseSubtitles(lastData);
      console.log("✅ [完成] 提取了", words?.length || 0, "个单词");
      sendResponse({ data: words });
    } else {
      console.warn("⚠️ [警告] 尚未截获数据。请开启字幕 [CC] 并刷新页面");
      sendResponse({ data: null });
    }
  }

  return true;
});

// 解析字幕
function parseSubtitles(rawStr) {
  try {
    const json = JSON.parse(rawStr);
    const text = json.events
      .filter(e => e.segs)
      .flatMap(e => e.segs)
      .map(s => s.utf8)
      .join(' ');
    const words = [...new Set(text.toLowerCase().match(/[a-z']{4,}/g))].sort();
    return words;
  } catch (e) {
    console.error("❌ [解析失败]", e);
    return null;
  }
}

// 遮罩功能
function toggleMask() {
  let style = document.getElementById('v-mask');
  if (style) {
    style.remove();
    console.log("🔓 [遮罩] 已关闭");
  } else {
    style = document.createElement('style');
    style.id = 'v-mask';
    style.textContent = `
      .ytp-caption-segment {
        background: #1a1a1a !important;
        color: #1a1a1a !important;
        transition: 0.2s;
      }
      .ytp-caption-segment:hover {
        color: white !important;
      }
    `;
    document.head.appendChild(style);
    console.log("🔒 [遮罩] 已开启");
  }
}

console.log("✅ [Step 7] Content script 加载完成");
