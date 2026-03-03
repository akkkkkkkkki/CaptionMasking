// ============================================
// Vocab Hunter - Word List Manager
// ============================================

// 默认设置
const DEFAULT_SETTINGS = {
  familiarThreshold: 3,
  dictionary: 'oxford',
  hideMatched: true
};

// 词典 URL 模板
const DICTIONARY_URLS = {
  cambridge: 'https://dictionary.cambridge.org/dictionary/english/',
  oxford: 'https://www.oxfordlearnersdictionaries.com/definition/english/',
  merriam: 'https://www.merriam-webster.com/dictionary/',
  youdao: 'https://dict.youdao.com/search?q=',
  google: 'https://translate.google.com/?sl=en&tl=zh-CN&text='
};

// 全局状态
let settings = { ...DEFAULT_SETTINGS };
let userVocab = {};
let currentFilter = 'all';
let currentWords = [];
let isShuffled = false;

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  await loadWordsFromURL();
  updateStats();
  renderWordList();
  bindEvents();
});

// ============================================
// 数据加载
// ============================================

async function loadData() {
  const data = await chrome.storage.local.get(['settings', 'userVocab']);
  settings = data.settings || { ...DEFAULT_SETTINGS };
  userVocab = data.userVocab || {};

  // 更新设置 UI
  document.getElementById('threshold-slider').value = settings.familiarThreshold;
  document.getElementById('threshold-value').textContent = settings.familiarThreshold;
  document.querySelector(`input[name="dictionary"][value="${settings.dictionary}"]`).checked = true;
}

async function saveData() {
  await chrome.storage.local.set({
    settings: settings,
    userVocab: userVocab
  });
}

// 从 URL 参数加载单词列表
async function loadWordsFromURL() {
  const params = new URLSearchParams(window.location.search);
  const wordsParam = params.get('words');

  if (wordsParam) {
    try {
      currentWords = JSON.parse(decodeURIComponent(wordsParam));

      // 更新 userVocab，添加新词
      const today = new Date().toISOString().split('T')[0];
      currentWords.forEach(word => {
        if (!userVocab[word]) {
          userVocab[word] = {
            status: 'new',
            familiarCount: 0,
            firstSeen: today,
            lastSeen: today,
            masteredAt: null
          };
        } else {
          userVocab[word].lastSeen = today;
        }
      });

      await saveData();
    } catch (e) {
      console.error('Failed to parse words:', e);
    }
  } else {
    // 如果没有 URL 参数，显示所有已保存的单词
    currentWords = Object.keys(userVocab);
  }
}

// ============================================
// 渲染
// ============================================

function updateStats() {
  const total = currentWords.length;
  const newCount = currentWords.filter(w => userVocab[w]?.status === 'new').length;
  const masteredCount = currentWords.filter(w => userVocab[w]?.status === 'mastered').length;

  document.getElementById('total-count').textContent = `${total} words`;
  document.getElementById('new-count').textContent = `${newCount} new`;
  document.getElementById('mastered-count').textContent = `${masteredCount} mastered`;
}

