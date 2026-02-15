/* ============================================
   オリジナルURL作成ツール - Application Logic
   Pure vanilla JS, no dependencies required
   ============================================ */

// === State ===
const state = {
  mode: 'url',       // 'url' or 'pdf'
  selectedFile: null, // File object for PDF
  isLoading: false,
};

// === Initialization ===
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupDropZone();
  setupFileInput();
  updateSlugPrefix();
  loadHistory();
  validateConnection();

  loadHistory();
  validateConnection();
});

// === Settings Management ===
function loadSettings() {
  const fields = ['github-token', 'github-username', 'github-repo', 'custom-domain'];
  fields.forEach(id => {
    const value = localStorage.getItem(`urlshort_${id}`);
    if (value) document.getElementById(id).value = value;
  });
}

function saveSettings() {
  const fields = ['github-token', 'github-username', 'github-repo', 'custom-domain'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) localStorage.setItem(`urlshort_${id}`, el.value.trim());
  });
}

// Auto-save on input (モーダル内のフィールド)
['github-token', 'github-username', 'github-repo', 'custom-domain'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    saveSettings();
    updateSlugPrefix();
  });
});

// === Settings Modal ===
function openSettingsModal() {
  document.getElementById('settings-modal').classList.add('visible');
}

function closeSettingsModal(event) {
  // event引数がある場合はオーバーレイクリック
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('settings-modal').classList.remove('visible');
}

function saveAndClose() {
  saveSettings();
  validateConnection();
  updateSlugPrefix();
  loadHistory();
  closeSettingsModal();
  const s = getSettings();
  if (s.token && s.username && s.repo) {
    showStatus('GitHub設定を保存しました ✅', 'success');
  }
}

function getSettings() {
  return {
    token: document.getElementById('github-token').value.trim(),
    username: document.getElementById('github-username').value.trim(),
    repo: document.getElementById('github-repo').value.trim(),
    customDomain: document.getElementById('custom-domain').value.trim(),
  };
}

function getBaseUrl() {
  const s = getSettings();
  if (s.customDomain) {
    return `https://${s.customDomain}`;
  }
  return `https://${s.username}.github.io/${s.repo}`;
}

function updateSlugPrefix() {
  const prefix = document.getElementById('slug-prefix');
  if (prefix) {
    const baseUrl = getBaseUrl();
    prefix.textContent = baseUrl.replace('https://', '') + '/';
  }
}

