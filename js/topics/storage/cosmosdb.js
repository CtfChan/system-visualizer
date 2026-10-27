// ============================================================================
// AZURE COSMOS DB (/#cosmosdb)
// ARS Storage Engine, 5 Consistency Levels, RU/s & Partition Scaling
// ============================================================================

function cosmosArchitectureSvg() {
  const m = 'arrow-cosmos';
  const C = { client: '#94a3b8', server: '#06b6d4', part: '#0ea5e9', store: '#10b981', conflict: '#f59e0b' };
  return `<svg viewBox="0 0 1000 390" class="w-full h-auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cosmos DB architecture diagram">
    ${Svg.defs(m)}
    ${Svg.group(180, 20, 480, 350, 'COSMOS DB REGIONAL FABRIC (REGION A)', C.server)}
    ${Svg.group(690, 20, 290, 350, 'MULTI-REGION REPLICATION & CONFLICTS', C.conflict)}

    ${Svg.box(20, 150, 130, 60, 'Client App', 'Direct / Gateway mode', C.client)}

    ${Svg.box(205, 55, 200, 58, 'Partition Key Router', 'Hash(PK) routing map', C.server)}
    ${Svg.box(435, 55, 205, 58, 'Physical Partition 1', '4-Replica Quorum (Leader/Followers)', C.part)}
    ${Svg.box(435, 160, 205, 58, 'Physical Partition 2', 'Max 50 GB · 10k RU/s limit', C.part)}
    ${Svg.box(435, 265, 205, 58, 'ARS Storage Engine', 'Atom-Record-Sequence · SSD', C.store)}

    ${Svg.box(205, 190, 200, 65, 'RU/s Rate Limiter', 'Uniform slice per partition', C.server)}

    ${Svg.box(720, 65, 230, 60, 'Region B (Active-Active)', '4-replica partition replica set', C.server)}
    ${Svg.box(720, 160, 230, 60, '5 Consistency Filters', 'Strong · Bounded · Session', C.conflict)}
    ${Svg.box(720, 260, 230, 60, 'Conflict Resolver', 'LWW (_ts) or Merge Stored Proc', C.conflict)}

    ${Svg.arrow(m, 150, 180, 203, 90, '1 request + session token', { lx: 172, ly: 125 })}
    ${Svg.arrow(m, 405, 84, 433, 84, '2 route by hash(PK)', { lx: 418, ly: 72 })}
    ${Svg.arrow(m, 537, 113, 537, 158, 'rebalance', { lx: 543, ly: 135, anchor: 'start', dashed: true })}
    ${Svg.arrow(m, 537, 218, 537, 263, 'append log', { lx: 543, ly: 240, anchor: 'start' })}
    ${Svg.arrow(m, 640, 84, 718, 84, 'async/sync replicate', { lx: 679, ly: 72 })}
    ${Svg.arrow(m, 640, 289, 718, 289, 'conflict resolution', { lx: 679, ly: 277 })}
  </svg>`;
}

