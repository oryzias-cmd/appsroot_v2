(function(global){
  "use strict";

  function build(A,B){
    return Engine.buildStepsOptimal(A,B);
  }

  global.ModeOptimal = { build };
})(window);
