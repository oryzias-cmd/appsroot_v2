# 共通ランチャー（template-launcher.html）使い方・超短手順

■ 1) 置く
- 新しい教材フォルダに template-launcher.html をコピーして、index.html にリネーム。

■ 2) 最小変更（必須）
- タイトル（<h1>）を書き換える。
- 6つのカードの href を自分のアプリのファイル名に変更する。
  例）
    第1弾 → ./app-tri-quad.html
    第2弾 → ./app-tri-quad-define.html
- strong（上段）と span（下段）の文言を必要に応じて変更。

■ 3) よく使う見た目調整（CSS変数を変更）
- --card-height: 160px;   ← ボタンの高さ（120/140/160 など）
- --title-size: 1.4rem;    ← タイトル「第1弾」の文字サイズ
- --desc-size: 0.95rem;    ← 説明文の文字サイズ
- --radius: 16px;          ← 角丸
- --border-color: #b4b9bf; ← 枠線色
- --hover-bg: #f5f5f5;     ← ホバー時の背景
- --shadow / --shadow-hover ← 影（お好みで）

■ 4) 配列は自動
- 240px以上の幅を確保して自動で折返し（2列/3列）。6個でも12個でもOK。

■ 5) アクセシビリティ
- カード全体がリンクになっているため、タップしやすく、フォーカスリングも表示。

■ 6) 既存ランチャーと統一したい場合
- 既存 index.html の .btn と .menu のCSSを template-launcher.html のものに合わせるだけでOK。
