// ============================================================================
// SECONDARY CATALOG 5: PAXOS CONSENSUS (/#paxos)
// Proposers, Acceptors, Learners, Phase 1 (Prepare/Promise) & Phase 2 (Accept/Accepted)
// ============================================================================
function renderPaxosView(container) {
  container.innerHTML = `
    <div class="glass-card rounded-2xl p-6 lg:p-8 border border-fuchsia-500/30">
      <div class="space-y-3 max-w-3xl">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 font-semibold">Consensus · Lamport Paxos</span>
          <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">2-Phase Quorum Intersection</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Paxos Consensus: Proposers, Acceptors &amp; Learners</h1>
        <p class="text-sm text-slate-300 leading-relaxed">
          Single-Decree Paxos reaches agreement across asynchronous nodes via a 2-phase protocol: <strong>Phase 1 (<code class="text-fuchsia-300">Prepare(n)</code> / <code class="text-fuchsia-300">Promise(n, v_a, n_a)</code>)</strong> fences out older ballot numbers and discovers any already-accepted value, while <strong>Phase 2 (<code class="text-emerald-300">Accept(n, v)</code> / <code class="text-emerald-300">Accepted</code>)</strong> commits the value on a majority of Acceptors.
        </p>
      </div>
    </div>

    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <h2 class="text-base font-bold text-white">Interactive 2-Phase Paxos Protocol Stepper</h2>
        <div class="flex flex-wrap gap-2">
          <button data-px="0" class="px-step-btn px-3 py-1.5 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400 text-white text-xs font-mono">Phase 1a: Prepare(n=10)</button>
          <button data-px="1" class="px-step-btn px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono">Phase 1b: Promise Quorum</button>
          <button data-px="2" class="px-step-btn px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono">Phase 2a: Accept(n=10, v)</button>
          <button data-px="3" class="px-step-btn px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono">Phase 2b: Chosen &amp; Learned</button>
          <button data-px="4" class="px-step-btn px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-mono">Dueling Proposers vs Multi-Paxos</button>
        </div>
      </div>
      <div id="paxos-stage-detail" class="p-5 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs text-slate-200 space-y-3"></div>
    </div>
  `;

  rehydrateIcons();

  const stages = [
    {
      title: 'Phase 1a: Proposer Sends Prepare(n = 10) to Majority of Acceptors',
      body: 'Proposer P1 picks a globally unique, monotonically increasing proposal number n=10 (e.g., round.nodeId) and sends Prepare(10) to Acceptors A1, A2, A3.',
      state: 'Acceptor A1, A2, A3 state: minProposal = 10 (Promises never to accept any proposal < 10)'
    },
    {
      title: 'Phase 1b: Acceptors Reply with Promise(n=10, maxAcceptedN=null, maxAcceptedV=null)',
      body: 'Because 10 > minProposal on A1, A2, and A3, each Acceptor updates minProposal=10 and returns any highest-numbered value it previously accepted. If any Acceptor returns an already-accepted value v_prev, P1 MUST propose v_prev in Phase 2!',
      state: 'Quorum (3/3) Promises received by Proposer P1. Value constrained to client value v = "LEADER_SHARD_3".'
    },
    {
      title: 'Phase 2a: Proposer Sends Accept(n = 10, v = "LEADER_SHARD_3")',
      body: 'Having locked ballot n=10 across a majority quorum in Phase 1, Proposer P1 broadcasts Accept(n=10, v="LEADER_SHARD_3") to all Acceptors.',
      state: 'Acceptors verify n (10) >= minProposal (10). If true, each persists acceptedProposal=10, acceptedValue="LEADER_SHARD_3" to disk.'
    },
    {
      title: 'Phase 2b: Majority Accepts -> Value is Durably Chosen & Broadcast to Learners',
      body: 'Once a majority of Acceptors (2 of 3) accept (n=10, v="LEADER_SHARD_3"), the value is immutable. Even if P1 crashes and P2 runs Prepare(n=20), Quorum Intersection guarantees P2 will read v="LEADER_SHARD_3" from at least one overlapping Acceptor!',
      state: 'CONSENSUS CHOSEN: Learners apply v = "LEADER_SHARD_3" to state machine.'
    },
    {
      title: 'Dueling Proposers Livelock & How Multi-Paxos Eliminates Phase 1 in Steady State',
      body: 'In Basic Paxos, two competing Proposers can endlessly preempt each other’s Prepare(n) before Phase 2a lands (Prepare(11) preempts Accept(10), Prepare(12) preempts Accept(11)). Multi-Paxos solves this by electing a stable Distinguished Leader who runs Phase 1 ONCE for the entire log stream, reducing steady-state writes to a single Phase 2a/2b roundtrip (1 RTT)!',
      state: 'Multi-Paxos Steady State = 1 RTT (Accept / Accepted only)'
    }
  ];

  function selectPaxosStage(idx) {
    const st = stages[idx];
    document.querySelectorAll('.px-step-btn').forEach((b, i) => {
      b.className = i === idx
        ? 'px-step-btn px-3 py-1.5 rounded-lg bg-fuchsia-500/25 border border-fuchsia-400 text-white text-xs font-mono font-bold'
        : 'px-step-btn px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono';
    });
    document.getElementById('paxos-stage-detail').innerHTML = `
      <div class="text-sm font-bold text-fuchsia-300">${st.title}</div>
      <p class="leading-relaxed text-slate-300">${st.body}</p>
      <div class="p-3 rounded-lg bg-slate-950 border border-fuchsia-500/30 text-emerald-300">${st.state}</div>
    `;
  }

  document.querySelectorAll('.px-step-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPaxosStage(parseInt(btn.getAttribute('data-px'), 10)));
  });
  selectPaxosStage(0);
}
