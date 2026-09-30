使い方（3ステップ）

1) このフォルダをコピーして、作りたいアプリ配下へ貼り付け。
   例）apps/app5-draw/ にコピー → lv1.html/js/css にリネーム。

2) lv1.html を開いて、{{LEVEL}} を「Lv1」などに置換。
   最下段の REPLACE_ME.js を lv1.js に変更。

3) lv1.js の “各レベル固有ロジック（onBoardClick / onJudge / nextProblem …）” を実装。
   ヘッダー/グリッド/フッターの配線は完成済みなので、動きだけ書けばOK。

共有ライブラリ（変更禁止の正）
- ../../shared/frame-ui.js  …… ヘッダーのモード反転・音声ON/OFF
- ../../shared/grid_adv.js …… 改良グリッド（0px時リトライ）

CSSは base.css + shared/style.css を使う。
アプリ固有のベースCSS（例：app4-draw/app.css）がある場合は、htmlの<head>に追加してOK。
