// ========================================================================
// ui_helpers.js  ―  出版社選択ボタン群など、タブ間で共通のUI生成処理
// ========================================================================

// prefix: 'std' | 'det' | 'past' など。stateObj: そのタブ専用のstateオブジェクト
// defaultState: 省略時は'none'。'over'を渡すと初期状態を「条件以上（注文する想定）」で表示する（③タブの主要出版社で使用）
function generatePublisherButtons(containerId, publishers, allPublishersMap, prefix, stateObj, onChangeCb, defaultState) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const initState = defaultState || 'none';
    publishers.forEach(pub => {
        let name = Array.from(allPublishersMap.keys()).find(k => k === pub);
        if (!name) name = Array.from(allPublishersMap.keys()).find(k => k.includes(pub.split(' / ')[0]));
        if (!name) return;
        if (!(name in stateObj)) stateObj[name] = initState;
        const st = stateObj[name];
        const cond = allPublishersMap.get(name) || '';
        const item = document.createElement('div');
        item.className = 'publisher-item';
        const escName = name.replace(/'/g, "\\'");
        item.innerHTML = `
            <div class="publisher-name">${name}</div>
            <div class="publisher-condition">(${cond})</div>
            <div class="button-group">
                <button class="btn none ${st==='none'?'active':''}" onclick="setPublisherState('${prefix}','${escName}','none',this)">なし</button>
                <button class="btn under ${st==='under'?'active':''}" onclick="setPublisherState('${prefix}','${escName}','under',this)">条件未満</button>
                <button class="btn over ${st==='over'?'active':''}" onclick="setPublisherState('${prefix}','${escName}','over',this)">条件以上</button>
            </div>`;
        container.appendChild(item);
    });
}

// タブごとの stateObj マップ・再計算関数マップ
const TAB_STATE_MAP = {};
const TAB_RECALC_MAP = {};

function registerTabState(prefix, stateObj, recalcFn) {
    TAB_STATE_MAP[prefix] = stateObj;
    TAB_RECALC_MAP[prefix] = recalcFn;
}

function setPublisherState(prefix, publisher, state, button) {
    const stateObj = prefix === 'std' ? std_publisherStates
        : prefix === 'det' ? det_publisherStates
        : prefix === 'dl'  ? dl_publisherStates
        : prefix === 'past' ? past_publisherStates
        : null;
    if (!stateObj) return;
    stateObj[publisher] = state;
    const item = button.closest('.publisher-item');
    item.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    if (prefix === 'std') calcStandard();
    if (prefix === 'det') calcDetail();
    if (prefix === 'dl')  calcDeadline();
    if (prefix === 'past') calcPast();
}

function toggleOthers(containerId) {
    const el = document.getElementById(containerId);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function updateRegionalVisibility(prefix) {
    const regionEl = document.getElementById(prefix + '_region');
    if (!regionEl) return;
    const region = regionEl.value;
    const sec = document.getElementById(prefix + '_regionalSection');
    if (!sec) return;
    if (region === 'chugoku' || region === 'shikoku') {
        sec.style.display = 'block';
    } else {
        sec.style.display = 'none';
        const stateObj = prefix === 'std' ? std_publisherStates
            : prefix === 'det' ? det_publisherStates
            : prefix === 'dl'  ? dl_publisherStates
            : past_publisherStates;
        REGIONAL_PUBLISHERS.forEach(pub => {
            const fullName = Object.keys(stateObj).find(k => k.includes(pub));
            if (fullName && stateObj[fullName] !== 'none') {
                stateObj[fullName] = 'none';
                document.querySelectorAll(`#${sec.id} .publisher-item, #${prefix}_regionalPublishers .publisher-item`).forEach(item => {
                    const nameEl = item.querySelector('.publisher-name');
                    if (nameEl && nameEl.textContent === fullName) {
                        item.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
                        item.querySelector('.btn.none').classList.add('active');
                    }
                });
            }
        });
    }
}