async function validateConnection() {
  const s = getSettings();
  const statusEl = document.getElementById('connection-status');
  const textEl = document.getElementById('connection-text');

  if (!s.token || !s.username || !s.repo) {
    statusEl.classList.remove('connected');
    textEl.textContent = '未接続';
    return false;
  }

  try {
    // ユーザー情報の取得（トークンのスコープ確認のためではなく、接続確認として）
    const res = await fetch(`https://api.github.com/repos/${s.username}/${s.repo}`, {
      headers: {
        'Authorization': `Bearer ${s.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (res.ok) {
      const data = await res.json();

      // 権限チェック: push（書き込み）権限があるか確認
      if (data.permissions && (data.permissions.push || data.permissions.admin)) {
        statusEl.classList.add('connected');
        textEl.textContent = '接続OK';
        return true;
      } else {
        statusEl.classList.remove('connected');
        textEl.textContent = '権限不足';
        showStatus('接続できましたが、書き込み権限がありません。トークンの「repo」スコープを確認してください。', 'error');
        return false;
      }
    } else {
      statusEl.classList.remove('connected');
      if (res.status === 404) {
        textEl.textContent = 'リポジトリ不明';
        showStatus('リポジトリが見つかりません。ユーザー名とリポジトリ名を確認してください。', 'error');
      } else if (res.status === 401) {
        textEl.textContent = '認証エラー';
        showStatus('トークンが無効です。再度入力してください。', 'error');
      } else {
        textEl.textContent = `エラー: ${res.status}`;
      }
      return false;
    }
  } catch (e) {
    statusEl.classList.remove('connected');
    textEl.textContent = '通信エラー';
    console.error(e);
    return false;
  }
}

// === Token Visibility Toggle ===
function toggleTokenVisibility() {
  const input = document.getElementById('github-token');
  const btn = document.getElementById('token-toggle');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

// === Card Toggle ===
function toggleCard(name) {
  const body = document.getElementById(`${name}-body`);
  const toggle = document.getElementById(`${name}-toggle`);
  body.classList.toggle('collapsed');
  toggle.classList.toggle('collapsed');
}

// === Mode Switching ===
function setMode(mode) {
  state.mode = mode;

  document.getElementById('mode-url').classList.toggle('active', mode === 'url');
  document.getElementById('mode-pdf').classList.toggle('active', mode === 'pdf');
  document.getElementById('url-section').style.display = mode === 'url' ? 'block' : 'none';
  document.getElementById('pdf-section').style.display = mode === 'pdf' ? 'block' : 'none';
}

// === URL Input ===
function clearUrlInput() {
  document.getElementById('target-url').value = '';
}

// === File Drop Zone ===
function setupDropZone() {
  const zone = document.getElementById('drop-zone');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      selectFile(files[0]);
    } else {
      showStatus('PDFファイルのみアップロードできます。', 'error');
    }
  });
}

function setupFileInput() {
  document.getElementById('file-input').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectFile(e.target.files[0]);
    }
  });
}

function selectFile(file) {
  if (file.size > 25 * 1024 * 1024) {
    showStatus('ファイルサイズが25MBを超えています。', 'error');
    return;
  }

  state.selectedFile = file;
  document.getElementById('drop-zone').style.display = 'none';
  document.getElementById('file-info-zone').style.display = 'block';
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = formatFileSize(file.size);
}

function removeFile() {
  state.selectedFile = null;
  document.getElementById('drop-zone').style.display = 'block';
  document.getElementById('file-info-zone').style.display = 'none';
  document.getElementById('file-input').value = '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// === Slug Management ===
function validateSlug(input) {
  const clean = input.value.replace(/[^a-zA-Z0-9_-]/g, '');
  if (input.value !== clean) {
    input.value = clean;
  }
}

function generateRandomSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 6; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById('custom-slug').value = slug;
}

// === Status Messages ===
function showStatus(message, type = 'info') {
  const el = document.getElementById('status-message');
  const icon = document.getElementById('status-icon');
  const text = document.getElementById('status-text');

  el.className = `status-message visible ${type}`;
  icon.textContent = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  text.textContent = message;

  if (type !== 'error') {
    setTimeout(() => {
      el.classList.remove('visible');
    }, 5000);
  }
}

function clearStatus() {
  document.getElementById('status-message').classList.remove('visible');
}

// === GitHub API Helpers ===
async function githubApi(endpoint, options = {}) {
  const s = getSettings();
  const url = `https://api.github.com${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${s.token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody.message || res.statusText;
    if (res.status === 404) throw new Error('Not Found');
    if (res.status === 401) throw new Error('認証失敗: トークンが無効です');
    throw new Error(`GitHub API Error: ${res.status} ${msg}`);
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// Fetch database.json (with SHA for updates)
async function fetchDatabase() {
  const s = getSettings();
  try {
    const data = await githubApi(`/repos/${s.username}/${s.repo}/contents/database.json`);
    const content = JSON.parse(atob(data.content.replace(/\n/g, '')));
    return { content, sha: data.sha };
  } catch (e) {
    if (e.message === 'Not Found') {
      // ファイルが無い場合、リポジトリ自体の存在確認
      const repoCheck = await fetch(`https://api.github.com/repos/${s.username}/${s.repo}`, {
        headers: { 'Authorization': `Bearer ${s.token}` }
      });

      if (!repoCheck.ok) {
        if (repoCheck.status === 404) throw new Error('リポジトリが見つかりません。設定を確認してください。');
        if (repoCheck.status === 401) throw new Error('トークンが無効です。');
      }

      // リポジトリはあるがファイルが無い＝初回利用
      return { content: {}, sha: null };
    }
    throw e;
  }
}

// Update database.json
async function updateDatabase(newContent, sha) {
  const s = getSettings();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(newContent, null, 2))));
  const body = {
    message: `🔗 スラッグ追加: オリジナルURL作成`,

    content: encoded,
  };
  if (sha) body.sha = sha;

  return githubApi(`/repos/${s.username}/${s.repo}/contents/database.json`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// Upload PDF to GitHub
async function uploadPdf(file, slug) {
  const s = getSettings();
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const body = {
          message: `📄 PDF追加: ${slug}`,
          content: base64,
        };

        const result = await githubApi(
          `/repos/${s.username}/${s.repo}/contents/pdfs/${slug}.pdf`,
          { method: 'PUT', body: JSON.stringify(body) }
        );
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

// Delete entry from database
async function deleteEntry(slug) {
  if (!confirm(`"${slug}" を削除しますか？\n（PDFファイルは手動で削除してください）`)) return;

  try {
    const { content, sha } = await fetchDatabase();
    if (content[slug]) {
      delete content[slug];
      await updateDatabase(content, sha);
      showStatus(`"${slug}" を削除しました`, 'success');
      loadHistory();
    }
  } catch (e) {
    showStatus(`削除エラー: ${e.message}`, 'error');
  }
}

// === Main Submit Handler ===
async function handleSubmit() {
  if (state.isLoading) return;

  clearStatus();

  // Validate settings
  const s = getSettings();
  const hasAuth = s.token && s.username && s.repo;

  // Validate input
  if (state.mode === 'url') {
    const url = document.getElementById('target-url').value.trim();
    if (!url) {
      showStatus('URLを入力してください。', 'error');
      return;
    }
    try {
      new URL(url);
    } catch {
      showStatus('有効なURLを入力してください。', 'error');
      return;
    }

    // トークンがない場合の「手動モード」
    if (!hasAuth) {
      // Get slug
      let slug = document.getElementById('custom-slug').value.trim();
      if (!slug) {
        generateRandomSlug();
        slug = document.getElementById('custom-slug').value;
      }

      const jsonEntry = `"${slug}": {\n  "target": "${url}",\n  "type": "url",\n  "created": "${new Date().toISOString()}"\n},`;

      const manualMsg = `トークン未設定のため自動保存できません。\n以下のデータを database.json に手動で追記してください：\n\n${jsonEntry}`;

      // クリップボードにコピー
      navigator.clipboard.writeText(jsonEntry).then(() => {
        alert(manualMsg + "\n\n(クリップボードにコピーしました)");
      }).catch(() => {
        alert(manualMsg);
      });
      return;
    }

  } else {
    // PDFモード
    if (!state.selectedFile) {
      showStatus('PDFファイルを選択してください。', 'error');
      return;
    }
    if (!hasAuth) {
      alert('PDFアップロードにはトークン設定が必須です。設定画面からトークンを入力してください。');
      openSettingsModal();
      return;
    }
  }

  // Get or generate slug
  let slug = document.getElementById('custom-slug').value.trim();
  if (!slug) {
    generateRandomSlug();
    slug = document.getElementById('custom-slug').value;
  }

  // Start loading
  setLoading(true);

  try {
    // Fetch current database
    showStatus('データベースを読み込み中...', 'info');
    const { content: db, sha } = await fetchDatabase();

    // Check for duplicate slug
    if (db[slug]) {
      showStatus(`"${slug}" は既に使用されています。別のIDを指定してください。`, 'error');
      setLoading(false);
      return;
    }

    let targetUrl;

    if (state.mode === 'pdf') {
      // Upload PDF
      showStatus('PDFをアップロード中...', 'info');
      await uploadPdf(state.selectedFile, slug);
      targetUrl = `https://raw.githubusercontent.com/${s.username}/${s.repo}/main/pdfs/${slug}.pdf`;
    } else {
      targetUrl = document.getElementById('target-url').value.trim();
    }

    // Update database
    showStatus('データベースを更新中...', 'info');
    db[slug] = {
      target: targetUrl,
      type: state.mode,
      created: new Date().toISOString(),
    };
    await updateDatabase(db, sha);

    // Show result
    const shortUrl = `${getBaseUrl()}/${slug}`;
    document.getElementById('result-url').textContent = shortUrl;
    document.getElementById('result-panel').classList.add('visible');
    document.getElementById('copy-btn').classList.remove('copied');
    document.getElementById('copy-btn').innerHTML = '📋 コピー';

    showStatus('オリジナルURLが正常に作成されました！', 'success');

    // Refresh history
    loadHistory();

    // Reset form
    if (state.mode === 'url') {
      document.getElementById('target-url').value = '';
    } else {
      removeFile();
    }
    document.getElementById('custom-slug').value = '';

  } catch (e) {
    showStatus(`エラー: ${e.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  state.isLoading = loading;
  const btn = document.getElementById('submit-btn');
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

// === Copy Result ===
async function copyResult() {
  const url = document.getElementById('result-url').textContent;
  try {
    await navigator.clipboard.writeText(url);
    const btn = document.getElementById('copy-btn');
    btn.classList.add('copied');
    btn.innerHTML = '✅ コピー済み';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '📋 コピー';
    }, 2000);
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = url;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// === History ===
async function loadHistory() {
  const s = getSettings();
  if (!s.token || !s.username || !s.repo) {
    return;
  }

  try {
    const { content: db } = await fetchDatabase();
    renderHistory(db);
  } catch {
    // Silently fail
  }
}

function renderHistory(db) {
  const list = document.getElementById('history-list');
  const entries = Object.entries(db).sort((a, b) => {
    return new Date(b[1].created) - new Date(a[1].created);
  });

  if (entries.length === 0) {
    list.innerHTML = '<div class="history-empty">まだ作成した短縮URLはありません</div>';
    return;
  }

  const baseUrl = getBaseUrl();

  list.innerHTML = entries.map(([slug, data]) => {
    const date = new Date(data.created);
    const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const typeBadge = data.type === 'pdf'
      ? '<span class="history-type-badge pdf">PDF</span>'
      : '<span class="history-type-badge url">URL</span>';

    return `
      <div class="history-item">
        ${typeBadge}
        <span class="history-slug" title="${baseUrl}/${slug}">${slug}</span>
        <span class="history-date">${dateStr}</span>
        <button class="history-copy-btn" onclick="copyHistoryUrl('${slug}')" title="URLをコピー">📋</button>
        <button class="history-delete-btn" onclick="deleteEntry('${slug}')" title="削除">🗑️</button>
      </div>
    `;
  }).join('');
}

async function copyHistoryUrl(slug) {
  const url = `${getBaseUrl()}/${slug}`;
  try {
    await navigator.clipboard.writeText(url);
    showStatus(`コピーしました: ${url}`, 'success');
  } catch {
    showStatus('コピーに失敗しました', 'error');
  }
}
