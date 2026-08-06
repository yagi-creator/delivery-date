// ========================================================================
// app.js  ―  共通ロジック（日付・営業日計算・休業日管理・ストレージ・タブ制御）
// ========================================================================

const WDAYS = ['日','月','火','水','木','金','土'];
const STORAGE_KEY = 'nouki_app_state_v1';

// ===== グローバル状態（localStorageに永続化） =====
let appState = {
    holidays: [],          // {date:'YYYY-MM-DD', name, type:'holiday'|'business'}
    irregularList: [],      // 既存イレギュラー
    manualOverrides: {},    // 出版社別 出荷日手動修正
    office: '',             // 選択中オフィス
    excelImports: [],       // 取り込んだExcelデータのメタ情報
    excelShipData: {},      // { 'YYYY-MM-DD': { '出版社名': {direct:'YYYY-MM-DD'|null, takuso:'YYYY-MM-DD'|null} } }
    regionExceptions: []    // {pref, city, days, note}
};

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            appState = Object.assign(appState, parsed);
        }
    } catch(e) { console.warn('state load failed', e); }
    if (!appState.holidays || appState.holidays.length === 0) {
        appState.holidays = DEFAULT_HOLIDAYS.slice();
    }
}
function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); } catch(e) { console.warn('state save failed', e); }
}

