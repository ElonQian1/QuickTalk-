/* ws-spike-baseline.js
 * 统一 Spike 基线计算工具，减少不同模块重复实现。
 * API:
 *   computeSpikeBaseline(values:Array<number>, opts?) -> { baseline:number, modeUsed:string }
 * 逻辑：
 *   1) 过滤非正数值（<=0 忽略）保留0以上有效数；若全部无效 -> baseline = opts.minBaseline (默认 0.01)
 *   2) 支持两种 mode：
 *      - 'median' (默认): 中位数；若 < minBaseline 则寻找第一个 >= minBaseline，仍无 -> minBaseline
 *      - 'trimmedMean': 排序后去掉首尾各 trimCount (默认1，若长度<5 自动降级 median)，对剩余平均；平均 < minBaseline 同上回退
 *   3) 返回 { baseline, modeUsed }
 */
(function(){
  'use strict';
  if (window.computeSpikeBaseline) return; // 幂等

  function _median(arr){ if(!arr.length) return 0; const s=arr.slice().sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2? s[m] : (s[m-1]+s[m])/2; }

  function computeSpikeBaseline(values, opts){
    opts = opts || {};
    const minBaseline = (typeof opts.minBaseline === 'number') ? opts.minBaseline : 0.01;
    const mode = opts.mode === 'trimmedMean' ? 'trimmedMean' : 'median';
    const trimCount = typeof opts.trimCount === 'number' ? Math.max(0, opts.trimCount) : 1;
    const filtered = (values||[]).filter(v=> typeof v==='number' && v>0);
    if (!filtered.length) return { baseline: minBaseline, modeUsed: mode };
    let baseline = 0; let modeUsed = mode;
    if (mode === 'trimmedMean'){
      if (filtered.length < 5){ // 数据量太少回退 median
        baseline = _median(filtered);
        modeUsed = 'median';
      } else {
        const s = filtered.slice().sort((a,b)=>a-b);
        const start = Math.min(trimCount, Math.floor(s.length/2));
        const end = s.length - start;
        const slice = s.slice(start, end);
        const sum = slice.reduce((a,b)=>a+b,0);
        baseline = sum / slice.length;
      }
    } else {
      baseline = _median(filtered);
    }
    if (baseline < minBaseline){
      // 寻找第一个 >= minBaseline
      const sorted = filtered.slice().sort((a,b)=>a-b);
      const found = sorted.find(v=> v >= minBaseline);
      baseline = (found != null) ? found : minBaseline;
    }
    return { baseline, modeUsed };
  }

  window.computeSpikeBaseline = computeSpikeBaseline;
  console.log('✅ ws-spike-baseline 已加载 (computeSpikeBaseline)');
})();
