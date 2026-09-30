// 三角形モードの出題プール定義（線幅=3pxのSVGを想定）
// 画像は /images/valid_tri/ 配下に配置

window.TriData = (function(){
  // 正解（先生提供の4枚をトレースして配置してください）
  const OK = [
    "tri_ok_01.svg",
    "tri_ok_02.svg",
    "tri_ok_03.svg",
    "tri_ok_04.svg",
  ];

  // 誤答カテゴリ
  const OPEN = [ "tri_open_01.svg", "tri_open_02.svg" ];
  const CURVE = [ "tri_curve_01.svg", "tri_curve_02.svg" ];
  const ROUND = [ "tri_round_01.svg", "tri_round_02.svg" ]; // 02は仮→後で差替OK
  const NPOLY = [ "tri_npoly_circle.svg", "tri_npoly_ellipse.svg", "tri_npoly_capsule.svg" ];
  const OTHER = [ "tri_other_quad_01.svg", "tri_other_quad_02.svg", "tri_other_penta_01.svg" ];

  // 誤答プール（カテゴリ分散のため配列ごと扱う）
  const WRONG_GROUPS = [ OPEN, CURVE, ROUND, NPOLY, OTHER ];

  // 画像のベースパス
  const BASE = "../../../shared/images/valid_tri/";

  return {
    BASE,
    OK,
    WRONG_GROUPS
  };
}

)();

// ===== 四角形モード用データ（Triと同じIIFE形式に統一） =====
// 画像は /images/valid_quad/ 配下に配置（必要ならパス調整OK）
window.QuadData = (function(){
  // 正解（4枚）
  const OK = [
    "quad_rect.svg",          // 長方形
    "quad_square.svg",        // 正方形
    "quad_parallelogram.svg", // 平行四辺形
    "quad_trapezoid.svg"      // 台形
  ];

  // 誤答カテゴリ
  const OPEN  = [ "quad_open_01.svg",  "quad_open_02.svg"  ];
  const CURVE = [ "quad_curve_01.svg", "quad_curve_02.svg" ];
  const ROUND = [ "quad_round_01.svg", "quad_round_02.svg" ];
  const NPOLY = [ "quad_npoly_circle.svg", "quad_npoly_ellipse.svg", "quad_npoly_capsule.svg" ];
  // 角の数がちがう（三角/五角など）— 実ファイル名に合わせて差し替え可
  const OTHER = [ "quad_other_tri_01.svg", "quad_other_penta_01.svg" ];

  const WRONG_GROUPS = [ OPEN, CURVE, ROUND, NPOLY, OTHER ];

  // ベースパス（必要ならプロジェクトに合わせて変更）
  const BASE = "../../../shared/images/valid_quad/";

  return { BASE, OK, WRONG_GROUPS };
})();