const CosmosMeta = {
  accent: 'cyan',
  category: 'Storage & Databases',
  title: 'Azure Cosmos DB',
  tags: ['Globally Distributed', '5 Consistency Levels', 'Request Units (RU/s)', 'Active-Active Multi-Write'],
  summary: 'Globally distributed, multi-model NoSQL and relational database designed for elastic scale. Backed by the <strong>Atom-Record-Sequence (ARS)</strong> log-structured storage engine and partitioned into 4-replica Paxos quorum sets. Cosmos DB is famous for its <strong>5 mathematically verified (TLA+) consistency levels</strong> (Strong, Bounded Staleness, Session, Consistent Prefix, Eventual), its <strong>Request Unit (RU/s)</strong> throughput currency, and active-active multi-region replication with automatic conflict resolution.',
  diagram: {
    title: 'High-Level Architecture: Global Fabric, ARS Partitions & Replicas',
    svg: cosmosArchitectureSvg(),
    steps: [
      'Client SDK routes requests using Direct Mode over TCP directly to the replica leader for the computed <code>hash(PK)</code>.',
      'The physical partition leader coordinates a 4-replica local Paxos write quorum (committed upon ACK from majority of local replicas).',
      'The write is committed to local ARS log-structured SSD storage and inverted indexes are updated automatically for all attributes.',
      'Background replication streams mutations to configured Azure regions across Microsoft’s global fiber backbone.',
      'Readers query against their configured Consistency Level (e.g., Session Token guarantees monotonic reads and read-your-own-writes).',
      'In multi-region active-active write configurations, concurrent updates to the same document are resolved via Last-Write-Wins (LWW via <code>_ts</code>) or custom registered conflict resolution stored procedures.'
    ]
  },
  constraints: [
    ['Logical partition size limit', '20 GB maximum per distinct Partition Key value. If an individual customer or tenant exceeds 20 GB under a single PK, writes are hard rejected! Design hierarchical partition keys (synthetic keys).'],
    ['Physical partition ceiling', 'A physical partition hosts up to 50 GB storage and a maximum of 10,000 RU/s. When storage passes 50 GB, Cosmos DB automatically splits it into two physical partitions.'],
    ['Uniform RU/s distribution pitfall', 'Provisioned throughput is divided evenly across all physical partitions. If you provision 30,000 RU/s across 6 physical partitions, each partition gets exactly 5,000 RU/s. A hot key on partition #1 throttles (HTTP 429) at 5,001 RU/s even if 25,000 RU/s are completely idle!'],
    ['Strong consistency boundaries', 'Strong consistency cannot span accounts configured across multiple distant continents; write latency is bounded by speed-of-light roundtrips. In multi-region writes, Strong Consistency is not supported.'],
    ['Item payload size', 'Maximum 2 MB per document (including attribute names and JSON nesting). Store large binaries/attachments in Azure Blob Storage.'],
    ['Read RU cost vs consistency', 'Strong and Bounded Staleness reads cost 2× RU/s compared to Session or Eventual reads because they must query a quorum of replicas.']
  ],
  useWhen: [
    'Global applications needing sub-10ms read/write latencies with turnkey multi-region replication across 60+ Azure regions.',
    'Workloads with well-understood partition keys where Session Consistency (~73% of workloads) satisfies business requirements with read-your-own-writes semantics.',
    'Multi-master active-active write setups where services in Europe and US need local write latency without blocking on transatlantic round-trips.'
  ],
  avoidWhen: [
    'Workloads with highly skewed or unpredictable access patterns where a single entity experiences massive write spikes (hot partition throttling).',
    'Complex relational data requiring multi-table joins, cross-partition foreign keys, and distributed ACID transactions across multiple partitions.',
    'Budget-constrained small projects where provisioned RU minimums across multiple regions become unnecessarily expensive.'
  ]
};

