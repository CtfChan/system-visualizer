// ============================================================================
// SECONDARY CATALOG 3: POSTGRESQL INTERNALS (/#postgresql)
// MVCC Tuple Versions (xmin, xmax, ctid), Write-Ahead Log (WAL), VACUUM
// ============================================================================
function renderPostgresView(container) {
  container.innerHTML = `
    <div class="glass-card rounded-2xl p-6 lg:p-8 border border-sky-500/30">
      <div class="space-y-3 max-w-3xl">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold">Databases &amp; Consensus · PostgreSQL</span>
          <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">8KB Heap Pages &amp; MVCC</span>
          <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">WAL LSN &amp; Autovacuum</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white">PostgreSQL Storage Engine: MVCC Tuples, WAL &amp; VACUUM</h1>
        <p class="text-sm text-slate-300 leading-relaxed">
          Unlike InnoDB or Oracle (which overwrite rows in-place and store old versions in a Rollback/Undo Segment), PostgreSQL appends a <strong>new physical Heap Tuple version on every UPDATE</strong>, stamping <code class="text-rose-300">t_xmax</code> on the old tuple and <code class="text-emerald-300">t_xmin</code> on the new tuple, relying on <strong>AUTOVACUUM</strong> to reclaim dead tuple space.
        </p>
      </div>
    </div>

    <!-- Interactive 8KB Heap Page, MVCC Tuple Chain & WAL Simulator -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 class="text-base font-bold text-white flex items-center gap-2">
            <i data-lucide="layers" class="w-5 h-5 text-sky-400"></i>
            Interactive 8KB Heap Page MVCC Tuple Chain &amp; WAL Simulator
          </h2>
          <p class="text-xs text-slate-400">Execute SQL mutations and run <code class="text-emerald-300">VACUUM</code> to inspect <code class="text-sky-300">t_xmin</code>, <code class="text-rose-300">t_xmax</code>, <code class="text-amber-300">t_ctid</code> pointers, and WAL LSN records.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="pg-update-btn" class="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-semibold">+ Execute UPDATE balance = balance - 50</button>
          <button id="pg-vacuum-btn" class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold">🧹 Run VACUUM (Reclaim Dead Tuples)</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div class="lg:col-span-7 space-y-3">
          <div class="text-xs font-mono uppercase tracking-wider text-sky-400 font-bold">Heap Page #0 (8,192 Bytes) — Line Pointers &amp; Tuple Versions</div>
          <div id="pg-tuple-list" class="space-y-2 font-mono text-xs"></div>
        </div>
        <div class="lg:col-span-5 space-y-3">
          <div class="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">Write-Ahead Log (pg_wal) LSN Stream &amp; Replica Lag</div>
          <div id="pg-wal-list" class="space-y-1.5 font-mono text-[11px] bg-slate-950 p-3.5 rounded-xl border border-slate-800"></div>
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();

  let currentXid = 502;
  let currentBalance = 950;
  let tuples = [
    { slot: 1, xmin: 500, xmax: 501, ctid: '(0,2)', val: 'balance=1000', dead: true, hot: true },
    { slot: 2, xmin: 501, xmax: 0, ctid: '(0,2)', val: 'balance=950', dead: false, hot: true }
  ];
  let walRecords = [
    { lsn: '0/16B3748', xid: 500, op: 'HEAP_INSERT tuple (0,1) balance=1000' },
    { lsn: '0/16B37A0', xid: 501, op: 'HEAP_HOT_UPDATE (0,1)->(0,2) balance=950' }
  ];

  function renderPgState() {
    const tEl = document.getElementById('pg-tuple-list');
    if (tEl) {
      tEl.innerHTML = tuples.map(t => `
        <div class="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
          t.reclaimed ? 'bg-slate-950 border-dashed border-slate-800 text-slate-500' :
          t.dead ? 'bg-rose-950/25 border-rose-500/40 text-rose-200' :
          'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
        }">
          <div>
            <span class="font-bold text-white">ItemId lp_${t.slot}</span>
            ${t.reclaimed
              ? '<span class="ml-2 text-emerald-400">[LP_UNUSED — Reclaimed by VACUUM for reuse]</span>'
              : `<span class="ml-2">t_xmin=<strong class="text-emerald-300">${t.xmin}</strong> | t_xmax=<strong class="${t.xmax ? 'text-rose-400' : 'text-slate-400'}">${t.xmax || '0 (LIVE)'}</strong> | t_ctid=<strong class="text-amber-300">${t.ctid}</strong></span>`
            }
            ${!t.reclaimed ? `<div class="text-[11px] text-slate-300 mt-1">Payload: ${t.val} · ${t.dead ? 'DEAD TUPLE (Invisible to new snapshots)' : 'VISIBLE LIVE TUPLE (HOT Chain Head)'}</div>` : ''}
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
            t.reclaimed ? 'bg-slate-800 text-slate-400' : t.dead ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
          }">${t.reclaimed ? 'FREED' : t.dead ? 'DEAD_TUPLE' : 'LIVE_TUPLE'}</span>
        </div>
      `).join('');
    }

    const wEl = document.getElementById('pg-wal-list');
    if (wEl) {
      wEl.innerHTML = walRecords.slice(-6).map(w => `
        <div class="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
          <span><strong class="text-amber-300">${w.lsn}</strong> [XID ${w.xid}]</span>
          <span class="text-slate-300 truncate">${w.op}</span>
        </div>
      `).join('');
    }
  }

  document.getElementById('pg-update-btn')?.addEventListener('click', () => {
    currentXid++;
    currentBalance -= 50;
    const newSlot = tuples.length + 1;
    const liveTuple = tuples.find(t => !t.dead && !t.reclaimed);
    if (liveTuple) {
      liveTuple.xmax = currentXid;
      liveTuple.ctid = `(0,${newSlot})`;
      liveTuple.dead = true;
    }
    tuples.push({
      slot: newSlot,
      xmin: currentXid,
      xmax: 0,
      ctid: `(0,${newSlot})`,
      val: `balance=${currentBalance}`,
      dead: false,
      hot: true
    });
    walRecords.push({
      lsn: `0/16B3${(800 + currentXid).toString(16).toUpperCase()}`,
      xid: currentXid,
      op: `HEAP_HOT_UPDATE -> (0,${newSlot}) balance=${currentBalance}`
    });
    renderPgState();
  });

  document.getElementById('pg-vacuum-btn')?.addEventListener('click', () => {
    tuples.forEach(t => {
      if (t.dead && !t.reclaimed) t.reclaimed = true;
    });
    walRecords.push({
      lsn: `0/16B3${(900 + currentXid).toString(16).toUpperCase()}`,
      xid: 0,
      op: `VACUUM_PAGE_PRUNE reclaimed dead line pointers & updated Visibility Map`
    });
    renderPgState();
  });

  renderPgState();
}
