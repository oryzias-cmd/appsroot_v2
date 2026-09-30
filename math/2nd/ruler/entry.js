/* ========================================
   entry_base.js（汎用たたき台）
   - SetupCardで選択 → targetへ遷移
   - 「戻る」時だけ sessionStorage から復元
======================================== */

document.addEventListener('DOMContentLoaded', () => {
  initEntryHeader();
  if (!window.SetupCard) {
    alert('SetupCard が読み込まれていません（setup.full.js）');
    return;
  }
  showEntrySetup();
});

/* ============================================================
   ★ここだけアプリごとに変える（最小）
============================================================ */
const APP = {
  key: 'entryBase',                   // storageキーに使う（アプリごとに一意）
  title: 'セットアップ',              // ヘッダー表示
  backUrl: '../../../catalog/math-2nd.html#upper',  // 左戻るの行き先
  defaultTarget: './app_main.html'    // スタートで飛ぶ先（未作成なら仮でOK）
};

/* ============================================================
   ヘッダー初期化（長さentryの“最終責務はAppActions.back”を踏襲）
   ※長さentryの設計思想を汎用化したものです
============================================================ */
function initEntryHeader() {
  try {
    window.dispatchEvent(new CustomEvent('header:set-title', { detail: APP.title }));
  } catch (e) {}

  try {
    window.dispatchEvent(new CustomEvent('header:set-back', { detail: APP.backUrl }));
  } catch (e) {}

  window.AppActions = window.AppActions || {};
  window.AppActions.back = () => { location.href = APP.backUrl; };

  ['shell:back', 'header:back', 'app:back'].forEach((evName) => {
    document.addEventListener(evName, () => {
      if (window.AppActions && typeof window.AppActions.back === 'function') {
        window.AppActions.back();
      }
    });
  });
}

/* ============================================================
   sessionStorage 復元ルール（長さentryと同じ）
   ・「戻る」操作のときだけ復元（RETURN_FLAG が 1 のときだけ）
   ・直アクセス/リロードは初回扱いで捨てる
============================================================ */
function loadSavedOnce() {
  const STORAGE_KEY = APP.key + ':setup';
  const RETURN_FLAG = APP.key + ':return';

  const restoreOnce = (sessionStorage.getItem(RETURN_FLAG) === '1');
  if (restoreOnce) {
    sessionStorage.removeItem(RETURN_FLAG);
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  if (!restoreOnce) return null;

  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return null;
  }
}

function saveForReturn(out) {
  const STORAGE_KEY = APP.key + ':setup';
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch (e) {}
}

/* ============================================================
   SetupCard（汎用）
   - columns は “アプリごとに足す” 前提で、最小サンプルのみ
============================================================ */
function showEntrySetup() {
  const saved = loadSavedOnce();

  SetupCard.show({
    mount: '#mainArea',
    startLabel: 'スタート',
    columns: [
      [
        {
          id: 'difficulty',
          title: 'もんだいの レベル',
          desc: 'むずかしさを えらぶ',
          type: 'radio',
          required: true,
          options: [
            { value: 'lv1', label: 'かんたん' },
            { value: 'lv2', label: 'ふつう' }
          ],
          default: (saved && saved.difficulty) ? saved.difficulty : undefined
        }
      ],
      [
        {
          id: 'helpers',
          title: 'おたすけ',
          desc: 'つかうか えらぶ',
          type: 'radio',
          required: true,
          options: [
            { value: 'off', label: 'つかわない' },
            { value: 'on',  label: 'つかう' }
          ],
          default: (saved && saved.helpers) ? saved.helpers : 'on'
        }
      ],
      [
        {
          id: 'teachBtn',
          title: '「いっしょに かぞえる」',
          desc: 'ボタンを だすか えらぶ',
          type: 'radio',
          required: true,
          options: [
            { value: 'off', label: 'ださない' },
            { value: 'on',  label: 'だす' }
          ],
          default: (saved && saved.teachBtn) ? saved.teachBtn : 'off'
        }
      ]
    ],

    onStart: (out) => {
      // out をそのまま保存（戻ったときだけ復元）
      saveForReturn(out);

      // 遷移先（アプリごとに変える）
      const target = APP.defaultTarget;

      // URLパラメータで渡す（localStorageは使わない：事故防止）
      const params = new URLSearchParams();
      Object.keys(out).forEach((k) => params.set(k, String(out[k])));

      location.href = target + '?' + params.toString();
    }
  });
}
