// ========================================================================
// calc_core.js  ―  納期計算コアエンジン（全タブ共通）
// ========================================================================
//
// calcCore(params) の params:
//   orderDateTime : Date  … 注文日時（基準）
//   region        : string … 配送地域コード
//   pref          : string|null … 都道府県（詳細/過去タブのみ）
//   city          : string|null … 市町村（詳細/過去タブのみ）
//   publisherStates: { pubName: 'none'|'under'|'over' }
//   useManualOverrides: bool（標準/詳細タブのみ true）
//   useExcelData  : bool（true の場合、取込Excelデータがあれば最優先で使用）
//
// 戻り値: { baseDate, orders:[...], regionVal }
//   各 order: { name, isDirect, reason, shipDateObj, shipDisplay, deliveryDate, deliveryDisplay,
//               dataSource: 'excel'|'formula'|'manual', irrLabel }

// ===== 直送/宅送 2段階判定（③注文締切逆算タブからも共通利用） =====
// orders: [{ cond, state, isDirect, reason, ... }] を直接書き換える
function classifyOrders(orders, region) {
    // ---- 1段階目：確実に宅送になる商品があるかスキャン ----
    let hasDefiniteTakuso = false;
    orders.forEach(o => {
        const c = o.cond;
        if (c.specialRule === 'always_takuso') { hasDefiniteTakuso = true; return; }
        if (c.forbiddenRegions.includes(region)) { hasDefiniteTakuso = true; return; }
        if (c.specialRule === 'always_direct' || o.state === 'over') return;
        if (o.state === 'under') {
            if (!c.allowDirectIfOthersAreDirect) {
                hasDefiniteTakuso = true;
            } else {
                const regionOK = c.allowedRegionsForUpgrade.length === 0 || c.allowedRegionsForUpgrade.includes(region);
                if (!regionOK) hasDefiniteTakuso = true;
            }
        }
    });

    // ---- 2段階目：最終判定 ----
    orders.forEach(o => {
        const c = o.cond;
        if (c.specialRule === 'always_direct') {
            o.isDirect = true; o.reason = '常に直送';
        } else if (c.specialRule === 'always_takuso') {
            o.isDirect = false; o.reason = '常に宅送';
        } else if (c.forbiddenRegions.includes(region)) {
            o.isDirect = false; o.reason = '地域制限により宅送';
        } else if (o.state === 'over') {
            o.isDirect = true; o.reason = '冊数条件クリア';
        } else if (o.state === 'under') {
            if (c.allowDirectIfOthersAreDirect) {
                const regionOK = c.allowedRegionsForUpgrade.length === 0 || c.allowedRegionsForUpgrade.includes(region);
                if (regionOK && !hasDefiniteTakuso) {
                    o.isDirect = true;
                    o.reason = orders.length === 1 ? '単独注文（地域OK）' : '他全て直送（地域OK）';
                } else {
                    o.isDirect = false;
                    o.reason = !regionOK ? '地域対象外のため宅送' : '他に宅送商品があるため';
                }
            } else {
                o.isDirect = false; o.reason = '冊数不足';
            }
        }
    });
    return orders;
}

