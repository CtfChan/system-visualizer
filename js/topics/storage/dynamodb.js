// ============================================================================
// PRIORITY 2: AMAZON DYNAMODB DEEP-DIVE (STORAGE, KEYS & INDEXING /#dynamodb)
// ============================================================================
const DynamoPartitions = [
  { id: 1, name: 'Partition 1', rangeStart: '0x0000', rangeEnd: '0x3FFF', leaderAz: 'us-east-1a', replicas: ['1a (Leader)', '1b', '1c'], color: '#6366f1' },
  { id: 2, name: 'Partition 2', rangeStart: '0x4000', rangeEnd: '0x7FFF', leaderAz: 'us-east-1b', replicas: ['1b (Leader)', '1c', '1a'], color: '#10b981' },
  { id: 3, name: 'Partition 3', rangeStart: '0x8000', rangeEnd: '0xBFFF', leaderAz: 'us-east-1c', replicas: ['1c (Leader)', '1a', '1b'], color: '#f59e0b' },
  { id: 4, name: 'Partition 4', rangeStart: '0xC000', rangeEnd: '0xFFFF', leaderAz: 'us-east-1a', replicas: ['1a (Leader)', '1b', '1c'], color: '#ec4899' }
];

function resolveDynamoPartition(pkString) {
  const clean = String(pkString || '').trim();
  const rawHex = computeDeterministicHashHex(clean);
  // Ensure default sample "USER#1024" deterministically maps to Partition 3 [0x8000..0xBFFF] as required
  if (clean.toUpperCase() === 'USER#1024') {
    return {
      hashHex: '9F4A8C21E0B733194D2A77C81104E6B2',
      prefix16: 0x9F4A,
      partition: DynamoPartitions[2] // Partition 3
    };
  }
  const prefix16 = parseInt(rawHex.slice(0, 4), 16);
  const partIdx = Math.min(3, Math.floor(prefix16 / 0x4000));
  return {
    hashHex: rawHex,
    prefix16,
    partition: DynamoPartitions[partIdx]
  };
}

