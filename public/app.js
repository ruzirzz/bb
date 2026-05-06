// --- Dashboard Logic ---
let dashData = { allMaps: [], dbMaps: {}, currentFilter: 'all' };

async function loadDashboard() {
  const btn = document.getElementById('btnLoadDash');
  btn.innerHTML = '<span class="spinner"></span> Memuat...';
  btn.disabled = true;

  try {
    const [mapsRes, dbRes] = await Promise.allSettled([
      fetch('/api/allmaps'),
      fetch('/api/github')
    ]);

    if (mapsRes.status === 'fulfilled' && mapsRes.value.ok) {
      dashData.allMaps = await mapsRes.value.json();
    }

    dashData.dbMaps = {};
    if (dbRes.status === 'fulfilled' && dbRes.value.ok) {
      const data = await dbRes.value.json();
      const regex = /\["([^"]+)"\]\s*=\s*\{([^}]+)\}/g;
      let m;
      while ((m = regex.exec(data.content)) !== null) {
        const inner = m[2];
        dashData.dbMaps[m[1]] = {
          far: /Far\s*=\s*CFrame/.test(inner),
          sky: /Sky\s*=\s*CFrame/.test(inner)
        };
      }
    }

    updateDashStats();
    renderDashGrid();
    document.getElementById('dashToolbar').style.display = 'flex';
    document.getElementById('dashGridHeader').style.display = 'block';
    fetchLastUpdate();
    showToast('Dashboard dimuat!', 'success');
  } catch (err) {
    showToast('Gagal memuat dashboard: ' + err.message, 'error');
  } finally {
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Refresh Dashboard';
    btn.disabled = false;
  }
}

function updateDashStats() {
  const total = dashData.allMaps.length;
  let complete = 0, partial = 0;
  dashData.allMaps.forEach(name => {
    const db = dashData.dbMaps[name];
    if (db && db.far && db.sky) complete++;
    else if (db && (db.far || db.sky)) partial++;
  });
  const missing = total - complete - partial;
  const pct = total > 0 ? Math.round(((complete + partial * 0.5) / total) * 100) : 0;

  document.getElementById('dashTotal').textContent = total;
  document.getElementById('dashComplete').textContent = complete;
  document.getElementById('dashMissing').textContent = missing + partial;
  document.getElementById('dashPercent').textContent = pct + '%';
  document.getElementById('dashProgressFill').style.width = pct + '%';
  document.getElementById('dashProgressText').textContent =
    `${complete} selesai lengkap, ${partial} sebagian, ${missing} belum ada dari ${total} map`;
}

function getMapStatus(name) {
  const db = dashData.dbMaps[name];
  if (!db) return 'missing';
  if (db.far && db.sky) return 'complete';
  return 'partial';
}

function renderDashGrid() {
  const grid = document.getElementById('dashGrid');
  const query = (document.getElementById('dashSearch')?.value || '').trim().toLowerCase();
  const filter = dashData.currentFilter;
  grid.innerHTML = '';

  let shown = 0;
  dashData.allMaps.forEach(name => {
    const status = getMapStatus(name);
    if (filter !== 'all' && filter !== status) return;
    if (query && !name.toLowerCase().includes(query)) return;

    const db = dashData.dbMaps[name];
    const card = document.createElement('div');
    card.className = `map-card status-${status}`;

    const nameEl = document.createElement('div');
    nameEl.className = 'map-card-name';
    nameEl.textContent = name;

    const badges = document.createElement('div');
    badges.className = 'map-card-badges';

    if (!db) {
      badges.innerHTML = '<span class="map-badge no-data">No Data</span>';
    } else {
      if (db.far) badges.innerHTML += '<span class="map-badge has-far">Far ✓</span>';
      else badges.innerHTML += '<span class="map-badge no-far">Far ✕</span>';
      if (db.sky) badges.innerHTML += '<span class="map-badge has-sky">Sky ✓</span>';
      else badges.innerHTML += '<span class="map-badge no-sky">Sky ✕</span>';
    }

    card.appendChild(nameEl);
    card.appendChild(badges);
    grid.appendChild(card);
    shown++;
  });

  document.getElementById('dashShowing').textContent = `Menampilkan ${shown} map`;
}