function calcCore(params) {
    const {
        orderDateTime, region, pref, city,
        publisherStates, useManualOverrides, useExcelData, forceNextDay
    } = params;

    const orders = [];
    for (const [pub, state] of Object.entries(publisherStates)) {
        if (state === 'none') continue;
        let cond = JSON.parse(JSON.stringify(getCondition(pub)));

        const irr = getActiveIrregular(pub, orderDateTime);
        let extraDelayDays = 0, irrLabel = '';
        if (irr) {
            const cd = irr.changeData;
            if (cd.type === 'shipDelay') {
                extraDelayDays = cd.delayDays;
                irrLabel = `📦 +${cd.delayDays}日遅延（イレギュラー）`;
            } else if (cd.type === 'threshold') {
                if (cd.forceTakuso) { cond.specialRule = 'always_takuso'; irrLabel = '🚛 強制宅送（イレギュラー）'; }
                else if (cd.newThreshold !== null) { cond.quantityThreshold = cd.newThreshold; irrLabel = `📊 直送条件${cd.newThreshold}冊（イレギュラー）`; }
            } else if (cd.type === 'fixedDate') {
                irrLabel = '📅 出荷日固定（イレギュラー）';
            } else if (cd.type === 'leadTimeChange') {
                irrLabel = '⏱️ リードタイム変更（イレギュラー）';
            }
        }
        orders.push({ name:pub, state, cond, isDirect:false, canUpgrade:false, reason:'',
                      extraDelayDays, irrLabel, irregularRule:irr });
    }

    if (orders.length === 0) return { baseDate:null, orders:[], regionVal:region };

    // ===== 直送/宅送 2段階判定（共通関数） =====
    classifyOrders(orders, region);

    // ===== 基準日時決定 =====
    let base = new Date(orderDateTime);
    let hour = orderDateTime.getHours();
    if (!isBusinessDay(base)) { base = getNextBusinessDay(base); hour = 10; }
    if (forceNextDay || hour >= 16) { base = getNextBusinessDay(base); hour = 10; }

    // ===== 出荷日計算 =====
    orders.forEach(o => {
        const rule = getBaseRule(o.name);
        const effDate = getEffectiveOrderDate(base, hour, rule);
        let baseLeadTime = o.isDirect
            ? (rule.directLeadTime ?? rule.takusoLeadTime)
            : (rule.takusoLeadTime ?? rule.directLeadTime);

        o.dataSource = 'formula';

        if (baseLeadTime === null) {
            o.shipDateObj = null; o.shipDisplay = '取扱なし'; o.deliveryDisplay = '-'; return;
        }

        if (isBunriThursdayRule(o.name, effDate)) {
            baseLeadTime = 2;
            o.reason += ' [木曜→月曜特殊ルール]';
        }

        if (o.irregularRule?.changeData.type === 'leadTimeChange') {
            const cd = o.irregularRule.changeData;
            if (o.isDirect  && cd.directLead != null) baseLeadTime = cd.directLead;
            if (!o.isDirect && cd.takusoLead != null) baseLeadTime = cd.takusoLead;
        }

        const manualDateStr = useManualOverrides ? appState.manualOverrides[o.name] : null;

        // ===== Excel取込データ最優先 =====
        let excelHit = null;
        if (useExcelData) {
            excelHit = lookupExcelShipDate(o.name, base, hour);
        }

        if (manualDateStr) {
            o.shipDateObj = parseISODate(manualDateStr);
            o.reason += ' [手動修正適用]';
            o.dataSource = 'manual';
        } else if (excelHit && (o.isDirect ? excelHit.direct : excelHit.takuso)) {
            const dstr = o.isDirect ? excelHit.direct : excelHit.takuso;
            o.shipDateObj = parseISODate(dstr);
            o.dataSource = 'excel';
        } else if (o.irregularRule?.changeData.type === 'fixedDate') {
            o.shipDateObj = parseISODate(o.irregularRule.changeData.fixedDate);
        } else {
            o.shipDateObj = addBusinessDays(effDate, baseLeadTime + (o.extraDelayDays || 0));
        }
    });

    // ===== 着日計算 =====
    let maxTakusoDelivery = null;
    const extraRegionDays = getRegionExceptionDays(pref, city);

    orders.forEach(o => {
        if (!(o.shipDateObj instanceof Date)) return;
        const sd = o.shipDateObj;
        o.shipDisplay = fmtDate(sd);

        const dd = getDeliveryDays(o.name, region, o.isDirect, pref) + extraRegionDays;
        const dDate = new Date(sd);
        dDate.setDate(dDate.getDate() + dd);
        o.individualDeliveryDate = new Date(dDate);

        if (!o.isDirect) {
            if (!maxTakusoDelivery || dDate > maxTakusoDelivery) maxTakusoDelivery = new Date(dDate);
        }
    });

    orders.forEach(o => {
        if (!(o.shipDateObj instanceof Date)) { o.deliveryDisplay = '-'; return; }
        const finalDate = o.isDirect ? o.individualDeliveryDate : (maxTakusoDelivery || o.individualDeliveryDate);
        o.deliveryDate = finalDate;
        o.deliveryDisplay = fmtDate(finalDate);
    });

    return { baseDate: base, orders, regionVal: region };
}

