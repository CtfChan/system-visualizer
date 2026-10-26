// ============================================================================
// SECONDARY CATALOG 4: RAFT CONSENSUS (/#raft)
// Leader Election, Log Replication, Terms, Heartbeats, Split Votes

const RaftMeta = {
  accent: 'rose',
  category: 'Consensus Protocols',
  title: 'Raft Consensus',
  tags: ['Leader-based', 'Replicated log', 'etcd · CockroachDB · TiKV'],
  summary: 'Consensus for a replicated log. Time is divided into <strong>terms</strong>; each term has at most one leader, elected by majority vote. The leader appends client commands and replicates them with <code>AppendEntries</code>; an entry is <strong>committed</strong> once stored on a majority. A candidate can only win if its log is at least as up-to-date as the voters’, so committed entries are never lost.',
  constraints: [
    ['Fault tolerance', '2f+1 voters tolerate f failures. 3 nodes → 1 failure, 5 nodes → 2. Even counts add cost without extra tolerance.'],
    ['Throughput', 'Every write flows through the single leader; the leader’s disk and NIC are the ceiling. Shard into many Raft groups (Multi-Raft) to scale.'],
    ['Commit latency', '1 RTT to a majority + fsync. Spreading voters across regions puts a WAN RTT on every write.'],
    ['Failover gap', 'Leader loss → no writes until an election timeout (typically 150–300 ms+) fires and a new leader wins.'],
    ['Linearizable reads', 'Need a ReadIndex round-trip or a leader lease (which relies on bounded clock drift). Follower reads are stale by default.'],
    ['Membership changes', 'Must use joint consensus or one-at-a-time changes to avoid two majorities.']
  ],
  useWhen: [
    'Building a replicated state machine: metadata/config stores, lock services, per-shard replication.',
    'You want a protocol that is well-specified and widely implemented (etcd/raft, hashicorp/raft).'
  ],
  avoidWhen: [
    'An existing store (etcd, a managed DB) already gives you the guarantees — don’t roll your own.',
    'You need many voters (>7) or geo-distributed voters with strict write latency budgets.',
    'Throughput needs exceed one leader and you can’t shard the state.'
  ]
};
// ============================================================================
function renderRaftView(container) {
  container.innerHTML = `
    ${renderTopicIntro(RaftMeta)}
    <div class="glass-card rounded-2xl px-5 py-3 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
      <span class="text-[11px] font-mono uppercase tracking-wider text-slate-400">Simulator controls</span>
      <div class="flex flex-wrap gap-2">
      <button id="raft-append-btn" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold">+ Append Client Command</button>
      <button id="raft-kill-leader-btn" class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold">💥 Kill Leader &amp; Elect</button>
      <button id="raft-split-vote-btn" class="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-mono font-bold">⚡ Simulate Split Vote</button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
        <div class="flex items-center justify-between text-xs font-mono">
          <span class="text-slate-300 font-bold">5-Node Raft Quorum Cluster (Majority Quorum = 3 of 5)</span>
          <span id="raft-status-banner" class="text-emerald-300 font-bold">Term #4 · Leader: Node 1</span>
        </div>
        <canvas id="raft-cluster-canvas" class="w-full h-[300px] rounded-xl bg-slate-950 border border-slate-800 block"></canvas>
      </div>

      <div class="lg:col-span-5 glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between space-y-4">
        <div class="space-y-2.5">
          <div class="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">Per-Node Replicated Log &amp; Commit Index</div>
          <div id="raft-nodes-table" class="space-y-2 font-mono text-xs"></div>
        </div>
        <div id="raft-event-explain" class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed"></div>
      </div>
    </div>
  `;

  rehydrateIcons();

  let term = 4;
  let commitIdx = 2;
  const nodes = [
    { id: 1, role: 'LEADER', status: 'UP', log: ['T1:SET x=1', 'T4:SET y=8'] },
    { id: 2, role: 'FOLLOWER', status: 'UP', log: ['T1:SET x=1', 'T4:SET y=8'] },
    { id: 3, role: 'FOLLOWER', status: 'UP', log: ['T1:SET x=1', 'T4:SET y=8'] },
    { id: 4, role: 'FOLLOWER', status: 'UP', log: ['T1:SET x=1', 'T4:SET y=8'] },
    { id: 5, role: 'FOLLOWER', status: 'UP', log: ['T1:SET x=1', 'T4:SET y=8'] }
  ];
  let explainMsg = 'Term #4 Steady State: Leader Node 1 sends periodic AppendEntries heartbeats every 50ms to suppress follower election timers.';

  function updateRaftUI() {
    const leader = nodes.find(n => n.role === 'LEADER' && n.status === 'UP');
    document.getElementById('raft-status-banner').textContent = leader
      ? `Term #${term} · Leader: Node ${leader.id} · commitIndex=${commitIdx}`
      : `Term #${term} · SPLIT VOTE (No Majority — Awaiting Randomized Backoff)`;
    document.getElementById('raft-event-explain').textContent = explainMsg;

    const tbl = document.getElementById('raft-nodes-table');
    if (tbl) {
      tbl.innerHTML = nodes.map(n => `
        <div class="p-2.5 rounded-lg bg-slate-950 border ${
          n.status === 'DOWN' ? 'border-rose-500/40 opacity-50' :
          n.role === 'LEADER' ? 'border-emerald-500/50' :
          n.role === 'CANDIDATE' ? 'border-amber-500/50' : 'border-slate-800'
        } flex items-center justify-between gap-2">
          <div>
            <span class="font-bold text-white">Node ${n.id}</span>
            <span class="ml-2 px-1.5 py-0.5 rounded text-[10px] ${
              n.status === 'DOWN' ? 'bg-rose-500/20 text-rose-300' :
              n.role === 'LEADER' ? 'bg-emerald-500/20 text-emerald-300' :
              n.role === 'CANDIDATE' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'
            }">${n.status === 'DOWN' ? 'CRASHED' : n.role}</span>
          </div>
          <div class="text-[11px] text-slate-400 truncate">[${n.log.slice(-3).join(', ')}]</div>
        </div>
      `).join('');
    }
  }

  document.getElementById('raft-append-btn')?.addEventListener('click', () => {
    let leader = nodes.find(n => n.role === 'LEADER' && n.status === 'UP');
    if (!leader) {
      term++;
      nodes.forEach(n => { n.status = 'UP'; n.role = 'FOLLOWER'; });
      nodes[1].role = 'LEADER';
      leader = nodes[1];
    }
    commitIdx++;
    const entry = `T${term}:CMD#${commitIdx}`;
    nodes.forEach(n => { if (n.status === 'UP') n.log.push(entry); });
    explainMsg = `Client sent command to Leader Node ${leader.id}. Replicated via AppendEntries RPC to quorum and committed at index #${commitIdx}!`;
    updateRaftUI();
  });

  document.getElementById('raft-kill-leader-btn')?.addEventListener('click', () => {
    const oldLeader = nodes.find(n => n.role === 'LEADER' && n.status === 'UP');
    if (oldLeader) {
      oldLeader.status = 'DOWN';
      oldLeader.role = 'FOLLOWER';
    }
    term++;
    const nextCandidate = nodes.find(n => n.status === 'UP') || nodes[0];
    nodes.forEach(n => { if (n.status === 'UP') n.role = 'FOLLOWER'; });
    nextCandidate.status = 'UP';
    nextCandidate.role = 'LEADER';
    explainMsg = `Leader crashed! Node ${nextCandidate.id}'s randomized election timer (172ms) expired first, incremented Term to #${term}, won RequestVote quorum (3/4), and became new Leader!`;
    updateRaftUI();
  });

  document.getElementById('raft-split-vote-btn')?.addEventListener('click', () => {
    term++;
    nodes.forEach(n => { n.status = 'UP'; n.role = 'FOLLOWER'; });
    nodes[0].role = 'CANDIDATE';
    nodes[2].role = 'CANDIDATE';
    nodes[4].status = 'DOWN';
    explainMsg = `Split Vote in Term #${term}! Node 5 is unreachable, and Node 1 & Node 3 timed out at the exact same microsecond (each winning 2 votes — short of 3-vote majority). Randomized election timeout [150..300ms] will break symmetry on next term.`;
    updateRaftUI();
  });

  const rCanvas = document.getElementById('raft-cluster-canvas');
  let rAnim = 0;
  function drawRaftCanvas() {
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

    rAnim += 0.04;
    const cx = w / 2;
    const cy = h / 2;
    const rad = Math.min(w, h) * 0.34;

    const coords = nodes.map((n, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      return { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, node: n };
    });

    const leaderCoord = coords.find(c => c.node.role === 'LEADER' && c.node.status === 'UP');
    if (leaderCoord) {
      coords.forEach(c => {
        if (c !== leaderCoord && c.node.status === 'UP') {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([5, 5]);
          ctx.lineDashOffset = -rAnim * 16;
          ctx.beginPath();
          ctx.moveTo(leaderCoord.x, leaderCoord.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    coords.forEach(c => {
      const n = c.node;
      ctx.fillStyle = n.status === 'DOWN' ? '#3f1d28' : n.role === 'LEADER' ? '#064e3b' : n.role === 'CANDIDATE' ? '#78350f' : '#0f172a';
      ctx.strokeStyle = n.status === 'DOWN' ? '#f43f5e' : n.role === 'LEADER' ? '#10b981' : n.role === 'CANDIDATE' ? '#f59e0b' : '#64748b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Node ${n.id}`, c.x, c.y - 4);
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = n.status === 'DOWN' ? '#fda4af' : '#a7f3d0';
      ctx.fillText(n.status === 'DOWN' ? 'DEAD' : n.role, c.x, c.y + 11);
    });

    ctx.restore();
    LifecycleManager.requestFrame(drawRaftCanvas);
  }

  updateRaftUI();
  LifecycleManager.requestFrame(drawRaftCanvas);
}
