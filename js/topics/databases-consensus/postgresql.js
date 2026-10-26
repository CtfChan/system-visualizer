// ============================================================================
// SECONDARY CATALOG 3: POSTGRESQL INTERNALS (/#postgresql)
// MVCC Tuple Versions (xmin, xmax, ctid), Write-Ahead Log (WAL), VACUUM

const PostgresMeta = {
  accent: 'sky',
  category: 'Storage & Databases',
  title: 'PostgreSQL Internals',
  tags: ['Single primary', 'Append-only MVCC', 'WAL replication'],
  summary: 'Single-primary relational database. An <code>UPDATE</code> never overwrites in place: it writes a new tuple version and stamps the old one with <code>xmax</code>. Readers pick the version visible to their snapshot, so readers never block writers — but dead tuples accumulate until <strong>VACUUM</strong> reclaims them. Every change is first written to the <strong>WAL</strong>, which provides crash recovery and feeds physical/logical replication.',
  constraints: [
    ['Write scaling', 'All writes go to one primary — scale is vertical. Read replicas scale reads only.'],
    ['Bloat', 'Long-running transactions or idle-in-transaction sessions pin the xmin horizon and stop VACUUM from reclaiming dead tuples.'],
    ['XID wraparound', '32-bit transaction IDs. Tables must be frozen by (anti-wraparound) autovacuum or the cluster stops accepting writes.'],
    ['Connections', 'One OS process per connection (several MB each). Thousands of clients need a pooler such as PgBouncer.'],
    ['Replication lag', 'Async replicas serve stale reads; synchronous replication adds a replica RTT to every commit.'],
    ['HOT updates', 'Heap-only tuple updates (no index writes) only happen if no indexed column changes and the page has free space — tune fillfactor for update-heavy tables.']
  ],
  useWhen: [
    'Default choice for OLTP: rich SQL, joins, constraints, extensions (PostGIS, pgvector).',
    'Data and write rate fit on one well-provisioned primary (multi-TB is fine).',
    'You want a mature ecosystem and predictable operational behaviour.'
  ],
  avoidWhen: [
    'Sustained write throughput beyond a single node.',
    'Active-active multi-region writes.',
    'Very high-churn update workloads where VACUUM cannot keep up without heavy tuning.'
  ]
};
// ============================================================================
function renderPostgresView(container) {
  container.innerHTML = `
    ${renderTopicIntro(PostgresMeta)}

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
