// =============================
// WWM Sushi Contest Website Config
// =============================
const SITE_CONFIG = {
  tallyEmbedUrl: 'https://tally.so/embed/xXleGG?hideTitle=1&transparentBackground=1&dynamicHeight=1',

  // Show the final ranking publicly after judging has ended.
  publicResults: true,

  // Keep this so judges can still view results if publicResults is disabled later.
  showResultsInJudgeMode: true
};

const state = {
  entries: [],
  judgeCode: localStorage.getItem('wwm_judge_code') || '',
  judgeName: localStorage.getItem('wwm_judge_name') || '',
  // Do not trust localStorage by itself. Judge mode is enabled only after server verification.
  judgeMode: false,
currentGalleryEntryIndex: 0
};

const $ = (id) => document.getElementById(id);

window.addEventListener('DOMContentLoaded', () => {
  $('year-span').textContent = new Date().getFullYear();
  setupTabs();
  setupTally();
  setupJudgeLogin();
  setupModals();
  setupScoreSelects();
  setupButtons();
  updateJudgeUi();
  validateStoredJudgeCode();
  loadEntries();
});

function setupTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = $(tab.dataset.target);
      if (target) target.classList.add('active');
      if (tab.dataset.target === 'tab-gallery') loadEntries();
      if (tab.dataset.target === 'tab-judge') loadEntries();
      if (tab.dataset.target === 'tab-results') loadResults();
    });
  });
}

function setupTally() {
  const iframe = $('tally-frame');
  if (!SITE_CONFIG.tallyEmbedUrl || SITE_CONFIG.tallyEmbedUrl.includes('PASTE_TALLY')) {
    $('tally-frame-wrapper').classList.add('hidden');
    $('missing-tally').classList.remove('hidden');
    return;
  }
  iframe.src = SITE_CONFIG.tallyEmbedUrl;
}

function setupButtons() {
  $('refresh-gallery').addEventListener('click', loadEntries);
  $('refresh-results').addEventListener('click', loadResults);
  $('logout-judge').addEventListener('click', () => {
    state.judgeMode = false;
    state.judgeCode = '';
    localStorage.removeItem('wwm_judge_mode');
    localStorage.removeItem('wwm_judge_code');
    updateJudgeUi();
    document.querySelector('.nav-tab[data-target="tab-gallery"]').click();
  });
  $('judge-score-form').addEventListener('submit', submitScore);
}

function setupJudgeLogin() {
  $('judge-access-link').addEventListener('click', async (e) => {
    e.preventDefault();

    if (state.judgeMode) {
      document.querySelector('.nav-tab[data-target="tab-judge"]').click();
      return;
    }

    const code = prompt('Enter Judge Access Code:');
    if (!code) return;

    try {
      await verifyJudgeCode(code.trim());
      state.judgeCode = code.trim();
      state.judgeMode = true;
      localStorage.setItem('wwm_judge_code', state.judgeCode);
      localStorage.setItem('wwm_judge_mode', 'true');
      updateJudgeUi();
      document.querySelector('.nav-tab[data-target="tab-judge"]').click();
    } catch (err) {
      state.judgeCode = '';
      state.judgeMode = false;
      localStorage.removeItem('wwm_judge_code');
      localStorage.removeItem('wwm_judge_mode');
      updateJudgeUi();
      alert(err.message || 'Invalid judge code.');
    }
  });
}

async function verifyJudgeCode(code) {
  const res = await fetch('/api/verifyJudge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ judgeCode: code })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Invalid judge code.');
  }
  return true;
}

async function validateStoredJudgeCode() {
  const savedCode = localStorage.getItem('wwm_judge_code');
  if (!savedCode) return;
  try {
    await verifyJudgeCode(savedCode);
    state.judgeCode = savedCode;
    state.judgeMode = true;
  } catch (err) {
    state.judgeCode = '';
    state.judgeMode = false;
    localStorage.removeItem('wwm_judge_code');
    localStorage.removeItem('wwm_judge_mode');
  }
  updateJudgeUi();
}

