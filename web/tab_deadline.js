// ========================================================================
// tab_deadline.js  ―  ③注文締切逆算タブ
// ------------------------------------------------------------------------
// 「いつまでに届けたいか(目標納品日)」を指定 → 出版社ごとの注文締切日時を逆算し、
// 全出版社が間に合う「最速締切（＝この日時までに注文すればすべて間に合う）」を表示する。
// ========================================================================

let dl_publisherStates = {};

function initDeadlineTab() {
    const root = document.getElementById('dl_root');
    root.innerHTML = `
        <div class="control-panel">
            <div class="form-row">
                <div class="form-group">
                    <label for="dl_targetDate">🎯 希望到着日（この日までに届けたい）</label>
                    <input type="date" id="dl_targetDate">
                </div>
                <div class="form-group">
                    <label for="dl_pref">🗺️ 都道府県（任意）</label>
                    <select id="dl_pref">
                        <option value="">-- 指定しない --</option>
                        ${PREFECTURE_LIST.map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="dl_city">🏙️ 市町村（任意・離島など特殊地域の判定に使用）</label>
                    <input type="text" id="dl_city" placeholder="例：八丈町">
                </div>
                <div class="form-group">
                    <label for="dl_region">🚚 配送地域（都道府県から自動設定・手動変更可）</label>
                    <select id="dl_region">
                        <option value="hokkaido">北海道</option>
                        <option value="tohoku">東北</option>
                        <option value="kanto" selected>関東</option>
                        <option value="chubu">中部</option>
                        <option value="kinki">近畿</option>
                        <option value="chugoku">中国</option>
                        <option value="shikoku">四国</option>
                        <option value="kyushu">九州</option>
                        <option value="okinawa">沖縄</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="tab-desc" style="background:#fff3cd;border-left-color:#ffc107;">💡 主要出版社は最初から「条件以上（注文する）」で一覧表示されています。注文しないメーカーは「なし」を押して減らし、主要以外を追加したい場合は下の「その他の出版社を表示」から選んでください。</div>

        <button class="reset-btn" onclick="resetDeadlineStates()">🔄 主要出版社の初期状態に戻す</button>

        <div class="publisher-section">
            <h4>主要出版社</h4>
            <div id="dl_mainPublishers"></div>
        </div>
        <div class="publisher-section" id="dl_regionalSection" style="display:none;">
            <h4>中四国のみ</h4>
            <div id="dl_regionalPublishers"></div>
        </div>
        <div class="toggle-others"><button onclick="toggleOthers('dl_otherPublishers')">その他の出版社を表示/非表示（主要以外を追加）</button></div>
        <div id="dl_otherPublishers" class="publisher-section" style="display:none;">
            <h4>その他の出版社</h4>
            <div id="dl_otherPublishersList"></div>
        </div>
        <div id="dl_resultArea" style="display:none;"></div>
    `;

    const allPub = buildAllPublishersMap();
    // ===== 主要出版社は初期状態から「条件以上（注文する）」で一覧表示し、そこから減らす／追加する運用に変更 =====
    generatePublisherButtons('dl_mainPublishers', MAIN_PUBLISHERS, allPub, 'dl', dl_publisherStates, null, 'over');
    generatePublisherButtons('dl_regionalPublishers', REGIONAL_PUBLISHERS, allPub, 'dl', dl_publisherStates, null, 'none');
    const others = Array.from(allPub.keys()).filter(p =>
        !MAIN_PUBLISHERS.some(m => p.includes(m.split(' / ')[0])) && !REGIONAL_PUBLISHERS.includes(p));
    generatePublisherButtons('dl_otherPublishersList', others, allPub, 'dl', dl_publisherStates, null, 'none');

    // 初期値：1週間後
    const def = getNow();
    def.setDate(def.getDate() + 7);
    document.getElementById('dl_targetDate').value = toISODate(def);

    document.getElementById('dl_pref').addEventListener('change', () => {
        const pref = document.getElementById('dl_pref').value;
        if (pref && PREFECTURE_TO_REGION[pref]) {
            document.getElementById('dl_region').value = PREFECTURE_TO_REGION[pref];
            updateRegionalVisibility('dl');
        }
        calcDeadline();
    });
    document.getElementById('dl_city').addEventListener('input', calcDeadline);
    document.getElementById('dl_region').addEventListener('change', () => { updateRegionalVisibility('dl'); calcDeadline(); });
    document.getElementById('dl_targetDate').addEventListener('change', calcDeadline);

    applyOfficeDefaultRegion();
    updateRegionalVisibility('dl');
    // ===== 主要出版社が初期状態で「条件以上」のため、表示直後から結果を自動計算 =====
    calcDeadline();
}

