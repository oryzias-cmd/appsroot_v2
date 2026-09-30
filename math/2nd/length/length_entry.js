/* ========================================
   length_entry.js（Entry Lego 登録）
   - entry.full.js（EntryFull）に寄せる
   - entry は「ページ内 SetupCard」担当（歯車は出さない）
======================================== */

(() => {
  'use strict';

  if (!window.EntryFull || typeof window.EntryFull.register !== 'function') {
    alert('EntryFull が読み込まれていません（entry.full.js）');
    return;
  }

  // 4つだけ（確定）：3m は未実装でも entry には出す
  const RANGES = {
    cm10: { key:'cm10', label:'10cm', target:'./length_10cm.html' },
    cm30: { key:'cm30', label:'30cm', target:'./length_30cm.html' },
    m1:   { key:'m1',   label:'１m',  target:'./length_1m.html' },
    m3:   { key:'m3',   label:'３m',  target:'./length_3m.html' } // 予定（未実装）
  };

  // entry 側の app 定義（entry の名札）
  const APP = {
    key: 'length.entry',
    title: 'ながさ',
    backUrl: '../../../catalog/math-2nd.html#upper'
  };

  window.EntryFull.register({
    app: APP,

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        const s = saved || {};

        return [
          // col1：ものさしの ながさ
          [
            {
              id: 'rangeKey',
              title: 'ものさしの ながさ',
              desc: 'ものさしを えらぶ',
              type: 'radio',
              required: true,
              options: [
                { value: 'cm10', label: RANGES.cm10.label },
                { value: 'cm30', label: RANGES.cm30.label },
                { value: 'm1',   label: RANGES.m1.label   },
                { value: 'm3',   label: RANGES.m3.label   }
              ],
              default: (s.rangeKey != null) ? String(s.rangeKey) : undefined
            }
          ],

          // col2：もんだいの レベル（出題の最小単位）
          [
            {
              id: 'unitMode',
              title: 'もんだいの レベル',
              desc: 'むずかしさを えらぶ',
              type: 'radio',
              required: true,
              options: [
                { value: 'coarse', label: 'cmだけ' },
                { value: 'fine',   label: 'cmとmm' }
              ],
              default: (s.unitMode != null) ? String(s.unitMode) : undefined
            }
          ],

          // col3：おたすけの しゅるい（ボタンの種類）
          [
            {
              id: 'helpMark',
              title: 'おたすけの しゅるい',
              desc: 'ボタンを えらぶ',
              type: 'radio',
              required: true,
              options: [
                { value: 'uniform', label: 'そろった ボタン' },
                { value: 'varied',  label: 'いろいろな ボタン' }
              ],
              default: (s.helpMark != null) ? String(s.helpMark) : undefined
            }
          ]
        ];
      }
    },

    hooks: {
      // 戻りは「固定URL（slot-header / APP.backUrl）を優先」、なければ history
      onReady: () => {
        window.AppActions = window.AppActions || {};
        if (typeof window.AppActions.back !== 'function') {
          const slot = document.getElementById('slot-header');
          const back = slot ? String(slot.dataset.back || '') : '';

          if (back && back !== 'history') {
            window.AppActions.back = () => { location.href = back; };
          } else if (APP.backUrl) {
            window.AppActions.back = () => { location.href = APP.backUrl; };
          } else {
            window.AppActions.back = () => history.back();
          }
        }
      },

      // ★entry.full.js は「defaultTarget への1本遷移」しか持たないため、
      // 分岐遷移は beforeStart 内でこちらが直接 location.href する。
      // その代わり、復元用の保存（key:setup）は先にここで行う。
      beforeStart: (out) => {
        const rk = String(out.rangeKey || '');

        // 3m はまだ作っていないので「準備中」で止める
        if (rk === 'm3') {
          alert('３m は じゅんびちゅう です');
          return { cancel: true };
        }

        const r = RANGES[rk] || null;
        const target = r ? r.target : RANGES.cm10.target;

        // 復元用に保存（entry.full.js の saveForReturn 相当）
        try {
          sessionStorage.setItem('length.entry:setup', JSON.stringify(out));
        } catch (e) {}

        // URLパラメータ付与（entry.full.js の startTo 相当）
        const params = new URLSearchParams();
        Object.keys(out).forEach((k) => params.set(k, String(out[k])));

        location.href = target + '?' + params.toString();

        // entry.full.js 側のデフォルト遷移を止める
        return { cancel: true };
      }
    }
  });
})();