function updateJudgeUi() {
  $('judge-tab').classList.toggle('hidden', !state.judgeMode);

  $('results-tab').classList.toggle(
    'hidden',
    !(SITE_CONFIG.publicResults || (state.judgeMode && SITE_CONFIG.showResultsInJudgeMode))
  );

  $('judge-access-link').textContent = state.judgeMode ? 'Judge Mode Active' : 'Judge Login';
}

function setupModals() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  const lightbox = $('image-lightbox');
  const lightboxImg = $('lightbox-img');
  const lightboxClose = $('lightbox-close');

  function openLightbox(imageSrc) {
    if (!imageSrc) return;

    lightboxImg.src = imageSrc;
    lightbox.classList.remove('hidden');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  ['modal-main-img', 'judge-main-img'].forEach(id => {
    const image = $(id);

    image.addEventListener('click', e => {
      e.stopPropagation();
      openLightbox(image.src);
    });
  });

  lightboxClose.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });
}

function setupScoreSelects() {
  const ids = ['score-creativity','score-composition','score-character','score-story','score-impact'];
  ids.forEach(id => {
    const select = $(id);
    select.innerHTML = '<option value="">Select 1-10</option>';
    for (let i = 1; i <= 10; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      select.appendChild(opt);
    }
    select.addEventListener('change', updateScoreTotal);
  });
}

async function loadEntries() {
  setText('gallery-status', 'Loading gallery...');
  setText('judge-status', 'Loading entries...');
  try {
    const res = await fetch('/api/getEntries');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load entries');
    state.entries = data.entries || [];
    renderGallery();
    renderJudgeGrid();
  } catch (err) {
    setText('gallery-status', 'Could not load gallery: ' + err.message);
    setText('judge-status', 'Could not load entries: ' + err.message);
  }
}

function renderGallery() {
  const grid = $('gallery-grid');
  grid.innerHTML = '';
  setText('gallery-status', `${state.entries.length} approved entr${state.entries.length === 1 ? 'y' : 'ies'} loaded.`);
  if (!state.entries.length) {
    grid.innerHTML = '<div class="empty-state"><h3>No entries yet</h3><p>Approved Airtable entries will appear here.</p></div>';
    return;
  }
  state.entries.forEach(entry => grid.appendChild(makeEntryCard(entry, false)));
}

function renderJudgeGrid() {
  const grid = $('judge-grid');
  grid.innerHTML = '';
  setText('judge-status', `${state.entries.length} entr${state.entries.length === 1 ? 'y' : 'ies'} ready for judging.`);
  if (!state.entries.length) {
    grid.innerHTML = '<div class="empty-state"><h3>No entries yet</h3><p>Entries will appear after Tally sends them to Airtable.</p></div>';
    return;
  }
  state.entries.forEach(entry => grid.appendChild(makeEntryCard(entry, true)));
}

function makeEntryCard(entry, judgeMode) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  const firstImg = entry.photos[0]?.thumb || entry.photos[0]?.url || '';
  card.innerHTML = `
    <img class="card-img" src="${escapeAttr(firstImg)}" alt="Entry thumbnail">
    <div class="card-info">
      <h3 class="card-title">${escapeHTML(entry.title || 'Untitled')}</h3>
      <p class="card-ign">By: ${escapeHTML(entry.ign || 'Unknown')}</p>
    </div>
    ${judgeMode ? '<button class="judge-score-btn" type="button">Score Entry</button>' : ''}
  `;
  card.addEventListener('click', () => judgeMode ? openJudgeModal(entry) : openEntryModal(entry));
  const btn = card.querySelector('.judge-score-btn');
  if (btn) btn.addEventListener('click', e => { e.stopPropagation(); openJudgeModal(entry); });
  return card;
}