function setDashFilter(filter, btn) {
  dashData.currentFilter = filter;
  document.querySelectorAll('.dash-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDashGrid();
}

function filterDashGrid() { renderDashGrid(); }

// --- Toast Notification System ---
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- Navigation Logic ---
function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('active');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

function switchView(viewName, element) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + viewName).classList.add('active');
  element.classList.add('active');
  document.getElementById('sidebar').classList.remove('active');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// --- Copy Helper ---
function copyInput(elementId) {
  const el = document.getElementById(elementId);
  if (el && el.value) {
    navigator.clipboard.writeText(el.value).then(() => {
      const btn = el.parentElement.querySelector('.btn-icon-sm');
      if (btn) {
        btn.classList.add('copied');
        const prev = btn.innerHTML;
        btn.innerHTML = '✓ Copied';
        setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = prev; }, 1500);
      }
      showToast('Berhasil disalin!', 'success');
    });
  } else {
    showToast('Tidak ada data untuk disalin!', 'error');
  }
}

function copyCFrame(text, btnEl) {
  navigator.clipboard.writeText(text).then(() => {
    btnEl.classList.add('copied');
    const prev = btnEl.innerHTML;
    btnEl.textContent = '✓ Copied';
    setTimeout(() => { btnEl.classList.remove('copied'); btnEl.innerHTML = prev; }, 1500);
    showToast('CFrame disalin!', 'success');
  });
}

// --- View 1: Extractor ---
function getContext(code, idx) {
  let before = code.substring(Math.max(0, idx - 110), idx);
  let sm = before.match(/"([^"]{1,40})"\s*,?\s*$/);
  if (sm) return '"' + sm[1] + '"';
  return 'unknown';
}

function extractCFrames() {
  const raw = document.getElementById('rawInput').value;
  const resultsDiv = document.getElementById('extractorResults');
  resultsDiv.innerHTML = '';
  if (!raw.trim()) return showToast('Teks tidak boleh kosong!', 'error');

  const btn = document.querySelector('[onclick="extractCFrames()"]');
  const origText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Mengekstrak...';
  btn.disabled = true;

  setTimeout(() => {
    const pat = /CFrame\.new\(([^)]+)\)/g;
    let match;
    let count = 0;
    const fragment = document.createDocumentFragment();

    while ((match = pat.exec(raw)) !== null) {
      if (getContext(raw, match.index).indexOf('Teleporter') !== -1) {
        count++;
        const fullCframe = match[0];

        const card = document.createElement('div');
        card.className = 'result-card';

        const header = document.createElement('div');
        header.className = 'result-header';

        const tag = document.createElement('span');
        tag.className = 'result-tag';
        tag.textContent = `Teleporter #${count}`;


        const cframeDiv = document.createElement('div');
        cframeDiv.className = 'result-cframe';
        cframeDiv.textContent = fullCframe;

        header.appendChild(tag);

        const actions = document.createElement('div');
        actions.className = 'result-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-icon-sm';
        copyBtn.textContent = 'Copy';
        copyBtn.dataset.cframe = fullCframe;
        copyBtn.addEventListener('click', function() {
          copyCFrame(this.dataset.cframe, this);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-icon-sm';
        addBtn.innerHTML = '+ Tambah';
        addBtn.dataset.cframe = fullCframe;
        addBtn.addEventListener('click', function() {
          quickAddCFrame(this.dataset.cframe);
        });

        actions.appendChild(copyBtn);
        actions.appendChild(addBtn);
        header.appendChild(actions);
        card.appendChild(header);
        card.appendChild(cframeDiv);
        fragment.appendChild(card);
      }
    }

    resultsDiv.appendChild(fragment);

    if (count === 0) {
      resultsDiv.innerHTML = '<div class="no-result">Tidak ditemukan CFrame dengan konteks "Teleporter".</div>';
    } else {
      showToast(`Ditemukan ${count} CFrame Teleporter!`, 'success');
    }

    btn.innerHTML = origText;
    btn.disabled = false;
  }, 0);
}

function clearExtractor() {
  document.getElementById('rawInput').value = '';
  document.getElementById('extractorResults').innerHTML = '';
  showToast('Data dibersihkan', 'info');
}

// --- View 2: Import (Add Map) ---
let allMapNames = [];

async function loadAllMaps() {
  try {
    const res = await fetch('/api/allmaps');
    if (res.ok) allMapNames = await res.json();
  } catch (e) { console.warn('Gagal memuat daftar map:', e); }
}

// Load map names on page init
loadAllMaps();

function toggleAddInputs() {
  const farCheck = document.getElementById('checkAddFar').checked;
  const skyCheck = document.getElementById('checkAddSky').checked;
  document.getElementById('addFarCFrame').disabled = !farCheck;
  document.getElementById('addSkyCFrame').disabled = !skyCheck;
  if (!farCheck) document.getElementById('addFarCFrame').value = '';
  if (!skyCheck) document.getElementById('addSkyCFrame').value = '';
}

// --- Autocomplete for Nama Map ---
(function() {
  const input = document.getElementById('addMapName');
  const listEl = document.getElementById('addMapSuggestions');
  if (!input || !listEl) return;

  function highlightMatch(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.substring(0, idx) + '<span class="match-hl">' + text.substring(idx, idx + query.length) + '</span>' + text.substring(idx + query.length);
  }

  function renderSuggestions() {
    const q = input.value.trim();
    listEl.innerHTML = '';
    if (!q || allMapNames.length === 0) { listEl.classList.remove('active'); return; }

    const filtered = allMapNames.filter(m => m.toLowerCase().includes(q.toLowerCase())).slice(0, 20);
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="autocomplete-empty">Tidak ditemukan</div>';
      listEl.classList.add('active');
      return;
    }

    filtered.forEach(name => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.innerHTML = highlightMatch(name, q);
      item.addEventListener('click', () => {
        input.value = name;
        listEl.classList.remove('active');
      });
      listEl.appendChild(item);
    });
    listEl.classList.add('active');
  }

  input.addEventListener('input', renderSuggestions);
  input.addEventListener('focus', () => { if (input.value.trim()) renderSuggestions(); });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#addMapWrapper')) listEl.classList.remove('active');
  });
})();

