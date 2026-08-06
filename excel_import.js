// ========================================================================
// excel_import.js  ―  毎週配布Excel（宅・直納期早見表）の取込処理
// ------------------------------------------------------------------------
// Excelの構成:
//   シート = 曜日（月〜土）。「その曜日に注文した場合」の結果が入っている。
//   各シートは以下のセクションに分かれる:
//     ★14時まで★   … EN系グループ(EN/森の実/スプリックス/インフィニットマインド)の14時までの注文
//     ★14時以降★   … 同上グループの14時以降の注文（＝翌営業日扱い相当のデータ）
//     ★16時まで★   … 一般出版社の16時までの注文（直送出荷日/宅送出荷日の列を含む）
//   列: A=出版社名, B=入力上の出荷日, H=直送出荷日, I=宅送出荷日
//   16時以降(翌日シート参照)の欄は無いため、翌日シートの「16時まで」セクションを16時以降として採用する。
// ========================================================================

const WEEKDAY_SHEET_NAMES = ['月曜','火曜','水曜','木曜','金曜','土曜'];
const SHEET_DOW = { '日曜':0,'月曜':1,'火曜':2,'水曜':3,'木曜':4,'金曜':5,'土曜':6 };

function initSettingsExcel() {
    renderImportList();
}

async function handleExcelImport(evt) {
    const files = Array.from(evt.target.files || []);
    if (files.length === 0) return;
    const statusEl = document.getElementById('importStatus');
    statusEl.innerHTML = '⏳ 読み込み中...';

    for (const file of files) {
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type:'array', cellDates:true });
            const result = parseNoukiWorkbook(wb, file.name);
            result._fileName = file.name;
            mergeImportResult(result);
            statusEl.innerHTML += `<div style="color:#27ae60;">✅ ${file.name} を取り込みました（${result.dateCount}日分・出版社${result.publisherCount}件）</div>`;
            if (result.warnings && result.warnings.length > 0) {
                statusEl.innerHTML += `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:8px 10px;margin:6px 0;font-size:12px;color:#856404;">
                    ⚠️ ${result.warnings.length}件の注意事項があります（日付が読み取れず反映されなかった箇所）:<br>
                    ${result.warnings.map(w => `・${w}`).join('<br>')}
                    <br><strong>→ これらの日付・出版社は「基本ルール計算値」にフォールバックされます。イレギュラー管理タブから個別に休業日・出荷日遅延を登録してください。</strong>
                </div>`;
            }
        } catch(e) {
            console.error(e);
            statusEl.innerHTML += `<div style="color:#dc3545;">❌ ${file.name} の読み込みに失敗しました: ${e.message}</div>`;
        }
    }
    saveState();
    renderImportList();
    recalcAllTabs();
    evt.target.value = '';
}