function openEntryModal(entry) {
  $('modal-title').textContent = entry.title || 'Untitled';
  $('modal-ign').textContent = entry.ign || 'Unknown';
  $('modal-discord').textContent = entry.discord || '-';
  $('modal-summary').textContent = entry.summary || '';

  const comments = entry.comments || [];
  const commentsSection = $('modal-comments-section');
  const commentsBox = $('modal-comments');

  commentsBox.innerHTML = comments.map((comment, index) => `
    <div class="judge-comment">
      <strong>Judge ${index + 1}</strong>
      <p>${escapeHTML(comment)}</p>
    </div>
  `).join('');

  commentsSection.classList.toggle('hidden', comments.length === 0);

  fillImageSet('modal-main-img', 'modal-thumbs', entry.photos);
  $('entry-modal').classList.remove('hidden');
}

function openJudgeModal(entry) {
  $('score-entry-id').value = entry.id;
  $('judge-title').textContent = entry.title || 'Untitled';
  $('judge-ign').textContent = entry.ign || 'Unknown';
  $('judge-summary').textContent = entry.summary || '';
  $('judge-name').value = state.judgeName || '';
  $('score-comments').value = '';
  ['score-creativity','score-composition','score-character','score-story','score-impact'].forEach(id => $(id).value = '');
  $('score-total').textContent = '0';
  $('score-message').textContent = '';
  fillImageSet('judge-main-img', 'judge-thumbs', entry.photos);
  $('judge-modal').classList.remove('hidden');
}

function fillImageSet(mainId, thumbsId, photos) {
  const main = $(mainId);
  const thumbs = $(thumbsId);
  thumbs.innerHTML = '';
  const usable = photos || [];
  main.src = usable[0]?.url || usable[0]?.thumb || '';
  usable.forEach(photo => {
    const img = document.createElement('img');
    img.src = photo.thumb || photo.url;
    img.alt = 'Entry thumbnail';
    img.addEventListener('click', () => main.src = photo.url || photo.thumb);
    thumbs.appendChild(img);
  });
}

function updateScoreTotal() {
  const total = ['score-creativity','score-composition','score-character','score-story','score-impact']
    .map(id => parseInt($(id).value || '0', 10))
    .reduce((sum, n) => sum + n, 0);
  $('score-total').textContent = total;
  return total;
}

async function submitScore(e) {
  e.preventDefault();
  const btn = $('submit-score-btn');
  const entryId = $('score-entry-id').value;
  const judgeName = $('judge-name').value.trim();
  state.judgeName = judgeName;
  localStorage.setItem('wwm_judge_name', judgeName);

  const payload = {
    judgeCode: state.judgeCode,
    entryId,
    judgeName,
    creativity: numberValue('score-creativity'),
    composition: numberValue('score-composition'),
    character: numberValue('score-character'),
    story: numberValue('score-story'),
    impact: numberValue('score-impact'),
    total: updateScoreTotal(),
    comments: $('score-comments').value.trim()
  };

  btn.disabled = true;
  btn.textContent = 'Submitting...';
  setText('score-message', '');

  try {
    const res = await fetch('/api/submitScore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit score');
    setText('score-message', 'Score submitted successfully.');
    setTimeout(() => $('judge-modal').classList.add('hidden'), 700);
  } catch (err) {
    setText('score-message', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Score';
  }
}

async function loadResults() {
  setText('results-status', 'Loading results...');
  const body = $('results-body');
  body.innerHTML = '';

  try {
    const res = await fetch('/api/getResults');
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to load results');

    const results = data.results || [];
    setText('results-status', `${results.length} entries ranked.`);

    body.innerHTML = results.map((r, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(r.title || 'Untitled')}</td>
        <td>${escapeHTML(r.ign || 'Unknown')}</td>
        <td>${r.judgeCount}</td>
        <td>${r.average.toFixed(2)}</td>
        <td>${r.total}</td>
      </tr>
    `).join('');
  } catch (err) {
    setText('results-status', err.message);
  }
}

function numberValue(id) { return parseInt($(id).value || '0', 10); }
function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function escapeHTML(str = '') { return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function escapeAttr(str = '') { return escapeHTML(str).replace(/`/g, '&#96;'); }
