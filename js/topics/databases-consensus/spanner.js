// ============================================================================
// SECONDARY CATALOG 1: GOOGLE CLOUD SPANNER (/#spanner)
// TrueTime API [t_earliest, t_latest], Commit Wait (2ε), Multi-Paxos Splits

const SpannerMeta = {
  accent: 'blue',
  category: 'Storage & Databases',
  title: 'Google Cloud Spanner',
  tags: ['Global SQL', 'TrueTime', 'Paxos per split'],
  summary: 'Horizontally scalable SQL database. Tables are range-partitioned into <strong>splits</strong>; each split is a Paxos group with a leader. <strong>TrueTime</strong> exposes clock time as an interval <code>[earliest, latest]</code> with bounded error ε. The leader picks commit timestamp <code>s = latest</code> and waits until <code>earliest &gt; s</code> (<strong>commit wait</strong>) before acknowledging — this makes timestamp order match real-time order (external consistency) and enables lock-free snapshot reads anywhere.',
  constraints: [
    ['Write latency floor', 'max(Paxos quorum RTT, commit wait ≈ 2ε). ε is typically low single-digit ms, so commit wait mostly overlaps with replication.'],
    ['Multi-region writes', 'Every write pays a cross-region quorum RTT (tens of ms) in multi-region configs. Choose the leader region close to writers.'],
    ['Cross-split transactions', 'Writes spanning multiple splits use 2PC across Paxos leaders — more RTTs and lock hold time.'],
    ['Hotspotting', 'Monotonically increasing primary keys (timestamps, sequences) land on one split. Use UUIDv4, bit-reversed sequences, or hash prefixes.'],
    ['Commit size', 'Mutation count per commit is capped (80,000 mutations).'],
    ['Portability', 'GCP-only; TrueTime depends on Google’s GPS + atomic clock infrastructure.']
  ],
  useWhen: [
    'You need SQL + strong consistency across regions (ledgers, inventory, identity).',
    'Write volume or dataset size exceeds what a single Postgres primary can handle.',
    'You want stale-but-consistent snapshot reads served from any replica without locks.'
  ],
  avoidWhen: [
    'A single-region Postgres/MySQL primary fits the load — it is cheaper and lower latency.',
    'You require multi-cloud or on-prem deployment.',
    'Workload is analytical / scan-heavy rather than OLTP.'
  ]
};
// ============================================================================
function renderSpannerView(container) {
  container.innerHTML = `
    ${renderTopicIntro(SpannerMeta)}

    <!-- INTERACTIVE TRUETIME [t_earliest, t_latest] & COMMIT WAIT SIMULATOR -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i data-lucide="clock" class="w-5 h-5 text-blue-400"></i>
            Interactive TrueTime Interval &amp; Commit Wait (<code class="text-amber-300">2ε</code>) Simulator
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            Adjust clock uncertainty <code class="text-blue-300">ε (epsilon)</code> and network Paxos latency to see how the Paxos Leader picks commit timestamp <code class="text-emerald-300">s ≥ t_latest</code> and waits until <code class="text-amber-300">TT.now().earliest &gt; s</code> before exposing the write.
          </p>
        </div>
        <button id="spanner-tx-btn" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20">
          <i data-lucide="play" class="w-4 h-4"></i> Execute Cross-Region Read-Write Tx
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
          <div class="text-[10px] text-slate-400 mt-1"> Commit Wait integrates in parallel with Paxos replication!</div>
        </div>
        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-center">
          <div class="text-slate-400 text-[10px]">Effective Total Commit Latency:</div>
          <div id="span-total-lat" class="text-base font-bold text-white mt-0.5">6.0 ms (max(PaxosRTT, 2ε))</div>
          <div id="span-overlap-note" class="text-[10px] text-emerald-400">2.0ms extra wait after Paxos Quorum ACK</div>
        </div>
      </div>

      <canvas id="spanner-truetime-canvas" class="w-full h-[230px] rounded-xl bg-slate-950 border border-slate-800 block"></canvas>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div class="font-mono font-bold text-blue-300">1. Start Rule (Pick Commit Timestamp s)</div>
          <p class="text-slate-300 leading-relaxed">
            When transaction <code class="text-white">T1</code> arrives at the Paxos Leader at <code class="text-blue-300">TT.now() = [t_earliest, t_latest]</code>, the leader assigns commit timestamp <code class="text-emerald-300">s1 = t_latest</code> (guaranteeing <code class="text-emerald-300">s1 ≥ true_absolute_time</code>).
          </p>
        </div>
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div class="font-mono font-bold text-amber-300">2. Commit Wait Rule (Wait until s &lt; t_earliest)</div>
          <p class="text-slate-300 leading-relaxed">
            Before releasing 2PL locks or replying to the client, the coordinator waits until <code class="text-amber-300">TT.now().earliest &gt; s1</code> (at most <code class="text-amber-300">2ε</code>). Now the absolute wall-clock time is strictly past <code class="text-emerald-300">s1</code> everywhere on Earth!
          </p>
        </div>
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div class="font-mono font-bold text-emerald-300">3. Lock-Free Snapshot Reads Across Split Leaders</div>
          <p class="text-slate-300 leading-relaxed">
            Because all committed writes obey TrueTime bounds, any read-only query at <code class="text-emerald-300">t_read = TT.now().latest</code> can read from any sufficiently up-to-date Multi-Paxos replica with <strong>zero locks and zero 2PC</strong>.
          </p>
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();

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
      ? `+${residualWait.toFixed(1)}ms Commit Wait after Paxos Quorum`
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

    // Track 3: Commit Wait Window until t_earliest > s_commit (which takes another 2ε from t=0)
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
