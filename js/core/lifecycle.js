// ============================================================================
// GLOBAL LIFECYCLE & MEMORY MANAGEMENT ENGINE
// Strictly cleans up requestAnimationFrame loops, intervals, Chart.js instances,
// and Three.js scenes/geometries/materials on every route change.
// ============================================================================
const LifecycleManager = {
  rafIds: new Set(),
  intervals: new Set(),
  timeouts: new Set(),
  charts: new Set(),
  threeContexts: new Set(),
  disposeCounter: 0,

  requestFrame(callback) {
    const id = window.requestAnimationFrame((ts) => {
      this.rafIds.delete(id);
      this.updateTelemetry();
      callback(ts);
    });
    this.rafIds.add(id);
    this.updateTelemetry();
    return id;
  },

  cancelFrame(id) {
    if (id) {
      window.cancelAnimationFrame(id);
      this.rafIds.delete(id);
      this.updateTelemetry();
    }
  },

  setInterval(fn, ms) {
    const id = window.setInterval(fn, ms);
    this.intervals.add(id);
    return id;
  },

  setTimeout(fn, ms) {
    const id = window.setTimeout(() => {
      this.timeouts.delete(id);
      fn();
    }, ms);
    this.timeouts.add(id);
    return id;
  },

  registerChart(chartInstance) {
    if (chartInstance) this.charts.add(chartInstance);
    return chartInstance;
  },

  registerThree(ctx) {
    if (ctx) this.threeContexts.add(ctx);
    return ctx;
  },

  cleanupAll() {
    // 1. Cancel all animation frames
    for (const id of this.rafIds) {
      window.cancelAnimationFrame(id);
    }
    this.rafIds.clear();

    // 2. Clear intervals & timeouts
    for (const id of this.intervals) {
      window.clearInterval(id);
    }
    this.intervals.clear();

    for (const id of this.timeouts) {
      window.clearTimeout(id);
    }
    this.timeouts.clear();

    // 3. Destroy all Chart.js instances
    for (const chart of this.charts) {
      try { chart.destroy(); } catch (e) {}
    }
    this.charts.clear();

    // 4. Dispose all Three.js scenes, geometries, materials, and WebGLRenderers
    for (const ctx of this.threeContexts) {
      try {
        if (ctx.rafId) window.cancelAnimationFrame(ctx.rafId);
        if (ctx.scene) {
          ctx.scene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose && m.dispose());
              } else if (obj.material.dispose) {
                obj.material.dispose();
              }
            }
          });
          ctx.scene.clear();
        }
        if (ctx.renderer) {
          ctx.renderer.dispose();
          if (ctx.renderer.domElement && ctx.renderer.domElement.parentNode) {
            ctx.renderer.domElement.parentNode.removeChild(ctx.renderer.domElement);
          }
        }
        this.disposeCounter++;
      } catch (e) {}
    }
    this.threeContexts.clear();
    this.updateTelemetry();
  },

  updateTelemetry() {
    const rafEl = document.getElementById('telemetry-raf-count');
    const dispEl = document.getElementById('telemetry-dispose-count');
    if (rafEl) rafEl.textContent = String(this.rafIds.size);
    if (dispEl) dispEl.textContent = String(this.disposeCounter);
  }
};

// Helper to rehydrate Lucide icons after DOM updates
function rehydrateIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Deterministic 128-bit MD5-style Hex Hash Simulator for DynamoDB & Partitioning
function computeDeterministicHashHex(inputStr) {
  const str = String(inputStr || '');
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  let h3 = 0x9e3779b9 ^ str.length;
  let h4 = 0x85ebca6b ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return (hex(h1) + hex(h2) + hex(h3) + hex(h4)).toUpperCase();
}
