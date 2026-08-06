// ========================================================================
// tab_past.js  ―  ④過去納期確認タブ（過去/任意の注文日時を指定。Excel取込データを最優先）
// ========================================================================

let past_publisherStates = {};

function initPastTab() {
    const root = document.getElementById('past_root');
    root.innerHTML = `
        <div class="control-panel">
            <div class="form-row">
                <div class="form-group">
                    <label for="past_orderDate">📅 注文日（過去日も指定可）</label>
                    <input type="date" id="past_orderDate">
                </div>
                <div class="form-group">
                    <label for="past_orderTime">⏰ 注文時刻</label>
                    <input type="time" id="past_orderTime">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="past_pref">🗺️ 都道府県（任意）</label>
                    <select id="past_pref">
                        <option value="">-- 指定しない --</option>
                        ${PREFECTURE_LIST.map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="past_city">🏙️ 市町村（任意）</label>
                    <input type="text" id="past_city" placeholder="例：八丈町">
                </div>
            </div>
            <div class="form-group">
                <label for="past_region">🚚 配送地域（都道府県から自動設定・手動変更可）</label>
                <select id="past_region">
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

        <div class="tab-desc" style="margin-bottom:16px;">📥 該当日時のExcel取込データがある場合は、そちらの値を最優先で表示します。取込データが無い期間は基本ルールで計算した推定値を表示します。</div>

        <button class="reset-btn" onclick="resetPastStates()">🔄 注文内容をリセット（全てなしに戻す）</button>

        <div class="publisher-section">
            <h4>主要出版社</h4>
            <div id="past_mainPublishers"></div>
        </div>
        <div class="publisher-section" id="past_regionalSection" style="display:none;">
            <h4>中四国のみ</h4>
            <div id="past_regionalPublishers"></div>
        </div>
        <div class="toggle-others"><button onclick="toggleOthers('past_otherPublishers')">その他の出版社を表示/非表示</button></div>
        <div id="past_otherPublishers" class="publisher-section" style="display:none;">
            <h4>その他の出版社</h4>
            <div id="past_otherPublishersList"></div>
        </div>
        <div id="past_resultArea" class="result-area" style="display:none;"></div>
    `;

    const allPub = buildAllPublishersMap();
    generatePublisherButtons('past_mainPublishers', MAIN_PUBLISHERS, allPub, 'past', past_publisherStates);
    generatePublisherButtons('past_regionalPublishers', REGIONAL_PUBLISHERS, allPub, 'past', past_publisherStates);
    const others = Array.from(allPub.keys()).filter(p =>
        !MAIN_PUBLISHERS.some(m => p.includes(m.split(' / ')[0])) && !REGIONAL_PUBLISHERS.includes(p));
    generatePublisherButtons('past_otherPublishersList', others, allPub, 'past', past_publisherStates);

    // 初期値：1週間前
    const def = getNow();
    def.setDate(def.getDate() - 7);
    document.getElementById('past_orderDate').value = toISODate(def);
    document.getElementById('past_orderTime').value = '10:00';

    document.getElementById('past_pref').addEventListener('change', () => {
        const pref = document.getElementById('past_pref').value;
        if (pref && PREFECTURE_TO_REGION[pref]) {
            document.getElementById('past_region').value = PREFECTURE_TO_REGION[pref];
            updateRegionalVisibility('past');
        }
        calcPast();
    });
    document.getElementById('past_city').addEventListener('input', calcPast);
    document.getElementById('past_region').addEventListener('change', () => { updateRegionalVisibility('past'); calcPast(); });
    document.getElementById('past_orderDate').addEventListener('change', calcPast);
    document.getElementById('past_orderTime').addEventListener('change', calcPast);

    applyOfficeDefaultRegion();
    updateRegionalVisibility('past');
}

function resetPastStates() {
    Object.keys(past_publisherStates).forEach(p => past_publisherStates[p] = 'none');
    document.querySelectorAll('#tab-past .publisher-item').forEach(item => {
        item.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        item.querySelector('.btn.none').classList.add('active');
    });
    document.getElementById('past_resultArea').style.display = 'none';
    document.getElementById('deliverySummaryBanner').style.display = 'none';
}

function calcPast() {
    const region = document.getElementById('past_region')?.value;
    const dateStr = document.getElementById('past_orderDate')?.value;
    const timeStr = document.getElementById('past_orderTime')?.value || '10:00';
    if (!region || !dateStr) return;

    const [y,m,d] = dateStr.split('-').map(Number);
    const [hh,mm] = timeStr.split(':').map(Number);
    const orderDateTime = new Date(y, m-1, d, hh, mm);

    const pref = document.getElementById('past_pref').value || null;
    const city = document.getElementById('past_city').value.trim() || null;

    const hasAny = Object.values(past_publisherStates).some(s => s !== 'none');
    if (!hasAny) {
        document.getElementById('past_resultArea').style.display = 'none';
        document.getElementById('deliverySummaryBanner').style.display = 'none';
        return;
    }

    // 過去タブ：手動修正は「今現在の実運用向け」の値なので反映しない。Excel取込データは最優先で使用する。
    const result = calcCore({
        orderDateTime, region, pref, city,
        publisherStates: past_publisherStates,
        useManualOverrides: false,
        useExcelData: true,
        forceNextDay: false
    });

    updateDeliverySummaryBanner(result.orders);
    let locationLabel = '';
    if (pref) locationLabel = `📍 ${pref}${city ? ' ' + city : ''}`;
    const html = renderResultHtml(result, { showManualOverride:false, locationLabel });
    document.getElementById('past_resultArea').innerHTML = html;
    document.getElementById('past_resultArea').style.display = 'block';
}
