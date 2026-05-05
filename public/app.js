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

  const pat = /CFrame\.new\(([^)]+)\)/g;
  let match;
  let count = 0;

  while ((match = pat.exec(raw)) !== null) {
    if (getContext(raw, match.index).indexOf("Teleporter") !== -1) {
      count++;
      let fullCframe = match[0];
      let escaped = fullCframe.replace(/'/g, "\\'");

      resultsDiv.innerHTML += `
        <div class="result-card">
          <div class="result-header">
            <span class="result-tag">Teleporter #${count}</span>
            <button class="btn-icon-sm" onclick="copyCFrame('${escaped}', this)">Copy</button>
          </div>
          <div class="result-cframe">${fullCframe}</div>
        </div>`;
    }
  }

  if (count === 0) {
    resultsDiv.innerHTML = '<div class="no-result">Tidak ditemukan CFrame dengan konteks "Teleporter".</div>';
  } else {
    showToast(`Ditemukan ${count} CFrame Teleporter!`, 'success');
  }
}

function clearExtractor() {
  document.getElementById('rawInput').value = '';
  document.getElementById('extractorResults').innerHTML = '';
  showToast('Data dibersihkan', 'info');
}

// --- View 2: Import (Add Map) ---
function toggleAddInputs() {
  const farCheck = document.getElementById('checkAddFar').checked;
  const skyCheck = document.getElementById('checkAddSky').checked;
  document.getElementById('addFarCFrame').disabled = !farCheck;
  document.getElementById('addSkyCFrame').disabled = !skyCheck;
  if (!farCheck) document.getElementById('addFarCFrame').value = '';
  if (!skyCheck) document.getElementById('addSkyCFrame').value = '';
}

async function addMapToGitHub() {
  const mapName = document.getElementById('addMapName').value.trim();
  const useFar = document.getElementById('checkAddFar').checked;
  const useSky = document.getElementById('checkAddSky').checked;
  const cFar = document.getElementById('addFarCFrame').value.trim();
  const cSky = document.getElementById('addSkyCFrame').value.trim();

  if (!mapName || (!useFar && !useSky)) return showToast('Data form belum lengkap!', 'error');

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

    const select = document.getElementById('editMapSelect');
    select.innerHTML = '<option value="">— Pilih Map —</option>';

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
      select.innerHTML += `<option value="${mapName}">${mapName}</option>`;
      mapCount++;
    }

    document.getElementById('editArea').style.display = 'block';
    document.getElementById('mapCountStat').textContent = mapCount;
    showToast(`Database dimuat! ${mapCount} map ditemukan.`, 'success');
  } catch (err) {
    showToast('Gagal memuat: ' + err.message, 'error');
  } finally {
    btn.innerHTML = 'Sinkronisasi & Muat Data'; btn.disabled = false;
  }
}

function populateEditForm() {
  const mapName = document.getElementById('editMapSelect').value;
  if (mapName && dbState.maps[mapName]) {
    document.getElementById('editFarCFrame').value = dbState.maps[mapName].far;
    document.getElementById('editSkyCFrame').value = dbState.maps[mapName].sky;
  } else {
    document.getElementById('editFarCFrame').value = '';
    document.getElementById('editSkyCFrame').value = '';
  }
}

async function updateMapToGitHub() {
  const mapName = document.getElementById('editMapSelect').value;
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
  const mapName = document.getElementById('editMapSelect').value;
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
