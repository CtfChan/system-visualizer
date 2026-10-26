// ============================================================================
// PRIORITY 1.2: RESTATE.DEV ARCHITECTURE (/ #restate)
// ============================================================================
const RestateData = {
  components: {
    bifrost: {
      title: 'Bifrost Log (Embedded Raft Consensus Journal)',
      badge: 'Rust Kernel · Sub-ms Local Quorum Append',
      summary: 'Restate replaces external databases (Cassandra/Postgres) with Bifrost—an embedded, partitioned log engine built directly into the single-binary Rust runtime. Every handler invocation, ctx.run() side effect, and RPC call is journaled into a Raft-replicated partition log.',
      bullets: [
        'Zero external DB hop: Journal entries are written directly to local NVMe via Raft quorum across Restate nodes.',
        'Push-Preloading: When resuming a suspended or crashed invocation, Restate streams all prior Journal Entries in the initial HTTP/2 StartMessage frame.',
        'Deterministic Replay at Wire Speed: The SDK matches journal entries in memory without making secondary RPCs to fetch history.'
      ],
      wireFrame: `Frame 0x0001 [StartMessage] {
  id: "inv_01J9Z8K4M",
  known_entries: 3,
  state_map: [ ("cart_items", "[\"sku-99\"]") ],
  journal: [
Entry#0: Input(orderId="ORD-77"),
Entry#1: RunEntry(name="chargeStripe", result={"tx":"ch_441"}),
Entry#2: SleepEntry(wakeup_time=1761439200, completed=true)
  ]
}`
    },
    lsm: {
      title: 'Embedded RocksDB / LSM-Tree State Store (Virtual Objects)',
      badge: 'Co-located K/V State · Single-Writer Per Key',
      summary: 'Restate provides stateful "Virtual Objects" (key-addressable actors) backed by an embedded RocksDB LSM-tree partitioned alongside the Bifrost log. State mutations (ctx.set) are committed atomically with the invocation journal.',
      bullets: [
        'Eager State Attachment: Restate attaches the Virtual Object’s key-value state directly into the HTTP/2 StartMessage so ctx.get("key") resolves in 0ms locally in the SDK.',
        'Per-Key Linearizable Queue: Invocations targeting the same Virtual Object key (e.g., Wallet["user-108"]) are serialized in a per-key FIFO mailbox, eliminating optimistic locking retry storms.',
        'Consistent Snapshots: LSM checkpoints integrate with Raft log truncation for instant partition recovery.'
      ],
      wireFrame: `// Handler Code (TypeScript SDK)
export const walletObject = restate.object({
  name: "Wallet",
  handlers: {
withdraw: async (ctx: restate.ObjectContext, amount: number) => {
  // 0ms local read from StartMessage state_map!
  const balance = (await ctx.get<number>("balance")) ?? 0;
  if (balance < amount) throw new restate.TerminalError("Insufficient");
  // Journaled via SetStateEntryMessage on the HTTP/2 stream
  ctx.set("balance", balance - amount);
  return { remaining: balance - amount };
}
  }
});`
    },
    http2: {
      title: 'HTTP/2 Bidirectional Streaming Protocol',
      badge: 'Full-Duplex Multiplexed · Push Invocation',
      summary: 'Instead of workers long-polling task queues, Restate acts as a reverse proxy / ingress that pushes invocations to microservice handlers over HTTP/2 bidirectional streams (or AWS Lambda HTTPS invoke).',
      bullets: [
        'Multiplexed Streams: Thousands of concurrent invocations share a single TCP connection via HTTP/2 stream IDs.',
        'Real-Time Syscall Pipelining: As the handler executes ctx.run() or ctx.serviceClient().call(), the SDK writes frames to the HTTP/2 request stream and awaits acknowledgment frames on the response stream.',
        'Universal Deployment: Works identically with Kubernetes deployments, Knative, AWS Lambda, Cloudflare Workers, or Fargate.'
      ],
      wireFrame: `HTTP/2 Stream #49 (POST /OrderService/process HTTP/2)
--> Restate sends:   [Header: content-type: application/vnd.restate.invocation.v2]
--> Restate sends:   [StartMessage: entries=1]
<-- SDK streams:     [RunEntryMessage: propose result={"tx":"ch_441"}]
--> Restate acks:    [EntryAckMessage: entry_index=1 committed_in_raft=true]
<-- SDK streams:     [SleepEntryMessage: duration=86400s]
<-- SDK streams:     [SuspensionMessage: waiting_on=[entry_index=2]]
[HTTP/2 Stream #49 CLOSED cleanly -> Worker Thread Freed!]`
    },
    suspension: {
      title: 'Deterministic Promise Parking & Thread-Free Suspension',
      badge: '0ms Idle Compute Billing · Serverless Native',
      summary: 'When a handler awaits an asynchronous operation (e.g., ctx.sleep(), ctx.awakeable(), or a slow downstream service call), the SDK yields a SuspensionMessage and terminates the HTTP/2 stream immediately.',
      bullets: [
        'Zero Blocked Worker Threads: While a workflow sleeps for 30 days or awaits human approval, 0 bytes of RAM and 0 threads are held on the worker.',
        'Timer & Awakeable Wakeup: When the timer fires in Restate’s internal RocksDB timer wheel, Restate opens a brand-new HTTP/2 stream to any healthy worker instance.',
        'Fast-Forward Replay: The new HTTP/2 stream includes all completed journal entries so execution jumps straight to the line after await ctx.sleep() in microseconds.'
      ],
      wireFrame: `// Lifecycle of a 30-Day Sleep on AWS Lambda:
1. t=0.000s: Lambda invoked via Push -> runs ctx.run("charge") (12ms)
2. t=0.012s: Hits await ctx.sleep({ days: 30 })
3. t=0.013s: SDK sends SuspensionMessage(entry=2) -> Lambda exits!
   [30 Days Pass: $0.00 Lambda compute cost, 0 active containers]
4. t=30d:    Restate Timer Wheel fires -> invokes Lambda with [Entry#0, Entry#1, Entry#2(done)]
5. t=30d+4ms: Lambda fast-forwards past Entry#1 & #2, runs ctx.run("ship") -> Done!`
    }
  },

  suspensionSteps: [
    {
      step: 0,
      mode: 'ACTIVE STREAM #1',
      workerState: 'RUNNING (Thread #1 Active)',
      streamStatus: 'HTTP/2 Stream #101 OPEN',
      title: 'Ingress Request Arrives -> Restate Assigns Invocation ID & Opens HTTP/2 Push Stream',
      journalEntries: [
        { idx: 0, type: 'InputEntry', status: 'COMMITTED', payload: '{ userId: "U-42", amount: 99 }' }
      ],
      desc: 'Client calls POST /checkout. Restate appends InputEntry(#0) to the Bifrost Raft log and immediately opens HTTP/2 Stream #101 to the Checkout Service handler, pushing StartMessage + Virtual Object K/V state.'
    },
    {
      step: 1,
      mode: 'ACTIVE STREAM #1',
      workerState: 'RUNNING ctx.run("reserve")',
      streamStatus: 'HTTP/2 Stream #101 FULL-DUPLEX',
      title: 'Handler Executes Non-Deterministic Block via ctx.run()',
      journalEntries: [
        { idx: 0, type: 'InputEntry', status: 'COMMITTED', payload: '{ userId: "U-42", amount: 99 }' },
        { idx: 1, type: 'RunEntry[reserve]', status: 'COMMITTED', payload: '{ skuLock: "LK-901" }' }
      ],
      desc: 'The handler executes ctx.run("reserve", () => db.lockSku()). The SDK streams the result {skuLock: "LK-901"} over HTTP/2 Stream #101 to Restate. Restate commits Entry #1 to Raft and sends back an EntryAck.'
    },
    {
      step: 2,
      mode: 'SUSPENDING...',
      workerState: 'YIELDING PROMISE -> EXITING',
      streamStatus: 'Stream #101 CLOSING (SuspensionMessage)',
      title: 'Handler Hits await ctx.sleep(24h) or External Awakeable -> Emits SuspensionMessage!',
      journalEntries: [
        { idx: 0, type: 'InputEntry', status: 'COMMITTED', payload: '{ userId: "U-42", amount: 99 }' },
        { idx: 1, type: 'RunEntry[reserve]', status: 'COMMITTED', payload: '{ skuLock: "LK-901" }' },
        { idx: 2, type: 'SleepEntry[24h]', status: 'PARKED IN KERNEL', payload: 'wake_at: +86,400s' }
      ],
      desc: 'Handler awaits ctx.sleep(86400s). Instead of holding a thread or polling, the SDK sends SleepEntry(#2) + SuspensionMessage(waiting_on=[2]) and cleanly returns from the HTTP handler!'
    },
    {
      step: 3,
      mode: 'PARKED IN LSM-TREE',
      workerState: '0 THREADS / 0 WORKERS (Scale-to-Zero)',
      streamStatus: 'NO NETWORK CONNECTION',
      title: 'Invocation Parked in Restate Kernel (Worker Completely Idle / Scaled to Zero)',
      journalEntries: [
        { idx: 0, type: 'InputEntry', status: 'DURABLE ON DISK', payload: '{ userId: "U-42", amount: 99 }' },
        { idx: 1, type: 'RunEntry[reserve]', status: 'DURABLE ON DISK', payload: '{ skuLock: "LK-901" }' },
        { idx: 2, type: 'SleepEntry[24h]', status: 'TIMER WHEEL ACTIVE', payload: 'Remaining: 00:00:00' }
      ],
      desc: 'While suspended, the invocation consumes ZERO worker memory and ZERO network sockets. Even if all worker containers scale to zero (e.g. AWS Lambda), Restate tracks the timer in its embedded RocksDB timer wheel.'
    },
    {
      step: 4,
      mode: 'FAST-FORWARD STREAM #2',
      workerState: 'RESUMED (Fast-Forward Replay 0.05ms)',
      streamStatus: 'HTTP/2 Stream #209 OPEN (Preloaded Journal)',
      title: 'Timer Fires -> Restate Pushes New HTTP/2 Stream Pre-Populated with Entries #0..#2',
      journalEntries: [
        { idx: 0, type: 'InputEntry', status: 'REPLAYED (0ms)', payload: '{ userId: "U-42", amount: 99 }' },
        { idx: 1, type: 'RunEntry[reserve]', status: 'SKIPPED (Cached)', payload: '{ skuLock: "LK-901" }' },
        { idx: 2, type: 'SleepEntry[24h]', status: 'COMPLETED', payload: 'Fired by Kernel' },
        { idx: 3, type: 'OutputEntry', status: 'COMMITTED', payload: '{ status: "SHIPPED" }' }
      ],
      desc: 'Restate initiates HTTP/2 Stream #209 with Entries #0, #1, and #2 bundled inside the initial StartMessage. The SDK fast-forwards past ctx.run("reserve") and ctx.sleep() without network I/O and completes the invocation!'
    }
  ]
};

