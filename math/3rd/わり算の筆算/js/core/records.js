(function(global){
  "use strict";
  const store = {
    last: null
  };
  function save(run){
    try{ store.last = JSON.parse(JSON.stringify(run)); }catch(_){}
  }
  function get(){ return store.last; }
  global.Rec = { save, get };
})(window);
