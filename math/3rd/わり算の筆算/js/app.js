(function(){
  "use strict";

  // --- modes フォールバック（未読み込みでも動かす） ---
  const ModeApprox = (window.ModeApprox && window.ModeApprox.build)
    ? window.ModeApprox
    : { build: (A,B)=> Engine.buildStepsApprox(A,B) };
  const ModeOptimal = (window.ModeOptimal && window.ModeOptimal.build)
    ? window.ModeOptimal
    : { build: (A,B)=> Engine.buildStepsOptimal(A,B) };

  const qs  = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));

  const state = {
    run: null,
    index: -1,
    timer: null,
    speed: 1.0,
    settings: {
      showZeros: false,
      gridOn: true,
      lanesOn: true,   // 位ラベル表示
    },
  };

  function init(){
    qsa(".ex").forEach(b=> b.addEventListener("click", ()=>{
      qs("#expr").value = b.dataset.ex;
    }));

    qs("#startBtn").addEventListener("click", onStart);
    qs("#nextBtn").addEventListener("click", onNext);
    qs("#backBtn").addEventListener("click", onBack);
    qs("#resetBtn").addEventListener("click", onReset);
    qs("#autoBtn").addEventListener("click", onAuto);

    qs("#speed").addEventListener("input", e=>{
      state.speed = parseFloat(e.target.value);
    });
    qs("#showZeros").addEventListener("change", e=>{
      state.settings.showZeros = e.target.checked;
      rerender();
    });
    qs("#gridOn").addEventListener("change", e=>{
      state.settings.gridOn = e.target.checked;
      rerender();
    });
    const lanesOn = qs("#lanesOn");
    if(lanesOn){
      lanesOn.addEventListener("change", e=>{
        state.settings.lanesOn = e.target.checked;
        rerender();
      });
    }
  }

  function currentMode(){
    const v = document.querySelector('input[name="mode"]:checked').value;
    return v;
  }

  function onStart(){
    const expr = qs("#expr").value.trim();
    const parsed = Fmt.parseExpr(expr);
    if(!parsed){ return alert("『 例）972 ÷ 36 』の形式で入力してください。"); }
    const {A,B} = parsed;

    const errs = Validate.validate(A,B);
    if(errs.length){ return alert(errs.join("\n")); }

    const mode = currentMode();
    const steps = (mode==="approx" ? ModeApprox.build(A,B) : ModeOptimal.build(A,B));

    state.run = { A,B, mode, steps };
    state.index = -1;
    Rec.save(state.run);

    Render.setupStatic(A,B, state.settings);
    qs("#backBtn").disabled = false;
    qs("#nextBtn").disabled = false;
    qs("#autoBtn").disabled = false;
    qs("#resetBtn").disabled = false;
    qs("#explain").innerHTML = `<div class="note">工程を『次へ』で進めます。</div>`;
  }

  function onNext(){
    if(!state.run) return;
    state.index = Math.min(state.index+1, state.run.steps.length-1);
    rerender();
  }

  function onBack(){
    if(!state.run) return;
    state.index = Math.max(state.index-1, -1);
    rerender();
  }

  function onReset(){
    if(state.timer){ clearInterval(state.timer); state.timer=null; }
    if(!state.run) return;
    state.index = -1;
    rerender();
  }

  function onAuto(){
    if(!state.run) return;
    if(state.timer){
      clearInterval(state.timer); state.timer=null;
      qs("#autoBtn").textContent = "自動再生";
      return;
    }
    const base = 800; // ms
    qs("#autoBtn").textContent = "停止";
    state.timer = setInterval(()=>{
      if(state.index >= state.run.steps.length-1){
        clearInterval(state.timer); state.timer=null;
        qs("#autoBtn").textContent = "自動再生";
      }else{
        onNext();
      }
    }, base / state.speed);
  }

  function rerender(){
    if(!state.run){
      Render.clearBoard();
      return;
    }
    const idx = state.index;
    qs("#explain").innerHTML = "";
    if(idx>=0){
      Render.renderUpTo(state.run, idx, state.settings);
    }else{
      Render.setupStatic(state.run.A, state.run.B, state.settings);
      qs("#explain").innerHTML = `<div class="note">工程を『次へ』で進めます。</div>`;
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
