// ========================================================================
// tab_detail.js  ―  ②詳細納期確認タブ（注文日時・都道府県・市町村まで指定）
// ========================================================================

let det_publisherStates = {};

function initDetailTab() {
    const root = document.getElementById('det_root');
    root.innerHTML = `
        <div class="control-panel">
            <div class="form-row">
                <div class="form-group">
                    <label for="det_orderDate">📅 注文日</label>
                    <input type="date" id="det_orderDate">
                </div>
                <div class="form-group">
                    <label for="det_orderTime">⏰ 注文時刻</label>
                    <input type="time" id="det_orderTime">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="det_pref">🗺️ 都道府県</label>
                    <select id="det_pref">
                        <option value="">-- 選択してください --</option>
                        ${PREFECTURE_LIST.map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="det_city">🏙️ 市町村（任意・離島など特殊地域の判定に使用）</label>
                    <input type="text" id="det_city" placeholder="例：八丈町">
                </div>
            </div>
            <div class="form-group">
                <label for="det_region">🚚 配送地域（都道府県から自動設定・手動変更可）</label>
                <select id="det_region">
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

        <button class="reset-btn" onclick="resetDetailStates()">🔄 注文内容をリセット（全てなしに戻す）</button>

        <div class="publisher-section">
            <h4>主要出版社</h4>
            <div id="det_mainPublishers"></div>
        </div>
        <div class="publisher-section" id="det_regionalSection" style="display:none;">
            <h4>中四国のみ</h4>
            <div id="det_regionalPublishers"></div>
        </div>
        <div class="toggle-others"><button onclick="toggleOthers('det_otherPublishers')">その他の出版社を表示/非表示</button></div>
        <div id="det_otherPublishers" class="publisher-section" style="display:none;">
            <h4>その他の出版社</h4>
            <div id="det_otherPublishersList"></div>
        </div>
        <div id="det_resultArea" class="result-area" style="display:none;"></div>
    `;

    const allPub = buildAllPublishersMap();
    generatePublisherButtons('det_mainPublishers', MAIN_PUBLISHERS, allPub, 'det', det_publisherStates);
    generatePublisherButtons('det_regionalPublishers', REGIONAL_PUBLISHERS, allPub, 'det', det_publisherStates);
    const others = Array.from(allPub.keys()).filter(p =>
        !MAIN_PUBLISHERS.some(m => p.includes(m.split(' / ')[0])) && !REGIONAL_PUBLISHERS.includes(p));
    generatePublisherButtons('det_otherPublishersList', others, allPub, 'det', det_publisherStates);

    // 初期値：現在日時
    const now = getNow();
    document.getElementById('det_orderDate').value = toISODate(now);
    document.getElementById('det_orderTime').value =
        `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    document.getElementById('det_pref').addEventListener('change', () => {
        const pref = document.getElementById('det_pref').value;
        if (pref && PREFECTURE_TO_REGION[pref]) {
            document.getElementById('det_region').value = PREFECTURE_TO_REGION[pref];
            updateRegionalVisibility('det');
        }
        calcDetail();
    });
    document.getElementById('det_city').addEventListener('input', calcDetail);
    document.getElementById('det_region').addEventListener('change', () => { updateRegionalVisibility('det'); calcDetail(); });
    document.getElementById('det_orderDate').addEventListener('change', calcDetail);
    document.getElementById('det_orderTime').addEventListener('change', calcDetail);

    applyOfficeDefaultRegion();
    updateRegionalVisibility('det');
}

function resetDetailStates() {
    Object.keys(det_publisherStates).forEach(p => det_publisherStates[p] = 'none');
    document.querySelectorAll('#tab-detail .publisher-item').forEach(item => {
        item.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        item.querySelector('.btn.none').classList.add('active');
    });
    document.getElementById('det_resultArea').style.display = 'none';
    document.getElementById('deliverySummaryBanner').style.display = 'none';
}

function calcDetail() {
    const region = document.getElementById('det_region')?.value;
    const dateStr = document.getElementById('det_orderDate')?.value;
    const timeStr = document.getElementById('det_orderTime')?.value || '10:00';
    if (!region || !dateStr) return;

    const [y,m,d] = dateStr.split('-').map(Number);
    const [hh,mm] = timeStr.split(':').map(Number);
    const orderDateTime = new Date(y, m-1, d, hh, mm);

    const pref = document.getElementById('det_pref').value || null;
    const city = document.getElementById('det_city').value.trim() || null;

    const hasAny = Object.values(det_publisherStates).some(s => s !== 'none');
    if (!hasAny) {
        document.getElementById('det_resultArea').style.display = 'none';
        document.getElementById('deliverySummaryBanner').style.display = 'none';
        return;
    }

    const result = calcCore({
        orderDateTime, region, pref, city,
        publisherStates: det_publisherStates,
        useManualOverrides: true,
        useExcelData: true,
        forceNextDay: false
    });

    updateDeliverySummaryBanner(result.orders);
    let locationLabel = '';
    if (pref) locationLabel = `📍 ${pref}${city ? ' ' + city : ''}`;
    const html = renderResultHtml(result, { showManualOverride:true, locationLabel });
    document.getElementById('det_resultArea').innerHTML = html;
    document.getElementById('det_resultArea').style.display = 'block';
}