async function addMapToGitHub() {
  const mapName = document.getElementById('addMapName').value.trim();
  const useFar = document.getElementById('checkAddFar').checked;
  const useSky = document.getElementById('checkAddSky').checked;
  const cFar = document.getElementById('addFarCFrame').value.trim();
  const cSky = document.getElementById('addSkyCFrame').value.trim();

  if (!mapName) return showToast('Nama map tidak boleh kosong!', 'error');
  if (!useFar && !useSky) return showToast('Pilih minimal satu tipe lokasi (Far/Sky)!', 'error');
  if (useFar && !cFar) return showToast('CFrame Far tidak boleh kosong!', 'error');
  if (useSky && !cSky) return showToast('CFrame Sky tidak boleh kosong!', 'error');

  const btn = document.getElementById('btnAddSubmit');
  btn.innerHTML = '<span class="spinner"></span> Mengirim...'; btn.disabled = true;

  try {
    const res = await fetch('/api/github');
    if (!res.ok) { let e = await res.json().catch(()=>({})); throw new Error(e.error || "Server gagal memuat data."); }
    const data = await res.json();

    let newEntry = `\n    ["${mapName}"] = {\n`;
    if (useFar) newEntry += `        Far = ${cFar},\n`;
    if (useSky) newEntry += `        Sky = ${cSky}\n`;
    newEntry += `    },`;

    const anchor = "TeleportModule.mapSpots = {";
    if (!data.content.includes(anchor)) throw new Error("Format file tp.lua tidak dikenali.");

    const updatedContent = data.content.replace(anchor, anchor + newEntry);

    const postRes = await fetch('/api/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: updatedContent, sha: data.sha, message: `Update Database: Menambah Map [${mapName}]` })
    });

    if (!postRes.ok) { let e = await postRes.json().catch(()=>({})); throw new Error(e.error || "Gagal menyimpan."); }

    showToast(`Map "${mapName}" berhasil ditambahkan!`, 'success');
    document.getElementById('addMapName').value = '';
    document.getElementById('addFarCFrame').value = '';
    document.getElementById('addSkyCFrame').value = '';
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.innerHTML = 'Simpan ke Database'; btn.disabled = false;
  }
}

// --- View 3: Edit & Hapus ---
let dbState = { content: "", sha: "", maps: {} };
let selectedEditMap = '';

// --- Custom Dropdown for Edit ---
function toggleEditDropdown() {
  const trigger = document.getElementById('editMapTrigger');
  const dropdown = document.getElementById('editMapDropdown');
  const search = document.getElementById('editMapSearch');
  const isOpen = dropdown.classList.contains('active');

  if (isOpen) {
    dropdown.classList.remove('active');
    trigger.classList.remove('active');
  } else {
    dropdown.classList.add('active');
    trigger.classList.add('active');
    search.value = '';
    filterEditMaps();
    setTimeout(() => search.focus(), 50);
  }
}