// ===== リセット：主要出版社は「条件以上」（注文する想定）に戻し、中四国・その他は「なし」に戻す =====
function resetDeadlineStates() {
    Object.keys(dl_publisherStates).forEach(p => {
        const isMain = MAIN_PUBLISHERS.some(m => p.includes(m.split(' / ')[0]));
        dl_publisherStates[p] = isMain ? 'over' : 'none';
    });
    document.querySelectorAll('#tab-deadline .publisher-item').forEach(item => {
        const nameEl = item.querySelector('.publisher-name');
        const isMain = nameEl && MAIN_PUBLISHERS.some(m => nameEl.textContent.includes(m.split(' / ')[0]));
        item.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        item.querySelector(isMain ? '.btn.over' : '.btn.none').classList.add('active');
    });
    calcDeadline();
}

// ===== 出版社1件分の締切逆算 =====
// targetDate: Date（希望到着日） 戻り値: {deadlineDate:Date, deadlineHour:number} | null（取扱なしの場合）
function computeDeadlineForOrder(o, region, pref, city, targetDate) {
    const rule = getBaseRule(o.name);
    let baseLeadTime = o.isDirect
        ? (rule.directLeadTime ?? rule.takusoLeadTime)
        : (rule.takusoLeadTime ?? rule.directLeadTime);
    if (baseLeadTime === null) return null;

    const extraRegionDays = getRegionExceptionDays(pref, city);
    const deliveryDays = getDeliveryDays(o.name, region, o.isDirect, pref) + extraRegionDays;

    // 出荷から到着までの日数を逆算し、「これまでに出荷しないといけない日」を求める
    const mustShipBy = new Date(targetDate);
    mustShipBy.setDate(mustShipBy.getDate() - deliveryDays);

    // 収束計算（文理木曜特殊ルール・イレギュラーのリードタイム変更を反映するため数回反復）
    let effDate = subtractBusinessDays(mustShipBy, baseLeadTime);
    for (let i = 0; i < 3; i++) {
        let lt = baseLeadTime;
        let label = '';
        if (isBunriThursdayRule(o.name, effDate)) { lt = 2; label = ' [木曜→月曜特殊ルール]'; }
        const irr = getActiveIrregular(o.name, effDate);
        if (irr && irr.changeData.type === 'leadTimeChange') {
            const cd = irr.changeData;
            if (o.isDirect && cd.directLead != null) lt = cd.directLead;
            if (!o.isDirect && cd.takusoLead != null) lt = cd.takusoLead;
            label = ' [イレギュラー適用]';
        }
        let extraDelay = 0;
        if (irr && irr.changeData.type === 'shipDelay') { extraDelay = irr.changeData.delayDays; label = ' [イレギュラー遅延適用]'; }
        const newEffDate = subtractBusinessDays(mustShipBy, lt + extraDelay);
        if (newEffDate.getTime() === effDate.getTime()) { o._deadlineNote = label; break; }
        effDate = newEffDate;
        o._deadlineNote = label;
    }

    return { deadlineDate: effDate, deadlineHour: rule.deadlineHour };
}

