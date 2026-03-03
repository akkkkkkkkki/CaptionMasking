// 初始化状态 - 从页面获取真实状态
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "GET_INTERCEPTOR_STATUS" }, (res) => {
            if (res && res.enabled !== undefined) {
                updateUI(res.enabled);
                chrome.storage.local.set({ interceptorEnabled: res.enabled });
            } else {
                // 如果获取失败，从 storage 读取
                chrome.storage.local.get(['interceptorEnabled'], (result) => {
                    updateUI(result.interceptorEnabled || false);
                });
            }
        });
    }
});

// 切换拦截器
document.getElementById('btn-toggle').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_INTERCEPTOR" }, (res) => {
        if (res && res.enabled !== undefined) {
            chrome.storage.local.set({ interceptorEnabled: res.enabled });
            updateUI(res.enabled);
        }
    });
});

function updateUI(enabled) {
    const btn = document.getElementById('btn-toggle');
    const status = document.getElementById('status');
    if (enabled) {
        btn.style.background = '#dc3545';
        status.textContent = '开启';
    } else {
        btn.style.background = '#28a745';
        status.textContent = '关闭';
    }
}

document.getElementById('btn-mask').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_MASK" });
});

document.getElementById('btn-scan').addEventListener('click', async () => {
    const list = document.getElementById('word-list');
    list.innerText = "⏳ 扫描中...";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: "SCAN_FULL" }, (res) => {
        if (res && res.data) {
            list.innerHTML = `<strong>发现 ${res.data.length} 个单词：</strong><br><br>${res.data.join(', ')}`;
        } else {
            list.innerText = "⚠️ 提取失败。请确认：\n1. 已打开拦截器\n2. 已开启视频字幕 [CC]\n3. 已刷新页面";
        }
    });
});