function renderWordList() {
  const container = document.getElementById('word-list');
  const searchTerm = document.getElementById('search-input').value.toLowerCase();

  // 过滤单词
  let filteredWords = currentWords.filter(word => {
    const vocab = userVocab[word];
    if (!vocab) return false;

    // 搜索过滤
    if (searchTerm && !word.toLowerCase().includes(searchTerm)) {
      return false;
    }

    // 状态过滤
    if (currentFilter === 'all') return true;
    if (currentFilter === 'new') return vocab.status === 'new';
    if (currentFilter === 'familiar') return vocab.status === 'familiar';
    if (currentFilter === 'mastered') return vocab.status === 'mastered';

    return true;
  });

  // 如果设置了隐藏已掌握的词
  if (settings.hideMatched && currentFilter === 'all') {
    filteredWords = filteredWords.filter(word => userVocab[word].status !== 'mastered');
  }

  // 排序
  if (isShuffled) {
    // 打乱顺序（使用 Fisher-Yates 算法）
    for (let i = filteredWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredWords[i], filteredWords[j]] = [filteredWords[j], filteredWords[i]];
    }
  } else {
    // 按状态和字母顺序排序
    filteredWords.sort((a, b) => {
      const statusOrder = { new: 0, familiar: 1, mastered: 2 };
      const orderA = statusOrder[userVocab[a].status];
      const orderB = statusOrder[userVocab[b].status];
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
  }

  // 渲染
  if (filteredWords.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <div>No words found</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredWords.map(word => {
    const vocab = userVocab[word];
    const statusIcon = getStatusIcon(vocab.status);
    const badge = getBadge(vocab);

    return `
      <div class="word-item" data-word="${word}">
        <div class="word-status">${statusIcon}</div>
        <div class="word-text">${word}</div>
        ${badge}
        <div class="word-actions">
          <button class="word-btn" data-action="familiar" data-tooltip="Mark as familiar">👁️</button>
          <button class="word-btn" data-action="master" data-tooltip="Mark as mastered">✓</button>
          <button class="word-btn-text" data-action="lookup">Look up</button>
        </div>
      </div>
    `;
  }).join('');
}

function getStatusIcon(status) {
  switch (status) {
    case 'new': return '○';
    case 'familiar': return '◐';
    case 'mastered': return '✓';
    default: return '○';
  }
}

function getBadge(vocab) {
  if (vocab.status === 'mastered') {
    return '<span class="word-badge mastered">mastered</span>';
  } else if (vocab.status === 'familiar') {
    return `<span class="word-badge familiar">👁️ ${vocab.familiarCount}</span>`;
  } else {
    return '<span class="word-badge">new</span>';
  }
}

// ============================================
// 事件处理
// ============================================

function bindEvents() {
  // 过滤按钮
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderWordList();
    });
  });

  // 打乱按钮
  document.getElementById('shuffle-btn').addEventListener('click', () => {
    isShuffled = !isShuffled;
    const btn = document.getElementById('shuffle-btn');
    if (isShuffled) {
      btn.classList.add('active');
      btn.title = 'Sort alphabetically';
    } else {
      btn.classList.remove('active');
      btn.title = 'Shuffle';
    }
    renderWordList();
  });

  // 搜索
  document.getElementById('search-input').addEventListener('input', () => {
    renderWordList();
  });

  // 单词操作
  document.getElementById('word-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.word-btn, .word-btn-text');
    if (!btn) return;

    const wordItem = btn.closest('.word-item');
    const word = wordItem.dataset.word;
    const action = btn.dataset.action;

    if (action === 'familiar') {
      await markFamiliar(word);
    } else if (action === 'master') {
      await markMastered(word, wordItem);
    } else if (action === 'lookup') {
      lookupWord(word);
    }
  });

  // 设置按钮
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('active');
  });

  document.getElementById('close-settings').addEventListener('click', () => {
    closeModal(document.getElementById('settings-modal'));
  });

  // 阈值滑块
  document.getElementById('threshold-slider').addEventListener('input', (e) => {
    document.getElementById('threshold-value').textContent = e.target.value;
  });

  // 保存设置
  document.getElementById('save-settings').addEventListener('click', async () => {
    settings.familiarThreshold = parseInt(document.getElementById('threshold-slider').value);
    settings.dictionary = document.querySelector('input[name="dictionary"]:checked').value;
    await saveData();
    closeModal(document.getElementById('settings-modal'));
    renderWordList();
  });

  // 常用词表
  document.getElementById('import-common-btn').addEventListener('click', () => {
    document.getElementById('common-words-modal').classList.add('active');
  });

  document.getElementById('close-common-words').addEventListener('click', () => {
    closeModal(document.getElementById('common-words-modal'));
  });

  document.getElementById('import-common-words').addEventListener('click', async () => {
    const level = document.querySelector('input[name="common-list"]:checked').value;
    await importCommonWords(level);
    closeModal(document.getElementById('common-words-modal'));
  });

  // 导出
  document.getElementById('export-btn').addEventListener('click', exportToCSV);

  // 导入
  document.getElementById('import-btn').addEventListener('click', importFromCSV);

  // 清空
  document.getElementById('clear-btn').addEventListener('click', clearAll);

  // ESC 键关闭 Modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(modal => {
        closeModal(modal);
      });
    }
  });

  // 点击 Modal 背景关闭
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });
}

