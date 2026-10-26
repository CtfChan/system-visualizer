// ============================================================================
// PRIORITY 1.3: COMPARATIVE VISUALIZER: TEMPORAL vs. RESTATE (/#compare-durable)
// ============================================================================
const CompareScenarios = {
  rpc: {
    name: '1. Low-Latency Synchronous Durable RPC (<25ms)',
    temporalSummary: 'Client -> Frontend -> History Shard (DB Write) -> Transfer Queue -> Matching Service -> Worker Poll Return -> Worker Executes -> RespondCompleted. Optimized via Sync-Match, typically 4–8 internal hops (~15-35ms).',
    restateSummary: 'Client -> Restate Ingress -> Local Bifrost Raft Append -> Direct HTTP/2 Push to Handler -> Stream Response back to Client. Single-hop push pipeline (~2-6ms).',
    temporalHops: ['Client gRPC', 'Frontend Svc', 'History Shard DB', 'Matching SyncMatch', 'Worker Poller', 'History Commit'],
    restateHops: ['Client HTTP/2', 'Restate Bifrost Log', 'HTTP/2 Push Handler', 'Stream Output']
  },
  serverless: {
    name: '2. 30-Day Durable Sleep / Human Approval on Serverless (AWS Lambda)',
    temporalSummary: 'Temporal Workers require persistent outbound long-polling gRPC processes (EC2/ECS/K8s Pods) watching Task Queues 24/7. Serverless Lambda cannot natively long-poll without an external poller fleet.',
    restateSummary: 'Restate natively invokes AWS Lambda via HTTPS Push. On await ctx.sleep(30d), Lambda returns SuspensionMessage in 12ms and scales to 0 instances ($0 idle cost). Restate wakes Lambda up 30 days later.',
    temporalHops: ['Timer Queue DB', 'Matching Task Queue', 'Requires 24/7 Long-Polling Worker Fleet', 'Sticky/Replay Execution'],
    restateHops: ['RocksDB Timer Wheel', '0 Running Workers during Sleep', 'HTTPS Push to Lambda on Wakeup', 'Fast-Forward Journal']
  },
  actor: {
    name: '3. Stateful Entity / Per-Key Exclusive Serialization (Virtual Object vs Entity Workflow)',
    temporalSummary: 'Modeled via long-running Entity Workflows receiving Signals/Updates + Continue-As-New every ~10,000 events to bound History size.',
    restateSummary: 'First-class Virtual Objects backed by embedded RocksDB K/V store. State is eagerly pushed in StartMessage; per-key sequential queue enforced natively without Continue-As-New.',
    temporalHops: ['SignalWithStart / UpdateWorkflow', 'History MutableState Lock', 'Worker Replay/Sticky', 'Continue-As-New Rollover'],
    restateHops: ['VirtualObject Call(key)', 'Per-Key Partition Mailbox', 'Eager K/V State in Frame #1', 'Atomic SetState + Output']
  }
};

