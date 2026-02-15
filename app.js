// ===== State =====
let selectedFile = null;
let history = JSON.parse(localStorage.getItem('urlconv_history') || '[]');

// ===== DOM Elements =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== Settings =====
function getSettings() {
  return {
    username: localStorage.getItem('gh_username') || '',
    repo: localStorage.getItem('gh_repo') || '',
    token: localStorage.getItem('gh_token') || ''
  };
}

function saveSettingsToStorage(username, repo, token) {
  localStorage.setItem('gh_username', username);
  localStorage.setItem('gh_repo', repo);
  localStorage.setItem('gh_token', token);
}

function isConfigured() {
  const s = getSettings();
  return s.username && s.repo && s.token;
}

// ===== Toast =====
function showToast(message, type = 'info') {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = '0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===== Tabs =====
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`#tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ===== Drop Zone =====
const dropZone = $('#dropZone');
const fileInput = $('#fileInput');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    handleFileSelect(file);
  } else {
    showToast('PDFファイルのみ対応しています', 'error');
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    handleFileSelect(e.target.files[0]);
  }
});

function handleFileSelect(file) {
  selectedFile = file;
  $('#fileName').textContent = file.name;
  $('#fileSize').textContent = formatSize(file.size);
  $('#fileInfo').classList.add('show');
  validatePdfForm();
}

$('#removeFile').addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  $('#fileInfo').classList.remove('show');
  validatePdfForm();
});

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ===== Form Validation =====
function validatePdfForm() {
  const slug = $('#pdfSlug').value.trim();
  $('#pdfSubmit').disabled = !(slug && selectedFile && isConfigured());
}

function validateUrlForm() {
  const slug = $('#urlSlug').value.trim();
  const url = $('#targetUrl').value.trim();
  $('#urlSubmit').disabled = !(slug && url && isConfigured());
}

$('#pdfSlug').addEventListener('input', validatePdfForm);
$('#urlSlug').addEventListener('input', validateUrlForm);
$('#targetUrl').addEventListener('input', validateUrlForm);

// ===== GitHub API =====
async function githubRequest(path, method, body) {
  const settings = getSettings();
  const url = `https://api.github.com/repos/${settings.username}/${settings.repo}/contents/${path}`;

  const headers = {
    'Authorization': `token ${settings.token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };

  // Check if file already exists (for update, to get sha)
  let sha = null;
  if (method === 'PUT') {
    try {
      const checkRes = await fetch(url, { headers });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        sha = checkData.sha;
      }
    } catch (e) {
      // File doesn't exist yet, that's fine
    }
  }

  const payload = { ...body };
  if (sha) payload.sha = sha;

  const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API エラー (${res.status})`);
  }
  return res.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Remove the data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== Generate PDF Viewer HTML =====
function generatePdfViewerHtml(pdfFileName, title) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#1a1a2e;font-family:sans-serif;display:flex;flex-direction:column;height:100vh}.toolbar{background:#16213e;padding:8px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0}.toolbar .title{color:#e8e8f0;font-size:14px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.toolbar button{background:rgba(255,255,255,0.1);border:none;color:#e8e8f0;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;transition:0.2s}.toolbar button:hover{background:rgba(255,255,255,0.2)}.toolbar .page-info{color:#8888aa;font-size:13px}.viewer{flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:16px;gap:12px}canvas{max-width:100%;box-shadow:0 4px 20px rgba(0,0,0,0.4);border-radius:4px}.loading{color:#8888aa;font-size:14px;padding:40px}</style></head><body><div class="toolbar"><span class="title">${title}</span><button id="prevBtn" onclick="changePage(-1)">◀</button><span class="page-info" id="pageInfo">-</span><button id="nextBtn" onclick="changePage(1)">▶</button><button onclick="zoomChange(-0.2)">ー</button><button onclick="zoomChange(0.2)">＋</button></div><div class="viewer" id="viewer"><div class="loading">読み込み中...</div></div><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script><script>pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';let pdfDoc=null,currentPage=1,scale=1.2;async function loadPdf(){try{pdfDoc=await pdfjsLib.getDocument('./${pdfFileName}').promise;document.getElementById('pageInfo').textContent=currentPage+'/'+pdfDoc.numPages;renderAllPages()}catch(e){document.getElementById('viewer').innerHTML='<div class="loading">PDF読み込みエラー</div>'}}async function renderAllPages(){const v=document.getElementById('viewer');v.innerHTML='';for(let i=1;i<=pdfDoc.numPages;i++){const p=await pdfDoc.getPage(i);const vp=p.getViewport({scale:scale});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;v.appendChild(c);await p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise}}function changePage(d){if(!pdfDoc)return;currentPage=Math.max(1,Math.min(pdfDoc.numPages,currentPage+d));document.getElementById('pageInfo').textContent=currentPage+'/'+pdfDoc.numPages;const canvases=document.querySelectorAll('#viewer canvas');if(canvases[currentPage-1])canvases[currentPage-1].scrollIntoView({behavior:'smooth',block:'start'})}function zoomChange(d){scale=Math.max(0.4,Math.min(3,scale+d));if(pdfDoc)renderAllPages()}loadPdf()<\/script></body></html>`;
}