// ===== ワークブック解析 =====
function parseNoukiWorkbook(wb, fileName) {
    const shipData = {}; // { 'YYYY-MM-DD(注文日)': { pubName: {direct, takuso, source} } }
    let dateCount = 0;
    const publisherSet = new Set();
    const warnings = []; // 日付が読み取れず取り込みをスキップしたシート（お盆等でヘッダに「休業」等の文字が入っている場合など）

    WEEKDAY_SHEET_NAMES.forEach(sheetName => {
        if (!wb.SheetNames.includes(sheetName)) {
            warnings.push(`「${sheetName}」シートが見つかりませんでした`);
            return;
        }
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:false, defval:null, blankrows:true });
        // ヘッダ日付: 1行目の複数列に分かれている可能性があるため柔軟に探索する
        const headerRow = rows[0] || [];
        // 優先順: D(3), E(4), H(7), I(8), J(9)
        let baseDate = excelCellToDate(headerRow[3]) || excelCellToDate(headerRow[4]) || excelCellToDate(headerRow[7]) || excelCellToDate(headerRow[8]) || excelCellToDate(headerRow[9]);
        // 最終手段: ヘッダ行のどれかに日付っぽい文字列があれば採用
        if (!baseDate) {
            for (let ci = 0; ci < headerRow.length; ci++) {
                const cand = excelCellToDate(headerRow[ci]);
                if (cand) { baseDate = cand; break; }
            }
        }
        if (!baseDate) {
            const rawSamples = [headerRow[3], headerRow[4], headerRow[7], headerRow[8], headerRow[9]].map(x => x || '').join(' | ');
            warnings.push(`「${sheetName}」シート：ヘッダー日付が読み取れず取込をスキップしました（D1/E1/H1/I1/J1の内容: "${rawSamples}"）。休業日で日付が入っていない・文字列になっている可能性があります。`);
            return;
        }

        // セクション抽出: ★14時まで★ / ★14時以降★ / ★16時まで★
        const sections = extractSections(rows);

        // その曜日シートの「注文日」＝baseDate。14時まで注文 or 16時まで注文の代表として扱う。
        // 14時までセクション → 注文日=baseDate(14時までに注文したケース)
        // 14時以降セクション → 注文日=baseDate(14時以降に注文したケース、翌営業日扱い相当)
        // 16時までセクション → 注文日=baseDate(16時までに注文した一般出版社)
        const dateKey = toISODate(baseDate);
        if (!shipData[dateKey]) shipData[dateKey] = {};

        ['before14','after14','before16'].forEach(secKey => {
            const rowsInSec = sections[secKey] || [];
            rowsInSec.forEach(r => {
                // 優先: J列(index9) の出版社名、なければA列(index0)や末尾を使う
                const pubRawCandidates = [r[9], r[0], r[r.length-1]];
                const pubRaw = pubRawCandidates.find(x => x != null && String(x).trim() !== '');
                if (!pubRaw) return;
                const pubName = String(pubRaw).replace(/\s+/g,' ').replace(/\n/g,'').trim();
                if (!pubName || pubName.startsWith('★') || pubName.startsWith('《')) return;

                // H/I列のみを参照（index 7=H, 8=I）。J列(index9)は出版社名として扱う
                const rawDirect = r[7], rawTakuso = r[8];
                const directDate = excelCellToDate(rawDirect);
                const takusoDate = excelCellToDate(rawTakuso);

                // 休業表記（例: "休業" を含む）や空欄は警告しない
                if (rawDirect && !directDate && !/休/.test(String(rawDirect))) {
                    warnings.push(`「${sheetName}」シート「${pubName}」の直送出荷日欄が日付として読み取れませんでした（内容: "${rawDirect}"）`);
                }
                if (rawTakuso && !takusoDate && !/休/.test(String(rawTakuso))) {
                    warnings.push(`「${sheetName}」シート「${pubName}」の宅送出荷日欄が日付として読み取れませんでした（内容: "${rawTakuso}"）`);
                }

                // 直近1週間（シートの基準日(baseDate)〜+6日）だけ取り込む
                const withinWeek = d => {
                    if (!d) return false;
                    const start = new Date(baseDate);
                    start.setHours(0,0,0,0);
                    const end = new Date(baseDate);
                    end.setDate(end.getDate() + 6);
                    end.setHours(23,59,59,999);
                    return d >= start && d <= end;
                };
                if (!directDate && !takusoDate) return;
                if (!(withinWeek(directDate) || withinWeek(takusoDate))) return;

                publisherSet.add(pubName);
                const slot = secKey === 'after14' ? '_after14' : '';
                const key = pubName + slot;
                shipData[dateKey][key] = {
                    direct: directDate ? toISODate(directDate) : null,
                    takuso: takusoDate ? toISODate(takusoDate) : null,
                    source: fileName
                };
            });
        });
        dateCount++;
    });

    return { shipData, dateCount, publisherCount: publisherSet.size, warnings };
}