function calcDeadline() {
    const region = document.getElementById('dl_region')?.value;
    const targetStr = document.getElementById('dl_targetDate')?.value;
    if (!region || !targetStr) return;

    const [ty,tm,td] = targetStr.split('-').map(Number);
    const targetDate = new Date(ty, tm-1, td);
    const pref = document.getElementById('dl_pref').value || null;
    const city = document.getElementById('dl_city').value.trim() || null;

    const hasAny = Object.values(dl_publisherStates).some(s => s !== 'none');
    if (!hasAny) {
        document.getElementById('dl_resultArea').style.display = 'none';
        return;
    }

    // ===== 直送/宅送 判定（共通ロジック） =====
    const orders = [];
    for (const [pub, state] of Object.entries(dl_publisherStates)) {
        if (state === 'none') continue;
        const cond = JSON.parse(JSON.stringify(getCondition(pub)));
        orders.push({ name: pub, state, cond, isDirect: false, reason: '' });
    }
    if (orders.length === 0) {
        document.getElementById('dl_resultArea').style.display = 'none';
        return;
    }
    classifyOrders(orders, region);

    // ===== 締切逆算 =====
    let earliest = null; // 最も早い（=最も厳しい）締切
    orders.forEach(o => {
        const dl = computeDeadlineForOrder(o, region, pref, city, targetDate);
        if (!dl) { o.deadlineInfo = null; return; }
        o.deadlineInfo = dl;
        const dlDateTime = new Date(dl.deadlineDate);
        dlDateTime.setHours(dl.deadlineHour, 0, 0, 0);
        if (!earliest || dlDateTime < earliest.dateTime) {
            earliest = { dateTime: dlDateTime, publisher: o.name };
        }
    });

    // ===== 描画 =====
    let html = `<h3>📋 注文締切逆算結果</h3>`;
    html += `<p style="color:#666;margin-bottom:12px;font-size:13px;">希望到着日: ${fmtDateFull(targetDate)} ／ 地域: ${REGION_NAMES[region]||region}${pref ? ' ／ 📍 ' + pref + (city?(' '+city):'') : ''}</p>`;

    if (earliest) {
        html += `
            <div class="deadline-hero">
                <div class="label">🚨 全て間に合わせるための注文締切（最速締切）</div>
                <div class="value">${fmtDateFull(earliest.dateTime)} ${String(earliest.dateTime.getHours()).padStart(2,'0')}:00 まで</div>
                <div style="font-size:12px;margin-top:6px;opacity:.85;">（最も厳しいのは「${earliest.publisher}」の締切です）</div>
            </div>`;
    }

    html += `<table class="deadline-table"><thead><tr>
        <th>出版社</th><th>判定</th><th>締切日</th><th>締切時刻</th><th>備考</th>
    </tr></thead><tbody>`;
    orders.slice().sort((a,b) => {
        const at = a.deadlineInfo ? new Date(a.deadlineInfo.deadlineDate).setHours(a.deadlineInfo.deadlineHour) : Infinity;
        const bt = b.deadlineInfo ? new Date(b.deadlineInfo.deadlineDate).setHours(b.deadlineInfo.deadlineHour) : Infinity;
        return at - bt;
    }).forEach(o => {
        const isEarliestRow = earliest && o.name === earliest.publisher;
        const bt = o.isDirect ? '直送' : '宅送';
        const bc = o.isDirect ? 'direct' : 'takuso';
        if (!o.deadlineInfo) {
            html += `<tr><td>${o.name}</td><td><span class="badge ${bc}">${bt}</span></td><td colspan="2">取扱なし</td><td>-</td></tr>`;
            return;
        }
        html += `<tr class="${isEarliestRow ? 'earliest' : ''}">
            <td>${o.name}</td>
            <td><span class="badge ${bc}">${bt}</span></td>
            <td>${fmtDate(o.deadlineInfo.deadlineDate)}</td>
            <td>${String(o.deadlineInfo.deadlineHour).padStart(2,'0')}:00まで</td>
            <td style="font-size:11px;color:#856404;">${o._deadlineNote || ''}</td>
        </tr>`;
    });
    html += `</tbody></table>`;

    document.getElementById('dl_resultArea').innerHTML = html;
    document.getElementById('dl_resultArea').style.display = 'block';
}