// 关闭 Modal 动画
function closeModal(modal) {
  modal.classList.add('closing');
  setTimeout(() => {
    modal.classList.remove('active', 'closing');
  }, 300);
}

// ============================================
// 单词操作
// ============================================

async function markFamiliar(word) {
  const vocab = userVocab[word];
  vocab.familiarCount++;

  if (vocab.familiarCount >= settings.familiarThreshold) {
    vocab.status = 'mastered';
    vocab.masteredAt = new Date().toISOString().split('T')[0];

    // 庆祝动画
    const wordItem = document.querySelector(`[data-word="${word}"]`);
    wordItem.classList.add('celebrating');
    setTimeout(() => wordItem.classList.remove('celebrating'), 300);
  } else {
    vocab.status = 'familiar';
  }

  await saveData();
  updateStats();
  renderWordList();
}

async function markMastered(word, wordItem) {
  const vocab = userVocab[word];
  vocab.status = 'mastered';
  vocab.masteredAt = new Date().toISOString().split('T')[0];
  vocab.familiarCount = settings.familiarThreshold;

  await saveData();
  updateStats();

  // 如果设置了隐藏已掌握的词，播放删除动画
  if (settings.hideMatched && currentFilter === 'all') {
    wordItem.classList.add('mastering');
    setTimeout(() => {
      renderWordList();
    }, 400);
  } else {
    renderWordList();
  }
}

function lookupWord(word) {
  const baseUrl = DICTIONARY_URLS[settings.dictionary];
  const url = baseUrl + encodeURIComponent(word);
  window.open(url, '_blank');
}

// ============================================
// 导入导出
// ============================================

function exportToCSV() {
  const rows = [['Word', 'Status', 'Familiar Count', 'First Seen', 'Last Seen', 'Mastered At']];

  Object.keys(userVocab).forEach(word => {
    const vocab = userVocab[word];
    rows.push([
      word,
      vocab.status,
      vocab.familiarCount,
      vocab.firstSeen,
      vocab.lastSeen,
      vocab.masteredAt || ''
    ]);
  });

  const csv = rows.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vocab-hunter-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function importFromCSV() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = text.split('\n').slice(1); // 跳过标题行

    rows.forEach(row => {
      const [word, status, familiarCount, firstSeen, lastSeen, masteredAt] = row.split(',');
      if (word && word.trim()) {
        userVocab[word.trim()] = {
          status: status || 'new',
          familiarCount: parseInt(familiarCount) || 0,
          firstSeen: firstSeen || new Date().toISOString().split('T')[0],
          lastSeen: lastSeen || new Date().toISOString().split('T')[0],
          masteredAt: masteredAt || null
        };
      }
    });

    await saveData();
    currentWords = Object.keys(userVocab);
    updateStats();
    renderWordList();
  };

  input.click();
}

async function clearAll() {
  if (!confirm('Are you sure you want to clear all vocabulary data? This cannot be undone.')) {
    return;
  }

  userVocab = {};
  currentWords = [];
  await saveData();
  updateStats();
  renderWordList();
}

// ============================================
// 常用词表导入
// ============================================