function renderCosmosDBView(container) {
  container.innerHTML = `
    ${renderTopicIntro(CosmosMeta)}

    <!-- SECTION 1: THE 5 TUNABLE CONSISTENCY LEVELS VISUALIZER -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i data-lucide="shield-check" class="w-5 h-5 text-cyan-400"></i>
            Interactive 5 Consistency Levels Explorer (TLA+ Verified)
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            Cosmos DB offers 5 distinct consistency levels. Select a consistency mode to watch real-time replica propagation across regions and inspect what readers see.
          </p>
        </div>
        <div class="flex flex-wrap gap-1.5" id="cosmos-consistency-tabs">
          <button data-level="STRONG" class="cos-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-slate-900 border-slate-800 text-slate-300">Strong</button>
          <button data-level="BOUNDED" class="cos-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-slate-900 border-slate-800 text-slate-300">Bounded Staleness</button>
          <button data-level="SESSION" class="cos-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-cyan-500/20 border-cyan-400 text-white shadow-md">Session (Default)</button>
          <button data-level="PREFIX" class="cos-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-slate-900 border-slate-800 text-slate-300">Consistent Prefix</button>
          <button data-level="EVENTUAL" class="cos-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-slate-900 border-slate-800 text-slate-300">Eventual</button>
        </div>
      </div>

      <!-- Selected Consistency Dossier Card -->
      <div id="cosmos-consistency-dossier" class="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 font-mono text-xs">
        <!-- Dynamically rendered via selectConsistencyLevel() -->
      </div>

      <!-- Live Multi-Region Propagation Visualizer -->
      <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
        <div class="flex items-center justify-between text-slate-400">
          <span>Global Replication Timeline: Writer in US-East writes Document V1 $\rightarrow$ V2 $\rightarrow$ V3</span>
          <button id="cosmos-write-pulse-btn" class="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] transition">
            + Write Version V4 (Increment)
          </button>
        </div>
        <div id="cosmos-timeline-canvas-container" class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- Dynamically populated -->
        </div>
      </div>
    </div>

    <!-- SECTION 2: REQUEST UNITS (RU/s) & THE HOT PARTITION PITFALL -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
      <div class="border-b border-slate-800 pb-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <i data-lucide="gauge" class="w-5 h-5 text-amber-400"></i>
          Request Units (RU/s) Currency &amp; The Hot Partition Throttling Pitfall
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          Simulate how total provisioned RU/s is divided equally across physical partitions. Experience how skewing write traffic to a single partition causes <strong>HTTP 429 (RequestRateTooLarge)</strong> even while the overall database is 70% idle!
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-xs font-mono">
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-slate-300">Total Provisioned RU/s:</span>
            <span id="cos-total-ru-val" class="text-cyan-300 font-bold">12,000 RU/s</span>
          </div>
          <input id="cos-total-ru-slider" type="range" min="6000" max="30000" step="3000" value="12000" class="w-full accent-cyan-500" />
          <div class="text-[10px] text-slate-400 mt-1">Cost: ~$0.08 per 100 RU/s/month</div>
        </div>

        <div>
          <div class="flex justify-between mb-1">
            <span class="text-slate-300">Physical Partitions:</span>
            <span id="cos-parts-val" class="text-amber-300 font-bold">4 Partitions</span>
          </div>
          <input id="cos-parts-slider" type="range" min="2" max="6" step="1" value="4" class="w-full accent-amber-500" />
          <div class="text-[10px] text-slate-400 mt-1">Capacity per Partition = <strong id="cos-ru-per-part" class="text-white">3,000 RU/s</strong></div>
        </div>

        <div>
          <div class="flex justify-between mb-1">
            <span class="text-slate-300">Traffic Skew to Partition #1:</span>
            <span id="cos-skew-val" class="text-rose-400 font-bold">75% (Hot Key)</span>
          </div>
          <input id="cos-skew-slider" type="range" min="25" max="95" step="5" value="75" class="w-full accent-rose-500" />
          <div class="text-[10px] text-slate-400 mt-1">Simulates bad PartitionKey (e.g. <code>type='user'</code>)</div>
        </div>
      </div>

      <!-- Live Diagnostic Status Box -->
      <div id="cosmos-throttle-alert" class="p-4 rounded-xl border space-y-1.5 font-mono text-xs"></div>

      <!-- Physical Partition RU Allocation Bars -->
      <div id="cosmos-partitions-bars" class="space-y-2 font-mono text-xs"></div>
    </div>
  `;

  rehydrateIcons();

  // 5 Consistency Levels Metadata
  const ConsistencyData = {
    STRONG: {
      name: 'Strong Consistency (Linearizable)',
      readRu: '2× RU/s (Quorum Read)',
      latency: '~25–65 ms (bounded by cross-region quorum RTT)',
      summary: 'Linearizable reads. Guarantees that reads always return the most recent committed write. Requires reading from a quorum of replicas. Not supported in multi-region active-active write accounts.',
      invariant: 'T1 committed before T2 in real time ⇒ All readers globally observe T1 before T2. Zero stale reads.',
      readerUs: 'V3 (Latest)',
      readerEu: 'V3 (Latest)',
      readerAsia: 'V3 (Latest)'
    },
    BOUNDED: {
      name: 'Bounded Staleness Consistency',
      readRu: '2× RU/s (Quorum Read)',
      latency: '~10–20 ms',
      summary: 'Reads lag behind writes by at most K versions (e.g., 100,000 updates) or T time interval (e.g., 5 seconds). Predictable staleness bound for global readers.',
      invariant: 'Reads never lag by more than K versions or T seconds behind the write region. Total order preserved within bounds.',
      readerUs: 'V3 (Latest)',
      readerEu: 'V2 (Within 5s window)',
      readerAsia: 'V2 (Within 5s window)'
    },
    SESSION: {
      name: 'Session Consistency (Default ~73% of Cosmos DB Accounts)',
      readRu: '1× RU/s (Single Replica Read)',
      latency: '&lt; 10 ms (Single digit)',
      summary: 'Scoped to a client session token. The writer client always reads its own writes (RYOW) and observes monotonic reads and writes. Other clients observe consistent prefix.',
      invariant: 'Writer process with SessionToken sees V3 immediately. Other concurrent clients in remote regions see consistent prefix (V2 or V3).',
      readerUs: 'V3 (Writer Sees Own Write via SessionToken)',
      readerEu: 'V2 (Consistent Prefix for other sessions)',
      readerAsia: 'V2 (Consistent Prefix for other sessions)'
    },
    PREFIX: {
      name: 'Consistent Prefix Consistency',
      readRu: '1× RU/s (Single Replica Read)',
      latency: '&lt; 10 ms',
      summary: 'Readers never see out-of-order writes. If a sequence of writes is A, B, C, a reader will never see B before A or C before B, but might see lag.',
      invariant: 'Updates are never read out of order. No dirty reads, no gap anomalies.',
      readerUs: 'V3',
      readerEu: 'V2 (Prefix of committed stream)',
      readerAsia: 'V1 (Prefix of committed stream)'
    },
    EVENTUAL: {
      name: 'Eventual Consistency (Weakest, Cheapest)',
      readRu: '1× RU/s (Cheapest single replica)',
      latency: '&lt; 5 ms (Lowest latency)',
      summary: 'No ordering guarantees between concurrent readers. In the absence of further writes, replicas eventually converge to the identical state.',
      invariant: 'Lowest latency and cheapest RUs, but readers in Asia might observe V2 then briefly see V1 if querying different replicas.',
      readerUs: 'V3',
      readerEu: 'V2',
      readerAsia: 'V1 (Can flip between replicas)'
    }
  };

  let activeConsistency = 'SESSION';
  let writeVersion = 3;

  function renderConsistencyDossier() {
    const d = ConsistencyData[activeConsistency];
    const dossierEl = document.getElementById('cosmos-consistency-dossier');
    if (!dossierEl) return;
    dossierEl.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <span class="text-sm font-bold text-cyan-300">${d.name}</span>
        <div class="flex gap-3 text-[11px]">
          <span class="text-slate-400">Read Cost: <strong class="text-emerald-300">${d.readRu}</strong></span>
          <span class="text-slate-400">Read Latency: <strong class="text-amber-300">${d.latency}</strong></span>
        </div>
      </div>
      <p class="text-slate-300 leading-relaxed text-xs">${d.summary}</p>
      <div class="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-cyan-200">
        <strong>Formal Guarantee:</strong> ${d.invariant}
      </div>
    `;

    const canvasCont = document.getElementById('cosmos-timeline-canvas-container');
    if (!canvasCont) return;
    canvasCont.innerHTML = `
      <div class="p-3 rounded-lg bg-slate-900 border border-cyan-500/40 space-y-1">
        <div class="flex justify-between font-bold text-cyan-300">
          <span>US-East (Primary Write)</span>
          <span class="text-[10px] text-emerald-400">ACK Confirmed</span>
        </div>
        <div class="text-slate-300">Committed: <strong>Version V${writeVersion}</strong></div>
        <div class="text-[10px] text-slate-400 mt-1">Reader Sees: <strong class="text-white">${d.readerUs}</strong></div>
      </div>

      <div class="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
        <div class="flex justify-between font-bold text-slate-300">
          <span>West Europe (Replica)</span>
          <span class="text-[10px] text-amber-400">~35ms WAN</span>
        </div>
        <div class="text-slate-300">Replicating V${writeVersion}...</div>
        <div class="text-[10px] text-slate-400 mt-1">Reader Sees: <strong class="text-white">${d.readerEu}</strong></div>
      </div>

      <div class="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
        <div class="flex justify-between font-bold text-slate-300">
          <span>East Asia (Replica)</span>
          <span class="text-[10px] text-amber-400">~120ms WAN</span>
        </div>
        <div class="text-slate-300">Replicating V${writeVersion}...</div>
        <div class="text-[10px] text-slate-400 mt-1">Reader Sees: <strong class="text-white">${d.readerAsia}</strong></div>
      </div>
    `;
  }

  document.querySelectorAll('.cos-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeConsistency = btn.getAttribute('data-level');
      document.querySelectorAll('.cos-tab-btn').forEach(b => {
        const isAct = b.getAttribute('data-level') === activeConsistency;
        b.className = isAct
          ? 'cos-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-cyan-500/20 border-cyan-400 text-white shadow-md'
          : 'cos-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700';
      });
      renderConsistencyDossier();
    });
  });

  document.getElementById('cosmos-write-pulse-btn')?.addEventListener('click', () => {
    writeVersion++;
    renderConsistencyDossier();
  });

  renderConsistencyDossier();

  // RU/s Hot Partition Simulator Logic
  function updateRUSimulator() {
    const totalRu = parseInt(document.getElementById('cos-total-ru-slider')?.value || '12000', 10);
    const numParts = parseInt(document.getElementById('cos-parts-slider')?.value || '4', 10);
    const skewPct = parseInt(document.getElementById('cos-skew-slider')?.value || '75', 10);

    const ruPerPart = Math.floor(totalRu / numParts);
    const incomingRps = 10000; // total incoming request units per second
    const part1Demand = Math.floor((incomingRps * skewPct) / 100);
    const otherDemand = Math.floor((incomingRps * (100 - skewPct)) / (100 * (numParts - 1)));

    document.getElementById('cos-total-ru-val').textContent = `${totalRu.toLocaleString()} RU/s`;
    document.getElementById('cos-parts-val').textContent = `${numParts} Physical Partitions`;
    document.getElementById('cos-ru-per-part').textContent = `${ruPerPart.toLocaleString()} RU/s`;
    document.getElementById('cos-skew-val').textContent = `${skewPct}% to Partition #1`;

    const alertEl = document.getElementById('cosmos-throttle-alert');
    const isThrottled = part1Demand > ruPerPart;

    if (alertEl) {
      if (isThrottled) {
        alertEl.className = 'p-4 rounded-xl border border-rose-500 bg-rose-950/30 text-xs font-mono space-y-1.5';
        alertEl.innerHTML = `
          <div class="font-bold text-rose-300 flex items-center gap-2">
            <span>🚨 HTTP 429: RequestRateTooLarge on Physical Partition #1!</span>
          </div>
          <p class="text-slate-200 leading-relaxed">
            Partition #1 has an allocated capacity of <strong>${ruPerPart.toLocaleString()} RU/s</strong>, but is receiving <strong>${part1Demand.toLocaleString()} RU/s</strong> of traffic! Requests fail with <code class="text-white">x-ms-retry-after-ms</code>, even though the other ${numParts - 1} partitions are running at only ${Math.round((otherDemand / ruPerPart) * 100)}% capacity!
          </p>
        `;
      } else {
        alertEl.className = 'p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/25 text-xs font-mono space-y-1.5';
        alertEl.innerHTML = `
          <div class="font-bold text-emerald-300 flex items-center gap-2">
            <span>✓ Healthy Throughput Distribution</span>
          </div>
          <p class="text-slate-300 leading-relaxed">
            Partition #1 demand (${part1Demand.toLocaleString()} RU/s) is safely within its allocated slice (${ruPerPart.toLocaleString()} RU/s). Zero 429 throttling.
          </p>
        `;
      }
    }

    const barsCont = document.getElementById('cosmos-partitions-bars');
    if (barsCont) {
      let html = '';
      for (let i = 1; i <= numParts; i++) {
        const demand = i === 1 ? part1Demand : otherDemand;
        const pct = Math.min(100, Math.round((demand / ruPerPart) * 100));
        const overflow = demand > ruPerPart;
        html += `
          <div class="p-3 rounded-lg bg-slate-950 border ${overflow ? 'border-rose-500/50' : 'border-slate-800'} space-y-1.5">
            <div class="flex justify-between items-center">
              <span class="${i === 1 ? 'text-amber-300 font-bold' : 'text-slate-300'}">
                Physical Partition #${i} ${i === 1 ? '(Hot Key Target)' : ''}
              </span>
              <span class="text-[11px] ${overflow ? 'text-rose-400 font-bold' : 'text-slate-400'}">
                ${demand.toLocaleString()} / ${ruPerPart.toLocaleString()} RU/s (${pct}%)
              </span>
            </div>
            <div class="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
              <div class="h-full rounded-full transition-all ${overflow ? 'bg-rose-500' : 'bg-cyan-500'}" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }
      barsCont.innerHTML = html;
    }
  }

  ['cos-total-ru-slider', 'cos-parts-slider', 'cos-skew-slider'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateRUSimulator);
  });
  updateRUSimulator();
}
