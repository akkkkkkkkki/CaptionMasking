document.getElementById('btn-mask').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_MASK" });
});

let lastWords = null;

document.getElementById('btn-scan').addEventListener('click', async () => {
    const list = document.getElementById('word-list');
    list.innerText = "⏳ 扫描中...";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: "SCAN_FULL" }, (res) => {
        if (res && res.data) {
            lastWords = res.data;
            list.innerHTML = `<strong>✅ 发现 ${res.data.length} 个单词</strong><br><br>点击下方"打开词表"查看详情`;
            document.getElementById('btn-open-list').style.display = 'block';
        } else {
            list.innerText = "⚠️ 提取失败。请确认已开启视频字幕 [CC] 并刷新页面。";
            document.getElementById('btn-open-list').style.display = 'none';
        }
    });
});

document.getElementById('btn-open-list').addEventListener('click', () => {
    if (lastWords && lastWords.length > 0) {
        const wordsParam = encodeURIComponent(JSON.stringify(lastWords));
        const url = chrome.runtime.getURL(`wordlist.html?words=${wordsParam}`);
        chrome.tabs.create({ url: url });
    }
});