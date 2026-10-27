// ============================================================================
// GOOGLE CLOUD SPANNER (/#spanner)
// TrueTime API, Multi-Paxos Splits & Interleaved Tables
// ============================================================================

function spannerArchitectureSvg() {
  const m = 'arrow-spanner';
  const C = { client: '#94a3b8', server: '#38bdf8', store: '#0284c7', time: '#fbbf24', split: '#34d399' };
  return `<svg viewBox="0 0 1000 390" class="w-full h-auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Spanner architecture diagram">
    ${Svg.defs(m)}
    ${Svg.group(180, 20, 480, 350, 'SPANNER STORAGE NODE & SPLIT CLUSTER', C.server)}
    ${Svg.group(690, 20, 290, 350, 'TRUETIME & CONSENSUS FABRIC', C.time)}

    ${Svg.box(20, 150, 130, 60, 'Client App', 'gRPC · Spanner SDK', C.client)}

    ${Svg.box(205, 55, 200, 58, 'Spanner API / Gateway', 'session pool · query router', C.server)}
    ${Svg.box(435, 55, 205, 58, 'Split 1 (Paxos Leader)', 'Keys: [A..M) · Singers/Albums', C.split)}
    ${Svg.box(435, 160, 205, 58, 'Split 2 (Paxos Leader)', 'Keys: [M..Z) · Interleaved', C.split)}
    ${Svg.box(435, 265, 205, 58, 'Colossus / Persistent Disk', 'LSM SSTables · Shared Storage', C.store)}

    ${Svg.box(205, 190, 200, 65, 'Split Balancing Mgr', 'size (4GB) & CPU split engine', C.server)}

    ${Svg.box(720, 65, 230, 60, 'TrueTime API', 'GPS + Rubidium clocks · 2ε', C.time)}
    ${Svg.box(720, 160, 230, 60, 'Multi-Paxos Group', '3 or 5 cross-zone replicas', C.time)}
    ${Svg.box(720, 260, 230, 60, '2PC Coordinator', 'Cross-split atomic transactions', C.server)}

    ${Svg.arrow(m, 150, 180, 203, 90, '1 query / tx', { lx: 172, ly: 125 })}
    ${Svg.arrow(m, 405, 84, 433, 84, '2 route to split', { lx: 418, ly: 72 })}
    ${Svg.arrow(m, 537, 113, 537, 158, 'split migration', { lx: 543, ly: 135, anchor: 'start', dashed: true })}
    ${Svg.arrow(m, 537, 218, 537, 263, 'durable writes', { lx: 543, ly: 240, anchor: 'start' })}
    ${Svg.arrow(m, 640, 84, 718, 84, 'commit wait [t_e, t_l]', { lx: 679, ly: 72 })}
    ${Svg.arrow(m, 640, 189, 718, 189, 'replicate', { lx: 679, ly: 177 })}
  </svg>`;
}

