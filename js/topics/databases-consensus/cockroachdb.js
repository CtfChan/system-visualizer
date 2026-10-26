// ============================================================================
// SECONDARY CATALOG 2: COCKROACHDB (/#cockroachdb)
// Multi-Raft 64MB Ranges, Range Leases, Hybrid Logical Clocks (HLC) & Read Restart
// ============================================================================
function renderCockroachDBView(container) {
  container.innerHTML = `
    <div class="glass-card rounded-2xl p-6 lg:p-8 border border-teal-500/30">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div class="space-y-3 max-w-3xl">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold">Databases &amp; Consensus · CockroachDB</span>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">Multi-Raft (64MB Ranges)</span>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">Hybrid Logical Clocks (HLC)</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white">CockroachDB: Multi-Raft, Range Leases &amp; Hybrid Logical Clocks</h1>
          <p class="text-sm text-slate-300 leading-relaxed">
            Designed to run on commodity cloud VMs using software NTP clocks instead of atomic hardware clocks, CockroachDB combines <strong>Hybrid Logical Clocks <code class="text-teal-300">(physical_time, logical_counter)</code></strong>, <strong>Multi-Raft 64MB keyspace ranges</strong>, and <strong>Read Refresh / Uncertainty Restarts</strong> across the window <code class="text-amber-300">[t_read, t_read + max_offset]</code>.
          </p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left 7 Cols: Interactive HLC Uncertainty Interval & Read Restart Simulator -->
      <div class="lg:col-span-7 glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="shield-alert" class="w-4 h-4 text-teal-400"></i>
              HLC Uncertainty Interval <code class="text-amber-300">[t_read, t_read + max_offset]</code> Simulator
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              Drag the encountered MVCC Tuple Timestamp <code class="text-indigo-300">t_tuple</code> relative to Transaction <code class="text-teal-300">t_read = 100ms</code> (with <code class="text-amber-300">max_offset = 250ms</code>) to see when CockroachDB triggers a <strong>Read Restart</strong>.
            </p>
          </div>
        </div>

        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3 text-xs font-mono">
          <div class="flex justify-between">
            <span class="text-slate-300">Encountered MVCC Tuple Timestamp (t_tuple):</span>
            <span id="crdb-tuple-val" class="text-amber-300 font-bold">180 ms</span>
          </div>
          <input id="crdb-tuple-slider" type="range" min="20" max="450" step="10" value="180" class="w-full accent-teal-400" />
          <div class="flex justify-between text-[10px] text-slate-400">
            <span>Past (&lt; 100ms: Visible)</span>
            <span class="text-amber-300">Uncertainty Zone [100ms .. 350ms] (Read Restart!)</span>
            <span>Future (&gt; 350ms: Invisible)</span>
          </div>
        </div>

        <div id="crdb-outcome-box" class="p-4 rounded-xl border text-xs font-mono space-y-1.5"></div>

        <!-- HLC Causality Step Simulator -->
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold text-teal-300">HLC Causality Tick Simulator: HLC = (pt, lc)</span>
            <div class="flex gap-2">
              <button id="crdb-local-ev-btn" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-white">Local Event</button>
              <button id="crdb-skew-rpc-btn" class="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-xs font-mono text-white font-semibold">Receive Fast-Clock RPC (+45ms Skew)</button>
            </div>
          </div>
          <div id="crdb-hlc-log" class="font-mono text-xs text-slate-300 space-y-1"></div>
        </div>
      </div>

      <!-- Right 5 Cols: Range Leaseholder & Multi-Raft Architecture -->
      <div class="lg:col-span-5 glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i data-lucide="layers" class="w-4 h-4 text-teal-400"></i>
          Multi-Raft Range Leases &amp; Pebble LSM Storage
        </h3>
        <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div class="font-mono font-bold text-teal-300 mb-1">1. 64 MB Ordered Keyspace Ranges</div>
            <p>The monolithic logical keyspace is sorted lexicographically and automatically split into contiguous 64 MB <strong>Ranges</strong>. Each Range is an independent 3- or 5-replica Raft consensus group stored in Pebble (Go RocksDB-inspired LSM).</p>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div class="font-mono font-bold text-amber-300 mb-1">2. Range Leaseholder Optimization</div>
            <p>A single replica holds a time-bounded <strong>Range Lease</strong> (almost always co-located with the Raft Leader). Because all writes must go through the Leaseholder, the Leaseholder can serve <strong>linearizable reads locally from Pebble with 0 Raft roundtrips</strong>!</p>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div class="font-mono font-bold text-indigo-300 mb-1">3. Parallel Commits (1-RTT Transactions)</div>
            <p>CockroachDB pipelines writing transaction intent records and writing the <code class="text-teal-300">STAGING</code> transaction record concurrently in a single consensus roundtrip.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();

  function updateCrdbUncertainty() {
    const tTuple = parseInt(document.getElementById('crdb-tuple-slider')?.value || '180', 10);
    document.getElementById('crdb-tuple-val').textContent = `${tTuple} ms`;
    const box = document.getElementById('crdb-outcome-box');
    if (!box) return;
    if (tTuple <= 100) {
      box.className = 'p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/25 text-xs font-mono space-y-1.5';
      box.innerHTML = `<div class="text-emerald-300 font-bold">✓ DEFINITELY IN THE PAST (t_tuple = ${tTuple}ms ≤ t_read = 100ms)</div><p class="text-slate-300">Tuple committed causally before our transaction started. Read returns this tuple immediately with zero restart.</p>`;
    } else if (tTuple <= 350) {
      box.className = 'p-4 rounded-xl border border-amber-500 bg-amber-950/35 text-xs font-mono space-y-1.5';
      box.innerHTML = `<div class="text-amber-300 font-bold">🔄 UNCERTAINTY INTERVAL CONFLICT (100ms &lt; t_tuple = ${tTuple}ms ≤ 350ms) -> READ RESTART!</div><p class="text-slate-200">Because NTP clocks across nodes can drift by up to max_offset (250ms), CockroachDB cannot tell if t_tuple=${tTuple}ms actually happened before t_read=100ms in real time! It bumps <code class="text-white">t_read = ${tTuple}ms</code> and restarts the read cleanly.</p>`;
    } else {
      box.className = 'p-4 rounded-xl border border-indigo-500/40 bg-indigo-950/25 text-xs font-mono space-y-1.5';
      box.innerHTML = `<div class="text-indigo-300 font-bold">⏭ DEFINITELY IN THE FUTURE (t_tuple = ${tTuple}ms &gt; t_read + max_offset = 350ms)</div><p class="text-slate-300">Even under worst-case clock skew, this tuple was written after our snapshot started. Safely ignored (invisible to snapshot).</p>`;
    }
  }

  document.getElementById('crdb-tuple-slider')?.addEventListener('input', updateCrdbUncertainty);
  updateCrdbUncertainty();

  let hlcPt = 1000;
  let hlcLc = 0;
  const hlcHistory = [`Node A Initial HLC = (pt: 1000ms, lc: 0)`];

  function renderHlcLog() {
    const el = document.getElementById('crdb-hlc-log');
    if (el) el.innerHTML = hlcHistory.slice(-4).map(l => `<div class="px-2 py-1 rounded bg-slate-900 border border-slate-800">${l}</div>`).join('');
  }
  document.getElementById('crdb-local-ev-btn')?.addEventListener('click', () => {
    hlcLc += 1;
    hlcHistory.push(`Local Write Event -> HLC = (pt: ${hlcPt}ms, lc: ${hlcLc})`);
    renderHlcLog();
  });
  document.getElementById('crdb-skew-rpc-btn')?.addEventListener('click', () => {
    const msgPt = hlcPt + 45;
    hlcPt = msgPt;
    hlcLc = 1;
    hlcHistory.push(`RPC from Fast Node (msg_pt=${msgPt}ms) -> Node A jumps HLC = (pt: ${hlcPt}ms, lc: ${hlcLc})`);
    renderHlcLog();
  });
  renderHlcLog();
}