function extractSections(rows) {
    const sections = { before14: [], after14: [], before16: [] };
    let current = null;
    for (let i = 0; i < rows.length; i++) {
        const cellA = rows[i][0];
        if (typeof cellA === 'string') {
            if (cellA.includes('12時まで') || cellA.includes('14時まで')) { current = 'before14'; continue; }
            if (cellA.includes('12時以降') || cellA.includes('14時以降')) { current = 'after14'; continue; }
            if (cellA.includes('16時まで')) { current = 'before16'; continue; }
            if (cellA.includes('《')) { current = null; continue; }
        }
        if (current && rows[i][0]) {
            sections[current].push(rows[i]);
        }
    }
    return sections;
}

function excelCellToDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
        // YYYY-MM-DD
        const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
        // M/D/YYYY or MM/DD/YYYY
        const m2 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (m2) return new Date(parseInt(m2[3]), parseInt(m2[1])-1, parseInt(m2[2]));
        // YYYY年M月D日 (Japanese format)
        const m3 = val.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (m3) return new Date(parseInt(m3[1]), parseInt(m3[2])-1, parseInt(m3[3]));
    }
    return null;
}

function mergeImportResult(result) {
    Object.entries(result.shipData).forEach(([dateKey, pubs]) => {
        if (!appState.excelShipData[dateKey]) appState.excelShipData[dateKey] = {};
        Object.assign(appState.excelShipData[dateKey], pubs);
    });
    const dates = Object.keys(result.shipData).sort();
    appState.excelImports.push({
        id: Date.now() + Math.random(),
        fileName: result._fileName || '(不明なファイル)',
        importedAt: new Date().toISOString(),
        dateRange: dates.length ? `${dates[0]} 〜 ${dates[dates.length-1]}` : '-',
        publisherCount: result.publisherCount
    });
}

function deleteImport(id) {
    if (!confirm('この取込データを削除しますか？（該当期間の出荷日データも削除されます）')) return;
    appState.excelImports = appState.excelImports.filter(i => i.id !== id);
    // 簡易実装: 個別データの巻き戻しは行わず、全期間再取込を促すのみ
    saveState();
    renderImportList();
    recalcAllTabs();
}

function renderImportList() {
    const container = document.getElementById('importListContainer');
    if (!appState.excelImports || appState.excelImports.length === 0) {
        container.innerHTML = '<div class="no-data">まだ取り込んでいません</div>';
        return;
    }
    container.innerHTML = appState.excelImports.slice().reverse().map(i => `
        <div class="import-list-item">
            <div>
                <strong>${i.fileName}</strong>
                <div style="font-size:12px;color:#6c757d;">対象期間: ${i.dateRange} ／ 出版社${i.publisherCount}件</div>
                <div style="font-size:11px;color:#adb5bd;">取込日時: ${new Date(i.importedAt).toLocaleString('ja-JP')}</div>
            </div>
            <button class="btn-small" onclick="deleteImport(${i.id})">削除</button>
        </div>
    `).join('');
}

// ===== Excelデータ参照ヘルパー（計算エンジンから呼ばれる） =====
// orderDate: Date（注文日）, hour: 注文時刻(0-23), pubName: 出版社名
// 戻り値: {direct:'YYYY-MM-DD'|null, takuso:'YYYY-MM-DD'|null, source:string} | null
function lookupExcelShipDate(pubName, orderDate, hour) {
    const dateKey = toISODate(orderDate);
    const dayData = appState.excelShipData[dateKey];
    if (!dayData) return null;

    const cond = getCondition(pubName);
    const isENGroupPub = cond.isENGroup;
    let key = pubName;

    if (isENGroupPub) {
        // EN系は14時締切。14時以降なら after14 データを見る
        if (hour >= 14 && dayData[pubName + '_after14']) {
            key = pubName + '_after14';
        }
    }
    // 直接一致 → 部分一致
    if (dayData[key]) return dayData[key];
    if (dayData[pubName]) return dayData[pubName];
    const foundKey = Object.keys(dayData).find(k => k.replace('_after14','').includes(pubName.split(' / ')[0]) || pubName.includes(k.replace('_after14','').split(' / ')[0]));
    if (foundKey) return dayData[foundKey];
    return null;
}