const SpannerMeta = {
  accent: 'blue',
  category: 'Storage & Databases',
  title: 'Google Cloud Spanner',
  tags: ['Global SQL', 'TrueTime [t_e, t_l]', 'Range Splits', 'Interleaved Tables'],
  summary: 'Horizontally scalable distributed SQL database with external consistency (linearizability) across global regions. Spanner partitions tables by primary key ranges into <strong>Splits</strong> (~4 GB chunks), each managed by its own <strong>Multi-Paxos replication group</strong>. <strong>TrueTime</strong> enforces a deterministic <strong>commit wait (2ε)</strong> to guarantee real-time ordering without global locks, while <strong>Interleaved Tables</strong> physically co-locate child rows on the same storage pages as their parent to eliminate network hops on joins and avoid distributed 2PC.',
  diagram: {
    title: 'High-Level Spanner Architecture: Gateway, Splits & TrueTime',
    svg: spannerArchitectureSvg(),
    steps: [
      'Client issues a read-write transaction to the stateless Spanner API Gateway.',
      'The Gateway inspects the primary key and routes the transaction to the Split currently holding the target keyspace range.',
      'If tables use <code>INTERLEAVE IN PARENT</code>, parent and child rows share the same split, allowing single-split local joins with 0 network RPCs.',
      'The Split’s Paxos leader acquires locks, requests a TrueTime timestamp interval <code>[t_earliest, t_latest]</code>, and picks commit timestamp <code>s = t_latest</code>.',
      'Replication occurs in parallel across Paxos replicas. The leader enforces commit wait (waiting until <code>TT.now().earliest &gt; s</code>) before releasing locks and returning to the client.',
      'When splits grow beyond ~4 GB or experience hot CPU load, Spanner automatically splits the range and rebalances splits across nodes with zero downtime.'
    ]
  },
  constraints: [
    ['Write latency floor', 'max(Paxos quorum RTT, commit wait ≈ 2ε). In multi-region deployments, every write pays a cross-region quorum RTT (30–60 ms).'],
    ['Interleaved table hierarchy', 'Child tables must include the parent’s primary key as their primary key prefix. Cascade deletes and parent-child co-location are strictly bound to this key hierarchy.'],
    ['Cross-split 2PC penalty', 'Queries or transactions modifying multiple independent splits incur distributed Two-Phase Commit (2PC) with coordinator Paxos logging (~3× latency of a single-split write).'],
    ['Split sizing & boundaries', 'Splits default to ~4 GB. If an individual interleaved row family (parent + all children) grows beyond split capacity, Spanner must split within child keys, losing co-location benefits for those specific keys.'],
    ['Hotspotting on sequential PKs', 'Monotonically increasing keys (timestamps, auto-increment IDs) land all writes onto a single split leader, causing severe throttling. Always use UUIDv4, bit-reversed IDs, or hash prefixes.'],
    ['Commit mutation limits', 'Maximum 80,000 mutations or 100 MB per commit transaction.'],
    ['Lock-free snapshot reads', 'Reads executed at <code>t_read &lt;= TT.now().earliest - 2ε</code> read directly from any local Paxos follower without locks or 2PC.']
  ],
  useWhen: [
    'Mission-critical global financial ledgers, transactional inventory, or billing systems where data corruption or stale reads cannot be tolerated.',
    'Relational workloads with strong 1:N parent-child relationships (e.g., Accounts $\\rightarrow$ Orders $\\rightarrow$ LineItems) that benefit from 0-network-hop interleaved joins.',
    'Workloads requiring horizontal auto-sharding and automatic split balancing with zero operational failover downtime.'
  ],
  avoidWhen: [
    'Workloads that comfortably fit inside a single-region managed PostgreSQL or MySQL instance (significantly cheaper and lower write latency).',
    'Analytical / OLAP scan workloads with massive aggregations over petabytes (use BigQuery or Snowflake).',
    'Multi-cloud or on-premises requirements (TrueTime relies on Google proprietary GPS + atomic clock hardware infrastructure).'
  ]
};

