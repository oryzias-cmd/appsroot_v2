(function(global){
  "use strict";

  function validate(A,B){
    const errs = [];
    if(!(Number.isInteger(A) && Number.isInteger(B))) errs.push("整数を入力してください。");
    if(B===0) errs.push("0でわることはできません。");
    if(A<0 || B<0) errs.push("負の数は対象外です。");
    if(String(A).length>4) errs.push("被除数は4桁までです。");
    if(String(B).length>3) errs.push("除数は3桁までです。");
    return errs;
  }

  global.Validate = { validate };
})(window);
