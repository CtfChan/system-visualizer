// ============================================================================
// SECONDARY CATALOG 6: APACHE KAFKA (/#kafka)
// Topic Partitions, Consumer Groups, Offsets, Zero-Copy sendfile() DMA
// ============================================================================
function renderKafkaView(container) {
  container.innerHTML = `
    <div class="glass-card rounded-2xl p-6 lg:p-8 border border-orange-500/30">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div class="space-y-3 max-w-3xl">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/40 font-semibold">Streaming &amp; Logs · Apache Kafka</span>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">Sequential Pagecache + Zero-Copy DMA</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Apache Kafka: Partition Logs, Consumer Rebalance &amp; Zero-Copy</h1>
          <p class="text-sm text-slate-300 leading-relaxed">
            Kafka achieves multi-GB/sec throughput per broker by treating topics as partitioned, append-only sequential log segments (<code class="text-orange-300">.log</code> + <code class="text-amber-300">.index</code>) and transferring bytes directly from the OS Pagecache to the NIC buffer via the Linux <strong><code class="text-emerald-300">sendfile()</code> Zero-Copy syscall</strong> without copying data into JVM user-space memory.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="kafka-add-consumer" class="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-mono font-bold">+ Add Consumer to Group</button>
          <button id="kafka-rem-consumer" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono">- Remove Consumer</button>
        </div>
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
            <p class="text-slate-300 text-[11px]">OS Pagecache -> DMA directly to NIC Ring Buffer! <strong>0 JVM heap copies, 2 context switches</strong>, enabling 10Gbps+ saturation regardless of JVM heap size.</p>
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
