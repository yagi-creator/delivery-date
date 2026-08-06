// ========================================================================
// irregular.js  ―  イレギュラー登録・管理
// ========================================================================

let currentChangeType = 'shipDelay';

function toggleIrregularPanel() {
    const p = document.getElementById('irregularPanel');
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
}

function initIrregularUI() {
    const sel = document.getElementById('irr_publisher');
    Object.keys(PUBLISHER_CONDITIONS).forEach(pub => {
        const opt = document.createElement('option');
        opt.value = pub; opt.textContent = pub;
        sel.appendChild(opt);
    });
    renderChangeDetailArea('shipDelay');
    renderIrregularList();
}

function selectChangeType(type, btn) {
    currentChangeType = type;
    document.querySelectorAll('.change-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChangeDetailArea(type);
}

function renderChangeDetailArea(type) {
    const area = document.getElementById('changeDetailArea');
    if (type === 'shipDelay') {
        area.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <label style="font-size:13px;font-weight:600;color:#495057;">📦 追加遅延日数:</label>
                <input type="number" id="irr_delayDays" value="1" min="0" max="30" style="width:90px;">
                <span style="font-size:12px;color:#6c757d;">営業日</span>
            </div>`;
    } else if (type === 'threshold') {
        area.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
                <label style="font-size:13px;font-weight:600;color:#495057;">📊 新しい直送条件:</label>
                <input type="number" id="irr_newThreshold" min="0" placeholder="例:20" style="width:100px;">
                <span style="font-size:12px;color:#6c757d;">冊以上で直送</span>
            </div>
            <label style="font-size:12px;color:#6c757d;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="checkbox" id="irr_forceTakuso" style="width:auto;">
                期間中は冊数に関わらず強制宅送にする
            </label>`;
    } else if (type === 'fixedDate') {
        area.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <label style="font-size:13px;font-weight:600;color:#495057;">📅 固定出荷日:</label>
                <input type="date" id="irr_fixedDate" style="width:auto;">
            </div>`;
    } else if (type === 'leadTimeChange') {
        area.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <label style="font-size:13px;font-weight:600;color:#495057;">📦 直送リードタイム</label>
                    <input type="number" id="irr_directLead" min="0" max="10" placeholder="1" style="width:80px;">
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;color:#495057;">🚛 宅送リードタイム</label>
                    <input type="number" id="irr_takusoLead" min="0" max="10" placeholder="2" style="width:80px;">
                </div>
            </div>`;
    }
}

function registerIrregular() {
    const startDate = document.getElementById('irr_startDate').value;
    const endDate   = document.getElementById('irr_endDate').value;
    const publisher = document.getElementById('irr_publisher').value;
    const memo      = document.getElementById('irr_memo').value;

    if (!startDate || !endDate) { alert('⚠️ 開始日と終了日を入力してください。'); return; }
    if (!publisher) { alert('⚠️ 対象出版社を選択してください。'); return; }
    if (startDate > endDate) { alert('⚠️ 終了日は開始日以降にしてください。'); return; }

    const changeData = { type: currentChangeType };
    if (currentChangeType === 'shipDelay') {
        const d = parseInt(document.getElementById('irr_delayDays').value);
        if (isNaN(d) || d < 0) { alert('⚠️ 遅延日数を正しく入力してください。'); return; }
        changeData.delayDays = d;
    } else if (currentChangeType === 'threshold') {
        const t = document.getElementById('irr_newThreshold').value;
        const f = document.getElementById('irr_forceTakuso').checked;
        if (!f && (!t || isNaN(parseInt(t)))) { alert('⚠️ 冊数を入力するか強制宅送を選択してください。'); return; }
        changeData.newThreshold = t ? parseInt(t) : null;
        changeData.forceTakuso  = f;
    } else if (currentChangeType === 'fixedDate') {
        const fd = document.getElementById('irr_fixedDate').value;
        if (!fd) { alert('⚠️ 固定出荷日を入力してください。'); return; }
        changeData.fixedDate = fd;
    } else if (currentChangeType === 'leadTimeChange') {
        const dl = document.getElementById('irr_directLead').value;
        const tl = document.getElementById('irr_takusoLead').value;
        if (!dl && !tl) { alert('⚠️ いずれかのリードタイムを入力してください。'); return; }
        changeData.directLead = dl ? parseInt(dl) : null;
        changeData.takusoLead = tl ? parseInt(tl) : null;
    }

    appState.irregularList.push({ id: Date.now(), startDate, endDate, publisher, changeData, memo });
    saveState();
    renderIrregularList();
    recalcAllTabs();

    document.getElementById('irr_startDate').value = '';
    document.getElementById('irr_endDate').value   = '';
    document.getElementById('irr_publisher').value = '';
    document.getElementById('irr_memo').value      = '';
    renderChangeDetailArea(currentChangeType);
    alert('✅ イレギュラーを登録しました。');
}

function renderIrregularList() {
    const container = document.getElementById('irregularListContainer');
    if (appState.irregularList.length === 0) {
        container.innerHTML = '<div class="no-data">登録されたイレギュラーはありません</div>';
        return;
    }
    const todayStr = toISODate(getNow());
    container.innerHTML = appState.irregularList.map(e => {
        const isActive  = e.startDate <= todayStr && todayStr <= e.endDate;
        const isExpired = e.endDate < todayStr;
        const cls   = isExpired ? 'expired' : isActive ? 'active-now' : '';
        const badge = isExpired
            ? '<span class="irregular-badge expired-tag">期限切れ</span>'
            : isActive
                ? '<span class="irregular-badge active">適用中</span>'
                : '<span class="irregular-badge waiting">適用待ち</span>';
        const pubName = e.publisher === 'ALL_PUBLISHERS' ? '🌐 全出版社' : e.publisher;
        return `
            <div class="irregular-item ${cls}">
                <div style="flex:1;">
                    <div>${badge}<strong>${pubName}</strong></div>
                    <div style="font-size:12px;color:#6c757d;">📅 ${e.startDate} 〜 ${e.endDate}</div>
                    <div style="font-size:13px;color:#495057;">${buildChangeDescription(e.changeData)}</div>
                    ${e.memo ? `<div style="font-size:12px;color:#6c757d;font-style:italic;">📝 ${e.memo}</div>` : ''}
                </div>
                <button class="btn-small" onclick="deleteIrregular(${e.id})">削除</button>
            </div>`;
    }).join('');
}

function buildChangeDescription(cd) {
    if (cd.type === 'shipDelay')
        return `出荷日を <strong>+${cd.delayDays}営業日</strong> 遅らせる`;
    if (cd.type === 'threshold')
        return cd.forceTakuso
            ? '<strong style="color:#dc3545;">強制宅送</strong>'
            : `直送条件を <strong>${cd.newThreshold}冊以上</strong> に変更`;
    if (cd.type === 'fixedDate')
        return `出荷日を <strong>${cd.fixedDate}</strong> に固定`;
    if (cd.type === 'leadTimeChange') {
        let t = '';
        if (cd.directLead != null) t += `直送 ${cd.directLead}営業日 `;
        if (cd.takusoLead != null) t += `宅送 ${cd.takusoLead}営業日`;
        return t;
    }
    return '変更内容なし';
}

function deleteIrregular(id) {
    if (!confirm('このイレギュラー設定を削除しますか？')) return;
    appState.irregularList = appState.irregularList.filter(e => e.id !== id);
    saveState();
    renderIrregularList();
    recalcAllTabs();
}

function getActiveIrregular(name, dateObj) {
    const s = toISODate(dateObj || getNow());
    return appState.irregularList.find(e =>
        (e.publisher === name || e.publisher === 'ALL_PUBLISHERS') &&
        e.startDate <= s && s <= e.endDate
    ) || null;
}