// ===== 現在時刻 =====
function getNow() { return new Date(); }
function fmtDate(d) { return `${d.getMonth()+1}/${d.getDate()}(${WDAYS[d.getDay()]})`; }
function fmtDateFull(d) { return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}(${WDAYS[d.getDay()]})`; }
function toISODate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function parseISODate(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }

function updateCurrentDateTime() {
    const now = getNow();
    const el = document.getElementById('currentDateTime');
    if (!el) return;
    const month = String(now.getMonth()+1).padStart(2,'0');
    const day   = String(now.getDate()).padStart(2,'0');
    const hours = String(now.getHours()).padStart(2,'0');
    const mins  = String(now.getMinutes()).padStart(2,'0');
    el.textContent = `${month}月${day}日（${WDAYS[now.getDay()]}） ${hours}:${mins}`;
}

// ===== 共有状態の作成/公開/同期 =====
function buildSharedState() {
    // 共有したいのは: holidays, irregularList, manualOverrides, regionExceptions, excelShipData (出荷日)
    const ship = {};
    Object.entries(appState.excelShipData || {}).forEach(([date, pubs]) => {
        ship[date] = {};
        Object.entries(pubs).forEach(([k,v]) => {
            // 共有時は source を除外
            ship[date][k] = { direct: v.direct || null, takuso: v.takuso || null };
        });
    });
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        holidays: appState.holidays || [],
        irregularList: appState.irregularList || [],
        manualOverrides: appState.manualOverrides || {},
        regionExceptions: appState.regionExceptions || [],
        excelShipData: ship
    };
}

async function publishSharedState(token, targetRepo) {
    if (!token) throw new Error('GitHub token is required');
    targetRepo = targetRepo || 'yagi-creator/delivery-date';
    const [owner, repo] = targetRepo.split('/');
    const path = 'shared/shared_state.json';
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const shared = buildSharedState();
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(shared, null, 2))));
    // Try to get existing file to obtain sha
    const getRes = await fetch(url, { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' }});
    let sha = null;
    if (getRes.ok) {
        const j = await getRes.json();
        sha = j.sha;
    }
    const body = { message: 'Publish shared_state.json (by app)', content, branch: 'main' };
    if (sha) body.sha = sha;
    const putRes = await fetch(url, { method: 'PUT', headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json', 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    if (!putRes.ok) {
        const text = await putRes.text();
        throw new Error('GitHub API error: ' + putRes.status + ' ' + text);
    }
    const rj = await putRes.json();
    // record that a published version exists
    return rj;
}

async function syncSharedState(token, targetRepo) {
    targetRepo = targetRepo || 'yagi-creator/delivery-date';
    const [owner, repo] = targetRepo.split('/');
    const path = 'shared/shared_state.json';
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: token ? { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' } : { Accept: 'application/vnd.github.v3+json' } });
    if (!res.ok) {
        const t = await res.text();
        throw new Error('Failed to fetch shared state: ' + res.status + ' ' + t);
    }
    const j = await res.json();
    const content = atob(j.content.replace(/\n/g,''));
    const shared = JSON.parse(decodeURIComponent(escape(content)));
    mergeSharedState(shared);
    saveState();
    recalcAllTabs();
    return shared;
}

function mergeSharedState(shared) {
    if (!shared) return;
    // Merge holidays: replace by shared (but keep any local ones not in shared?)
    // Strategy: take shared as authoritative for holidays/irregulars/regionExceptions/manualOverrides/excelShipData
    if (Array.isArray(shared.holidays)) appState.holidays = shared.holidays.slice();
    if (Array.isArray(shared.irregularList)) appState.irregularList = shared.irregularList.slice();
    if (shared.manualOverrides && typeof shared.manualOverrides === 'object') appState.manualOverrides = Object.assign({}, shared.manualOverrides);
    if (Array.isArray(shared.regionExceptions)) appState.regionExceptions = shared.regionExceptions.slice();
    if (shared.excelShipData && typeof shared.excelShipData === 'object') {
        // Merge excelShipData by replacing entries for the dates present in shared
        appState.excelShipData = appState.excelShipData || {};
        Object.entries(shared.excelShipData).forEach(([date, pubs]) => {
            appState.excelShipData[date] = appState.excelShipData[date] || {};
            Object.entries(pubs).forEach(([k,v]) => {
                appState.excelShipData[date][k] = { direct: v.direct || null, takuso: v.takuso || null, source: 'shared' };
            });
        });
    }
}

// expose to global for settings.js
window.publishSharedState = publishSharedState;
window.syncSharedState = syncSharedState;

// ===== 休業日判定（設定タブで編集された appState.holidays を使用） =====
function getHolidayEntry(dateObj) {
    const s = toISODate(dateObj);
    return appState.holidays.find(h => h.date === s) || null;
}
function isBusinessDay(dateObj) {
    const entry = getHolidayEntry(dateObj);
    if (entry) {
        // 明示的な特別営業日 → 営業日扱い
        if (entry.type === 'business') return true;
        // 明示的な休業日 → 休業扱い
        return false;
    }
    const dow = dateObj.getDay();
    return !(dow === 0 || dow === 6); // 土日以外は営業日
}
function getNextBusinessDay(dateObj) {
    const d = new Date(dateObj);
    do { d.setDate(d.getDate()+1); } while (!isBusinessDay(d));
    return d;
}
function getPrevBusinessDay(dateObj) {
    const d = new Date(dateObj);
    do { d.setDate(d.getDate()-1); } while (!isBusinessDay(d));
    return d;
}
function addBusinessDays(startDate, n) {
    let d = new Date(startDate), added = 0;
    while (added < n) {
        d.setDate(d.getDate()+1);
        if (isBusinessDay(d)) added++;
    }
    return d;
}
function subtractBusinessDays(startDate, n) {
    let d = new Date(startDate), subtracted = 0;
    while (subtracted < n) {
        d.setDate(d.getDate()-1);
        if (isBusinessDay(d)) subtracted++;
    }
    return d;
}

// ===== 実質注文受付日 =====
function getEffectiveOrderDate(baseDate, currentHour, rule) {
    let d = new Date(baseDate);
    if (currentHour >= rule.deadlineHour) {
        d = addBusinessDays(d, rule.afterDeadlineAdd ?? 1);
    }
    return d;
}

// ===== 出版社名ルックアップ（部分一致対応） =====
function getBaseRule(name) {
    if (BASE_SHIPPING_RULES[name]) return BASE_SHIPPING_RULES[name];
    for (const [k,v] of Object.entries(BASE_SHIPPING_RULES)) {
        if (name.includes(k.split(' / ')[0])) return v;
    }
    return { deadlineHour:16, directLeadTime:2, takusoLeadTime:3, afterDeadlineAdd:1, isENGroup:false };
}
function getCondition(name) {
    if (PUBLISHER_CONDITIONS[name]) return PUBLISHER_CONDITIONS[name];
    for (const [k,v] of Object.entries(PUBLISHER_CONDITIONS)) {
        if (name.includes(k.split(' / ')[0])) return v;
    }
    return { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[], forbiddenRegions:[], isENGroup:false, specialRule:null };
}

// ===== 文理木曜特殊ルール =====
function isBunriThursdayRule(name, effectiveDate) {
    return name.includes('文理') && effectiveDate.getDay() === 4;
}

// ===== 地域別配送日数（基本ルール） =====
// pref: 都道府県名（'東京都'など）。指定があれば都道府県別テーブル(PREF_EXTRA_DAYS_*)を優先的に使用する。
// pref省略時（①標準納期確認タブなど地域のみ選択の場合）は地域(9ブロック)単位の従来ロジックにフォールバック。
function getDeliveryDays(name, region, isDirect, pref) {
    const baseDays = 1; // 基準＝出荷日+1日（翌日着）

    if (!isDirect) {
        if (pref) {
            const extra = PREF_EXTRA_DAYS_TAKUSO[pref] || 0;
            return baseDays + extra;
        }
        // 都道府県未指定時：地域単位フォールバック（東北・北海道・沖縄は+1日相当）
        return ['hokkaido','tohoku','okinawa'].includes(region) ? 2 : 1;
    }

    // ===== 直送：都道府県別テーブルがあれば優先 =====
    if (pref) {
        const table = findPrefExtraTableDirect(name);
        if (table && table[pref] != null) {
            return baseDays + table[pref];
        }
        // テーブルに該当出版社があるが、その都道府県は例外リストに無い → 通常+1日
        if (table) return baseDays;
    }

    // ===== 都道府県未指定時：地域(9ブロック)単位フォールバック =====
    if (name.includes('EN')) {
        return ['hokkaido','okinawa'].includes(region) ? 2 : 1;
    }
    if (name.includes('学書')) {
        if (['hokkaido','okinawa'].includes(region)) return 2;
        if (region === 'tohoku') return 3;
        return 1;
    }
    if (name.includes('文理')) {
        return ['shikoku','chugoku','kyushu','hokkaido','okinawa'].includes(region) ? 2 : 1;
    }
    if (name.includes('好学')) {
        return ['hokkaido','tohoku','kyushu'].includes(region) ? 2 : 1;
    }
    return ['hokkaido','okinawa'].includes(region) ? 2 : 1;
}

// ===== 地域特殊ルール（都道府県・市町村 追加日数） =====
function getRegionExceptionDays(pref, city) {
    if (!pref) return 0;
    let extra = 0;
    appState.regionExceptions.forEach(ex => {
        if (ex.pref === pref) {
            if (!ex.city) { extra = Math.max(extra, ex.days); }
            else if (city && city.includes(ex.city)) { extra = Math.max(extra, ex.days); }
        }
    });
    return extra;
}

// ===== 全出版社一覧（Map: 名前 -> 条件テキスト） =====
function buildAllPublishersMap() {
    const map = new Map();
    Object.keys(PUBLISHER_CONDITIONS).forEach(pub => {
        const c = PUBLISHER_CONDITIONS[pub];
        const text = c.quantityThreshold
            ? `${c.quantityThreshold}冊以上で直送`
            : c.specialRule === 'always_direct' ? '常に直送'
            : c.specialRule === 'always_takuso' ? '常に宅送'
            : '条件あり';
        map.set(pub, text);
    });
    return map;
}

// ===== タブ切替 =====
function initTabs() {
    document.querySelectorAll('.tab-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
    document.querySelectorAll('.settings-nav button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.settings-nav button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.settings).classList.add('active');
        });
    });
}

// ===== 初期化 =====
window.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateCurrentDateTime();
    setInterval(updateCurrentDateTime, 30000);
    initTabs();
    initSettingsBasic();
    initSettingsHoliday();
    initSettingsExcel();
    initSettingsException();
    initIrregularUI();

    initStandardTab();
    initDetailTab();
    initDeadlineTab();
    initPastTab();
});