function renderSpannerView(container) {
  container.innerHTML = `
    ${renderTopicIntro(SpannerMeta)}

    <!-- SECTION 1: SPLITS & INTERLEAVED TABLES DEEP-DIVE -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i data-lucide="layers" class="w-5 h-5 text-sky-400"></i>
            Physical Splits &amp; Interleaved Table Co-location Explorer
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            Compare physical on-disk storage layout, network hops, and consensus overhead between <strong>Interleaved Tables</strong> (co-located in the same Split) vs. <strong>Independent Root Tables</strong> (scattered across multiple Paxos splits).
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="spanner-interleaved-toggle-btn" class="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-semibold flex items-center gap-2 shadow-lg shadow-sky-600/20">
            <i data-lucide="git-merge" class="w-3.5 h-3.5"></i>
            <span id="spanner-interleaved-btn-label">Layout: INTERLEAVED (Co-located)</span>
          </button>
          <button id="spanner-trigger-split-btn" class="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-mono font-semibold flex items-center gap-2">
            <i data-lucide="scissors" class="w-3.5 h-3.5"></i>
            <span>Simulate Range Split (&gt;4 GB Load)</span>
          </button>
        </div>
      </div>

      <!-- DDL Schema Comparison -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold text-sky-300">INTERLEAVED Schema (Co-located)</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">0-Hop Joins · 1-Paxos Tx</span>
          </div>
          <pre class="code-block bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
CREATE TABLE Customers (
  CustomerId STRING(36), Name STRING(100)
) PRIMARY KEY (CustomerId);

CREATE TABLE Orders (
  CustomerId STRING(36), OrderId STRING(36), Total INT64
) PRIMARY KEY (CustomerId, OrderId),
  <span class="text-sky-300 font-bold">INTERLEAVE IN PARENT Customers ON DELETE CASCADE;</span>

CREATE TABLE OrderLines (
  CustomerId STRING(36), OrderId STRING(36), LineId INT64
) PRIMARY KEY (CustomerId, OrderId, LineId),
  <span class="text-sky-300 font-bold">INTERLEAVE IN PARENT Orders ON DELETE CASCADE;</span></pre>
        </div>

        <div class="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold text-slate-300">INDEPENDENT Root Tables (Traditional)</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">Network Distributed Join · 2PC Multi-Paxos</span>
          </div>
          <pre class="code-block bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-slate-400 overflow-x-auto text-[11px] leading-relaxed">
CREATE TABLE Customers (
  CustomerId STRING(36), Name STRING(100)
) PRIMARY KEY (CustomerId);

CREATE TABLE Orders (
  OrderId STRING(36), CustomerId STRING(36), Total INT64
) PRIMARY KEY (OrderId); <span class="text-slate-500">-- Independent primary key</span>

CREATE TABLE OrderLines (
  LineId STRING(36), OrderId STRING(36)
) PRIMARY KEY (LineId); <span class="text-slate-500">-- Scattered across separate splits!</span></pre>
        </div>
      </div>

      <!-- Live Split & Disk Layout Visualizer -->
      <div class="space-y-3">
        <div class="flex items-center justify-between text-xs font-mono">
          <span class="text-slate-300 font-bold flex items-center gap-1.5">
            <i data-lucide="hard-drive" class="w-4 h-4 text-sky-400"></i>
            Physical Splits &amp; On-Disk SSTable Layout
          </span>
          <span id="spanner-layout-status" class="text-emerald-300 font-semibold">Status: Interleaved in Split #1 (0-Hop Local Storage)</span>
        </div>

        <div id="spanner-splits-container" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Dynamically populated via updateSpannerLayoutUI() -->
        </div>
      </div>

      <!-- Transaction Cost Diff Box -->
      <div id="spanner-tx-cost-box" class="p-4 rounded-xl border transition-all text-xs font-mono space-y-2"></div>
    </div>

    <!-- SECTION 2: INTERACTIVE TRUETIME [t_earliest, t_latest] & COMMIT WAIT SIMULATOR -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i data-lucide="clock" class="w-5 h-5 text-blue-400"></i>
            TrueTime Interval &amp; Commit Wait (<code class="text-amber-300">2ε</code>) Simulator
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            Adjust clock uncertainty bound <code class="text-blue-300">ε (epsilon)</code> and Paxos quorum latency to observe how Spanner picks commit timestamp <code class="text-emerald-300">s ≥ t_latest</code> and enforces commit wait until <code class="text-amber-300">TT.now().earliest &gt; s</code>.
          </p>
        </div>
        <button id="spanner-tx-btn" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20">
          <i data-lucide="play" class="w-4 h-4"></i> Execute Read-Write Transaction
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-xs font-mono">
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-slate-300">Clock Uncertainty ε (Epsilon):</span>
            <span id="span-eps-val" class="text-blue-300 font-bold">3.0 ms</span>
          </div>
          <input id="span-eps-slider" type="range" min="0.5" max="7.0" step="0.5" value="3.0" class="w-full accent-blue-500" />
          <div class="text-[10px] text-slate-400 mt-1">Interval width 2ε = <span id="span-2eps-val" class="text-amber-300">6.0 ms</span></div>
        </div>
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-slate-300">Multi-Paxos Quorum RTT:</span>
            <span id="span-rtt-val" class="text-emerald-300 font-bold">4.0 ms</span>
          </div>
          <input id="span-rtt-slider" type="range" min="1.0" max="15.0" step="0.5" value="4.0" class="w-full accent-emerald-500" />
          <div class="text-[10px] text-slate-400 mt-1">Commit Wait runs in parallel with Paxos replication</div>
        </div>
        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-center">
          <div class="text-slate-400 text-[10px]">Effective Commit Latency:</div>
          <div id="span-total-lat" class="text-base font-bold text-white mt-0.5">6.0 ms (max(PaxosRTT, 2ε))</div>
          <div id="span-overlap-note" class="text-[10px] text-emerald-400">+2.0ms commit wait after Paxos Quorum ACK</div>
        </div>
      </div>

      <canvas id="spanner-truetime-canvas" class="w-full h-[230px] rounded-xl bg-slate-950 border border-slate-800 block"></canvas>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div class="font-mono font-bold text-blue-300">1. Start Rule (Assign Commit Timestamp s)</div>
          <p class="text-slate-300 leading-relaxed">
            When transaction <code class="text-white">T1</code> arrives at the Paxos Leader at <code class="text-blue-300">TT.now() = [t_earliest, t_latest]</code>, the leader assigns commit timestamp <code class="text-emerald-300">s1 = t_latest</code> (guaranteeing <code class="text-emerald-300">s1 ≥ true_absolute_time</code>).
          </p>
        </div>
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div class="font-mono font-bold text-amber-300">2. Commit Wait Rule (Wait until s &lt; t_earliest)</div>
          <p class="text-slate-300 leading-relaxed">
            Before releasing 2PL locks or acknowledging the client, the coordinator waits until <code class="text-amber-300">TT.now().earliest &gt; s1</code> (at most <code class="text-amber-300">2ε</code>). This guarantees the commit timestamp is strictly in the past everywhere on Earth!
          </p>
        </div>
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div class="font-mono font-bold text-emerald-300">3. Lock-Free Snapshot Reads Globally</div>
          <p class="text-slate-300 leading-relaxed">
            Because all committed writes obey TrueTime bounds, any read-only transaction at <code class="text-emerald-300">t_read = TT.now().latest</code> can read from any up-to-date Paxos follower replica with <strong>zero locks and zero 2PC</strong>.
          </p>
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();

  // State for Interleaved vs Independent Splits
  let isInterleaved = true;
  let isSplitTriggered = false;

  function updateSpannerLayoutUI() {
    const btnLabel = document.getElementById('spanner-interleaved-btn-label');
    const statusLabel = document.getElementById('spanner-layout-status');
    const containerEl = document.getElementById('spanner-splits-container');
    const costBox = document.getElementById('spanner-tx-cost-box');

    if (btnLabel) {
      btnLabel.textContent = isInterleaved ? 'Layout: INTERLEAVED (Co-located)' : 'Layout: INDEPENDENT (Scattered)';
    }

    if (isInterleaved) {
      if (statusLabel) {
        statusLabel.textContent = isSplitTriggered
          ? 'Split Triggered: Partitioned into Split #1A and #1B while preserving Customer tree co-location!'
          : 'Co-located in Split #1: Parent Customer + Orders + Lines stored physically contiguous';
        statusLabel.className = 'text-emerald-300 font-semibold';
      }

      if (containerEl) {
        if (!isSplitTriggered) {
          containerEl.innerHTML = `
            <div class="md:col-span-2 p-4 rounded-xl bg-slate-950 border border-sky-500/50 space-y-3">
              <div class="flex items-center justify-between">
                <span class="font-bold text-white font-mono flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Split #1 [Keys: "C#101" .. "C#102"] (3 Paxos Replicas)
                </span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300">Co-located SSTable Pages</span>
              </div>
              <div class="space-y-1.5 font-mono text-[11px]">
                <div class="p-2 rounded bg-sky-950/40 border border-sky-500/30 text-sky-200">
                  <strong>Row 1:</strong> Customers("C#101", "Acme Corp")
                </div>
                <div class="p-2 rounded bg-sky-950/20 border border-sky-500/20 text-slate-300 ml-3">
                  <strong>Row 2:</strong> Orders("C#101", "ORD#01", $1,200) <span class="text-emerald-400 text-[10px]">[Interleaved]</span>
                </div>
                <div class="p-2 rounded bg-sky-950/10 border border-slate-800 text-slate-400 ml-6">
                  <strong>Row 3:</strong> OrderLines("C#101", "ORD#01", Line#1, SKU-88)
                </div>
                <div class="p-2 rounded bg-sky-950/10 border border-slate-800 text-slate-400 ml-6">
                  <strong>Row 4:</strong> OrderLines("C#101", "ORD#01", Line#2, SKU-99)
                </div>
                <div class="p-2 rounded bg-sky-950/20 border border-sky-500/20 text-slate-300 ml-3">
                  <strong>Row 5:</strong> Orders("C#101", "ORD#02", $450) <span class="text-emerald-400 text-[10px]">[Interleaved]</span>
                </div>
              </div>
              <div class="text-[10px] text-emerald-400 font-mono">
                ✓ Query: SELECT * FROM Customers JOIN Orders JOIN OrderLines executes on Split #1 local leader with ZERO network RPCs.
              </div>
            </div>

            <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 opacity-60">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-400 font-mono">Split #2 [Keys: "C#103" .. "C#200"]</span>
                <span class="text-[10px] font-mono text-slate-500">Idle Leader</span>
              </div>
              <div class="space-y-1.5 font-mono text-[11px] text-slate-500">
                <div class="p-2 rounded bg-slate-900 border border-slate-800">Customers("C#103", "Globex Inc")</div>
                <div class="p-2 rounded bg-slate-900 border border-slate-800 ml-3">Orders("C#103", "ORD#99")</div>
              </div>
            </div>
          `;
        } else {
          containerEl.innerHTML = `
            <div class="p-4 rounded-xl bg-slate-950 border border-emerald-500/50 space-y-2 font-mono text-[11px]">
              <div class="flex items-center justify-between">
                <span class="font-bold text-emerald-300">Split #1A ["C#101"]</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">2.1 GB</span>
              </div>
              <div class="text-slate-300">Customer "C#101" + all interleaved Orders &amp; Lines preserved on Split 1A</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-950 border border-emerald-500/50 space-y-2 font-mono text-[11px]">
              <div class="flex items-center justify-between">
                <span class="font-bold text-emerald-300">Split #1B ["C#102"]</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">2.2 GB</span>
              </div>
              <div class="text-slate-300">Customer "C#102" moved to new Paxos replica set with zero query disruption!</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px] opacity-60">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-400">Split #2 ["C#103"..]</span>
                <span class="text-[10px] text-slate-500">3.8 GB</span>
              </div>
              <div class="text-slate-500">Unmodified range partition</div>
            </div>
          `;
        }
      }

      if (costBox) {
        costBox.className = 'p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-xs font-mono space-y-1.5';
        costBox.innerHTML = `
          <div class="text-emerald-300 font-bold flex items-center gap-2">
            <i data-lucide="check-circle-2" class="w-4 h-4"></i>
            TRANSACTION METRICS: Single-Split Paxos Commit (Interleaved Hierarchy)
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div>Network RPCs: <strong class="text-white">0 (Local Page Scan)</strong></div>
            <div>Paxos Quorums: <strong class="text-emerald-400">1 Quorum (Split #1)</strong></div>
            <div>2PC Coordinator: <strong class="text-emerald-400">NONE (Bypassed!)</strong></div>
            <div>Total Latency: <strong class="text-emerald-400">~4–6 ms</strong></div>
          </div>
        `;
      }
    } else {
      if (statusLabel) {
        statusLabel.textContent = 'Independent Tables: Rows scattered across multiple splits. Joins require network fetch; Tx requires 2PC!';
        statusLabel.className = 'text-amber-300 font-semibold';
      }

      if (containerEl) {
        containerEl.innerHTML = `
          <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
            <div class="flex items-center justify-between">
              <span class="font-bold text-sky-400">Split #1: Customers</span>
              <span class="text-[10px] text-slate-500">Node A</span>
            </div>
            <div class="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
              Customers("C#101", "Acme Corp")
            </div>
          </div>

          <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
            <div class="flex items-center justify-between">
              <span class="font-bold text-amber-400">Split #3: Orders</span>
              <span class="text-[10px] text-slate-500">Node B (WAN Hop)</span>
            </div>
            <div class="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
              Orders("ORD#01", "C#101", $1,200)
            </div>
          </div>

          <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
            <div class="flex items-center justify-between">
              <span class="font-bold text-rose-400">Split #5: OrderLines</span>
              <span class="text-[10px] text-slate-500">Node C (WAN Hop)</span>
            </div>
            <div class="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
              OrderLines("LINE#01", "ORD#01")
            </div>
          </div>
        `;
      }

      if (costBox) {
        costBox.className = 'p-4 rounded-xl border border-rose-500/40 bg-rose-950/20 text-xs font-mono space-y-1.5';
        costBox.innerHTML = `
          <div class="text-rose-300 font-bold flex items-center gap-2">
            <i data-lucide="alert-triangle" class="w-4 h-4"></i>
            TRANSACTION METRICS: Cross-Split Distributed Two-Phase Commit (2PC)
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div>Network RPCs: <strong class="text-rose-300">4 Distributed Hops</strong></div>
            <div>Paxos Quorums: <strong class="text-rose-300">3 Separate Paxos Groups</strong></div>
            <div>2PC Coordinator: <strong class="text-rose-300">REQUIRED (Prepare/Commit)</strong></div>
            <div>Total Latency: <strong class="text-rose-300">~35–65 ms</strong></div>
          </div>
        `;
      }
    }
    rehydrateIcons();
  }

  document.getElementById('spanner-interleaved-toggle-btn')?.addEventListener('click', () => {
    isInterleaved = !isInterleaved;
    isSplitTriggered = false;
    updateSpannerLayoutUI();
  });

  document.getElementById('spanner-trigger-split-btn')?.addEventListener('click', () => {
    isSplitTriggered = !isSplitTriggered;
    isInterleaved = true;
    updateSpannerLayoutUI();
  });

  updateSpannerLayoutUI();

  // TrueTime Canvas Simulator Logic
  let eps = 3.0;
  let rtt = 4.0;
  let pulseTime = 0;

  function updateSpannerMetrics() {
    eps = parseFloat(document.getElementById('span-eps-slider')?.value || '3.0');
    rtt = parseFloat(document.getElementById('span-rtt-slider')?.value || '4.0');
    const twoEps = eps * 2;
    const total = Math.max(rtt, twoEps);
    const residualWait = Math.max(0, twoEps - rtt);

    document.getElementById('span-eps-val').textContent = `${eps.toFixed(1)} ms`;
    document.getElementById('span-2eps-val').textContent = `${twoEps.toFixed(1)} ms`;
    document.getElementById('span-rtt-val').textContent = `${rtt.toFixed(1)} ms`;
    document.getElementById('span-total-lat').textContent = `${total.toFixed(1)} ms (max(PaxosRTT, 2ε))`;
    document.getElementById('span-overlap-note').textContent = residualWait > 0
      ? `+${residualWait.toFixed(1)}ms commit wait after Paxos Quorum`
      : `0ms extra wait! Paxos RTT (${rtt.toFixed(1)}ms) already exceeded 2ε (${twoEps.toFixed(1)}ms)`;
  }

  document.getElementById('span-eps-slider')?.addEventListener('input', updateSpannerMetrics);
  document.getElementById('span-rtt-slider')?.addEventListener('input', updateSpannerMetrics);
  document.getElementById('spanner-tx-btn')?.addEventListener('click', () => { pulseTime = 0.01; });
  updateSpannerMetrics();

  const sCanvas = document.getElementById('spanner-truetime-canvas');
  function drawSpannerCanvas() {
    if (!sCanvas || !sCanvas.isConnected) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = sCanvas.getBoundingClientRect();
    if (sCanvas.width !== Math.floor(rect.width * dpr) || sCanvas.height !== Math.floor(rect.height * dpr)) {
      sCanvas.width = Math.floor(rect.width * dpr);
      sCanvas.height = Math.floor(rect.height * dpr);
    }
    const ctx = sCanvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    pulseTime += 0.015;
    const twoEps = eps * 2;
    const xOrigin = 70;
    const scalePx = (w - 140) / 18; // 18ms timeline axis

    // Draw timeline axis
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xOrigin, h - 32);
    ctx.lineTo(w - 40, h - 32);
    ctx.stroke();

    for (let ms = 0; ms <= 18; ms += 2) {
      const x = xOrigin + ms * scalePx;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`+${ms}ms`, x - 12, h - 14);
    }

    // Track 1: Initial TrueTime Uncertainty Window [t_earliest=0, t_latest=2ε]
    const w2EpsPx = twoEps * scalePx;
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(xOrigin, 32, w2EpsPx, 42, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText(`1. TT.now() = [t_e, t_l] (Width 2ε = ${twoEps.toFixed(1)}ms) -> Pick s = t_l`, xOrigin + 10, 57);

    // Commit timestamp vertical line at s = 2ε
    const sX = xOrigin + w2EpsPx;
    ctx.strokeStyle = '#f59e0b';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sX, 20);
    ctx.lineTo(sX, h - 32);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`s_commit = +${twoEps.toFixed(1)}ms`, sX + 6, 26);

    // Track 2: Multi-Paxos Replication Bar
    const rttPx = rtt * scalePx;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(xOrigin, 90, rttPx, 36, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText(`2. Multi-Paxos Log Replication (${rtt.toFixed(1)}ms)`, xOrigin + 10, 112);

    // Track 3: Commit Wait Window until t_earliest > s_commit
    const waitEndX = xOrigin + Math.max(rtt, twoEps) * scalePx;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(xOrigin, 140, waitEndX - xOrigin, 38, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.fillText(`3. Commit Wait Complete at +${Math.max(rtt, twoEps).toFixed(1)}ms (t_earliest > s_commit Guaranteed!)`, xOrigin + 10, 163);

    ctx.restore();
    LifecycleManager.requestFrame(drawSpannerCanvas);
  }

  LifecycleManager.requestFrame(drawSpannerCanvas);
}