function renderCompareDurableView(container) {
  container.innerHTML = `
    <!-- Header -->
    <div class="glass-card rounded-2xl p-6 lg:p-8 border border-cyan-500/30">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="space-y-2 max-w-3xl">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold">Priority 1.3 · Architectural Diff</span>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Comparative Visualizer: Temporal Polling vs. Restate HTTP/2 Push</h1>
          <p class="text-sm text-slate-300">
            Interactive side-by-side protocol and topology comparison contrasting Temporal's <strong>Worker Task-Queue Long-Polling &amp; Sharded History DB</strong> with Restate's <strong>HTTP/2 Push Streaming &amp; Embedded Bifrost/LSM Kernel</strong>.
          </p>
        </div>
        <div class="flex flex-wrap gap-2" id="cmp-scenario-btns">
          <button data-scen="rpc" class="cmp-scen-btn px-3.5 py-2 rounded-xl text-xs font-mono font-semibold bg-cyan-500/20 border border-cyan-400 text-white">1. Short Durable RPC</button>
          <button data-scen="serverless" class="cmp-scen-btn px-3.5 py-2 rounded-xl text-xs font-mono font-semibold bg-slate-900 border border-slate-800 text-slate-300">2. 30-Day Serverless Sleep</button>
          <button data-scen="actor" class="cmp-scen-btn px-3.5 py-2 rounded-xl text-xs font-mono font-semibold bg-slate-900 border border-slate-800 text-slate-300">3. Stateful Entity / K-V</button>
        </div>
      </div>
    </div>

    <!-- Side-by-Side Live Animated Architectural Diff -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Temporal Column -->
      <div class="glass-card rounded-2xl p-5 border border-indigo-500/40 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-indigo-500"></span>
            <h2 class="text-base font-bold text-white">Temporal: Worker Long-Polling &amp; Sharded History DB</h2>
          </div>
          <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">Pull / Poll Model</span>
        </div>
        <canvas id="cmp-temporal-canvas" class="w-full h-[210px] rounded-xl bg-slate-950 border border-slate-800 block"></canvas>
        <p id="cmp-temporal-desc" class="text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/90 p-3 rounded-lg border border-slate-800"></p>
        <div id="cmp-temporal-hops" class="flex flex-wrap gap-1.5"></div>
      </div>

      <!-- Restate Column -->
      <div class="glass-card rounded-2xl p-5 border border-emerald-500/40 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
            <h2 class="text-base font-bold text-white">Restate.dev: HTTP/2 Push &amp; Embedded Raft/LSM</h2>
          </div>
          <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Push / Stream Model</span>
        </div>
        <canvas id="cmp-restate-canvas" class="w-full h-[210px] rounded-xl bg-slate-950 border border-slate-800 block"></canvas>
        <p id="cmp-restate-desc" class="text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/90 p-3 rounded-lg border border-slate-800"></p>
        <div id="cmp-restate-hops" class="flex flex-wrap gap-1.5"></div>
      </div>
    </div>

    <!-- Comprehensive Architectural Tradeoff Matrix -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 overflow-x-auto">
      <h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
        <i data-lucide="table" class="w-4 h-4 text-cyan-400"></i>
        Architectural Dimension Matrix: Temporal vs. Restate.dev
      </h3>
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
            <th class="py-3 px-4">Architectural Dimension</th>
            <th class="py-3 px-4 text-indigo-300">Temporal Architecture</th>
            <th class="py-3 px-4 text-emerald-300">Restate.dev Architecture</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/70 text-slate-300">
          <tr>
            <td class="py-3 px-4 font-semibold text-white">Invocation Direction &amp; Firewall</td>
            <td class="py-3 px-4"><strong>Worker Pull (Outbound gRPC Long-Poll):</strong> Workers dial out to Temporal Server. Zero inbound ports required in Worker VPCs.</td>
            <td class="py-3 px-4"><strong>Coordinator Push (HTTP/2 Bi-Di Stream):</strong> Restate pushes directly to HTTP endpoints / AWS Lambda URLs (or via tunnel).</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-semibold text-white">Storage &amp; Consensus Engine</td>
            <td class="py-3 px-4">Pluggable External DB (Cassandra, PostgreSQL, MySQL, DynamoDB) + Ringpop shard membership + OpenSearch visibility.</td>
            <td class="py-3 px-4">Single-binary Rust runtime with embedded <strong>Bifrost Raft log</strong> and embedded <strong>RocksDB LSM-tree</strong> state store.</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-semibold text-white">Serverless / Scale-to-Zero FaaS</td>
            <td class="py-3 px-4">Requires always-on poller processes watching Task Queues; cannot natively scale workers to zero without external triggers.</td>
            <td class="py-3 px-4">Native scale-to-zero: closes HTTP/2 stream via <code class="text-amber-300">SuspensionMessage</code> on sleep/await, releasing Lambda/Knative instances.</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-semibold text-white">State &amp; Side-Effect Granularity</td>
            <td class="py-3 px-4">Strict separation between deterministic <strong>Workflows</strong> (sandboxed) and non-deterministic <strong>Activities</strong> (separate task queue).</td>
            <td class="py-3 px-4">Unified handler model: inline <code class="text-emerald-300">ctx.run()</code> blocks are journaled directly over the active HTTP/2 stream without a separate queue hop.</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-semibold text-white">Sweet Spot Workloads</td>
            <td class="py-3 px-4">Complex multi-month orchestration, sagas, child workflows, human-in-the-loop signals, isolated polyglot worker fleets.</td>
            <td class="py-3 px-4">Low-latency durable microservices, serverless FaaS workflows, stateful Virtual Object actors, idempotent payment/webhook pipelines.</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  rehydrateIcons();
  let activeScen = 'rpc';

  function updateScenarioUI() {
    const sc = CompareScenarios[activeScen];
    document.querySelectorAll('.cmp-scen-btn').forEach(btn => {
      const isAct = btn.getAttribute('data-scen') === activeScen;
      btn.className = isAct
        ? 'cmp-scen-btn px-3.5 py-2 rounded-xl text-xs font-mono font-semibold bg-cyan-500/20 border border-cyan-400 text-white'
        : 'cmp-scen-btn px-3.5 py-2 rounded-xl text-xs font-mono font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700';
    });
    document.getElementById('cmp-temporal-desc').textContent = sc.temporalSummary;
    document.getElementById('cmp-restate-desc').textContent = sc.restateSummary;
    document.getElementById('cmp-temporal-hops').innerHTML = sc.temporalHops.map((h, i) =>
      `<span class="px-2 py-1 rounded bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-mono text-indigo-200">${i + 1}. ${h}</span>`
    ).join('');
    document.getElementById('cmp-restate-hops').innerHTML = sc.restateHops.map((h, i) =>
      `<span class="px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono text-emerald-200">${i + 1}. ${h}</span>`
    ).join('');
  }

  document.querySelectorAll('.cmp-scen-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeScen = btn.getAttribute('data-scen');
      updateScenarioUI();
    });
  });
  updateScenarioUI();

  // Side-by-side canvas loop
  let cTick = 0;
  function drawCompareCanvases() {
    const tCan = document.getElementById('cmp-temporal-canvas');
    const rCan = document.getElementById('cmp-restate-canvas');
    if (!tCan || !rCan || !tCan.isConnected) return;
    cTick += 0.035;

    const renderPipeline = (can, nodes, colorHex, modeText) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = can.getBoundingClientRect();
      if (can.width !== Math.floor(rect.width * dpr) || can.height !== Math.floor(rect.height * dpr)) {
        can.width = Math.floor(rect.width * dpr);
        can.height = Math.floor(rect.height * dpr);
      }
      const ctx = can.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = colorHex;
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(modeText, 16, 22);

      const stepW = (w - 40) / nodes.length;
      nodes.forEach((n, idx) => {
        const nx = 20 + idx * stepW;
        const ny = 65;
        const nw = stepW - 18;
        const nh = 95;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(nx, ny, nw, nh, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(n.title, nx + 8, ny + 26);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(n.sub, nx + 8, ny + 46);
        ctx.fillStyle = colorHex;
        ctx.fillText(n.lat, nx + 8, ny + 76);

        if (idx < nodes.length - 1) {
          const x1 = nx + nw;
          const x2 = nx + stepW;
          ctx.strokeStyle = colorHex;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -cTick * 15;
          ctx.beginPath();
          ctx.moveTo(x1, ny + nh / 2);
          ctx.lineTo(x2, ny + nh / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
      ctx.restore();
    };

    renderPipeline(tCan, [
      { title: 'Frontend', sub: 'gRPC Edge', lat: '~1ms' },
      { title: 'History DB', sub: 'Shard Tx', lat: '~5-12ms' },
      { title: 'Matching', sub: 'Task Queue', lat: 'Long-Poll' },
      { title: 'Worker Pod', sub: 'SDK Replay', lat: 'Outbound' }
    ], '#818cf8', 'TEMPORAL: MULTI-SERVICE SHARDED POLL PIPELINE');

    renderPipeline(rCan, [
      { title: 'Ingress', sub: 'HTTP/2 Edge', lat: '~0.3ms' },
      { title: 'Bifrost + LSM', sub: 'Embedded Log', lat: '~1-2ms' },
      { title: 'Push Handler', sub: 'Bi-Di Stream', lat: '0 Threads Idle' }
    ], '#34d399', 'RESTATE: SINGLE-BINARY EMBEDDED LOG + HTTP/2 PUSH');

    LifecycleManager.requestFrame(drawCompareCanvases);
  }

  LifecycleManager.requestFrame(drawCompareCanvases);
}