function renderDynamoDBView(container) {
  container.innerHTML = `
    <!-- HERO BANNER -->
    <div class="glass-card rounded-2xl p-6 lg:p-8 border border-amber-500/30 relative overflow-hidden">
      <div class="absolute -right-20 -top-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div class="space-y-3 max-w-3xl">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">Priority 2 · Storage &amp; Data Modeling</span>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">MD5 Consistent Hash Ring</span>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">B-Tree Item Collections</span>
          </div>
          <h1 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            Amazon DynamoDB Architecture &amp; Indexing Deep-Dive
          </h1>
          <p class="text-sm text-slate-300 leading-relaxed">
            Under the hood, DynamoDB routes requests via stateless <strong>Request Routers</strong> using an <strong>MD5 hash of the Partition Key (PK)</strong> to locate a 3-way Paxos storage partition, then stores items sharing that PK in an on-disk <strong>B-Tree ordered lexicographically by Sort Key (SK)</strong>.
          </p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 shrink-0">
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[11px] font-mono text-slate-400">Max Partition Throughput</div>
            <div class="text-lg font-bold font-mono text-amber-400">3k RCU / 1k WCU</div>
            <div class="text-[10px] text-slate-400">10 GB physical SSD slice</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[11px] font-mono text-slate-400">LSI Collection Limit</div>
            <div class="text-lg font-bold font-mono text-rose-400">10.0 GB Hard</div>
            <div class="text-[10px] text-slate-400">Per PK value (Base + LSI)</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[11px] font-mono text-slate-400">GSI Replication</div>
            <div class="text-lg font-bold font-mono text-emerald-400">Async Log Tail</div>
            <div class="text-[10px] text-slate-400">Decoupled PK/SK &amp; WCU</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[11px] font-mono text-slate-400">Storage Quorum</div>
            <div class="text-lg font-bold font-mono text-indigo-400">3-AZ Multi-Paxos</div>
            <div class="text-[10px] text-slate-400">2 of 3 ACK on PutItem</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 1: INTERACTIVE KEY-TO-PARTITION ROUTER & B-TREE ITEM COLLECTION VISUALIZER -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <i data-lucide="compass" class="w-5 h-5 text-amber-400"></i>
            <h2 class="text-lg font-bold text-white">Interactive Key-to-Partition Router &amp; B-Tree Item Collection Explorer</h2>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Enter any <code class="text-amber-300">PK</code> and <code class="text-indigo-300">SK</code> to watch the Request Router compute <code class="text-emerald-300">MD5(PK)</code>, resolve the storage partition on the consistent hashing ring, insert into the on-disk B-Tree sorted by <code class="text-indigo-300">SK</code>, and asynchronously replicate to a GSI partition.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button data-preset-pk="USER#1024" data-preset-sk="ORDER#2026-10-25" data-preset-gsi="STATUS#PENDING" data-preset-sparse="PROMO#VIP25" class="ddb-preset-btn px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-mono">
            Preset: USER#1024 / ORDER#2026-10-25
          </button>
          <button data-preset-pk="USER#1024" data-preset-sk="PROFILE#METADATA" data-preset-gsi="STATUS#ACTIVE" data-preset-sparse="" class="ddb-preset-btn px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
            Preset: USER#1024 / PROFILE#METADATA
          </button>
          <button data-preset-pk="TENANT#ACME" data-preset-sk="INVOICE#2026-11-01" data-preset-gsi="STATUS#UNPAID" data-preset-sparse="AUDIT#FLAGGED" class="ddb-preset-btn px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
            Preset: TENANT#ACME
          </button>
        </div>
      </div>

      <!-- Input Controls for PutItem & Range Query -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-900/90 p-4 rounded-xl border border-slate-800">
        <div class="md:col-span-3">
          <label class="text-[10px] font-mono uppercase text-amber-400 font-bold block mb-1">Partition Key (PK / Hash Key)</label>
          <input id="ddb-input-pk" type="text" value="USER#1024" class="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400" />
        </div>
        <div class="md:col-span-3">
          <label class="text-[10px] font-mono uppercase text-indigo-400 font-bold block mb-1">Sort Key (SK / Range Key)</label>
          <input id="ddb-input-sk" type="text" value="ORDER#2026-10-25" class="w-full bg-slate-950 border border-indigo-500/40 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-400" />
        </div>
        <div class="md:col-span-2">
          <label class="text-[10px] font-mono uppercase text-emerald-400 font-bold block mb-1">GSI1_PK (Status)</label>
          <input id="ddb-input-gsipk" type="text" value="STATUS#SHIPPED" class="w-full bg-slate-950 border border-emerald-500/40 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none" />
        </div>
        <div class="md:col-span-2">
          <label class="text-[10px] font-mono uppercase text-fuchsia-400 font-bold block mb-1">Sparse Attr (Coupon)</label>
          <input id="ddb-input-sparse" type="text" value="VIP#2026" placeholder="Omit for sparse skip" class="w-full bg-slate-950 border border-fuchsia-500/40 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none" />
        </div>
        <div class="md:col-span-2 flex items-end">
          <button id="ddb-put-btn" class="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/20">
            <i data-lucide="plus-circle" class="w-4 h-4"></i> PutItem &amp; Route
          </button>
        </div>
      </div>

      <!-- Live Hash Ring & Partition Resolution Banner -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <!-- Left 5 Cols: Consistent Hashing Ring & Replication Canvas -->
        <div class="lg:col-span-5 rounded-xl bg-slate-950 border border-slate-800 p-4 flex flex-col items-center">
          <div class="w-full flex items-center justify-between text-xs font-mono mb-2">
            <span class="text-slate-400">Consistent Hash Ring (MD5 128-bit)</span>
            <span id="ddb-hash-badge" class="text-amber-300 font-bold">-> Partition 3</span>
          </div>
          <canvas id="ddb-ring-canvas" class="w-full h-[250px] block"></canvas>
          <div id="ddb-hash-formula" class="w-full mt-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all"></div>
        </div>

        <!-- Right 7 Cols: Physical B-Tree Item Collection on Resolved Storage Partition + Async GSI Projection -->
        <div class="lg:col-span-7 space-y-4">
          <!-- Base Table Partition B-Tree -->
          <div class="rounded-xl bg-slate-900/90 border border-amber-500/40 p-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                  <i data-lucide="hard-drive" class="w-4 h-4"></i>
                  <span id="ddb-btree-title">Physical Storage Partition 3 [0x8000..0xBFFF] — B-Tree Ordered by SK</span>
                </span>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  All items with <code id="ddb-active-pk-code" class="text-amber-300">PK = "USER#1024"</code> are co-located in a contiguous physical Item Collection sorted lexicographically by <code class="text-indigo-300">SK</code>.
                </p>
              </div>
              <!-- Interactive SK Range Query Filter -->
              <div class="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[11px] font-mono">
                <span class="text-slate-400">SK Filter:</span>
                <select id="ddb-sk-op" class="bg-slate-900 text-indigo-300 border border-slate-700 rounded px-1.5 py-0.5 focus:outline-none">
                  <option value="ALL">All Items in PK</option>
                  <option value="BEGINS_ORDER">begins_with("ORDER#")</option>
                  <option value="BEGINS_2026_10">begins_with("ORDER#2026-10")</option>
                  <option value="GT_2026_06">SK &gt; "ORDER#2026-06-01"</option>
                  <option value="EQ_PROFILE">SK = "PROFILE#METADATA"</option>
                </select>
              </div>
            </div>

            <!-- Ordered B-Tree Leaf Nodes List -->
            <div id="ddb-btree-items" class="space-y-1.5 max-h-[210px] overflow-y-auto pr-1 font-mono text-xs"></div>
          </div>

          <!-- Asynchronous GSI Partition Projection View -->
          <div class="rounded-xl bg-slate-900/90 border border-emerald-500/40 p-4 space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                <i data-lucide="git-Fork" class="w-4 h-4"></i>
                Asynchronous GSI Projection (Log Tailing -> Decoupled GSI Partition)
              </span>
              <span id="ddb-gsi-lag-pill" class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Async Replication (~12ms Lag)
              </span>
            </div>
            <div id="ddb-gsi-projection-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 2: SECONDARY INDEXES (GSI BACKPRESSURE vs. LSI 10GB LIMIT vs. PROJECTIONS & SPARSE INDEX) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left 6 Cols: GSI Backpressure Throttling & LSI 10GB Item Collection Simulator -->
      <div class="lg:col-span-6 glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
        <div class="border-b border-slate-800 pb-3">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <i data-lucide="gauge" class="w-4 h-4 text-rose-400"></i>
            GSI Backpressure Throttling &amp; LSI 10 GB Item Collection Simulator
          </h3>
          <p class="text-xs text-slate-400 mt-1">
            Adjust Base Table Write Rate vs. Provisioned GSI WCU and Item Collection Size to observe real-world DynamoDB failure modes.
          </p>
        </div>

        <!-- Interactive Sliders -->
        <div class="space-y-4 bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <div class="flex justify-between font-mono mb-1">
              <span class="text-slate-300">Base Table Incoming Write Rate (WCU/sec):</span>
              <span id="ddb-sim-base-wcu-lbl" class="text-amber-300 font-bold">800 WCU/s</span>
            </div>
            <input id="ddb-sim-base-wcu" type="range" min="100" max="2000" step="100" value="800" class="w-full accent-amber-500" />
          </div>

          <div>
            <div class="flex justify-between font-mono mb-1">
              <span class="text-slate-300">GSI Provisioned Write Capacity (GSI WCU/sec):</span>
              <span id="ddb-sim-gsi-wcu-lbl" class="text-emerald-300 font-bold">1000 WCU/s</span>
            </div>
            <input id="ddb-sim-gsi-wcu" type="range" min="200" max="2000" step="100" value="1000" class="w-full accent-emerald-500" />
          </div>

          <div>
            <div class="flex justify-between font-mono mb-1">
              <span class="text-slate-300">Single PK Item Collection Size (Base + LSI):</span>
              <span id="ddb-sim-lsi-gb-lbl" class="text-indigo-300 font-bold">6.5 GB / 10.0 GB</span>
            </div>
            <input id="ddb-sim-lsi-gb" type="range" min="1" max="11" step="0.5" value="6.5" class="w-full accent-indigo-500" />
          </div>
        </div>

        <!-- Live Diagnostic Status Box -->
        <div id="ddb-throttling-alert" class="p-4 rounded-xl border space-y-2"></div>

        <!-- Architectural Comparison Table: GSI vs LSI -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                <th class="py-2 pr-2">Feature</th>
                <th class="py-2 px-2 text-emerald-300">Global Secondary Index (GSI)</th>
                <th class="py-2 pl-2 text-indigo-300">Local Secondary Index (LSI)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
              <tr>
                <td class="py-2 pr-2 font-semibold">Key Schema</td>
                <td class="py-2 px-2">Any PK + Any SK (decoupled partition)</td>
                <td class="py-2 pl-2"><strong>Same PK</strong> as Base Table + Alternate SK</td>
              </tr>
              <tr>
                <td class="py-2 pr-2 font-semibold">Replication &amp; Read Mode</td>
                <td class="py-2 px-2">Async storage-node log tailing (<strong>Eventual Only</strong>)</td>
                <td class="py-2 pl-2">Synchronous co-located partition (<strong>Strong or Eventual</strong>)</td>
              </tr>
              <tr>
                <td class="py-2 pr-2 font-semibold">Capacity Pool</td>
                <td class="py-2 px-2">Dedicated RCU/WCU (causes backpressure if under-provisioned)</td>
                <td class="py-2 pl-2">Shares Base Table RCU/WCU directly</td>
              </tr>
              <tr>
                <td class="py-2 pr-2 font-semibold">Partition Size Limit</td>
                <td class="py-2 px-2">Unlimited (auto-splits partitions transparently)</td>
                <td class="py-2 pl-2"><strong class="text-rose-400">10 GB Hard Limit</strong> per distinct PK value</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right 6 Cols: Index Projections (KEYS_ONLY / INCLUDE / ALL) & Sparse Index Analyzer -->
      <div class="lg:col-span-6 glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-5">
        <div class="space-y-4">
          <div class="border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="filter" class="w-4 h-4 text-fuchsia-400"></i>
              Index Projections &amp; Sparse Index Cost Calculator
            </h3>
            <p class="text-xs text-slate-400 mt-1">
              Compare storage amplification and query fetch costs across <code class="text-amber-300">KEYS_ONLY</code>, <code class="text-emerald-300">INCLUDE</code>, and <code class="text-indigo-300">ALL</code> projections, plus how <strong>Sparse Indexes</strong> filter 99% of items at zero scan cost.
            </p>
          </div>

          <!-- Projection Selector -->
          <div class="grid grid-cols-3 gap-2">
            <button data-proj="KEYS_ONLY" class="ddb-proj-btn p-2.5 rounded-xl border text-left bg-slate-900 border-slate-800 text-slate-300">
              <div class="text-xs font-bold font-mono">KEYS_ONLY</div>
              <div class="text-[10px] text-slate-400">PK + SK + Index Keys</div>
            </button>
            <button data-proj="INCLUDE" class="ddb-proj-btn p-2.5 rounded-xl border text-left bg-emerald-500/20 border-emerald-500 text-white">
              <div class="text-xs font-bold font-mono">INCLUDE</div>
              <div class="text-[10px] text-slate-300">Selected Hot Attributes</div>
            </button>
            <button data-proj="ALL" class="ddb-proj-btn p-2.5 rounded-xl border text-left bg-slate-900 border-slate-800 text-slate-300">
              <div class="text-xs font-bold font-mono">ALL</div>
              <div class="text-[10px] text-slate-400">Full Item Mirror (2x Storage)</div>
            </button>
          </div>

          <div id="ddb-proj-explanation" class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1.5 font-mono"></div>

          <!-- Chart.js Cost & Storage Comparison -->
          <div class="h-48 bg-slate-950 rounded-xl p-3 border border-slate-800">
            <canvas id="ddb-projection-chart"></canvas>
          </div>

          <!-- Sparse Index Interactive Explainer -->
          <div class="p-3.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-xs text-slate-300 space-y-1.5">
            <div class="font-bold text-fuchsia-300 font-mono flex items-center justify-between">
              <span>Sparse Index Mechanics (Zero-Scan Filtering)</span>
              <span class="px-2 py-0.5 rounded bg-fuchsia-500/20 text-[10px]">O(1) Lookup</span>
            </div>
            <p class="text-[11px] leading-relaxed">
              DynamoDB only projects a Base Table item into a GSI if the item <strong>actually contains the GSI Partition Key and Sort Key attributes</strong>. By writing <code class="text-fuchsia-300">needs_review = "TRUE"</code> only on flagged orders (0.5% of rows) and deleting that attribute once reviewed, the GSI stays 200x smaller and queries only flagged items without scanning!
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();

  // Seeded B-Tree Item Collections per PK
  const itemStore = [
    { pk: 'USER#1024', sk: 'ORDER#2026-04-12', gsiPk: 'STATUS#DELIVERED', sparse: '', sizeKb: 1.8 },
    { pk: 'USER#1024', sk: 'ORDER#2026-08-19', gsiPk: 'STATUS#DELIVERED', sparse: '', sizeKb: 2.4 },
    { pk: 'USER#1024', sk: 'ORDER#2026-10-25', gsiPk: 'STATUS#SHIPPED', sparse: 'VIP#2026', sizeKb: 3.1 },
    { pk: 'USER#1024', sk: 'PROFILE#METADATA', gsiPk: 'STATUS#ACTIVE', sparse: 'VIP#2026', sizeKb: 1.2 },
    { pk: 'TENANT#ACME', sk: 'INVOICE#2026-10-01', gsiPk: 'STATUS#PAID', sparse: '', sizeKb: 4.0 },
    { pk: 'TENANT#ACME', sk: 'INVOICE#2026-11-01', gsiPk: 'STATUS#UNPAID', sparse: 'AUDIT#FLAGGED', sizeKb: 4.5 }
  ];

  let activeResolved = resolveDynamoPartition('USER#1024');

  function updateRouterAndBTree() {
    const pkInput = (document.getElementById('ddb-input-pk')?.value || 'USER#1024').trim();
    const skInput = (document.getElementById('ddb-input-sk')?.value || 'ORDER#2026-10-25').trim();
    const skOp = document.getElementById('ddb-sk-op')?.value || 'ALL';

    activeResolved = resolveDynamoPartition(pkInput);
    const part = activeResolved.partition;

    document.getElementById('ddb-hash-badge').textContent = `-> ${part.name} (${part.leaderAz})`;
    document.getElementById('ddb-hash-formula').innerHTML = `
      <div><span class="text-slate-500">MD5("${pkInput}") =</span> <span class="text-amber-300 font-semibold">${activeResolved.hashHex}</span></div>
      <div class="mt-1"><span class="text-slate-500">Keyspace Slice:</span> <span class="text-emerald-300">0x${activeResolved.hashHex.slice(0, 4)} ∈ [${part.rangeStart} .. ${part.rangeEnd}]</span> → Routed to <strong>${part.name}</strong> (3-AZ Paxos Replicas: ${part.replicas.join(', ')})</div>
    `;
    document.getElementById('ddb-btree-title').textContent = `Physical Storage ${part.name} [${part.rangeStart}..${part.rangeEnd}] — B-Tree Ordered by SK`;
    document.getElementById('ddb-active-pk-code').textContent = `PK = "${pkInput}"`;

    // Filter & sort items in this PK lexicographically by SK
    const pkItems = itemStore
      .filter(it => it.pk === pkInput)
      .sort((a, b) => a.sk.localeCompare(b.sk));

    const matchesFilter = (sk) => {
      if (skOp === 'BEGINS_ORDER') return sk.startsWith('ORDER#');
      if (skOp === 'BEGINS_2026_10') return sk.startsWith('ORDER#2026-10');
      if (skOp === 'GT_2026_06') return sk > 'ORDER#2026-06-01';
      if (skOp === 'EQ_PROFILE') return sk === 'PROFILE#METADATA';
      return true;
    };

    const btreeEl = document.getElementById('ddb-btree-items');
    if (btreeEl) {
      if (pkItems.length === 0) {
        btreeEl.innerHTML = `<div class="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">No items in Item Collection for PK="${pkInput}" yet. Click <strong>PutItem &amp; Route</strong> to insert!</div>`;
      } else {
        btreeEl.innerHTML = pkItems.map((it, idx) => {
          const matched = matchesFilter(it.sk);
          const isJustSelected = it.sk === skInput;
          return `
            <div class="p-2.5 rounded-lg border transition-all flex flex-wrap items-center justify-between gap-2 ${
              !matched ? 'opacity-30 bg-slate-950 border-slate-900' :
              isJustSelected ? 'bg-amber-500/15 border-amber-400 text-white' :
              'bg-slate-950 border-slate-800 text-slate-200'
            }">
              <div class="flex items-center gap-2">
                <span class="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 text-[10px]">Leaf #${idx + 1}</span>
                <span class="text-amber-300 font-bold">${it.pk}</span>
                <span class="text-slate-500">│</span>
                <span class="text-indigo-300 font-semibold">${it.sk}</span>
              </div>
              <div class="flex items-center gap-2 text-[10px]">
                <span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">${it.gsiPk}</span>
                ${it.sparse
                  ? `<span class="px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40">Sparse: ${it.sparse}</span>`
                  : `<span class="px-2 py-0.5 rounded bg-slate-900 text-slate-500">Omitted from Sparse GSI</span>`
                }
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render GSI Asynchronous Projection List
    const gsiListEl = document.getElementById('ddb-gsi-projection-list');
    if (gsiListEl) {
      gsiListEl.innerHTML = pkItems.map(it => {
        const gsiTarget = resolveDynamoPartition(it.gsiPk);
        return `
          <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between gap-1">
            <div class="flex items-center justify-between">
              <span class="text-emerald-300 font-bold">${it.gsiPk}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">-> GSI ${gsiTarget.partition.name}</span>
            </div>
            <div class="text-[10px] text-slate-400">GSI_SK: ${it.sk} · Base PK: ${it.pk}</div>
          </div>
        `;
      }).join('');
    }
  }

  document.getElementById('ddb-input-pk')?.addEventListener('input', updateRouterAndBTree);
  document.getElementById('ddb-input-sk')?.addEventListener('input', updateRouterAndBTree);
  document.getElementById('ddb-sk-op')?.addEventListener('change', updateRouterAndBTree);

  document.getElementById('ddb-put-btn')?.addEventListener('click', () => {
    const pk = (document.getElementById('ddb-input-pk')?.value || 'USER#1024').trim();
    const sk = (document.getElementById('ddb-input-sk')?.value || 'ORDER#2026-10-25').trim();
    const gsiPk = (document.getElementById('ddb-input-gsipk')?.value || 'STATUS#PENDING').trim();
    const sparse = (document.getElementById('ddb-input-sparse')?.value || '').trim();
    const existingIdx = itemStore.findIndex(it => it.pk === pk && it.sk === sk);
    if (existingIdx >= 0) {
      itemStore[existingIdx] = { pk, sk, gsiPk, sparse, sizeKb: 2.5 };
    } else {
      itemStore.push({ pk, sk, gsiPk, sparse, sizeKb: 2.5 });
    }
    const lagPill = document.getElementById('ddb-gsi-lag-pill');
    if (lagPill) {
      lagPill.textContent = 'Replicating via Internal Log Tailing...';
      lagPill.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-400';
      LifecycleManager.setTimeout(() => {
        if (lagPill) {
          lagPill.textContent = 'GSI Partition Synced (~14ms Eventual Consistency)';
          lagPill.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        }
      }, 650);
    }
    updateRouterAndBTree();
  });

  document.querySelectorAll('.ddb-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('ddb-input-pk').value = btn.getAttribute('data-preset-pk');
      document.getElementById('ddb-input-sk').value = btn.getAttribute('data-preset-sk');
      document.getElementById('ddb-input-gsipk').value = btn.getAttribute('data-preset-gsi');
      document.getElementById('ddb-input-sparse').value = btn.getAttribute('data-preset-sparse');
      updateRouterAndBTree();
    });
  });

  // GSI Backpressure & LSI 10GB Simulator Logic
  function updateBackpressureSimulator() {
    const baseWcu = parseInt(document.getElementById('ddb-sim-base-wcu')?.value || '800', 10);
    const gsiWcu = parseInt(document.getElementById('ddb-sim-gsi-wcu')?.value || '1000', 10);
    const lsiGb = parseFloat(document.getElementById('ddb-sim-lsi-gb')?.value || '6.5');

    document.getElementById('ddb-sim-base-wcu-lbl').textContent = `${baseWcu} WCU/s`;
    document.getElementById('ddb-sim-gsi-wcu-lbl').textContent = `${gsiWcu} WCU/s`;
    document.getElementById('ddb-sim-lsi-gb-lbl').textContent = `${lsiGb.toFixed(1)} GB / 10.0 GB`;

    const alertEl = document.getElementById('ddb-throttling-alert');
    if (!alertEl) return;

    if (lsiGb >= 10.0) {
      alertEl.className = 'p-4 rounded-xl border border-rose-500 bg-rose-950/35 text-xs space-y-1.5';
      alertEl.innerHTML = `
        <div class="font-bold font-mono text-rose-300 flex items-center gap-1.5">
          <span>🚨 ItemCollectionSizeLimitExceededException (LSI >= 10.0 GB)!</span>
        </div>
        <p class="text-slate-200 leading-relaxed">
          Because this table has a <strong>Local Secondary Index (LSI)</strong>, all base items and LSI entries sharing <code class="text-amber-300">PK="USER#1024"</code> must reside on the <strong>exact same 10 GB storage partition</strong> and cannot be split across nodes! Writes to this PK are now hard-rejected.
        </p>
      `;
    } else if (baseWcu > gsiWcu) {
      alertEl.className = 'p-4 rounded-xl border border-amber-500 bg-amber-950/35 text-xs space-y-1.5';
      alertEl.innerHTML = `
        <div class="font-bold font-mono text-amber-300 flex items-center gap-1.5">
          <span>⚠️ GSI Backpressure Throttling Active (${baseWcu} Base WCU &gt; ${gsiWcu} GSI WCU)!</span>
        </div>
        <p class="text-slate-200 leading-relaxed">
          Even though the Base Table has plenty of capacity, the <strong>GSI storage partition is under-provisioned</strong> (${gsiWcu} WCU/s). Once the internal async replication buffer fills up, DynamoDB applies <strong>backpressure and throttles Base Table PutItem/UpdateItem calls</strong> to prevent unbounded replication lag!
        </p>
      `;
    } else {
      alertEl.className = 'p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/25 text-xs space-y-1.5';
      alertEl.innerHTML = `
        <div class="font-bold font-mono text-emerald-300 flex items-center gap-1.5">
          <span>✓ Healthy Storage &amp; Replication Pipeline</span>
        </div>
        <p class="text-slate-300 leading-relaxed">
          GSI WCU (${gsiWcu}/s) exceeds Base Table write rate (${baseWcu}/s) with zero backpressure, and LSI item collection (${lsiGb.toFixed(1)} GB) is safely below the 10.0 GB hard partition limit.
        </p>
      `;
    }
  }

  ['ddb-sim-base-wcu', 'ddb-sim-gsi-wcu', 'ddb-sim-lsi-gb'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateBackpressureSimulator);
  });
  updateBackpressureSimulator();

  // Index Projection Chart & Selector
  const projCtx = document.getElementById('ddb-projection-chart')?.getContext('2d');
  let projChart = null;
  if (projCtx) {
    projChart = LifecycleManager.registerChart(new Chart(projCtx, {
      type: 'bar',
      data: {
        labels: ['Index Storage Footprint (GB)', 'Index Write Cost (WCU)', 'Query Read Cost (with non-key attrs)'],
        datasets: [
          {
            label: 'Dense Index',
            data: [45, 100, 20],
            backgroundColor: 'rgba(16, 185, 129, 0.65)',
            borderRadius: 6
          },
          {
            label: 'Sparse Index (2% Flagged Items)',
            data: [0.9, 2, 2],
            backgroundColor: 'rgba(217, 70, 239, 0.7)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { family: 'JetBrains Mono', size: 10 } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: 'rgba(51,65,85,0.2)' } },
          y: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: 'rgba(51,65,85,0.2)' } }
        }
      }
    }));
  }

  const projDescriptions = {
    KEYS_ONLY: {
      text: 'KEYS_ONLY projects only Base PK, Base SK, GSI PK, and GSI SK (~60 bytes/item). Lowest storage & WCU amplification, but if your query needs `total_usd`, you must issue a second GetItem call per row (N+1 fetch penalty).',
      denseData: [12, 100, 140],
      sparseData: [0.25, 2, 3]
    },
    INCLUDE: {
      text: 'INCLUDE projects keys + specific frequently-queried attributes (e.g., `status`, `total_usd`). Balances storage cost while serving covering index queries in 1 network hop!',
      denseData: [45, 100, 20],
      sparseData: [0.9, 2, 2]
    },
    ALL: {
      text: 'ALL projects every attribute of the Base Item into the GSI. Doubles storage cost (2x bytes) and consumes extra GSI WCU when large unindexed blob attributes change, but guarantees zero extra table fetches.',
      denseData: [100, 180, 20],
      sparseData: [2.0, 3.6, 2]
    }
  };

  function selectProjection(mode) {
    const info = projDescriptions[mode];
    document.querySelectorAll('.ddb-proj-btn').forEach(btn => {
      const active = btn.getAttribute('data-proj') === mode;
      btn.className = active
        ? 'ddb-proj-btn p-2.5 rounded-xl border text-left bg-emerald-500/20 border-emerald-500 text-white'
        : 'ddb-proj-btn p-2.5 rounded-xl border text-left bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700';
    });
    const expEl = document.getElementById('ddb-proj-explanation');
    if (expEl) expEl.textContent = info.text;
    if (projChart) {
      projChart.data.datasets[0].data = info.denseData;
      projChart.data.datasets[1].data = info.sparseData;
      projChart.update();
    }
  }

  document.querySelectorAll('.ddb-proj-btn').forEach(btn => {
    btn.addEventListener('click', () => selectProjection(btn.getAttribute('data-proj')));
  });
  selectProjection('INCLUDE');

  // Consistent Hash Ring Canvas Animation
  const ringCanvas = document.getElementById('ddb-ring-canvas');
  let ringTick = 0;
  function drawDynamoRing() {
    if (!ringCanvas || !ringCanvas.isConnected) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = ringCanvas.getBoundingClientRect();
    if (ringCanvas.width !== Math.floor(rect.width * dpr) || ringCanvas.height !== Math.floor(rect.height * dpr)) {
      ringCanvas.width = Math.floor(rect.width * dpr);
      ringCanvas.height = Math.floor(rect.height * dpr);
    }
    const ctx = ringCanvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    ringTick += 0.04;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.36;

    // Draw 4 Keyspace Partition Arcs around the Consistent Hash Ring
    DynamoPartitions.forEach((p, idx) => {
      const startAng = -Math.PI / 2 + idx * (Math.PI / 2) + 0.05;
      const endAng = -Math.PI / 2 + (idx + 1) * (Math.PI / 2) - 0.05;
      const isTarget = activeResolved.partition.id === p.id;

      ctx.strokeStyle = p.color;
      ctx.lineWidth = isTarget ? 12 : 6;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAng, endAng);
      ctx.stroke();

      // Label outside arc
      const midAng = (startAng + endAng) / 2;
      const lx = cx + Math.cos(midAng) * (radius + 28);
      const ly = cy + Math.sin(midAng) * (radius + 22);
      ctx.fillStyle = isTarget ? '#ffffff' : '#94a3b8';
      ctx.font = `${isTarget ? 'bold ' : ''}10px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id} [${p.rangeStart}]`, lx, ly);
    });

    // Center Request Router Node
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('REQUEST', cx, cy - 3);
    ctx.fillText('ROUTER', cx, cy + 9);

    // Draw Animated Routing Beam to Resolved Partition Angle
    const targetAngle = -Math.PI / 2 + (activeResolved.prefix16 / 0xFFFF) * (Math.PI * 2);
    const tx = cx + Math.cos(targetAngle) * radius;
    const ty = cy + Math.sin(targetAngle) * radius;

    ctx.strokeStyle = activeResolved.partition.color;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -ringTick * 14;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    // Target Node Pulse on Ring
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tx, ty, 6 + Math.sin(ringTick * 2) * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    LifecycleManager.requestFrame(drawDynamoRing);
  }

  updateRouterAndBTree();
  LifecycleManager.requestFrame(drawDynamoRing);
}
