// ========================================================================
// tab_standard.js  ―  ①標準納期確認タブ（地域のみ選択・今すぐ注文想定）
// ========================================================================

let std_publisherStates = {};

function initStandardTab() {
    const root = document.getElementById('std_root');
    root.innerHTML = `
        <div class="control-panel">
            <div class="next-day-mode">
                <label><input type="checkbox" id="std_nextDayMode"> 🚛 翌日手配モード（繁忙期・16時以降対応）</label>
            </div>
            <div class="form-group">
                <label for="std_region">🚚 配送地域:</label>
                <select id="std_region">
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

        <button class="reset-btn" onclick="resetStandardStates()">🔄 注文内容をリセット（全てなしに戻す）</button>

        <div class="publisher-section">
            <h4>主要出版社</h4>
            <div id="std_mainPublishers"></div>
        </div>
        <div class="publisher-section" id="std_regionalSection" style="display:none;">
            <h4>中四国のみ</h4>
            <div id="std_regionalPublishers"></div>
        </div>
        <div class="toggle-others"><button onclick="toggleOthers('std_otherPublishers')">その他の出版社を表示/非表示</button></div>
        <div id="std_otherPublishers" class="publisher-section" style="display:none;">
            <h4>その他の出版社</h4>
            <div id="std_otherPublishersList"></div>
        </div>
        <div id="std_resultArea" class="result-area" style="display:none;"></div>
    `;

    const allPub = buildAllPublishersMap();
    generatePublisherButtons('std_mainPublishers', MAIN_PUBLISHERS, allPub, 'std', std_publisherStates);
    generatePublisherButtons('std_regionalPublishers', REGIONAL_PUBLISHERS, allPub, 'std', std_publisherStates);
    const others = Array.from(allPub.keys()).filter(p =>
        !MAIN_PUBLISHERS.some(m => p.includes(m.split(' / ')[0])) && !REGIONAL_PUBLISHERS.includes(p));
    generatePublisherButtons('std_otherPublishersList', others, allPub, 'std', std_publisherStates);

    document.getElementById('std_region').addEventListener('change', () => { updateRegionalVisibility('std'); calcStandard(); });
    document.getElementById('std_nextDayMode').addEventListener('change', calcStandard);
    applyOfficeDefaultRegion();
    updateRegionalVisibility('std');
}

function resetStandardStates() {
    Object.keys(std_publisherStates).forEach(p => std_publisherStates[p] = 'none');
    document.querySelectorAll('#tab-standard .publisher-item').forEach(item => {
        item.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        item.querySelector('.btn.none').classList.add('active');
    });
    document.getElementById('std_resultArea').style.display = 'none';
    document.getElementById('deliverySummaryBanner').style.display = 'none';
}

function calcStandard() {
    const region = document.getElementById('std_region')?.value;
    if (!region) return;
    const isNextDay = document.getElementById('std_nextDayMode').checked;
    const hasAny = Object.values(std_publisherStates).some(s => s !== 'none');
    if (!hasAny) {
        document.getElementById('std_resultArea').style.display = 'none';
        document.getElementById('deliverySummaryBanner').style.display = 'none';
        return;
    }
    const result = calcCore({
        orderDateTime: getNow(),
        region,
        publisherStates: std_publisherStates,
        useManualOverrides: true,
        useExcelData: true,
        forceNextDay: isNextDay
    });
    updateDeliverySummaryBanner(result.orders);
    const html = renderResultHtml(result, { showManualOverride:true });
    document.getElementById('std_resultArea').innerHTML = html;
    document.getElementById('std_resultArea').style.display = 'block';
}