// 最常用的 5000 个英语单词（简化版，实际应该从文件加载）
const COMMON_WORDS = {
  1000: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having', 'may', 'should', 'does', 'being', 'might', 'must', 'shall', 'can', 'could', 'would', 'will', 'am', 'going', 'made', 'doing', 'makes', 'says', 'goes', 'came', 'took', 'seen', 'knew', 'got', 'given', 'thought', 'looked', 'wanted', 'used', 'found', 'told', 'asked', 'seemed', 'felt', 'kept', 'left', 'put', 'mean', 'keep', 'let', 'begin', 'seem', 'help', 'talk', 'turn', 'start', 'show', 'hear', 'play', 'run', 'move', 'live', 'believe', 'hold', 'bring', 'happen', 'write', 'provide', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue', 'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop', 'create', 'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk', 'win', 'offer', 'remember', 'love', 'consider', 'appear', 'buy', 'wait', 'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach', 'kill', 'remain', 'suggest', 'raise', 'pass', 'sell', 'require', 'report', 'decide', 'pull', 'man', 'woman', 'child', 'person', 'life', 'world', 'school', 'state', 'family', 'student', 'group', 'country', 'problem', 'hand', 'part', 'place', 'case', 'week', 'company', 'system', 'program', 'question', 'work', 'government', 'number', 'night', 'point', 'home', 'water', 'room', 'mother', 'area', 'money', 'story', 'fact', 'month', 'lot', 'right', 'study', 'book', 'eye', 'job', 'word', 'business', 'issue', 'side', 'kind', 'head', 'house', 'service', 'friend', 'father', 'power', 'hour', 'game', 'line', 'end', 'member', 'law', 'car', 'city', 'community', 'name', 'president', 'team', 'minute', 'idea', 'kid', 'body', 'information', 'back', 'parent', 'face', 'others', 'level', 'office', 'door', 'health', 'person', 'art', 'war', 'history', 'party', 'result', 'change', 'morning', 'reason', 'research', 'girl', 'guy', 'moment', 'air', 'teacher', 'force', 'education', 'foot', 'boy', 'age', 'policy', 'process', 'music', 'market', 'sense', 'nation', 'plan', 'college', 'interest', 'death', 'experience', 'effect', 'use', 'class', 'control', 'care', 'field', 'development', 'role', 'student', 'value', 'action', 'model', 'season', 'society', 'tax', 'director', 'position', 'player', 'agree', 'record', 'paper', 'space', 'ground', 'form', 'support', 'event', 'official', 'whose', 'matter', 'center', 'couple', 'site', 'project', 'activity', 'star', 'table', 'need', 'court', 'produce', 'eat', 'american', 'teach', 'oil', 'half', 'situation', 'easy', 'cost', 'industry', 'figure', 'street', 'image', 'itself', 'phone', 'either', 'data', 'cover', 'quite', 'picture', 'clear', 'practice', 'piece', 'land', 'recent', 'describe', 'product', 'doctor', 'wall', 'patient', 'worker', 'news', 'test', 'movie', 'certain', 'north', 'love', 'personal', 'open', 'support', 'simply', 'third', 'technology', 'catch', 'step', 'baby', 'computer', 'type', 'attention', 'draw', 'film', 'republican', 'tree', 'source', 'red', 'nearly', 'organization', 'choose', 'cause', 'hair', 'look', 'point', 'century', 'evidence', 'window', 'difficult', 'listen', 'soon', 'culture', 'billion', 'chance', 'brother', 'energy', 'period', 'course', 'summer', 'less', 'realize', 'hundred', 'available', 'plant', 'likely', 'opportunity', 'term', 'short', 'letter', 'condition', 'choice', 'place', 'single', 'rule', 'daughter', 'administration', 'south', 'husband', 'congress', 'floor', 'campaign', 'material', 'population', 'well', 'call', 'economy', 'medical', 'hospital', 'church', 'close', 'thousand', 'risk', 'current', 'fire', 'future', 'wrong', 'involve', 'defense', 'anyone', 'increase', 'security', 'bank', 'myself', 'certainly', 'west', 'sport', 'board', 'seek', 'per', 'subject', 'officer', 'private', 'rest', 'behavior', 'deal', 'performance', 'fight', 'throw', 'top', 'quickly', 'past', 'goal', 'second', 'bed', 'order', 'author', 'fill', 'represent', 'focus', 'foreign', 'drop', 'plan', 'blood', 'upon', 'agency', 'push', 'nature', 'color', 'no', 'recently', 'store', 'reduce', 'sound', 'note', 'fine', 'before', 'near', 'movement', 'page', 'enter', 'share', 'than', 'common', 'poor', 'other', 'natural', 'race', 'concern', 'series', 'significant', 'similar', 'hot', 'language', 'each', 'usually', 'response', 'dead', 'rise', 'animal', 'factor', 'decade', 'article', 'shoot', 'east', 'save', 'seven', 'artist', 'away', 'scene', 'stock', 'career', 'despite', 'central', 'eight', 'thus', 'treatment', 'beyond', 'happy', 'exactly', 'protect', 'approach', 'lie', 'size', 'dog', 'fund', 'serious', 'occur', 'media', 'ready', 'sign', 'thought', 'list', 'individual', 'simple', 'quality', 'pressure', 'accept', 'answer', 'hard', 'resource', 'identify', 'left', 'meeting', 'determine', 'prepare', 'disease', 'whatever', 'success', 'argue', 'cup', 'particularly', 'amount', 'ability', 'staff', 'recognize', 'indicate', 'character', 'growth', 'loss', 'degree', 'wonder', 'attack', 'herself', 'region', 'television', 'box', 'tv', 'training', 'pretty', 'trade', 'deal', 'election', 'everybody', 'physical', 'lay', 'general', 'feeling', 'standard', 'bill', 'message', 'fail', 'outside', 'arrive', 'analysis', 'benefit', 'name', 'sex', 'forward', 'lawyer', 'present', 'section', 'environmental', 'glass', 'answer', 'skill', 'sister', 'pm', 'professor', 'operation', 'financial', 'crime', 'stage', 'ok', 'compare', 'authority', 'miss', 'design', 'sort', 'one', 'act', 'ten', 'knowledge', 'gun', 'station', 'blue', 'state', 'strategy', 'little', 'clearly', 'discuss', 'indeed', 'force', 'truth', 'song', 'example', 'democratic', 'check', 'environment', 'leg', 'dark', 'public', 'various', 'rather', 'laugh', 'guess', 'executive', 'set', 'study', 'prove', 'hang', 'entire', 'rock', 'design', 'enough', 'forget', 'since', 'claim', 'note', 'remove', 'manager', 'help', 'close', 'sound', 'enjoy', 'network', 'legal', 'religious', 'cold', 'form', 'final', 'main', 'science', 'green', 'memory', 'card', 'above', 'seat', 'cell', 'establish', 'nice', 'trial', 'expert', 'that', 'spring', 'firm', 'democrat', 'radio', 'visit', 'management', 'care', 'avoid', 'imagine', 'tonight', 'huge', 'ball', 'no', 'close', 'finish', 'yourself', 'talk', 'theory', 'impact', 'respond', 'statement', 'maintain', 'charge', 'popular', 'traditional', 'onto', 'reveal', 'direction', 'weapon', 'employee', 'cultural', 'contain', 'peace', 'head', 'control', 'base', 'pain', 'apply', 'play', 'measure', 'wide', 'shake', 'fly', 'interview', 'manage', 'chair', 'fish', 'particular', 'camera', 'structure', 'politics', 'perform', 'bit', 'weight', 'suddenly', 'discover', 'candidate', 'top', 'production', 'treat', 'trip', 'evening', 'affect', 'inside', 'conference', 'unit', 'best', 'style', 'adult', 'worry', 'range', 'mention', 'rather', 'deep', 'past', 'edge', 'specific', 'writer', 'trouble', 'necessary', 'throughout', 'challenge', 'fear', 'shoulder', 'institution', 'middle', 'sea', 'dream', 'bar', 'beautiful', 'property', 'instead', 'improve', 'stuff', 'claim'],
  3000: [], // 将在运行时填充
  5000: []  // 将在运行时填充
};

// 生成 3000 和 5000 词表（这里简化处理，实际应该从完整词表文件加载）
COMMON_WORDS[3000] = [...COMMON_WORDS[1000]];
COMMON_WORDS[5000] = [...COMMON_WORDS[1000]];

async function importCommonWords(level) {
  const words = COMMON_WORDS[level];
  const today = new Date().toISOString().split('T')[0];

  words.forEach(word => {
    if (!userVocab[word]) {
      userVocab[word] = {
        status: 'mastered',
        familiarCount: settings.familiarThreshold,
        firstSeen: today,
        lastSeen: today,
        masteredAt: today
      };
    } else if (userVocab[word].status !== 'mastered') {
      userVocab[word].status = 'mastered';
      userVocab[word].familiarCount = settings.familiarThreshold;
      userVocab[word].masteredAt = today;
    }
  });

  await saveData();

  // 如果当前没有词表，加载所有已保存的词
  if (currentWords.length === 0) {
    currentWords = Object.keys(userVocab);
  }

  updateStats();
  renderWordList();

  alert(`Successfully imported ${words.length} common words as mastered!`);
}
