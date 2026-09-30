/* TenKeypad Lego
   window.TenKeypad.mount(root, options)

   options:
     - keys: number[]  (default: [1..9])
     - multi: boolean  (default: true)
     - value: number[] initial (default: [])
     - showAllClear: boolean (default: true)
     - onChange: (arr:number[]) => void
*/
(() => {
  'use strict';

  const uniqSorted = (arr) => {
    const s = new Set(arr.filter(n => Number.isFinite(n)));
    return Array.from(s).sort((a,b)=>a-b);
  };

  function mount(root, options){
    const opt = options || {};
    const keys = Array.isArray(opt.keys) && opt.keys.length ? opt.keys : [1,2,3,4,5,6,7,8,9];
    const multi = (opt.multi !== false);
    let value = uniqSorted(Array.isArray(opt.value) ? opt.value.map(Number) : []);
    const showAllClear = (opt.showAllClear !== false);
    const onChange = (typeof opt.onChange === 'function') ? opt.onChange : null;

    root.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'tenkeypad';

    const grid = document.createElement('div');
    grid.className = 'tenkeypad-grid';

    const btnMap = new Map();

    keys.forEach((k) => {
      const n = Number(k);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tenkeypad-btn';
      b.textContent = String(n);
      b.dataset.key = String(n);

      b.addEventListener('click', () => {
        if(!multi){
          value = [n];
        }else{
          if(value.includes(n)){
            value = value.filter(x => x !== n);
          }else{
            value = uniqSorted(value.concat([n]));
          }
        }
        update();
        if(onChange) onChange(value.slice());
      });

      btnMap.set(n, b);
      grid.appendChild(b);
    });

    wrap.appendChild(grid);

    let tools = null;
    if(showAllClear){
      tools = document.createElement('div');
      tools.className = 'tenkeypad-tools';

      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'tenkeypad-tool';
      allBtn.textContent = 'ぜんぶ';

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'tenkeypad-tool';
      clearBtn.textContent = 'けす';

      allBtn.addEventListener('click', () => {
        value = uniqSorted(keys.map(Number));
        update();
        if(onChange) onChange(value.slice());
      });

      clearBtn.addEventListener('click', () => {
        value = [];
        update();
        if(onChange) onChange(value.slice());
      });

      tools.appendChild(allBtn);
      tools.appendChild(clearBtn);
      wrap.appendChild(tools);
    }

    const update = () => {
      btnMap.forEach((b, n) => {
        b.classList.toggle('is-on', value.includes(n));
      });
    };

    update();
    root.appendChild(wrap);

    return {
      getValue: () => value.slice(),
      setValue: (arr) => {
        value = uniqSorted(Array.isArray(arr) ? arr.map(Number) : []);
        update();
        if(onChange) onChange(value.slice());
      }
    };
  }

  window.TenKeypad = { mount };
})();
