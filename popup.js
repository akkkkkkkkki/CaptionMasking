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
            list.innerText = "⚠️ 提取失败。请确认已开启视频字幕 [CC] 并刷新页面。";
        }
    });
});