// ===== 納期サマリーバナー更新（共通） =====
function updateDeliverySummaryBanner(orders) {
    const banner   = document.getElementById('deliverySummaryBanner');
    const datesDiv = document.getElementById('bannerDates');

    let maxDirectDate = null, maxTakusoDate = null;
    orders.forEach(order => {
        if (!order.deliveryDate) return;
        if (order.isDirect) {
            if (!maxDirectDate || order.deliveryDate > maxDirectDate) maxDirectDate = new Date(order.deliveryDate);
        } else {
            if (!maxTakusoDate || order.deliveryDate > maxTakusoDate) maxTakusoDate = new Date(order.deliveryDate);
        }
    });

    let overallLatest = null;
    if (maxDirectDate && maxTakusoDate) overallLatest = maxDirectDate > maxTakusoDate ? maxDirectDate : maxTakusoDate;
    else overallLatest = maxDirectDate || maxTakusoDate;

    if (!overallLatest) { banner.style.display = 'none'; return; }

    const hasDirect = orders.some(o => o.isDirect && o.deliveryDate);
    const hasTakuso = orders.some(o => !o.isDirect && o.deliveryDate);
    let html = '';
    if (hasDirect && hasTakuso) {
        html = `
            <div class="banner-item"><div class="banner-item-label">📦 全体統一納期</div><div class="banner-item-date highlight">${fmtDate(overallLatest)}</div></div>
            <div class="banner-divider">|</div>
            <div class="banner-item"><div class="banner-item-label">🚚 直送のみ</div><div class="banner-item-date">${maxDirectDate?fmtDate(maxDirectDate):'-'}</div></div>
            <div class="banner-divider">|</div>
            <div class="banner-item"><div class="banner-item-label">🏠 宅送のみ</div><div class="banner-item-date">${maxTakusoDate?fmtDate(maxTakusoDate):'-'}</div></div>`;
    } else if (hasDirect) {
        html = `<div class="banner-item"><div class="banner-item-label">🚚 最短納品日（直送）</div><div class="banner-item-date highlight">${fmtDate(maxDirectDate)}</div></div>`;
    } else {
        html = `<div class="banner-item"><div class="banner-item-label">🏠 最短納品日（宅送）</div><div class="banner-item-date highlight">${fmtDate(maxTakusoDate)}</div></div>`;
    }
    datesDiv.innerHTML = html;
    banner.style.display = 'block';
}

// ===== 結果HTML生成（共通・タブごとにオプション変更可） =====
function renderResultHtml(result, opts) {
    opts = opts || {};
    const { orders, baseDate, regionVal } = result;
    if (!orders || orders.length === 0) return '';

    let html = `<h3>📋 納期計算結果</h3>`;
    html += `<p style="color:#666;margin-bottom:12px;font-size:13px;">基準日: ${fmtDateFull(baseDate)} ／ 地域: ${REGION_NAMES[regionVal]||regionVal}${opts.locationLabel ? ' ／ ' + opts.locationLabel : ''}</p>`;

    orders.forEach(o => {
        const bc = o.isDirect ? 'direct' : 'takuso';
        const bt = o.isDirect ? '直送' : '宅送';
        const sid = o.name.replace(/[^a-zA-Z0-9]/g,'_');
        const shipVal = (opts.showManualOverride && appState.manualOverrides[o.name]) || '';
        const sourceTag = o.dataSource === 'excel'
            ? '<span class="source-tag excel">📥 Excel取込値</span>'
            : o.dataSource === 'manual'
                ? '<span class="source-tag manual">✏️ 手動修正値</span>'
                : '<span class="source-tag formula">🧮 基本ルール計算値</span>';

        html += `
            <div class="result-item ${bc}">
                <div class="result-header">
                    <strong style="font-size:15px;">${o.name}</strong>
                    <span><span class="badge ${bc}">${bt}</span>${sourceTag}</span>
                </div>
                <div style="font-size:12px;color:#7f8c8d;margin-bottom:6px;">判定理由: ${o.reason}</div>
                ${o.irrLabel ? `<div class="applied-irregular" style="display:inline-block;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:3px 9px;font-size:11px;color:#856404;margin-bottom:6px;">⚠️ ${o.irrLabel}</div>` : ''}
                <div style="font-size:13px;margin-top:6px;">
                    出荷予定日: <strong>${o.shipDisplay}</strong>
                    ${opts.showManualOverride && o.shipDateObj instanceof Date ? `
                    <div class="manual-override">
                        <label>個別修正:</label>
                        <input type="date" value="${shipVal}" onchange="updateManualOverride('${o.name.replace(/'/g,"\\'")}', this.value)">
                    </div>` : ''}
                    <div class="delivery-date">最短納品日: ${o.deliveryDisplay}</div>
                </div>
            </div>`;
    });
    return html;
}

function updateManualOverride(publisherName, value) {
    if (value) appState.manualOverrides[publisherName] = value;
    else delete appState.manualOverrides[publisherName];
    saveState();
    recalcAllTabs();
}