function renderRestateView(container) {
  container.innerHTML = `
    <!-- HERO BANNER -->
    <div class="glass-card rounded-2xl p-6 lg:p-8 border border-emerald-500/30 relative overflow-hidden">
      <div class="absolute -right-20 -top-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div class="space-y-3 max-w-3xl">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">Priority 1.2 · Durable Execution</span>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">Embedded Bifrost Raft Log</span>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">HTTP/2 Push &amp; Suspension</span>
          </div>
          <h1 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            Restate.dev Architecture &amp; Suspension Engine
          </h1>
          <p class="text-sm text-slate-300 leading-relaxed">
            Restate reimagines durable execution as a <strong>distributed Rust kernel runtime</strong> situated directly in the RPC path. Backed by an embedded <strong>Bifrost Raft log</strong> and <strong>RocksDB LSM-tree state store</strong>, Restate pushes invocations over <strong>HTTP/2 bidirectional streams</strong> and deterministically suspends handlers when awaiting promises—freeing worker threads completely.
          </p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 shrink-0">
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[11px] font-mono text-slate-400">Runtime Footprint</div>
            <div class="text-lg font-bold font-mono text-emerald-400">1 Binary</div>
            <div class="text-[10px] text-slate-400">Rust + RocksDB + Raft</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[11px] font-mono text-slate-400">Wire Protocol</div>
            <div class="text-lg font-bold font-mono text-cyan-400">HTTP/2 Push</div>
            <div class="text-[10px] text-slate-400">Bi-di streaming frames</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[11px] font-mono text-slate-400">Sleeping Thread Cost</div>
            <div class="text-lg font-bold font-mono text-indigo-400">0 Threads</div>
            <div class="text-[10px] text-slate-400">SuspensionMessage</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[11px] font-mono text-slate-400">Virtual Object State</div>
            <div class="text-lg font-bold font-mono text-amber-400">0ms Read</div>
            <div class="text-[10px] text-slate-400">Eagerly pushed in Start</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 1: INTERACTIVE HTTP/2 JOURNAL & PROMISE SUSPENSION SIMULATOR -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <i data-lucide="zap" class="w-5 h-5 text-emerald-400"></i>
            <h2 class="text-lg font-bold text-white">Interactive Simulator: Microservice Execution Journal vs. Deterministic Suspension</h2>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Step through how Restate journals <code class="text-emerald-300">ctx.run()</code> side effects over HTTP/2, parks a sleeping promise via <code class="text-amber-300">SuspensionMessage</code> (0 pinned threads), and resumes by pushing the pre-populated journal in a single packet.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button id="rest-prev-btn" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 border border-slate-700">
            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i> Prev
          </button>
          <button id="rest-next-btn" class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold flex items-center gap-1 shadow-lg shadow-emerald-600/20">
            Next Frame <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
          <button id="rest-park-btn" class="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono flex items-center gap-1.5">
            <i data-lucide="pause-circle" class="w-3.5 h-3.5"></i> Jump to Promise Suspension
          </button>
        </div>
      </div>

      <!-- Stepper Buttons -->
      <div class="grid grid-cols-1 sm:grid-cols-5 gap-2" id="restate-step-pills"></div>

      <!-- Live Animated HTTP/2 + Bifrost Log Canvas -->
      <div class="rounded-xl bg-slate-950 border border-slate-800 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2 px-2 text-xs font-mono">
          <div class="flex items-center gap-2">
            <span id="rest-step-badge" class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">FRAME 0</span>
            <span id="rest-step-title" class="text-white font-semibold"></span>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-slate-400">HTTP/2 Wire: <strong id="rest-wire-status" class="text-cyan-300"></strong></span>
            <span class="text-slate-400">Worker Compute: <strong id="rest-worker-status" class="text-emerald-300"></strong></span>
          </div>
        </div>
        <canvas id="restate-suspension-canvas" class="w-full h-[220px] rounded-lg bg-slate-950 block"></canvas>
        <div id="rest-step-desc" class="mt-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed"></div>
      </div>

      <!-- Journal Entries Inspector & Handler Code -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div class="lg:col-span-6 rounded-xl bg-slate-900/85 border border-slate-800 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
              <i data-lucide="database" class="w-4 h-4"></i> Bifrost Partition Journal + RocksDB State
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">Partition #07 (Raft Leader)</span>
          </div>
          <div id="restate-journal-list" class="space-y-2 font-mono text-xs"></div>
        </div>

        <div class="lg:col-span-6 rounded-xl bg-slate-900/85 border border-slate-800 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
              <i data-lucide="terminal" class="w-4 h-4"></i> Restate Microservice Handler (FaaS / K8s)
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">Stateless or Virtual Object</span>
          </div>
          <pre class="code-block bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto">
<span class="text-slate-500">// Standard RPC handler pushed via HTTP/2 from Restate</span>
export const checkoutService = restate.service({
  name: "CheckoutService",
  handlers: {
process: async (ctx: restate.Context, req: OrderReq) => {
  <span class="text-emerald-400">// Entry #1: Journaled side-effect (executed once)</span>
  const lock = await ctx.run("reserve", () => reserveSku(req));

  <span class="text-amber-400">// Entry #2: Emits SuspensionMessage &amp; closes HTTP/2!</span>
  <span class="text-amber-400">// Worker thread is 100% freed during the 24h wait.</span>
  await ctx.sleep({ hours: 24 });

  <span class="text-cyan-400">// Entry #3: Resumed in new HTTP/2 stream with #0..#2 preloaded</span>
  return { status: "SHIPPED", lock };
}
  }
});</pre>
        </div>
      </div>
    </div>

    <!-- SECTION 2: KERNEL SUBSYSTEM BREAKDOWN & CONCURRENCY TELEMETRY -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i data-lucide="cpu" class="w-4 h-4 text-emerald-400"></i>
          Restate Single-Binary Kernel Architecture Breakdown
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2" id="restate-comp-tabs">
          <button data-comp="bifrost" class="rest-comp-btn p-2.5 rounded-xl border text-left transition-all bg-emerald-500/20 border-emerald-500 text-white">
            <div class="text-xs font-bold">Bifrost Log</div>
            <div class="text-[10px] text-slate-400 font-mono">Embedded Raft</div>
          </button>
          <button data-comp="lsm" class="rest-comp-btn p-2.5 rounded-xl border text-left transition-all bg-slate-900 border-slate-800 text-slate-300">
            <div class="text-xs font-bold">RocksDB LSM</div>
            <div class="text-[10px] text-slate-400 font-mono">Virtual Objects</div>
          </button>
          <button data-comp="http2" class="rest-comp-btn p-2.5 rounded-xl border text-left transition-all bg-slate-900 border-slate-800 text-slate-300">
            <div class="text-xs font-bold">HTTP/2 Framing</div>
            <div class="text-[10px] text-slate-400 font-mono">Bi-di Stream</div>
          </button>
          <button data-comp="suspension" class="rest-comp-btn p-2.5 rounded-xl border text-left transition-all bg-slate-900 border-slate-800 text-slate-300">
            <div class="text-xs font-bold">Suspension</div>
            <div class="text-[10px] text-slate-400 font-mono">Zero Thread Pin</div>
          </button>
        </div>
        <div id="restate-comp-detail" class="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4"></div>
      </div>

      <div class="lg:col-span-5 glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-4">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <i data-lucide="bar-chart-3" class="w-4 h-4 text-cyan-400"></i>
            Worker Memory &amp; Active Threads (10,000 Sleeping Invocations)
          </h3>
          <p class="text-xs text-slate-400 mt-1">
            Comparing worker RAM consumption when 10,000 workflows are simultaneously waiting on a 1-hour durable timer or external webhook.
          </p>
        </div>
        <div class="h-56 bg-slate-950 rounded-xl p-3 border border-slate-800">
          <canvas id="restate-threads-chart"></canvas>
        </div>
        <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-slate-300">
          <strong class="text-emerald-300 font-mono">Why Push + Suspension Matters for FaaS:</strong> Because Restate closes the HTTP/2 stream on <code class="text-amber-300">SuspensionMessage</code>, AWS Lambda / Cloud Run instances terminate immediately after <code class="text-emerald-300">ctx.sleep()</code> instead of billing for idle wall-clock wait time.
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();

  let restStepIdx = 0;

  function updateRestateSimulator() {
    const s = RestateData.suspensionSteps[restStepIdx];
    const pillsEl = document.getElementById('restate-step-pills');
    if (pillsEl) {
      pillsEl.innerHTML = RestateData.suspensionSteps.map((st, idx) => `
        <button data-rstep="${idx}" class="rest-jump-btn p-2 rounded-lg border text-left transition-all ${
          idx === restStepIdx
            ? 'bg-emerald-500/20 border-emerald-400 text-white font-bold'
            : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
        }">
          <div class="text-[10px] font-mono">Step ${idx}</div>
          <div class="text-[11px] truncate">${st.mode}</div>
        </button>
      `).join('');
      pillsEl.querySelectorAll('.rest-jump-btn').forEach(b => {
        b.addEventListener('click', () => {
          restStepIdx = parseInt(b.getAttribute('data-rstep'), 10);
          updateRestateSimulator();
        });
      });
    }

    document.getElementById('rest-step-badge').textContent = `STEP ${restStepIdx} / 4`;
    document.getElementById('rest-step-title').textContent = s.title;
    document.getElementById('rest-wire-status').textContent = s.streamStatus;
    document.getElementById('rest-worker-status').textContent = s.workerState;
    document.getElementById('rest-step-desc').textContent = s.desc;

    const jList = document.getElementById('restate-journal-list');
    if (jList) {
      jList.innerHTML = s.journalEntries.map(e => `
        <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
          <div>
            <span class="text-emerald-400 font-bold">Entry #${e.idx}</span>
            <span class="text-white ml-1.5 font-semibold">${e.type}</span>
            <div class="text-[11px] text-slate-400 mt-0.5">${e.payload}</div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
            e.status.includes('PARKED') || e.status.includes('TIMER')
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }">${e.status}</span>
        </div>
      `).join('');
    }
  }

  document.getElementById('rest-prev-btn')?.addEventListener('click', () => {
    restStepIdx = (restStepIdx - 1 + RestateData.suspensionSteps.length) % RestateData.suspensionSteps.length;
    updateRestateSimulator();
  });
  document.getElementById('rest-next-btn')?.addEventListener('click', () => {
    restStepIdx = (restStepIdx + 1) % RestateData.suspensionSteps.length;
    updateRestateSimulator();
  });
  document.getElementById('rest-park-btn')?.addEventListener('click', () => {
    restStepIdx = 2;
    updateRestateSimulator();
  });

  function selectRestateComponent(key) {
    const comp = RestateData.components[key];
    if (!comp) return;
    document.querySelectorAll('.rest-comp-btn').forEach(btn => {
      const active = btn.getAttribute('data-comp') === key;
      btn.className = active
        ? 'rest-comp-btn p-2.5 rounded-xl border text-left transition-all bg-emerald-500/20 border-emerald-500 text-white'
        : 'rest-comp-btn p-2.5 rounded-xl border text-left transition-all bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700';
    });
    const panel = document.getElementById('restate-comp-detail');
    if (!panel) return;
    panel.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-sm font-bold text-white">${comp.title}</h4>
        <span class="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">${comp.badge}</span>
      </div>
      <p class="text-xs text-slate-300 leading-relaxed">${comp.summary}</p>
      <ul class="space-y-1.5 text-xs text-slate-300">
        ${comp.bullets.map(b => `<li class="flex items-start gap-2"><span class="text-emerald-400">▸</span><span>${b}</span></li>`).join('')}
      </ul>
      <pre class="code-block bg-slate-950 p-3 rounded-lg border border-slate-800 text-emerald-200 overflow-x-auto">${comp.wireFrame}</pre>
    `;
  }

  document.querySelectorAll('.rest-comp-btn').forEach(btn => {
    btn.addEventListener('click', () => selectRestateComponent(btn.getAttribute('data-comp')));
  });
  selectRestateComponent('bifrost');

  // Chart.js for Worker Memory & Threads
  const thCtx = document.getElementById('restate-threads-chart')?.getContext('2d');
  if (thCtx) {
    LifecycleManager.registerChart(new Chart(thCtx, {
      type: 'bar',
      data: {
        labels: ['Restate (HTTP/2 Suspended)', 'Temporal (Sticky Cache Evicted)', 'Naive Blocking Microservice'],
        datasets: [
          {
            label: 'Active Worker Threads Held',
            data: [0, 4, 10000],
            backgroundColor: ['rgba(16, 185, 129, 0.7)', 'rgba(99, 102, 241, 0.7)', 'rgba(244, 63, 94, 0.7)'],
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: 'logarithmic', ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: 'rgba(51,65,85,0.2)' } },
          y: { ticks: { color: '#e2e8f0', font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } }
        },
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { family: 'JetBrains Mono', size: 10 } } }
        }
      }
    }));
  }

  // Canvas animation for Restate HTTP/2 Stream & Suspension
  const rCanvas = document.getElementById('restate-suspension-canvas');
  let rTick = 0;
  function drawRestateCanvas() {
    if (!rCanvas || !rCanvas.isConnected) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = rCanvas.getBoundingClientRect();
    if (rCanvas.width !== Math.floor(rect.width * dpr) || rCanvas.height !== Math.floor(rect.height * dpr)) {
      rCanvas.width = Math.floor(rect.width * dpr);
      rCanvas.height = Math.floor(rect.height * dpr);
    }
    const ctx = rCanvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    rTick += 0.04;
    const isSuspended = restStepIdx === 2 || restStepIdx === 3;

    // Left: Restate Kernel Box
    const kernelBox = { x: 28, y: 30, w: 245, h: 160 };
    ctx.fillStyle = 'rgba(6, 78, 59, 0.4)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(kernelBox.x, kernelBox.y, kernelBox.w, kernelBox.h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText('RESTATE RUST KERNEL', kernelBox.x + 14, kernelBox.y + 24);
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('• Bifrost Raft Journal', kernelBox.x + 14, kernelBox.y + 46);
    ctx.fillText('• Embedded RocksDB LSM State', kernelBox.x + 14, kernelBox.y + 64);
    ctx.fillText('• Durable Timer Wheel', kernelBox.x + 14, kernelBox.y + 82);

    // Draw Journal Blocks inside Kernel
    for (let i = 0; i <= Math.min(3, restStepIdx); i++) {
      ctx.fillStyle = i === 2 && isSuspended ? '#f59e0b' : '#10b981';
      ctx.beginPath();
      ctx.roundRect(kernelBox.x + 14 + i * 52, kernelBox.y + 105, 46, 34, 5);
      ctx.fill();
      ctx.fillStyle = '#060913';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(`J#${i}`, kernelBox.x + 25 + i * 52, kernelBox.y + 126);
    }

    // Right: Handler Box
    const handlerBox = { x: w - 255, y: 30, w: 225, h: 160 };
    ctx.fillStyle = isSuspended ? 'rgba(30, 41, 59, 0.35)' : 'rgba(12, 74, 110, 0.45)';
    ctx.strokeStyle = isSuspended ? '#64748b' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(handlerBox.x, handlerBox.y, handlerBox.w, handlerBox.h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSuspended ? '#94a3b8' : '#ffffff';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText('SERVICE HANDLER (SDK)', handlerBox.x + 14, handlerBox.y + 24);
    ctx.fillStyle = isSuspended ? '#fbbf24' : '#38bdf8';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText(
      restStepIdx === 3 ? 'SCALE-TO-ZERO (0 THREADS)' :
      restStepIdx === 2 ? 'SENDING SuspensionMessage' :
      restStepIdx === 4 ? 'FAST-FORWARD REPLAY (#0..#2)' : 'HTTP/2 STREAM ACTIVE',
      handlerBox.x + 14, handlerBox.y + 52
    );

    // Middle HTTP/2 Stream Channel
    const xStart = kernelBox.x + kernelBox.w;
    const xEnd = handlerBox.x;
    if (restStepIdx === 3) {
      ctx.strokeStyle = '#475569';
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(xStart, 110);
      ctx.lineTo(xEnd, 110);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('⏸ HTTP/2 STREAM CLOSED — INVOCATION PARKED IN LSM-TREE', (xStart + xEnd) / 2 - 165, 102);
    } else {
      ctx.strokeStyle = restStepIdx === 2 ? '#f59e0b' : '#10b981';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -rTick * 18;
      ctx.beginPath();
      ctx.moveTo(xStart, 90);
      ctx.lineTo(xEnd, 90);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineDashOffset = rTick * 18;
      ctx.beginPath();
      ctx.moveTo(xStart, 135);
      ctx.lineTo(xEnd, 135);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(
        restStepIdx === 4 ? 'Push StartMessage [Entries #0, #1, #2 bundled]' : 'HTTP/2 Push Frame -->',
        (xStart + xEnd) / 2 - 110, 80
      );
      ctx.fillText(
        restStepIdx === 2 ? '<-- SuspensionMessage(entry=2)' : '<-- Stream Journal Entry Proposal',
        (xStart + xEnd) / 2 - 95, 154
      );
    }

    ctx.restore();
    LifecycleManager.requestFrame(drawRestateCanvas);
  }

  updateRestateSimulator();
  LifecycleManager.requestFrame(drawRestateCanvas);
}
