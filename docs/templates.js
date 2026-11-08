/* 色・種別・おすすめタスクの定義（データのみ。ロジックは app.js） */
window.FD = window.FD || {};

FD.COLORS = {
  rose:  { name: 'ローズ',   a: '#FF9DB0', b: '#E4577B', on: '#ffffff' },
  coral: { name: 'コーラル', a: '#FFB08A', b: '#F2674F', on: '#ffffff' },
  gold:  { name: 'シャンパン', a: '#F8DB8E', b: '#D9A13A', on: '#3A2600' },
  sage:  { name: 'セージ',   a: '#B5DDC4', b: '#5DAA86', on: '#0F3322' },
  teal:  { name: 'ティール', a: '#8FD8CE', b: '#2E9E96', on: '#07312E' },
  lilac: { name: 'ライラック', a: '#CDBDF5', b: '#8A6BDD', on: '#ffffff' },
  mocha: { name: 'モカ',     a: '#E2C3A5', b: '#A06F4E', on: '#ffffff' }
};

FD.KINDS = {
  engagement: {
    label: '婚約・プロポーズ', emoji: '💍', color: 'lilac',
    tasks: [
      { title: '婚約指輪のデザイン・サイズを決める', daysBefore: 60 },
      { title: '記念の食事やサプライズの場所を予約', daysBefore: 30 },
      { title: '両親へ報告する日を決める', daysBefore: 14 },
      { title: '婚約記念の写真を撮る', daysBefore: 0 }
    ]
  },
  yuino: {
    label: '結納', emoji: '🎎', color: 'gold',
    tasks: [
      { title: '結納を行うか・形式（正式/略式）を両家で相談', daysBefore: 120 },
      { title: '日取りと会場（料亭・ホテル・自宅）を決める', daysBefore: 90 },
      { title: '結納品・結納返しを手配', daysBefore: 60 },
      { title: '会場を予約し、人数を確定', daysBefore: 45 },
      { title: '服装・集合時間を両家に共有', daysBefore: 14 },
      { title: '当日の進行・挨拶を確認', daysBefore: 7 }
    ]
  },
  kaomiwase: {
    label: '両家顔合わせ', emoji: '🍽️', color: 'coral',
    tasks: [
      { title: '双方の親に顔合わせを打診', daysBefore: 60 },
      { title: '候補日を3つ出して日程調整', daysBefore: 50 },
      { title: 'お店を予約（個室・アレルギー・アクセス確認）', daysBefore: 40 },
      { title: '席順と当日の進行を決める', daysBefore: 21 },
      { title: '手土産・記念品を用意', daysBefore: 14 },
      { title: '服装・集合時間・場所を両家に共有', daysBefore: 10 },
      { title: '支払いの担当を決める', daysBefore: 7 },
      { title: '前日リマインド連絡', daysBefore: 1 }
    ]
  },
  nyuseki: {
    label: '入籍', emoji: '📝', color: 'sage',
    tasks: [
      { title: '戸籍謄本など必要書類を取得', daysBefore: 21 },
      { title: '婚姻届を記入・証人2名に署名をお願い', daysBefore: 14 },
      { title: '提出先（役所）と受付時間を確認', daysBefore: 7 },
      { title: '氏名変更の手続きリストを作る', daysBefore: 3 },
      { title: '婚姻届を提出する', daysBefore: 0 }
    ]
  },
  maeduri: {
    label: '前撮り', emoji: '📸', color: 'mocha',
    tasks: [
      { title: 'フォトスタジオ・ロケーションを選ぶ', daysBefore: 120 },
      { title: '衣装・ヘアメイクの打ち合わせ', daysBefore: 60 },
      { title: '撮影日と天候の予備日を決める', daysBefore: 30 },
      { title: '小物（ブーケ・アクセサリー）を準備', daysBefore: 14 }
    ]
  },
  wedding: {
    label: '結婚式', emoji: '💒', color: 'rose',
    tasks: [
      { title: '式場を見学して仮予約', daysBefore: 240 },
      { title: '予算・ゲスト人数の目安を決める', daysBefore: 210 },
      { title: '招待客リストを作る', daysBefore: 150 },
      { title: '衣装を選ぶ・試着の予約', daysBefore: 150 },
      { title: '招待状の準備と発送', daysBefore: 90 },
      { title: 'プロフィールブック・席次表の準備', daysBefore: 45 },
      { title: '引き出物・プチギフトを手配', daysBefore: 40 },
      { title: '最終打ち合わせ・人数確定', daysBefore: 14 },
      { title: '当日の持ち物・タイムスケジュールを確認', daysBefore: 3 }
    ]
  },
  afterparty: {
    label: '披露宴・二次会', emoji: '🥂', color: 'teal',
    tasks: [
      { title: '幹事さんを決めてお願いする', daysBefore: 90 },
      { title: '会場を押さえる', daysBefore: 75 },
      { title: '出欠を確認・会費を決める', daysBefore: 45 },
      { title: '余興・ゲームの内容を決める', daysBefore: 21 }
    ]
  },
  honeymoon: {
    label: '新婚旅行', emoji: '✈️', color: 'teal',
    tasks: [
      { title: '行き先・日程・予算を決める', daysBefore: 150 },
      { title: '航空券・宿を予約', daysBefore: 120 },
      { title: 'パスポートの有効期限を確認', daysBefore: 90 },
      { title: '旅行保険・海外Wi-Fiを手配', daysBefore: 14 },
      { title: '持ち物リストを作ってパッキング', daysBefore: 3 }
    ]
  },
  anniversary: { label: '記念日', emoji: '🎂', color: 'coral', tasks: [] },
  custom:      { label: 'その他', emoji: '✨', color: 'mocha', tasks: [] }
};

/* 追加画面に並べる順番 */
FD.KIND_ORDER = ['engagement', 'kaomiwase', 'yuino', 'nyuseki', 'maeduri', 'wedding', 'afterparty', 'honeymoon', 'anniversary', 'custom'];

FD.EMOJIS = ['💍', '💒', '🥂', '🍽️', '🎎', '📝', '📸', '✈️', '🏝️', '💐', '🎂', '🎁', '🏠', '🌸', '🌿', '🍀', '⭐', '🌙', '🐶', '🐱', '🍓', '🎈', '🎶', '💗', '✨', '🔥', '🌈', '☕'];
FD.MILESTONES = [30, 50, 100, 200, 300, 365, 500, 730, 1000, 1095, 1461, 1826, 2000, 3000, 3650];
