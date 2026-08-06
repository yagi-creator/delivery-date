// ========================================================================
// settings.js  ―  設定タブ（基本/休業日/イレギュラー/Excel取込/地域特殊ルール）
// ========================================================================

// ===== 基本設定（オフィス） =====
function initSettingsBasic() {
    const sel = document.getElementById('officeSelect');
    sel.value = appState.office || '';
    sel.addEventListener('change', () => {
        appState.office = sel.value;
        saveState();
        applyOfficeDefaultRegion();
    });

    // Sync controls
    const tokenInput = document.getElementById('sync_github_token');
    const repoSelect = document.getElementById('sync_target_repo');
    const statusEl = document.getElementById('sync_status');
    tokenInput.value = localStorage.getItem('shared_sync_token') || '';
    tokenInput.addEventListener('change', () => {
        localStorage.setItem('shared_sync_token', tokenInput.value);
    });
    document.getElementById('btnPublishShared').addEventListener('click', async () => {
        statusEl.textContent = 'Publishing...';
        try {
            await publishSharedState(tokenInput.value, repoSelect.value);
            statusEl.textContent = 'Published successfully.';
        } catch (e) { statusEl.textContent = 'Publish failed: ' + (e.message || e); }
    });
    document.getElementById('btnSyncShared').addEventListener('click', async () => {
        statusEl.textContent = 'Syncing...';
        try {
            await syncSharedState(tokenInput.value, repoSelect.value);
            statusEl.textContent = 'Synced successfully.';
        } catch (e) { statusEl.textContent = 'Sync failed: ' + (e.message || e); }
    });
}
function applyOfficeDefaultRegion() {
    const region = OFFICE_DEFAULT_REGION[appState.office];
    if (!region) return;
    ['std_region','det_region','dl_region','past_region'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = region;
    });
}

// ===== 休業日設定 =====
function initSettingsHoliday() {
    renderHolidayTable();
    document.getElementById('hol_date').value = toISODate(getNow());
}
function addHoliday() {
    const type = document.getElementById('hol_type').value;
    const date = document.getElementById('hol_date').value;
    const name = document.getElementById('hol_name').value.trim();
    if (!date) { alert('⚠️ 日付を入力してください。'); return; }
    if (!name) { alert('⚠️ 名称を入力してください。'); return; }
    // 同日重複は上書き
    appState.holidays = appState.holidays.filter(h => h.date !== date);
    appState.holidays.push({date, name, type});
    appState.holidays.sort((a,b) => a.date < b.date ? -1 : 1);
    saveState();
    renderHolidayTable();
    document.getElementById('hol_name').value = '';
    recalcAllTabs();
}
function deleteHoliday(date) {
    if (!confirm('この休業日設定を削除しますか？')) return;
    appState.holidays = appState.holidays.filter(h => h.date !== date);
    saveState();
    renderHolidayTable();
    recalcAllTabs();
}
function renderHolidayTable() {
    const tbody = document.getElementById('hol_tbody');
    const countEl = document.getElementById('hol_count');
    const sorted = appState.holidays.slice().sort((a,b) => a.date < b.date ? -1 : 1);
    countEl.textContent = sorted.length;
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">登録されていません</td></tr>';
        return;
    }
    tbody.innerHTML = sorted.map(h => {
        const d = parseISODate(h.date);
        const tagCls = h.type === 'business' ? 'business' : 'holiday';
        const tagLabel = h.type === 'business' ? '特別営業日' : '休業日';
        return `<tr>
            <td>${h.date}</td>
            <td>${WDAYS[d.getDay()]}</td>
            <td><span class="tag ${tagCls}">${tagLabel}</span></td>
            <td>${h.name}</td>
            <td><button class="btn-small" onclick="deleteHoliday('${h.date}')">削除</button></td>
        </tr>`;
    }).join('');
}

// ===== 地域特殊ルール =====
function initSettingsException() {
    const sel = document.getElementById('exc_pref');
    sel.innerHTML = PREFECTURE_LIST.map(p => `<option value="${p}">${p}</option>`).join('');
    renderExceptionList();
}
function addException() {
    const pref = document.getElementById('exc_pref').value;
    const city = document.getElementById('exc_city').value.trim();
    const days = parseInt(document.getElementById('exc_days').value);
    const note = document.getElementById('exc_note').value.trim();
    if (!pref || isNaN(days) || days < 1) { alert('⚠️ 都道府県と追加日数を正しく入力してください。'); return; }
    appState.regionExceptions.push({ id: Date.now(), pref, city, days, note });
    saveState();
    renderExceptionList();
    document.getElementById('exc_city').value = '';
    document.getElementById('exc_note').value = '';
    recalcAllTabs();
}
function deleteException(id) {
    if (!confirm('この地域特殊ルールを削除しますか？')) return;
    appState.regionExceptions = appState.regionExceptions.filter(e => e.id !== id);
    saveState();
    renderExceptionList();
    recalcAllTabs();
}
function renderExceptionList() {
    const container = document.getElementById('exceptionListContainer');
    if (!appState.regionExceptions || appState.regionExceptions.length === 0) {
        container.innerHTML = '<div class="no-data">登録されていません</div>';
        return;
    }
    container.innerHTML = appState.regionExceptions.map(e => `
        <div class="import-list-item">
            <div>
                <strong>${e.pref}${e.city ? ' ' + e.city : '（全域）'}</strong>
                <span style="color:#e74c3c;font-weight:700;margin-left:8px;">+${e.days}日</span>
                ${e.note ? `<div style="font-size:12px;color:#6c757d;">${e.note}</div>` : ''}
            </div>
            <button class="btn-small" onclick="deleteException(${e.id})">削除</button>
        </div>
    `).join('');
}

// ===== 全タブ再計算トリガー =====
function recalcAllTabs() {
    if (typeof calcStandard === 'function') calcStandard();
    if (typeof calcDetail === 'function') calcDetail();
    if (typeof calcDeadline === 'function') calcDeadline();
    if (typeof calcPast === 'function') calcPast();
}
