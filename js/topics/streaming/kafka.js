// ============================================================================
// SECONDARY CATALOG 6: APACHE KAFKA (/#kafka)
// Topic Partitions, Consumer Groups, Offsets, Zero-Copy sendfile() DMA

const KafkaMeta = {
  accent: 'orange',
  category: 'Streaming & Event Logs',
  title: 'Apache Kafka',
  tags: ['Partitioned append-only log', 'Pull-based consumers', 'ISR replication'],
  summary: 'A topic is a set of <strong>partitions</strong>; each partition is an ordered, replicated, append-only log with one leader broker. Producers append to the leader; followers in the <strong>in-sync replica set (ISR)</strong> copy it. Consumers pull and track their own <strong>offsets</strong>, so the same data can be replayed and read by many independent consumer groups. Throughput comes from sequential disk I/O, the OS page cache, batching, and <code>sendfile()</code> zero-copy.',
  constraints: [
    ['Ordering', 'Guaranteed only within a partition. Records with the same key go to the same partition.'],
    ['Consumer parallelism', 'Max one consumer per partition within a group. Extra consumers sit idle — partition count is your parallelism ceiling.'],
    ['Repartitioning', 'Adding partitions changes key → partition mapping and breaks per-key ordering for existing keys. Size partitions up front.'],
    ['Durability', 'Requires acks=all, replication.factor=3, min.insync.replicas=2. Defaults are weaker on older clients.'],
    ['Rebalances', 'Group membership changes pause consumption; use cooperative-sticky assignment and static membership to reduce impact.'],
    ['Zero-copy caveat', 'sendfile() is bypassed when TLS is terminated on the broker — encryption needs user-space copies and costs CPU.'],
    ['Queue semantics', 'No per-message ack, delay or priority; a slow message blocks its partition (head-of-line blocking).']
  ],
  useWhen: [
    'High-throughput event streams, CDC, log/metrics pipelines.',
    'Many independent consumers need the same data, or you need replay from history.',
    'Event sourcing / stream processing (Kafka Streams, Flink).'
  ],
  avoidWhen: [
    'You need a work queue with per-message retries, delays or priorities (use SQS, RabbitMQ).',
    'Low-volume workloads where operating brokers outweighs the benefit.',
    'Request/response RPC.'
  ]
};
// ============================================================================
function renderKafkaView(container) {
  container.innerHTML = `
    ${renderTopicIntro(KafkaMeta)}
    <div class="glass-card rounded-2xl px-5 py-3 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
      <span class="text-[11px] font-mono uppercase tracking-wider text-slate-400">Simulator controls</span>
      <div class="flex flex-wrap gap-2">
      <button id="kafka-add-consumer" class="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-mono font-bold">+ Add Consumer to Group</button>
      <button id="kafka-rem-consumer" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono">- Remove Consumer</button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <h2 class="text-base font-bold text-white">Interactive Consumer Group Partition Assignment (4 Partitions)</h2>
        <p class="text-xs text-slate-400">Add or remove consumers in <code class="text-orange-300">group.id = "payments-cg"</code> to see how the Group Coordinator rebalances partition ownership (max 1 consumer per partition within a group).</p>
        <div id="kafka-partition-map" class="space-y-2.5 font-mono text-xs"></div>
      </div>

      <div class="lg:col-span-5 glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <h2 class="text-base font-bold text-white">Linux <code class="text-emerald-300">sendfile()</code> Zero-Copy vs. Traditional Socket I/O</h2>
        <div class="space-y-3 text-xs font-mono">
          <div class="p-3.5 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-1">
            <div class="text-rose-300 font-bold">Traditional read() + write(): 4 Copies &amp; 4 Context Switches</div>
            <p class="text-slate-300 text-[11px]">Disk -> OS Pagecache -> JVM User-Space Heap -> Kernel Socket Buffer -> NIC Buffer (Pollutes CPU caches &amp; GC).</p>
          </div>
          <div class="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/40 space-y-1">
            <div class="text-emerald-300 font-bold">Kafka Zero-Copy (sendfile / FileChannel.transferTo):</div>
            <p class="text-slate-300 text-[11px]">OS Pagecache -> DMA directly to NIC Ring Buffer! <strong>0 JVM heap copies, 2 context switches</strong>. Only applies to plaintext listeners — with broker-side TLS, data must be copied to user space for encryption.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();
  let consumerCount = 2;

  function renderKafkaAssignment() {
    const partitions = [0, 1, 2, 3];
    const el = document.getElementById('kafka-partition-map');
    if (!el) return;
    el.innerHTML = partitions.map(p => {
      const ownerIdx = p % Math.min(4, consumerCount);
      const leo = 1420 + p * 85;
      const hw = leo - 2;
      return `
        <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span class="text-orange-400 font-bold">Topic "orders" · Partition #${p}</span>
            <div class="text-[11px] text-slate-400 mt-0.5">Committed Offset: ${hw - 4} | High Watermark (HW): ${hw} | LEO: ${leo}</div>
          </div>
          <span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
            Assigned -> Consumer-${ownerIdx + 1}
          </span>
        </div>
      `;
    }).join('') + (consumerCount > 4
      ? `<div class="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px]">⚠️ Consumers #5..#${consumerCount} are IDLE! A partition cannot be split across multiple consumers in the same Consumer Group.</div>`
      : '');
  }

  document.getElementById('kafka-add-consumer')?.addEventListener('click', () => {
    consumerCount = Math.min(6, consumerCount + 1);
    renderKafkaAssignment();
  });
  document.getElementById('kafka-rem-consumer')?.addEventListener('click', () => {
    consumerCount = Math.max(1, consumerCount - 1);
    renderKafkaAssignment();
  });
  renderKafkaAssignment();
}
