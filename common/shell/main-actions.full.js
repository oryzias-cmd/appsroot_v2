// common/shell/main-actions.full.js
// １つだけ中央に出るメインアクションボタンを管理する共通パーツ
// ・表示/非表示
// ・表示ラベル
// ・押されたときのコールバック
// 教材ごとの判定ロジックはここには持たせない

(function(){
  // 内部状態
  let mode = 'hide'; // 'hide' | 'check' | 'next' など自由に増やせる
  let rootEl = null; // #answerControlSlot
  let btnEl  = null; // 実際のボタン

  // 1. スロット(#answerControlSlot)を #board 内に確保する（盤面のど真ん中に重ねるため）
function ensureSlot(){
  if (!rootEl) rootEl = document.getElementById('answerControlSlot');
  if (!rootEl){
    const board = document.getElementById('board');
    if (board){
      rootEl = document.createElement('div');
      rootEl.id = 'answerControlSlot';
      board.appendChild(rootEl);          // ★ board 直下へ
    }
  }
  return rootEl;
}

  // 2. ボタンDOMを用意する
  function ensureButton(){
    ensureSlot();
    if (!rootEl) return;

    if (!btnEl){
btnEl = document.createElement('button');
btnEl.className = 'btn main-action-btn';
      // 基本スタイルはCSS側で。ここでは最低限だけ。
      btnEl.style.fontSize = '1.2rem';

      btnEl.addEventListener('click', ()=>{
        // ボタンが押されたとき、今のmodeに応じてアプリ側コールバックを呼ぶ
        if (typeof window.MainAction?.onPress === 'function'){
          window.MainAction.onPress(mode);
        }
      });

      rootEl.innerHTML = ''; // 念のためクリアして1個だけ入れる
      rootEl.appendChild(btnEl);
    }
  }

  // 3. 表示を更新する
  function render(){
    ensureButton();
    if (!rootEl || !btnEl) return;

    if (mode === 'hide'){
rootEl.style.display = (mode === 'hide') ? 'none' : 'block';
      return;
    }

    // ボタンを見せる
    rootEl.style.display = '';
    rootEl.style.justifyContent = 'center';
    rootEl.style.display = 'flex';

    // モードごとのラベル
    if (mode === 'check'){
      btnEl.textContent = 'こたえあわせ';
    } else if (mode === 'next'){
      btnEl.textContent = 'つぎのもんだい';
    } else {
      // それ以外の任意モードにも拡張できる
      btnEl.textContent = mode;
    }
  }

  // 4. 公開API
  window.MainAction = {
    // modeを変更して表示を反映
    setMode(newMode){
      mode = newMode;
      render();
    },
    // 今のmodeを知りたいとき
    getMode(){
      return mode;
    },
    // 強制的に消したいとき
    hide(){
      mode = 'hide';
      render();
    },
    // ボタンが押されたときに呼ばれる関数を、教材側で上書きできる
    onPress: function(currentMode){
      // デフォルトは何もしない。
      // 各教材側で window.MainAction.onPress = fn を代入してください。
      console.log('[MainAction.onPress default]', currentMode);
    }
  };

  // DOM完成後に初期化（スロットとボタンを用意しておく）
  document.addEventListener('DOMContentLoaded', ()=>{
    ensureButton();
    render(); // 初期は 'hide'
  });

})();