function filterEditMaps() {
  const query = document.getElementById('editMapSearch').value.trim().toLowerCase();
  const list = document.getElementById('editMapList');
  const emptyEl = document.getElementById('editMapEmpty');
  const mapNames = Object.keys(dbState.maps);
  list.innerHTML = '';

  const filtered = mapNames.filter(n => n.toLowerCase().includes(query));
  if (filtered.length === 0) {
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    filtered.forEach(name => {
      const item = document.createElement('div');
      item.className = 'custom-select-item' + (name === selectedEditMap ? ' selected' : '');
      item.innerHTML = highlightText(name, query);
      item.addEventListener('click', () => selectEditMap(name));
      list.appendChild(item);
    });
  }
}

function highlightText(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return text;
  return text.substring(0, idx) + '<span class="match-hl">' + text.substring(idx, idx + query.length) + '</span>' + text.substring(idx + query.length);
}

function selectEditMap(mapName) {
  selectedEditMap = mapName;
  document.getElementById('editMapSelectedText').textContent = mapName;
  document.getElementById('editMapDropdown').classList.remove('active');
  document.getElementById('editMapTrigger').classList.remove('active');
  populateEditForm();
}

// Click outside to close dropdown
document.addEventListener('click', (e) => {
  if (!e.target.closest('#editMapSelectWrapper')) {
    document.getElementById('editMapDropdown').classList.remove('active');
    document.getElementById('editMapTrigger').classList.remove('active');
  }
});

// Wire up trigger click and search
document.getElementById('editMapTrigger').addEventListener('click', toggleEditDropdown);
document.getElementById('editMapSearch').addEventListener('input', filterEditMaps);

async function loadDatabaseFromGitHub() {
  const btn = document.getElementById('btnLoadDb');
  btn.innerHTML = '<span class="spinner"></span> Memuat...'; btn.disabled = true;

  try {
    const res = await fetch('/api/github');
    if (!res.ok) { let e = await res.json().catch(()=>({})); throw new Error(e.error || "Server gagal memuat data."); }
    const data = await res.json();
    dbState.content = data.content;
    dbState.sha = data.sha;
    dbState.maps = {};
    selectedEditMap = '';
    document.getElementById('editMapSelectedText').textContent = '\u2014 Pilih Map \u2014';

    const mapRegex = /\["([^"]+)"\]\s*=\s*\{([^}]+)\}/g;
    let match;
    let mapCount = 0;
    while ((match = mapRegex.exec(data.content)) !== null) {
      const mapName = match[1];
      const innerData = match[2];
      const farMatch = innerData.match(/Far\s*=\s*(CFrame\.new\([^)]+\))/);
      const skyMatch = innerData.match(/Sky\s*=\s*(CFrame\.new\([^)]+\))/);

      dbState.maps[mapName] = {
        fullBlock: match[0],
        far: farMatch ? farMatch[1] : "",
        sky: skyMatch ? skyMatch[1] : ""
      };
      mapCount++;
    }

    filterEditMaps();
    document.getElementById('editArea').style.display = 'block';
    document.getElementById('mapCountStat').textContent = mapCount;
    showToast(`Database dimuat! ${mapCount} map ditemukan.`, 'success');
  } catch (err) {
    showToast('Gagal memuat: ' + err.message, 'error');
  } finally {
    btn.innerHTML = 'Sinkronisasi &amp; Muat Data'; btn.disabled = false;
  }
}

function populateEditForm() {
  if (selectedEditMap && dbState.maps[selectedEditMap]) {
    document.getElementById('editFarCFrame').value = dbState.maps[selectedEditMap].far;
    document.getElementById('editSkyCFrame').value = dbState.maps[selectedEditMap].sky;
  } else {
    document.getElementById('editFarCFrame').value = '';
    document.getElementById('editSkyCFrame').value = '';
  }
}

