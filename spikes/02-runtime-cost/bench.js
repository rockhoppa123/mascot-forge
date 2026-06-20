// Q3 runtime-cost sampler — browser built-ins ONLY (no dependency).
//   - frame time p50/p95 via requestAnimationFrame deltas
//   - main-thread blocking via PerformanceObserver({type:"longtask"})
//   - JS heap via performance.memory (Chrome-only, rough)
// Use: window.__bench({target,state,throttle,ms}) -> Promise<result>, OR load a demo with
//   ?bench=1&target=svg-css&state=idle&throttle=none  (autoruns, logs one JSON line).
(function () {
  function pct(sorted, p) {
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  }
  window.__bench = function (meta) {
    var ms = (meta && meta.ms) || 10000;
    var frames = [];
    var longTasks = 0, longTaskMs = 0, po;
    try {
      po = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) { longTasks++; longTaskMs += e.duration; });
      });
      po.observe({ type: "longtask", buffered: true });
    } catch (e) { /* longtask entry type unsupported in this browser */ }
    return new Promise(function (resolve) {
      var last = performance.now();
      var end = last + ms;
      (function tick(now) {
        frames.push(now - last); last = now;
        if (now < end) { requestAnimationFrame(tick); return; }
        if (po) po.disconnect();
        frames.shift(); // drop first (warm-up) delta
        frames.sort(function (a, b) { return a - b; });
        var mem = performance.memory; // ponytail: Chrome-only; null elsewhere is fine, it is a sanity check
        resolve(Object.assign({}, meta, {
          p50: +pct(frames, 50).toFixed(2),
          p95: +pct(frames, 95).toFixed(2),
          longTasks: longTasks,
          longTaskMs: +longTaskMs.toFixed(1),
          heapMB: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : null,
          frames: frames.length,
        }));
      })(last);
    });
  };
  var q = new URLSearchParams(location.search);
  if (q.get("bench") === "1") {
    window.__bench({ target: q.get("target") || "?", state: q.get("state") || "?", throttle: q.get("throttle") || "none" })
      .then(function (r) { console.log(JSON.stringify(r)); window.__benchResult = r; });
  }
})();