// ===== Generate Redirect HTML =====
function generateRedirectHtml(targetUrl, slug) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=${targetUrl}"><title>リダイレクト中...</title><style>body{background:#1a1a2e;color:#e8e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}a{color:#a855f7}</style></head><body><p>リダイレクト中... <a href="${targetUrl}">こちらをクリック</a></p><script>window.location.href="${targetUrl}"<\/script></body></html>`;
}

// ===== PDF Submit =====
$('#pdfSubmit').addEventListener('click', async () => {
  const slug = $('#pdfSlug').value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!slug) {
    showToast('カスタムIDには英数字・ハイフン・アンダースコアのみ使えます', 'error');
    return;
  }
  if (!selectedFile) return;

  const settings = getSettings();
  const btn = $('#pdfSubmit');
  const progress = $('#pdfProgress');
  const progressFill = $('#pdfProgressFill');
  const progressText = $('#pdfProgressText');

  btn.disabled = true;
  progress.classList.add('show');

  try {
    // Step 1: Convert file to base64
    progressText.textContent = 'PDFを準備中...';
    progressFill.style.width = '20%';
    const base64Content = await fileToBase64(selectedFile);

    // Step 2: Upload PDF
    progressText.textContent = 'PDFをGitHubにアップロード中...';
    progressFill.style.width = '40%';
    const pdfFileName = `file.pdf`;
    await githubRequest(`${slug}/${pdfFileName}`, 'PUT', {
      message: `PDF追加: ${slug}`,
      content: base64Content
    });

    // Step 3: Generate and upload viewer HTML
    progressText.textContent = 'ビューアHTMLを作成・送信中...';
    progressFill.style.width = '70%';
    const viewerHtml = generatePdfViewerHtml(pdfFileName, selectedFile.name.replace('.pdf', ''));
    const viewerBase64 = btoa(unescape(encodeURIComponent(viewerHtml)));
    await githubRequest(`${slug}/index.html`, 'PUT', {
      message: `ビューア追加: ${slug}`,
      content: viewerBase64
    });

    // Step 4: Done
    progressFill.style.width = '100%';
    progressText.textContent = '完了！';

    const publicUrl = `https://${settings.username}.github.io/${settings.repo}/${slug}/`;
    $('#pdfResultUrl').value = publicUrl;
    $('#pdfResult').classList.add('show');

    addToHistory('pdf', slug, publicUrl);
    showToast('オリジナルURLを作成しました！', 'success');

  } catch (err) {
    showToast(`エラー: ${err.message}`, 'error');
  } finally {
    setTimeout(() => {
      progress.classList.remove('show');
      progressFill.style.width = '0%';
      btn.disabled = false;
      validatePdfForm();
    }, 1500);
  }
});

// ===== URL Submit =====
$('#urlSubmit').addEventListener('click', async () => {
  const slug = $('#urlSlug').value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!slug) {
    showToast('カスタムIDには英数字・ハイフン・アンダースコアのみ使えます', 'error');
    return;
  }
  const targetUrl = $('#targetUrl').value.trim();
  if (!targetUrl) return;

  const settings = getSettings();
  const btn = $('#urlSubmit');
  const progress = $('#urlProgress');
  const progressFill = $('#urlProgressFill');
  const progressText = $('#urlProgressText');

  btn.disabled = true;
  progress.classList.add('show');

  try {
    // Step 1: Generate redirect HTML
    progressText.textContent = 'リダイレクト設定を作成中...';
    progressFill.style.width = '30%';
    const redirectHtml = generateRedirectHtml(targetUrl, slug);
    const base64 = btoa(unescape(encodeURIComponent(redirectHtml)));

    // Step 2: Upload
    progressText.textContent = 'GitHubに保存中...';
    progressFill.style.width = '60%';
    await githubRequest(`${slug}/index.html`, 'PUT', {
      message: `URL追加: ${slug} → ${targetUrl}`,
      content: base64
    });

    // Step 3: Done
    progressFill.style.width = '100%';
    progressText.textContent = '完了！';

    const publicUrl = `https://${settings.username}.github.io/${settings.repo}/${slug}/`;
    $('#urlResultUrl').value = publicUrl;
    $('#urlResult').classList.add('show');

    addToHistory('url', slug, publicUrl);
    showToast('オリジナルURLを作成しました！', 'success');

  } catch (err) {
    showToast(`エラー: ${err.message}`, 'error');
  } finally {
    setTimeout(() => {
      progress.classList.remove('show');
      progressFill.style.width = '0%';
      btn.disabled = false;
      validateUrlForm();
    }, 1500);
  }
});

// ===== Copy Buttons =====
$('#pdfCopyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText($('#pdfResultUrl').value);
  showToast('URLをコピーしました', 'success');
});

$('#urlCopyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText($('#urlResultUrl').value);
  showToast('URLをコピーしました', 'success');
});

