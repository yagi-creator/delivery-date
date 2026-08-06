// ========================================================================
// data.js  ―  出版社マスタ・リードタイム・デフォルト休業日・都道府県マスタ
// ========================================================================

// ===== 出版社条件定義（直送/宅送判定ルール） =====
const PUBLISHER_CONDITIONS = {
    'EN':                   { quantityThreshold:30,  allowDirectIfOthersAreDirect:true,  allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:true,  specialRule:null },
    '森の実':               { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:true,  specialRule:'always_takuso' },
    'スプリックス':         { quantityThreshold:10,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:true,  specialRule:null },
    'インフィニットマインド':{ quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:true,  specialRule:'always_direct' },
    '学書':                 { quantityThreshold:14,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '文理 / 文理市販商品':  { quantityThreshold:7,   allowDirectIfOthersAreDirect:true,  allowedRegionsForUpgrade:['hokkaido','tohoku','kanto'],          forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '好学':                 { quantityThreshold:8,   allowDirectIfOthersAreDirect:true,  allowedRegionsForUpgrade:['hokkaido','tohoku','kanto','chubu'],  forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '学友社':               { quantityThreshold:30,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '都麦':                 { quantityThreshold:30,  allowDirectIfOthersAreDirect:true,  allowedRegionsForUpgrade:['hokkaido','tohoku','kanto','chubu'],  forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    'JES':                  { quantityThreshold:25,  allowDirectIfOthersAreDirect:true,  allowedRegionsForUpgrade:['hokkaido','tohoku','kanto','chubu'],  forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '学林舎':               { quantityThreshold:20,  allowDirectIfOthersAreDirect:true,  allowedRegionsForUpgrade:['hokkaido','tohoku','kanto','chubu'],  forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    'CKT':                  { quantityThreshold:40,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '正進社':               { quantityThreshold:15,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '受験研究社':           { quantityThreshold:7,   allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:['hokkaido','okinawa'],isENGroup:false, specialRule:null },
    '杏王出版（HSB)':       { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_direct' },
    '西北':                 { quantityThreshold:30,  allowDirectIfOthersAreDirect:true,  allowedRegionsForUpgrade:['hokkaido','tohoku','kanto','chubu'],  forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '水王舎':               { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_direct' },
    '英俊社':               { quantityThreshold:35,  allowDirectIfOthersAreDirect:true,  allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    'MyStudy':              { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    '創育（入試演習）':     { quantityThreshold:10,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:['kanto'],           isENGroup:false, specialRule:null },
    '創育（のびじゃん）':   { quantityThreshold:30,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:['kanto'],           isENGroup:false, specialRule:null },
    'あかつき':             { quantityThreshold:20,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '教科書ガイド（文理）': { quantityThreshold:15,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '旺文社':               { quantityThreshold:25,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    '学研（文理）':         { quantityThreshold:20,  allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:null },
    'グランシップ':         { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    'CHUOH':                { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_direct' },
    '千葉ドリ':             { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    '学悠出版':             { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    '進学舎':               { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    '茨にゅー':             { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    '鹿児島県教育振興会':   { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    'PILOT':                { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    'クロノクリエイト':     { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    '四谷大塚':             { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    'スマートビジョン':     { quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_takuso' },
    'アール・エフ・ヤマカワ':{ quantityThreshold:null, allowDirectIfOthersAreDirect:false, allowedRegionsForUpgrade:[],                                    forbiddenRegions:[],                  isENGroup:false, specialRule:'always_direct' }
};

// ===== リードタイム設定 =====
const BASE_SHIPPING_RULES = {
    'EN':                   { deadlineHour:14, directLeadTime:1,    takusoLeadTime:2,    afterDeadlineAdd:1, isENGroup:true  },
    '森の実':               { deadlineHour:14, directLeadTime:null, takusoLeadTime:2,    afterDeadlineAdd:1, isENGroup:true  },
    'スプリックス':         { deadlineHour:14, directLeadTime:1,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:true  },
    'インフィニットマインド':{ deadlineHour:14, directLeadTime:1,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:true  },
    '学書':                 { deadlineHour:16, directLeadTime:1,    takusoLeadTime:2,    afterDeadlineAdd:1, isENGroup:false },
    '文理 / 文理市販商品':  { deadlineHour:16, directLeadTime:2,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '好学':                 { deadlineHour:16, directLeadTime:2,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '学友社':               { deadlineHour:16, directLeadTime:2,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '都麦':                 { deadlineHour:16, directLeadTime:1,    takusoLeadTime:2,    afterDeadlineAdd:1, isENGroup:false },
    'JES':                  { deadlineHour:16, directLeadTime:1,    takusoLeadTime:2,    afterDeadlineAdd:1, isENGroup:false },
    '学林舎':               { deadlineHour:16, directLeadTime:1,    takusoLeadTime:2,    afterDeadlineAdd:1, isENGroup:false },
    'CKT':                  { deadlineHour:16, directLeadTime:1,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    'あかつき':             { deadlineHour:16, directLeadTime:1,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '正進社':               { deadlineHour:16, directLeadTime:3,    takusoLeadTime:5,    afterDeadlineAdd:1, isENGroup:false },
    '教科書ガイド（文理）': { deadlineHour:16, directLeadTime:2,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '受験研究社':           { deadlineHour:16, directLeadTime:2,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '杏王出版（HSB)':       { deadlineHour:16, directLeadTime:2,    takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '西北':                 { deadlineHour:16, directLeadTime:2,    takusoLeadTime:4,    afterDeadlineAdd:1, isENGroup:false },
    '旺文社':               { deadlineHour:16, directLeadTime:2,    takusoLeadTime:4,    afterDeadlineAdd:1, isENGroup:false },
    '水王舎':               { deadlineHour:16, directLeadTime:2,    takusoLeadTime:4,    afterDeadlineAdd:1, isENGroup:false },
    '学研（文理）':         { deadlineHour:16, directLeadTime:2,    takusoLeadTime:4,    afterDeadlineAdd:1, isENGroup:false },
    '英俊社':               { deadlineHour:16, directLeadTime:4,    takusoLeadTime:5,    afterDeadlineAdd:1, isENGroup:false },
    'MyStudy':              { deadlineHour:16, directLeadTime:null, takusoLeadTime:2,    afterDeadlineAdd:1, isENGroup:false },
    'グランシップ':         { deadlineHour:16, directLeadTime:null, takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    'CHUOH':                { deadlineHour:16, directLeadTime:2,    takusoLeadTime:null, afterDeadlineAdd:1, isENGroup:false },
    '千葉ドリ':             { deadlineHour:16, directLeadTime:null, takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '学悠出版':             { deadlineHour:16, directLeadTime:null, takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '進学舎':               { deadlineHour:16, directLeadTime:null, takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '茨にゅー':             { deadlineHour:16, directLeadTime:null, takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    '鹿児島県教育振興会':   { deadlineHour:16, directLeadTime:null, takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    'PILOT':                { deadlineHour:16, directLeadTime:null, takusoLeadTime:3,    afterDeadlineAdd:1, isENGroup:false },
    'クロノクリエイト':     { deadlineHour:16, directLeadTime:null, takusoLeadTime:4,    afterDeadlineAdd:1, isENGroup:false },
    '四谷大塚':             { deadlineHour:16, directLeadTime:null, takusoLeadTime:5,    afterDeadlineAdd:1, isENGroup:false },
    'スマートビジョン':     { deadlineHour:16, directLeadTime:null, takusoLeadTime:5,    afterDeadlineAdd:1, isENGroup:false },
    'アール・エフ・ヤマカワ':{ deadlineHour:16, directLeadTime:5,   takusoLeadTime:null, afterDeadlineAdd:1, isENGroup:false },
    '創育（入試演習）':     { deadlineHour:16, directLeadTime:8,    takusoLeadTime:10,   afterDeadlineAdd:1, isENGroup:false },
    '創育（のびじゃん）':   { deadlineHour:16, directLeadTime:11,   takusoLeadTime:13,   afterDeadlineAdd:1, isENGroup:false }
};

const MAIN_PUBLISHERS     = ['EN','文理 / 文理市販商品','好学','学書','学友社','MyStudy','都麦','CKT'];
const REGIONAL_PUBLISHERS = ['スプリックス','森の実'];

// ===== 地域名 =====
const REGION_NAMES = {
    hokkaido:'北海道', tohoku:'東北', kanto:'関東', chubu:'中部',
    kinki:'近畿', chugoku:'中国', shikoku:'四国', kyushu:'九州', okinawa:'沖縄'
};

// ===== 都道府県 → 地域 マッピング（詳細納期確認・過去納期確認用） =====
const PREFECTURE_TO_REGION = {
    '北海道':'hokkaido',
    '青森県':'tohoku','岩手県':'tohoku','宮城県':'tohoku','秋田県':'tohoku','山形県':'tohoku','福島県':'tohoku',
    '茨城県':'kanto','栃木県':'kanto','群馬県':'kanto','埼玉県':'kanto','千葉県':'kanto','東京都':'kanto','神奈川県':'kanto',
    '新潟県':'chubu','富山県':'chubu','石川県':'chubu','福井県':'chubu','山梨県':'chubu','長野県':'chubu','岐阜県':'chubu','静岡県':'chubu','愛知県':'chubu',
    '三重県':'kinki','滋賀県':'kinki','京都府':'kinki','大阪府':'kinki','兵庫県':'kinki','奈良県':'kinki','和歌山県':'kinki',
    '鳥取県':'chugoku','島根県':'chugoku','岡山県':'chugoku','広島県':'chugoku','山口県':'chugoku',
    '徳島県':'shikoku','香川県':'shikoku','愛媛県':'shikoku','高知県':'shikoku',
    '福岡県':'kyushu','佐賀県':'kyushu','長崎県':'kyushu','熊本県':'kyushu','大分県':'kyushu','宮崎県':'kyushu','鹿児島県':'kyushu',
    '沖縄県':'okinawa'
};
const PREFECTURE_LIST = Object.keys(PREFECTURE_TO_REGION);

// ===== 都道府県別 追加日数テーブル（配布Excel記載の「翌々日着／翌々翌日着」表より作成） =====
// 基準＝出荷日+1日（翌日着）。ここに載っている都道府県は「+extra日」を追加する。
// 出版社名は部分一致（getBaseRule/getConditionと同様の仕組み）で判定。
const PREF_EXTRA_DAYS_DIRECT = {
    'EN': {
        '北海道':1, '沖縄県':1
    },
    '学書': {
        '北海道':1, '岩手県':1, '宮城県':1, '山形県':1, '福島県':1, '沖縄県':1, // 翌々日着（東北は青森・秋田以外、沖縄は本島）
        '青森県':2, '秋田県':2,                                                  // 翌々翌日着
        '福岡県':2, '佐賀県':2, '長崎県':2, '熊本県':2, '大分県':2, '宮崎県':2, '鹿児島県':2 // 翌々翌日着（九州）
    },
    '文理': {
        '徳島県':1, '香川県':1, '愛媛県':1, '高知県':1,                          // 四国
        '鳥取県':1, '島根県':1, '岡山県':1, '広島県':1, '山口県':1,               // 中国
        '福岡県':1, '佐賀県':1, '長崎県':1, '熊本県':1, '大分県':1, '宮崎県':1, '鹿児島県':1, // 九州
        '北海道':1, '沖縄県':1
    },
    '好学': {
        '北海道':1,
        '青森県':1, '岩手県':1, '宮城県':1, '秋田県':1, '山形県':1, '福島県':1,   // 東北地方
        '佐賀県':1, '長崎県':1, '熊本県':1, '大分県':1, '宮崎県':1, '鹿児島県':1  // 九州（福岡以外）
        // 福岡県はここに含めない（表の「九州（福岡以外）」の但し書きに対応）
    }
};

// 宅送は出版社共通ルール（配布Excel「宅送」表より）
const PREF_EXTRA_DAYS_TAKUSO = {
    '北海道':1, '青森県':1, '岩手県':1, '宮城県':1, '秋田県':1, '山形県':1, '福島県':1, // 東北
    '新潟県':1, '沖縄県':1
    // ※離島は除く旨が表に記載あり → 設定タブの「地域特殊ルール」で都道府県＋市町村ごとに追加日数を個別登録すること
};

// 出版社名部分一致で PREF_EXTRA_DAYS_DIRECT のテーブルを検索
function findPrefExtraTableDirect(name) {
    if (PREF_EXTRA_DAYS_DIRECT[name]) return PREF_EXTRA_DAYS_DIRECT[name];
    for (const [k, v] of Object.entries(PREF_EXTRA_DAYS_DIRECT)) {
        if (name.includes(k)) return v;
    }
    return null;
}

// ===== オフィス → 主要配送地域（初期値） =====
const OFFICE_DEFAULT_REGION = {
    tokyo:'kanto', kansai:'kinki', chushikoku:'chugoku', kyushu:'kyushu', national:'kanto'
};
const OFFICE_NAMES = { tokyo:'東京', kansai:'関西', chushikoku:'中四国', kyushu:'九州', national:'受発注（全国）' };

// ===== デフォルト休業日（配布Excelの「祝日」シートより抽出。設定タブで自由に追加・編集・削除可能） =====
// type: 'holiday' = 休業日（営業日として数えない） / 'business' = 特別営業日（土日祝でも営業する）
const DEFAULT_HOLIDAYS = [
    {date:'2025-01-01', name:'元日', type:'holiday'},
    {date:'2025-01-13', name:'成人の日', type:'holiday'},
    {date:'2025-02-11', name:'建国記念の日', type:'holiday'},
    {date:'2025-02-23', name:'天皇誕生日', type:'holiday'},
    {date:'2025-02-24', name:'振替休日', type:'holiday'},
    {date:'2025-03-20', name:'春分の日', type:'holiday'},
    {date:'2025-04-29', name:'昭和の日', type:'holiday'},
    {date:'2025-05-03', name:'憲法記念日', type:'holiday'},
    {date:'2025-05-04', name:'みどりの日', type:'holiday'},
    {date:'2025-05-05', name:'こどもの日', type:'holiday'},
    {date:'2025-05-06', name:'振替休日', type:'holiday'},
    {date:'2025-07-21', name:'海の日', type:'holiday'},
    {date:'2025-08-11', name:'山の日', type:'holiday'},
    {date:'2025-08-12', name:'夏期休業', type:'holiday'},
    {date:'2025-08-13', name:'夏期休業', type:'holiday'},
    {date:'2025-08-14', name:'夏期休業', type:'holiday'},
    {date:'2025-08-15', name:'夏期休業', type:'holiday'},
    {date:'2025-09-15', name:'敬老の日', type:'holiday'},
    {date:'2025-09-23', name:'秋分の日', type:'holiday'},
    {date:'2025-10-13', name:'スポーツの日', type:'holiday'},
    {date:'2025-10-17', name:'総会・物流休業', type:'holiday'},
    {date:'2025-11-03', name:'文化の日', type:'holiday'},
    {date:'2025-11-23', name:'勤労感謝の日', type:'holiday'},
    {date:'2025-11-24', name:'振替休日', type:'holiday'},
    {date:'2025-12-27', name:'年末年始休業', type:'holiday'},
    {date:'2025-12-28', name:'年末年始休業', type:'holiday'},
    {date:'2025-12-29', name:'年末年始休業', type:'holiday'},
    {date:'2025-12-30', name:'年末年始休業', type:'holiday'},
    {date:'2025-12-31', name:'年末年始休業', type:'holiday'},
    {date:'2026-01-01', name:'年末年始休業', type:'holiday'},
    {date:'2026-01-02', name:'年末年始休業', type:'holiday'},
    {date:'2026-01-03', name:'年末年始休業', type:'holiday'},
    {date:'2026-01-04', name:'年末年始休業', type:'holiday'},
    {date:'2026-01-12', name:'成人の日', type:'holiday'},
    {date:'2026-02-11', name:'建国記念の日', type:'holiday'},
    {date:'2026-02-23', name:'天皇誕生日', type:'holiday'},
    {date:'2026-03-20', name:'春分の日', type:'holiday'},
    {date:'2026-04-29', name:'昭和の日', type:'holiday'},
    {date:'2026-05-02', name:'GW休業', type:'holiday'},
    {date:'2026-05-03', name:'憲法記念日', type:'holiday'},
    {date:'2026-05-04', name:'みどりの日', type:'holiday'},
    {date:'2026-05-05', name:'こどもの日', type:'holiday'},
    {date:'2026-05-06', name:'憲法記念日（振替休日）', type:'holiday'},
    {date:'2026-05-07', name:'GW休業', type:'holiday'},
    {date:'2026-05-08', name:'GW休業', type:'holiday'},
    {date:'2026-05-09', name:'GW休業', type:'holiday'},
    {date:'2026-05-10', name:'GW休業', type:'holiday'},
    {date:'2026-07-20', name:'海の日', type:'holiday'},
    {date:'2026-08-11', name:'山の日', type:'holiday'},
    {date:'2026-09-21', name:'敬老の日', type:'holiday'},
    {date:'2026-09-22', name:'国民の休日', type:'holiday'},
    {date:'2026-09-23', name:'秋分の日', type:'holiday'},
    {date:'2026-10-12', name:'スポーツの日', type:'holiday'},
    {date:'2026-11-03', name:'文化の日', type:'holiday'},
    {date:'2026-11-23', name:'勤労感謝の日', type:'holiday'}
];
