/* ws-spike-streak.js
 * 共享的 Spike 连续次数 (streak) 追踪工具，避免各模块重复维护 Map 逻辑。
 * 设计：
 *   createSpikeStreakTracker({ sustainMin }) -> { update(key, isSpike): { streak, sustained } }
 *   - 内部使用 Map<key, number>
 *   - update: 若 isSpike=true -> streak++, 否则归零
 *   - sustained = streak >= sustainMin
 *   - sustainMin 若缺省=2
 */
(function(){
  'use strict';
  if (window.createSpikeStreakTracker) return; // 幂等

  function createSpikeStreakTracker(opts){
    opts = opts || {}; const sustainMin = typeof opts.sustainMin==='number'? Math.max(1, opts.sustainMin) : 2;
    let recoveryWindowMs = typeof opts.recoveryWindowMs==='number' && opts.recoveryWindowMs>0 ? opts.recoveryWindowMs : 30_000;
    // state: Map<key, { streak:number, lastSpikeTs:number|null, lastRecoveryTs:number|null, wasSpike:boolean, recoveries:number[] }>
    const state = new Map();
    function _purgeOldRecoveries(now, horizonMs){
      state.forEach(rec=>{
        if (rec.recoveries){
          const cutoff = now - horizonMs;
            let i=0; while(i < rec.recoveries.length && rec.recoveries[i] < cutoff) i++;
            if (i>0) rec.recoveries.splice(0,i);
        }
      });
    }
    return {
      update(key, isSpike){
        if (!key) return { streak:0, sustained:false, recovering:false };
        let rec = state.get(key);
        const now = Date.now();
        if (!rec){ rec = { streak:0, lastSpikeTs:null, lastRecoveryTs:null, wasSpike:false, recoveries:[] }; state.set(key, rec); }
        if (isSpike){
          rec.streak += 1;
          rec.lastSpikeTs = now;
          rec.wasSpike = true;
        } else {
          if (rec.wasSpike && rec.streak > 0){
            // recovery transition
            rec.lastRecoveryTs = now;
            if (Array.isArray(rec.recoveries)) rec.recoveries.push(now);
          }
          rec.streak = 0;
          rec.wasSpike = false;
        }
        const sustained = rec.streak >= sustainMin;
        const recovering = !isSpike && rec.lastRecoveryTs && (now - rec.lastRecoveryTs) < recoveryWindowMs; // 可配置恢复窗口
        return { streak: rec.streak, sustained, recovering, lastRecoveryTs: rec.lastRecoveryTs };
      },
      // expose read for potential future health score fine-tuning
      peek(key){ return state.get(key); },
      setRecoveryWindowMs(ms){ if (typeof ms==='number' && ms>0) recoveryWindowMs = ms; },
      recoveryStats(horizonMs){
        const now = Date.now();
        const h = typeof horizonMs==='number' && horizonMs>0 ? horizonMs : 60_000;
        _purgeOldRecoveries(now, h);
        let total = 0; let keys = 0;
        state.forEach(rec=>{ if (rec.recoveries){ const c = rec.recoveries.filter(ts=> now - ts <= h).length; if (c>0){ total += c; keys++; } } });
        return { horizonMs: h, count: total, keysAffected: keys };
      },
      recoveryTimeline(horizonMs){
        const now = Date.now();
        const h = typeof horizonMs==='number' && horizonMs>0 ? horizonMs : 60_000;
        const cutoff = now - h;
        const out=[];
        state.forEach((rec,key)=>{ if (rec.recoveries){ rec.recoveries.forEach(ts=>{ if (ts>=cutoff) out.push({ key, ts }); }); } });
        out.sort((a,b)=> a.ts - b.ts);
        return out;
      }
    };
  }

  window.createSpikeStreakTracker = createSpikeStreakTracker;
  if (!window.__SPIKE_STREAK_TRACKER__) window.__SPIKE_STREAK_TRACKER__ = createSpikeStreakTracker();
  console.log('✅ ws-spike-streak 已加载 (createSpikeStreakTracker)');
})();