// ===== History =====
function addToHistory(type, slug, url) {
  history.unshift({
    type,
    slug,
    url,
    date: new Date().toLocaleDateString('ja-JP')
  });
  if (history.length > 50) history.pop();
  localStorage.setItem('urlconv_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = $('#historyList');
  if (history.length === 0) {
    list.innerHTML = '<div class="history-empty">まだ履歴はありません</div>';
    return;
  }
  list.innerHTML = history.map(item => `
    <div class="history-item">
      <span class="type-badge ${item.type}">${item.type === 'pdf' ? 'PDF' : 'URL'}</span>
      <span class="history-slug">${item.slug}</span>
      <span class="history-date">${item.date}</span>
      <button class="history-copy" onclick="copyHistoryUrl('${item.url}')" title="URLをコピー">📋</button>
      <button class="history-delete" onclick="deleteHistoryItem('${item.slug}', '${item.type}')" title="GitHubから削除">🗑️</button>
    </div>
  `).join('');
}

window.copyHistoryUrl = function (url) {
  navigator.clipboard.writeText(url);
  showToast('URLをコピーしました', 'success');
};

async function deleteFromGithub(path) {
  const settings = getSettings();
  const url = `https://api.github.com/repos/${settings.username}/${settings.repo}/contents/${path}`;
  const headers = {
    'Authorization': `token ${settings.token}`,
    'Accept': 'application/vnd.github.v3+json'
  };

  let sha;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return;
    const data = await res.json();
    sha = data.sha;
  } catch (e) { return; }

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Delete ${path}`,
      sha: sha
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Delete failed');
  }
}

window.deleteHistoryItem = async function (slug, type) {
  if (!confirm(`「${slug}」をGitHubから削除しますか？\nこの操作は取り消せません。`)) return;

  try {
    showToast('GitHubからデータ削除中...', 'info');

    // Delete index.html
    await deleteFromGithub(`${slug}/index.html`);

    // If PDF, delete file.pdf
    if (type === 'pdf') {
      await deleteFromGithub(`${slug}/file.pdf`);
    }

    // Remove from local history
    history = history.filter(h => h.slug !== slug);
    localStorage.setItem('urlconv_history', JSON.stringify(history));
    renderHistory();

    showToast('削除しました', 'success');

  } catch (e) {
    showToast(`削除エラー: ${e.message}`, 'error');
  }
};

// ===== Settings Modal =====
$('#settingsBtn').addEventListener('click', () => {
  const settings = getSettings();
  $('#ghUsername').value = settings.username;
  $('#ghRepo').value = settings.repo;
  $('#ghToken').value = settings.token;
  $('#connectionStatus').innerHTML = '';
  $('#settingsModal').classList.add('show');
});

$('#modalClose').addEventListener('click', () => {
  $('#settingsModal').classList.remove('show');
});

$('#settingsModal').addEventListener('click', (e) => {
  if (e.target === $('#settingsModal')) {
    $('#settingsModal').classList.remove('show');
  }
});

$('#saveSettings').addEventListener('click', () => {
  const username = $('#ghUsername').value.trim();
  const repo = $('#ghRepo').value.trim();
  const token = $('#ghToken').value.trim();

  if (!username || !repo || !token) {
    showToast('全ての項目を入力してください', 'error');
    return;
  }

  saveSettingsToStorage(username, repo, token);
  showToast('設定を保存しました', 'success');
  $('#settingsModal').classList.remove('show');

  // Re-validate forms
  validatePdfForm();
  validateUrlForm();
});

$('#testConnection').addEventListener('click', async () => {
  const username = $('#ghUsername').value.trim();
  const repo = $('#ghRepo').value.trim();
  const token = $('#ghToken').value.trim();

  if (!username || !repo || !token) {
    showToast('全ての項目を入力してください', 'error');
    return;
  }

  const statusEl = $('#connectionStatus');
  statusEl.innerHTML = '<div class="status-badge checking">⏳ 接続確認中...</div>';

  try {
    const res = await fetch(`https://api.github.com/repos/${username}/${repo}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.permissions && data.permissions.push) {
        statusEl.innerHTML = '<div class="status-badge connected">✅ 接続OK（書き込み権限あり）</div>';
      } else {
        statusEl.innerHTML = '<div class="status-badge disconnected">⚠️ 読み取り専用。repoスコープのトークンが必要です</div>';
      }
    } else if (res.status === 404) {
      statusEl.innerHTML = '<div class="status-badge disconnected">❌ リポジトリが見つかりません</div>';
    } else if (res.status === 401) {
      statusEl.innerHTML = '<div class="status-badge disconnected">❌ トークンが無効です</div>';
    } else {
      statusEl.innerHTML = `<div class="status-badge disconnected">❌ エラー (${res.status})</div>`;
    }
  } catch (err) {
    statusEl.innerHTML = '<div class="status-badge disconnected">❌ 接続できません</div>';
  }
});

// ===== Init =====
function init() {
  renderHistory();

  // If not configured, open settings modal
  if (!isConfigured()) {
    setTimeout(() => {
      $('#settingsModal').classList.add('show');
      showToast('まずGitHub設定を行ってください', 'info');
    }, 500);
  }

  validatePdfForm();
  validateUrlForm();
}

init();