async function updateMapToGitHub() {
  const mapName = selectedEditMap;
  const cFar = document.getElementById('editFarCFrame').value.trim();
  const cSky = document.getElementById('editSkyCFrame').value.trim();

  if (!mapName) return showToast('Pilih map terlebih dahulu!', 'error');

  const btn = document.getElementById('btnEditSubmit');
  const btnDel = document.getElementById('btnDeleteSubmit');
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...'; btn.disabled = true;
  btnDel.disabled = true;

  try {
    let newBlock = `["${mapName}"] = {\n`;
    if (cFar) newBlock += `        Far = ${cFar},\n`;
    if (cSky) newBlock += `        Sky = ${cSky}\n`;
    newBlock += `    }`;

    const updatedContent = dbState.content.replace(dbState.maps[mapName].fullBlock, newBlock);

    const postRes = await fetch('/api/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: updatedContent, sha: dbState.sha, message: `Update Database: Edit Map [${mapName}]` })
    });

    if (!postRes.ok) { let e = await postRes.json().catch(()=>({})); throw new Error(e.error || "Gagal update."); }

    showToast(`Map "${mapName}" berhasil diperbarui!`, 'success');
    await loadDatabaseFromGitHub();
  } catch (err) {
    showToast('Gagal update: ' + err.message, 'error');
  } finally {
    btn.innerHTML = 'Perbarui Map'; btn.disabled = false;
    btnDel.disabled = false;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function deleteMapFromGitHub() {
  const mapName = selectedEditMap;
  if (!mapName) return showToast('Pilih map terlebih dahulu!', 'error');
  if (!confirm(`Hapus map "${mapName}" secara permanen?`)) return;

  const btn = document.getElementById('btnEditSubmit');
  const btnDel = document.getElementById('btnDeleteSubmit');
  btn.disabled = true;
  btnDel.innerHTML = '<span class="spinner"></span> Menghapus...'; btnDel.disabled = true;

  try {
    let regexStr = escapeRegExp(dbState.maps[mapName].fullBlock) + "\\s*,?";
    let updatedContent = dbState.content.replace(new RegExp(regexStr, 'g'), "");

    const postRes = await fetch('/api/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: updatedContent, sha: dbState.sha, message: `Update Database: Hapus Map [${mapName}]` })
    });

    if (!postRes.ok) { let e = await postRes.json().catch(()=>({})); throw new Error(e.error || "Gagal menghapus."); }

    showToast(`Map "${mapName}" berhasil dihapus!`, 'success');
    document.getElementById('editFarCFrame').value = '';
    document.getElementById('editSkyCFrame').value = '';
    await loadDatabaseFromGitHub();
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btnDel.innerHTML = 'Hapus Map'; btnDel.disabled = false;
  }
}

// --- Quick Add from Extractor ---
function quickAddCFrame(cframeText) {
  // Switch to Import view
  const importMenuItem = document.getElementById('menu-import');
  switchView('import', importMenuItem);

  // Auto-fill the Far CFrame field (most common use case)
  const farCheck = document.getElementById('checkAddFar');
  const skyCheck = document.getElementById('checkAddSky');

  if (!farCheck.checked && !skyCheck.checked) {
    farCheck.checked = true;
    toggleAddInputs();
  }

  // Fill the first empty CFrame field
  const farInput = document.getElementById('addFarCFrame');
  const skyInput = document.getElementById('addSkyCFrame');

  if (farCheck.checked && !farInput.value) {
    farInput.value = cframeText;
    showToast('CFrame diisi ke Far. Isi nama map lalu simpan!', 'info');
  } else if (skyCheck.checked && !skyInput.value) {
    skyInput.value = cframeText;
    showToast('CFrame diisi ke Sky. Isi nama map lalu simpan!', 'info');
  } else {
    farInput.value = cframeText;
    showToast('CFrame Far diganti. Isi nama map lalu simpan!', 'info');
  }
}

// --- Last Updated from GitHub ---
async function fetchLastUpdate() {
  try {
    const res = await fetch('/api/lastupdate');
    if (!res.ok) return;
    const data = await res.json();
    if (data.date) {
      const d = new Date(data.date);
      const formatted = d.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      document.getElementById('dashLastUpdateText').textContent =
        `Terakhir diperbarui: ${formatted} — ${data.message || ''}`;
    }
  } catch (e) {
    console.warn('Gagal mengambil info terakhir:', e);
  }
}

// --- Server Status Check ---
async function checkServerStatus() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      dot.classList.remove('offline');
      text.textContent = 'Server Connected';
    } else {
      dot.classList.add('offline');
      text.textContent = 'Server Error';
    }
  } catch (e) {
    dot.classList.add('offline');
    text.textContent = 'Server Offline';
  }
}

// --- Auto Init ---
document.addEventListener('DOMContentLoaded', () => {
  checkServerStatus();
  setInterval(checkServerStatus, 30000); // Check every 30s
  loadDashboard(); // Auto-load dashboard
});
