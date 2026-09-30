// blankテンプレート A案：
// ヘッダー＆問題バー＆フッターに
// 「見本のボタン＆ラベル」をあらかじめ組み込んでおく版

document.addEventListener('DOMContentLoaded', () => {
  console.log('blank shell ready (A案テンプレ)');

  // ▼ タブレット対策：OSの長押しメニュー／範囲選択を抑止（共通ルール）
  document.addEventListener('contextmenu', (e) => {
    const t = e.target;
    if (!t) return;

    // 入力欄は例外（必要ならアプリ側でさらに制御）
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;

    e.preventDefault();
  }, true);

  document.addEventListener('selectstart', (e) => {
    const t = e.target;
    if (!t) return;

    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;

    e.preventDefault();
  }, true);

  // ▼ 1. ヘッダー：タイトル見本
  // 新しいアプリでは、このテキストを自分のアプリ名に書き換えてください。
  document.dispatchEvent(new CustomEvent('header:set-title', {
    detail: { text: 'サンプルドリル' }
  }));

  // ▼ 2. 問題バー：見本UIを組み立てる
  const pLeft   = document.querySelector('#slot-pbar .problem-left');
  const pCenter = document.querySelector('#slot-pbar .problem-center');
  const pRight  = document.querySelector('#slot-pbar .problem-right');

  // 左：レベルボタン（見本）
  if (pLeft) {
    const btnLevel = document.createElement('button');
    btnLevel.type = 'button';
    btnLevel.className = 'btn btn-level';
    btnLevel.textContent = 'レベル';
    btnLevel.addEventListener('click', () => {
      // 見本動作：あとで各アプリで自由に置き換えてください
      alert('レベル選択ボタンの見本です（新アプリで処理を書き換えてください）');
    });
    pLeft.appendChild(btnLevel);
  }

  // 中央：モード名＋進行（見本）
  if (pCenter) {
    const wrap = document.createElement('div');
    wrap.className = 'pbar-labels';

    const spanMode = document.createElement('span');
    spanMode.id = 'labelMode';
    spanMode.className = 'mode-label';
    // 新アプリでは、たとえば「たしざん」「ひきざん」などに書き換える想定
    spanMode.textContent = 'サンプルモード';

    const spanProgress = document.createElement('span');
    spanProgress.id = 'labelProgress';
    spanProgress.className = 'progress-label';
    spanProgress.textContent = '1 / 3 もん';

    wrap.appendChild(spanMode);
    wrap.appendChild(spanProgress);
    pCenter.appendChild(wrap);
  }

  // ▼ 3. フッター：見本ボタンを配置
  const fLeft   = document.querySelector('#slot-footer .left');
  const fCenter = document.querySelector('#slot-footer .center');
  const fRight  = document.querySelector('#slot-footer .right');

  // 左：もどる
  if (fLeft) {
    const btnBack = document.createElement('button');
    btnBack.type = 'button';
    btnBack.className = 'btn btn-footer-back';
    btnBack.textContent = 'もどる';
    btnBack.addEventListener('click', () => {
      // AppActions.back があればそちらを優先
      const A = (window.AppActions = window.AppActions || {});
      if (typeof A.back === 'function') {
        A.back();
      } else if (history.length > 1) {
        history.back();
      }
    });
    fLeft.appendChild(btnBack);
  }

  // 中央：メインボタン（見本では「スタート」）
  if (fCenter) {
    const btnPrimary = document.createElement('button');
    btnPrimary.type = 'button';
    btnPrimary.className = 'btn btn-footer-primary';
    btnPrimary.textContent = 'スタート';
    btnPrimary.addEventListener('click', () => {
      alert('フッター中央ボタンの見本です（新アプリで処理を書き換えてください）');
    });
    fCenter.appendChild(btnPrimary);
  }

  // 右：メニューボタン（任意）
  if (fRight) {
    const btnMenu = document.createElement('button');
    btnMenu.type = 'button';
    btnMenu.className = 'btn btn-footer-menu';
    btnMenu.textContent = 'メニュー';
    btnMenu.addEventListener('click', () => {
      alert('フッター右ボタンの見本です（新アプリで処理を書き換えてください）');
    });
    fRight.appendChild(btnMenu);
  }

  // ▼ 4. AppActions の見本（必要なら各アプリで上書き）
  const A = (window.AppActions = window.AppActions || {});

    // ============================================================
  // ★設定（歯車）本線：kit.full.js → AppActions.openSettings → ここ
  // - blank は「間違えない型」を提供するだけ
  // - 実際の設定項目は、各アプリで columns を差し替える
  // ============================================================
  if (typeof A.openSettings !== 'function') {
    A.openSettings = () => {
      if (typeof window.SetupCard?.show !== 'function') return;

      // ============================================================
      // ★A案テンプレ（正解型）
      // - radio は required:true ＋ default を必ず付ける
      // - 各アプリでは「DEFAULTS」「loadSetup」「saveSetup」「columns」を差し替える
      // ============================================================

      // blank用の最小DEFAULT（各アプリで自由に拡張）
      const DEFAULTS = {
        qcount: 5
      };

      // blank用の最小ロード／セーブ（各アプリで自由に置換）
      const loadSetup = () => {
        try{
          const raw = localStorage.getItem('blank.setup');
          const obj = raw ? JSON.parse(raw) : {};
          return {
            qcount: Number(obj.qcount || DEFAULTS.qcount)
          };
        }catch(e){
          return { qcount: DEFAULTS.qcount };
        }
      };

      const saveSetup = (s) => {
        const ns = {
          qcount: Number(s.qcount || DEFAULTS.qcount)
        };
        try{
          localStorage.setItem('blank.setup', JSON.stringify(ns));
        }catch(e){}
      };

      const current = loadSetup();

      window.SetupCard.show({
        startLabel: 'OK',
        columns: [
          [],
          [
            {
              id: 'qcount',
              key: 'qcount',                 // ★out.qcount で返る前提（linegraph同様）
              title: 'もんだいすう（見本）',
              type: 'radio',
              required: true,
              default: String(current.qcount || DEFAULTS.qcount),  // ★最重要：初期選択
              options: [
                { value: '3',  label: '3もん'  },
                { value: '5',  label: '5もん'  },
                { value: '10', label: '10もん' }
              ]
            }
          ],
          []
        ],
        onStart: (out) => {
          // blank では「保存して閉じる」までを型として提供
          const next = {
            qcount: Number(out.qcount || DEFAULTS.qcount)
          };
          saveSetup(next);

          try { window.SetupCard.hide(); } catch (e) {}
        }
      });
    };
  }

  // 戻る動作のデフォルト（まだ上書きされていなければ）
  if (typeof A.back !== 'function') {
    A.back = () => {
      if (history.length > 1) {
        history.back();
      }
      // history が無い場合は何もしない
    };
  }

  // モード名の更新（たしざん／ひきざん など）
  if (typeof A.setMode !== 'function') {
    A.setMode = (text) => {
      const span = document.getElementById('labelMode');
      if (span) span.textContent = text;
    };
  }

  // 進行表示の更新（current / total）
  if (typeof A.setProgress !== 'function') {
    A.setProgress = (current, total) => {
      const span = document.getElementById('labelProgress');
      if (!span) return;

      const c = Number(current) || 0;
      const t = Number(total) || 0;
      if (t > 0) {
        span.textContent = `${c} / ${t} もん`;
      } else {
        span.textContent = '';
      }
    };
  }

  // 結果表示（ResultCardレゴ）…標準搭載
  // 使い方：A.showResult({ correct, total, tier, labels, buttons, extraHint, onRetry, onSetup, results })
  if (typeof A.showResult !== 'function') {
    A.showResult = (opts = {}) => {
      const correct = Number(opts.correct ?? 0);
      const total   = Number(opts.total ?? 0);

      const tier = opts.tier ?? "low";

      const labels = {
        heading: "【 け っ か 】",
        retry:   "おなじ もんだい",
        setup:   "もんだいを えらぶ",
        ...(opts.labels || {})
      };

      const buttons = Array.isArray(opts.buttons) ? opts.buttons : ["retry", "setup"];

      const results = Array.isArray(opts.results)
        ? opts.results
        : [`${total}もんちゅう ${correct}もん せいかい！`];

      const extraHint = opts.extraHint ?? "";

      const onRetry = typeof opts.onRetry === "function" ? opts.onRetry : () => {};
      const onSetup = typeof opts.onSetup === "function" ? opts.onSetup : () => {};

      // ResultCard が読み込まれていない（HTMLから削除した）場合は何もしない
      if (typeof window.ResultCard?.show !== "function") return;

      window.ResultCard.show({
        correct,
        total,
        results,
        tier,
        labels,
        buttons,
        extraHint,
        onRetry,
        onSetup
      });
    };
  }

  // Setup表示（SetupCardレゴ）…標準搭載
  // 使い方：A.showSetup({ title, columns, startLabel, onStart })
  if (typeof A.showSetup !== 'function') {
    A.showSetup = (cfg = {}) => {
      if (typeof window.SetupCard?.show !== "function") return;
      return window.SetupCard.show(cfg);
    };
  }

});
