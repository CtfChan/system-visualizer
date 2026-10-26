// ============================================================================
// PRIORITY 1.1: TEMPORAL ARCHITECTURE (DEFAULT VIEW /#temporal)
// ============================================================================

function temporalArchitectureSvg() {
  const m = 'arrow-temporal';
  const C = { client: '#94a3b8', server: '#38bdf8', infra: '#fbbf24', store: '#0284c7', worker: '#38bdf8', ext: '#34d399' };
  return `<svg viewBox="0 0 1000 400" class="w-full h-auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Temporal architecture diagram">
    ${Svg.defs(m)}
    ${Svg.group(190, 20, 430, 360, 'TEMPORAL SERVICE', C.server)}
    ${Svg.group(660, 20, 320, 360, 'YOUR INFRASTRUCTURE', C.infra)}

    ${Svg.box(20, 150, 130, 60, 'Client', 'SDK client / starter', C.client)}

    ${Svg.box(215, 60, 170, 58, 'Frontend', 'gRPC gateway · stateless', C.server)}
    ${Svg.box(425, 60, 170, 58, 'Matching', 'task queues', C.server)}
    ${Svg.box(215, 170, 170, 58, 'History', 'shards · event log owner', C.server)}
    ${Svg.box(425, 170, 170, 58, 'Visibility', 'list / search executions', C.server)}
    ${Svg.box(215, 290, 170, 58, 'Persistence', 'Cassandra · Postgres · MySQL', C.store)}
    ${Svg.box(425, 290, 170, 58, 'Visibility Store', 'Elasticsearch / SQL', C.store)}

    ${Svg.box(690, 60, 260, 58, 'Workflow Worker', 'deterministic code · replay', C.worker)}
    ${Svg.box(690, 170, 260, 58, 'Activity Worker', 'side effects · retries', C.worker)}
    ${Svg.box(690, 290, 260, 58, 'External Systems', 'APIs · databases · queues', C.ext)}

    ${Svg.arrow(m, 150, 175, 213, 100, '1 start', { lx: 170, ly: 128 })}
    ${Svg.arrow(m, 300, 118, 300, 168, '2 route to shard', { lx: 306, ly: 148, anchor: 'start' })}
    ${Svg.arrow(m, 300, 228, 300, 288, '3 append events', { lx: 306, ly: 262, anchor: 'start' })}
    ${Svg.arrow(m, 385, 185, 470, 120, '4 enqueue task', { lx: 432, ly: 150, anchor: 'start' })}
    ${Svg.arrow(m, 385, 212, 423, 212, '', { dashed: true })}
    ${Svg.arrow(m, 510, 228, 510, 288, 'async index', { lx: 516, ly: 262, anchor: 'start', dashed: true })}
    ${Svg.arrow(m, 690, 89, 597, 89, '5 poll / respond', { lx: 643, ly: 82, both: true })}
    ${Svg.arrow(m, 690, 195, 597, 108, 'poll activities', { lx: 652, ly: 140, both: true })}
    ${Svg.arrow(m, 820, 228, 820, 288, '6 side effects', { lx: 826, ly: 262, anchor: 'start' })}
  </svg>`;
}

const TemporalMeta = {
  accent: 'sky',
  category: 'Durable Execution',
  title: 'Temporal',
  tags: ['Event-sourced workflows', 'Worker long-polling', 'External persistence'],
  summary: 'Workflow orchestration platform. The Temporal service stores an append-only <strong>event history</strong> for every workflow execution. Your <strong>workers</strong> poll task queues, run workflow code until it blocks, and return <strong>commands</strong> (schedule activity, start timer). Side effects run as <strong>activities</strong> with server-managed retries. If a worker dies, another one replays the history through the same code to rebuild state — recorded activity results are reused, never re-executed.',
  diagram: {
    title: 'High-Level Architecture',
    svg: temporalArchitectureSvg(),
    steps: [
      'Client calls <code>StartWorkflowExecution</code> on the Frontend.',
      'Frontend hashes the workflow ID to a History shard and forwards the request.',
      'History atomically appends events, updates mutable state and writes outbox tasks in one DB transaction.',
      'Outbox (transfer) tasks put a workflow or activity task on a Matching task queue.',
      'Workers long-poll over outbound gRPC (via Frontend). Workflow workers return commands; History records them as events.',
      'Activity workers call external systems and report results. On crash, any worker replays history to resume.'
    ]
  },
  constraints: [
    ['Determinism', 'Workflow code must replay identically: no direct I/O, wall clock, randomness or native threads — use SDK APIs. Changing code with in-flight executions requires versioning (patching / worker versioning).'],
    ['History size', 'Hard limit 51,200 events or 50 MB per execution (warnings from 10,240 events / 10 MB). Long-lived or looping workflows must Continue-As-New.'],
    ['Payload size', '2 MB per payload. Pass references to large blobs, not the blobs.'],
    ['Per-step latency', 'Each workflow step is several internal hops plus a DB write — tens of ms. Not for hot synchronous request paths.'],
    ['History shards', 'numHistoryShards is fixed at cluster creation. Size it for future throughput; changing it means migrating.'],
    ['Operations', 'Self-hosting = 4 services + Cassandra/Postgres/MySQL + Elasticsearch for advanced visibility. Or use Temporal Cloud.'],
    ['Workers', 'Always-on processes polling task queues. Scale on schedule-to-start latency / backlog.']
  ],
  useWhen: [
    'Long-running business processes (minutes to months) with timers, retries and human approval steps.',
    'Sagas and compensation spanning many services and teams.',
    'Workers live in locked-down networks — they only need outbound connections.',
    'You need to list/search executions by status or custom attributes.'
  ],
  avoidWhen: [
    'Low-latency synchronous request paths.',
    'Simple background jobs where a queue with idempotent consumers is enough.',
    'Fully serverless stacks with no place to run an always-on poller fleet.',
    'Single workflows with unbounded fan-out (hits history limits — use child workflows).'
  ]
};
const TemporalData = {
  services: {
    frontend: {
      title: 'Frontend Service (Stateless gRPC Gateway)',
      badge: 'Port 7233 · Rate Limiting & Routing',
      color: 'indigo',
      summary: 'Stateless edge gateway handling all SDK gRPC traffic (StartWorkflowExecution, PollWorkflowTaskQueue, PollActivityTaskQueue, RespondWorkflowTaskCompleted). Performs namespace rate-limiting, authorization, and consistent-hash routing to History shards.',
      internals: [
        'Zero local state: horizontally scalable behind L7 gRPC load balancers.',
        'Computes History Shard ID via hash(NamespaceID + WorkflowID) % numHistoryShards.',
        'Routes PollWorkflowTaskQueue / PollActivityTaskQueue requests to Matching Service task queue partitions.',
        'Handles long-poll timeouts (typically 60s) from Worker SDK pollers.'
      ],
      protocolSnippet: `// Worker SDK -> Frontend Service gRPC
rpc RespondWorkflowTaskCompleted(
  workflowTaskToken: "0x8F2A..91B",
  commands: [
ScheduleActivityTaskCommandAttributes {
  activityId: "act-2-emit-shipment",
  activityType: "EmitShipmentActivity",
  taskQueue: "order-activities-tq"
}
  ]
)`
    },
    history: {
      title: 'History Service (Sharded State Machine & Event Log Owner)',
      badge: 'Sharded via Ringpop · Transactional MutableState',
      color: 'purple',
      summary: 'The brain of Temporal. Owns a fixed set of virtual History Shards (e.g., 4,096 shards). Serializes all state transitions for a Workflow Execution by transactionally updating MutableState and appending immutable History Events.',
      internals: [
        'RangeID Fencing: Acquires shard lock in persistence (Cassandra/PostgreSQL/MySQL/DynamoDB) to prevent split-brain shard writes.',
        'Single-row atomic transaction: Appends new Event batch + updates Workflow MutableState + enqueues Outbox Tasks (Transfer Queue & Timer Queue).',
        'Transfer Queue Processor pushes newly scheduled WorkflowTasks/ActivityTasks to the Matching Service.',
        'Timer Queue Processor fires durable sleep timers (TimerFired) and activity timeouts (ScheduleToStart, StartToClose, Heartbeat).'
      ],
      protocolSnippet: `// Atomic Persistence Transaction inside History Shard #142
BEGIN SHARD_TX (shard_id=142, range_id=89):
  INSERT INTO history_node (tree_id, branch_id, node_id, events_blob)
VALUES ('wf-ord-901', 'br-1', 8, [WorkflowTaskCompleted, ActivityTaskScheduled]);
  UPDATE executions SET mutable_state = { next_event_id: 10, status: RUNNING }
WHERE shard_id = 142 AND workflow_id = 'wf-ord-901';
  INSERT INTO transfer_tasks (task_type='ActivityTask', target_tq='order-activities-tq');
COMMIT;`
    },
    matching: {
      title: 'Matching Service (Task Queue Broker & Sync Match Engine)',
      badge: 'In-Memory Sync-Match · Partitioned Task Tree',
      color: 'emerald',
      summary: 'Manages Workflow Task Queues and Activity Task Queues. Optimizes latency by attempting an in-memory "Sync Match" directly handing a new task to a waiting long-polling Worker without touching disk.',
      internals: [
        'Sync Match Fast-Path: If a Worker poller is blocked waiting in memory when History pushes a task, the task bypasses DB persistence and dispatches in <2ms.',
        'Async Backlog Path: If all workers are busy, tasks are persisted to the Task Queue DB table and read into memory via a lookahead buffer.',
        'Sticky Workflow Task Queues: Routes subsequent WorkflowTasks to the exact Worker pod holding the cached in-memory workflow execution state to avoid full Event History replay on the happy path.',
        'Supports Task Queue Partitioning (Root + Child partitions) for high-throughput dispatch.'
      ],
      protocolSnippet: `// Matching Service Dispatch Logic
if (waitingPollers.isNotEmpty()) {
  // Fast Path: 0 DB writes on Task Queue table!
  pollerChannel.send(TaskDispatch { taskToken, workflowExecution, startedEventId });
  return SYNC_MATCHED;
} else {
  persistence.appendTaskToBacklog(taskQueueKey, task);
  return ASYNC_QUEUED;
}`
    },
    visibility: {
      title: 'Visibility Service (Search & Operational Indexing)',
      badge: 'OpenSearch / Elasticsearch / SQL Visibility',
      color: 'cyan',
      summary: 'Decouples operational fleet queries (ListWorkflowExecutions, Custom Search Attributes) from the transactional History shards so listing 50,000 workflows never degrades workflow state machine throughput.',
      internals: [
        'Consumes Visibility Tasks asynchronously from the History Service outbox queue.',
        'Indexes standard fields (WorkflowType, ExecutionStatus, StartTime, CloseTime) and strongly-typed Custom Search Attributes (e.g., CustomerTier="ENTERPRISE").',
        'Eventual consistency by design (~100ms–1s lag behind History shard commits).'
      ],
      protocolSnippet: `// Temporal CLI / UI Visibility Query
SELECT WorkflowId, RunId, ExecutionStatus, StartTime
FROMexecutions_visibility
WHERE NamespaceId = 'prod-payments'
  AND WorkflowType = 'OrderFulfillmentWorkflow'
  AND ExecutionStatus = 'Running'
  AND CustomStringField['CustomerRegion'] = 'us-east-1';`
    },
    worker: {
      title: 'Worker SDK Runtime (Deterministic Replay & Activity Executor)',
      badge: 'Customer VPC · Outbound gRPC Long-Polling Only',
      color: 'amber',
      summary: 'Runs inside your infrastructure. Hosts two distinct engines: (1) Deterministic Workflow Sandbox that steps through workflow code and emits Commands, and (2) Activity Worker Pool that executes arbitrary I/O side effects.',
      internals: [
        'Requires ZERO inbound firewall ports: Workers initiate outbound gRPC long-polls to Frontend Service.',
        'Workflow Sandbox: Intercepts time (workflow.now()), randomness, and async promises; compares emitted Commands against historical Events during replay.',
        'Sticky Cache: Caches live workflow coroutines in RAM (LRU); if evicted or worker crashes, fetches Event History from event #1 and replays in milliseconds.',
        'Deadlock Detector: Fails the WorkflowTask if workflow code blocks the thread for >1 second without yielding.'
      ],
      protocolSnippet: `// Worker SDK Command vs History Event Verification
for (const cmd of emittedCommandsInTurn) {
  const historicalEvent = historyIterator.nextCorrespondingCommandEvent();
  if (!cmd.matches(historicalEvent)) {
throw new NonDeterministicWorkflowError(
  \`Mismatch at Event #\${historicalEvent.id}: expected \${historicalEvent.type}, got \${cmd.type}\`
);
  }
}`
    }
  },

  replaySteps: [
    {
      step: 0,
      phase: 'NORMAL_EXECUTION',
      workerInstance: 'Worker-Pod-A (PID 4102)',
      title: 'Client Starts Workflow Execution',
      eventId: 1,
      eventType: 'WorkflowExecutionStarted',
      sdkMode: 'LIVE EXECUTION',
      description: 'Client invokes StartWorkflowExecution(OrderWorkflow, {orderId: "ORD-901", amount: 240.00}). History Service appends Event #1 (WorkflowExecutionStarted) and Event #2 (WorkflowTaskScheduled).',
      memoryState: { orderId: '"ORD-901"', amount: 240.00, reserveResult: 'pending', chargeResult: 'unscheduled', shipmentId: 'unscheduled', pcLine: 'Line 2: await activities.reserveInventory()' },
      activityNetworkCall: 'NONE (Workflow scheduled in Matching Queue)',
      codeHighlightLine: 2
    },
    {
      step: 1,
      phase: 'NORMAL_EXECUTION',
      workerInstance: 'Worker-Pod-A (PID 4102)',
      title: 'First Workflow Task & Activity #1 Scheduled',
      eventId: 5,
      eventType: 'ActivityTaskScheduled [ReserveInventory]',
      sdkMode: 'LIVE EXECUTION',
      description: 'Worker-Pod-A picks up WorkflowTask (#3), runs workflow up to first await activities.reserveInventory(), and emits ScheduleActivityTask command (#4 WorkflowTaskCompleted, #5 ActivityTaskScheduled).',
      memoryState: { orderId: '"ORD-901"', amount: 240.00, reserveResult: 'awaiting Event #7', chargeResult: 'unscheduled', shipmentId: 'unscheduled', pcLine: 'Line 2 (Suspended on Promise)' },
      activityNetworkCall: 'POST https://inventory.internal/reserve -> 200 OK {resId: "INV-88"}',
      codeHighlightLine: 3
    },
    {
      step: 2,
      phase: 'NORMAL_EXECUTION',
      workerInstance: 'Worker-Pod-A (PID 4102)',
      title: 'Activity #1 Completes & Activity #2 (ChargeCard) Completes',
      eventId: 13,
      eventType: 'ActivityTaskCompleted [ChargeCard]',
      sdkMode: 'LIVE EXECUTION (Sticky Cache Hit)',
      description: 'ReserveInventory completes (#6, #7). Worker-Pod-A advances to ChargeCard (#8..#13). Stripe charges $240.00 and returns {txId: "ch_9921"}. Event #13 (ActivityTaskCompleted) is durably committed to History DB!',
      memoryState: { orderId: '"ORD-901"', amount: 240.00, reserveResult: '{resId: "INV-88"}', chargeResult: '{txId: "ch_9921"}', shipmentId: 'unscheduled', pcLine: 'Line 5: ChargeCard resolved' },
      activityNetworkCall: 'POST https://api.stripe.com/v1/charges ($240) -> 200 OK {txId: "ch_9921"}',
      codeHighlightLine: 5
    },
    {
      step: 3,
      phase: 'CRASH_EVENT',
      workerInstance: 'Worker-Pod-A (KILLED - SIGKILL / OOM)',
      title: '💥 WORKER CRASH MID-WORKFLOW!',
      eventId: 14,
      eventType: 'WorkflowTaskTimedOut (Sticky Queue Evicted)',
      sdkMode: 'PROCESS TERMINATED',
      description: 'Worker-Pod-A crashes due to node OOM right before scheduling EmitShipment! All in-memory local variables (reserveResult, chargeResult) on Pod-A are wiped. Sticky task times out after 5s and falls back to the normal Task Queue.',
      memoryState: { orderId: 'LOST IN RAM', amount: 'LOST IN RAM', reserveResult: 'LOST IN RAM', chargeResult: 'LOST IN RAM', shipmentId: 'LOST IN RAM', pcLine: 'HEAP DESTROYED (SIGKILL)' },
      activityNetworkCall: 'NONE (Worker-Pod-A dead; History Service transfers task to Worker-Pod-B)',
      codeHighlightLine: 0
    },
    {
      step: 4,
      phase: 'REPLAY_RECOVERY',
      workerInstance: 'Worker-Pod-B (Cold Standby PID 8810)',
      title: 'Replay Step 1: Re-entering Workflow from Line 1',
      eventId: 1,
      eventType: 'REPLAYING Event #1 [WorkflowExecutionStarted]',
      sdkMode: 'REPLAYING (replaying=true)',
      description: 'Worker-Pod-B polls the task and downloads Events #1..#15 from History Service. It invokes OrderWorkflow() from Line 1 with the original input payload from Event #1.',
      memoryState: { orderId: '"ORD-901" (Restored)', amount: 240.00, reserveResult: 'reconstructing...', chargeResult: 'reconstructing...', shipmentId: 'unscheduled', pcLine: 'Line 1 -> Line 2 (Replay Engine)' },
      activityNetworkCall: 'ZERO NETWORK CALLS (Reading local Event History stream)',
      codeHighlightLine: 1
    },
    {
      step: 5,
      phase: 'REPLAY_RECOVERY',
      workerInstance: 'Worker-Pod-B (Cold Standby PID 8810)',
      title: 'Replay Step 2: Skipping Completed Activity #1 (ReserveInventory)',
      eventId: 7,
      eventType: 'REPLAY MATCH: Event #5 & #7 [ReserveInventory]',
      sdkMode: 'REPLAYING (Side-Effects Suppressed)',
      description: 'Workflow code calls await activities.reserveInventory(). SDK sees Event #5 (ActivityTaskScheduled) matches the command, and immediately resolves the promise using Event #7 payload {resId: "INV-88"} in ~0.02ms!',
      memoryState: { orderId: '"ORD-901"', amount: 240.00, reserveResult: '{resId: "INV-88"} (From Event #7)', chargeResult: 'reconstructing...', shipmentId: 'unscheduled', pcLine: 'Line 3 resolved via Event #7' },
      activityNetworkCall: 'SKIPPED! Inventory service is NOT called again.',
      codeHighlightLine: 3
    },
    {
      step: 6,
      phase: 'REPLAY_RECOVERY',
      workerInstance: 'Worker-Pod-B (Cold Standby PID 8810)',
      title: 'Replay Step 3: Skipping Completed Activity #2 (ChargeCard)',
      eventId: 13,
      eventType: 'REPLAY MATCH: Event #11 & #13 [ChargeCard]',
      sdkMode: 'REPLAYING (Side-Effects Suppressed)',
      description: 'Workflow code calls await activities.chargeCard(). SDK verifies determinism against Event #11 and resolves immediately from Event #13 ({txId: "ch_9921"}). Customer card is NEVER double-charged!',
      memoryState: { orderId: '"ORD-901"', amount: 240.00, reserveResult: '{resId: "INV-88"}', chargeResult: '{txId: "ch_9921"} (From Event #13)', shipmentId: 'ready to schedule', pcLine: 'Line 5 resolved via Event #13' },
      activityNetworkCall: 'SKIPPED! Stripe API is NOT called again (Idempotent Replay).',
      codeHighlightLine: 5
    },
    {
      step: 7,
      phase: 'NORMAL_EXECUTION',
      workerInstance: 'Worker-Pod-B (Cold Standby PID 8810)',
      title: 'Replay Caught Up -> Emitting New Command (EmitShipment)',
      eventId: 17,
      eventType: 'ActivityTaskScheduled [EmitShipment] -> WorkflowExecutionCompleted',
      sdkMode: 'LIVE EXECUTION RESUMED (replaying=false)',
      description: 'Worker-Pod-B reaches Line 7: await activities.emitShipment(). History cursor is at the end of the log (#15), so SDK switches replaying=false and emits a brand new ScheduleActivityTask(EmitShipment) command!',
      memoryState: { orderId: '"ORD-901"', amount: 240.00, reserveResult: '{resId: "INV-88"}', chargeResult: '{txId: "ch_9921"}', shipmentId: '{track: "1Z999AA1"}', pcLine: 'Line 8: return { status: "COMPLETED" }' },
      activityNetworkCall: 'POST https://shipping.internal/dispatch -> 200 OK {track: "1Z999AA1"}',
      codeHighlightLine: 7
    }
  ],

  fullEventLog: [
    { id: 1, type: 'WorkflowExecutionStarted', cat: 'workflow', detail: 'input: {orderId:"ORD-901", amount:240}' },
    { id: 2, type: 'WorkflowTaskScheduled', cat: 'task', detail: 'taskQueue: "order-wf-tq", attempt: 1' },
    { id: 3, type: 'WorkflowTaskStarted', cat: 'task', detail: 'identity: "Worker-Pod-A@4102"' },
    { id: 4, type: 'WorkflowTaskCompleted', cat: 'task', detail: 'commands: [ScheduleActivity(ReserveInventory)]' },
    { id: 5, type: 'ActivityTaskScheduled', cat: 'activity', detail: 'activityId: "1", type: "ReserveInventory"' },
    { id: 6, type: 'ActivityTaskStarted', cat: 'activity', detail: 'identity: "ActWorker-1"' },
    { id: 7, type: 'ActivityTaskCompleted', cat: 'activity', detail: 'result: {resId: "INV-88"}' },
    { id: 8, type: 'WorkflowTaskScheduled', cat: 'task', detail: 'taskQueue: "Worker-Pod-A:sticky"' },
    { id: 9, type: 'WorkflowTaskStarted', cat: 'task', detail: 'identity: "Worker-Pod-A@4102"' },
    { id: 10, type: 'WorkflowTaskCompleted', cat: 'task', detail: 'commands: [ScheduleActivity(ChargeCard)]' },
    { id: 11, type: 'ActivityTaskScheduled', cat: 'activity', detail: 'activityId: "2", type: "ChargeCard"' },
    { id: 12, type: 'ActivityTaskStarted', cat: 'activity', detail: 'identity: "ActWorker-2"' },
    { id: 13, type: 'ActivityTaskCompleted', cat: 'activity', detail: 'result: {txId: "ch_9921"}' },
    { id: 14, type: 'WorkflowTaskScheduled', cat: 'crash', detail: 'Sticky timeout -> normal queue fallback' },
    { id: 15, type: 'WorkflowTaskStarted', cat: 'replay', detail: 'identity: "Worker-Pod-B@8810" (REPLAY)' },
    { id: 16, type: 'WorkflowTaskCompleted', cat: 'task', detail: 'commands: [ScheduleActivity(EmitShipment)]' },
    { id: 17, type: 'ActivityTaskScheduled', cat: 'activity', detail: 'activityId: "3", type: "EmitShipment"' },
    { id: 18, type: 'ActivityTaskCompleted', cat: 'activity', detail: 'result: {track: "1Z999AA1"}' },
    { id: 19, type: 'WorkflowExecutionCompleted', cat: 'workflow', detail: 'result: {status: "FULFILLED"}' }
  ]
};

function renderTemporalView(container) {
  container.innerHTML = `
    ${renderTopicIntro(TemporalMeta)}

    <!-- SECTION 1: INTERACTIVE WORKER CRASH & REPLAY SIMULATOR -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <i data-lucide="play-circle" class="w-5 h-5 text-sky-400"></i>
            <h2 class="text-lg font-bold text-white">Interactive Replay Simulator: Event History Log vs. Worker State Machine</h2>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Simulate a mid-workflow worker crash after charging a credit card, or inject a non-deterministic code change to watch how the SDK Replay Engine validates Commands against the immutable Event Log.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button id="temp-prev-btn" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 border border-slate-700">
            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i> Prev
          </button>
          <button id="temp-next-btn" class="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-semibold flex items-center gap-1 shadow-lg shadow-sky-600/20">
            Step Forward <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
          <button id="temp-crash-btn" class="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono flex items-center gap-1.5">
            <i data-lucide="skull" class="w-3.5 h-3.5"></i> Simulate Mid-Workflow Crash
          </button>
          <button id="temp-nondet-btn" class="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-mono flex items-center gap-1.5">
            <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> <span id="temp-nondet-label">Inject Non-Deterministic Bug: OFF</span>
          </button>
          <button id="temp-auto-btn" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-mono flex items-center gap-1">
            <i data-lucide="repeat" class="w-3.5 h-3.5"></i> <span id="temp-auto-label">Auto-Play</span>
          </button>
        </div>
      </div>

      <!-- Progress Timeline Stepper -->
      <div class="grid grid-cols-4 sm:grid-cols-8 gap-1.5" id="temp-step-indicators"></div>

      <!-- Live Animated Architecture Canvas for Replay Flow -->
      <div class="rounded-xl bg-slate-950 border border-slate-800/90 p-3 relative">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2 px-2">
          <div class="flex items-center gap-2 text-xs font-mono">
            <span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30" id="temp-sim-badge">STEP 0 / 7</span>
            <span class="text-white font-semibold" id="temp-sim-title">Client Starts Workflow Execution</span>
          </div>
          <div class="flex items-center gap-3 text-[11px] font-mono">
            <span class="text-slate-400">Active Worker: <strong id="temp-sim-worker" class="text-emerald-300">Worker-Pod-A</strong></span>
            <span class="text-slate-400">SDK Mode: <strong id="temp-sim-mode" class="text-sky-300">LIVE EXECUTION</strong></span>
          </div>
        </div>
        <canvas id="temporal-replay-canvas" class="w-full h-[230px] rounded-lg bg-slate-950 block"></canvas>
        <div id="temp-sim-desc" class="mt-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono"></div>
      </div>

      <!-- 3-Column Deep State Inspection: Workflow Code & PC | Worker Memory & Command Machine | Persisted Event History Log -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Col 1: Workflow Deterministic Code & Instruction Pointer -->
        <div class="lg:col-span-4 rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-mono uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1.5">
                <i data-lucide="code-2" class="w-4 h-4"></i> Workflow Definition (V8 Sandbox)
              </span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300" id="temp-code-version-badge">Deterministic v1</span>
            </div>
            <div id="temp-workflow-code" class="code-block space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800/80 overflow-x-auto"></div>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
            <div class="text-[11px] font-mono text-slate-400">External Activity Side-Effect I/O:</div>
            <div id="temp-activity-io-box" class="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30 text-xs font-mono text-emerald-300"></div>
          </div>
        </div>

        <!-- Col 2: Worker Memory State & SDK Command Generator -->
        <div class="lg:col-span-4 rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between space-y-4">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                <i data-lucide="cpu" class="w-4 h-4"></i> Worker RAM State Machine
              </span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Ephemeral Heap</span>
            </div>
            <div id="temp-memory-table" class="space-y-2 font-mono text-xs"></div>
          </div>

          <!-- Determinism Validator Status -->
          <div id="temp-determinism-panel" class="p-3 rounded-xl bg-slate-950 border border-sky-500/30 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-mono font-bold text-sky-300 flex items-center gap-1.5">
                <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Command-to-Event Matcher
              </span>
              <span id="temp-det-status-pill" class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">VALIDATED</span>
            </div>
            <p id="temp-det-detail" class="text-[11px] font-mono text-slate-400 leading-relaxed">
              SDK compares each outbound Workflow Command against its corresponding History Event ID during replay.
            </p>
          </div>
        </div>

        <!-- Col 3: Immutable Event History Log in History Service -->
        <div class="lg:col-span-4 rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
              <i data-lucide="scroll-text" class="w-4 h-4"></i> History Service Event Log
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">Shard #142 · Durable</span>
          </div>
          <div id="temp-event-log-list" class="space-y-1.5 max-h-[290px] overflow-y-auto pr-1 font-mono text-[11px]"></div>
        </div>
      </div>
    </div>

    <!-- SECTION 2: INTERACTIVE BREAKDOWN OF TEMPORAL CORE SERVICES & RETRY ENGINE -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left 7 Cols: Interactive Subsystem Explorer -->
      <div class="lg:col-span-7 glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="layers" class="w-4 h-4 text-sky-400"></i>
              Temporal Server Subsystem Deep-Dive
            </h3>
            <p class="text-xs text-slate-400">Select any internal service to inspect its sharding, persistence protocol, and failure modes.</p>
          </div>
        </div>

        <!-- Interactive Component Buttons -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2" id="temp-service-tabs">
          <button data-service="history" class="temp-svc-btn p-2.5 rounded-xl border text-left transition-all bg-sky-500/20 border-sky-500 text-white">
            <div class="text-xs font-bold">History Svc</div>
            <div class="text-[10px] text-slate-400 font-mono">MutableState</div>
          </button>
          <button data-service="matching" class="temp-svc-btn p-2.5 rounded-xl border text-left transition-all bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700">
            <div class="text-xs font-bold">Matching Svc</div>
            <div class="text-[10px] text-slate-400 font-mono">Task Queues</div>
          </button>
          <button data-service="frontend" class="temp-svc-btn p-2.5 rounded-xl border text-left transition-all bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700">
            <div class="text-xs font-bold">Frontend Svc</div>
            <div class="text-[10px] text-slate-400 font-mono">gRPC Router</div>
          </button>
          <button data-service="visibility" class="temp-svc-btn p-2.5 rounded-xl border text-left transition-all bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700">
            <div class="text-xs font-bold">Visibility Svc</div>
            <div class="text-[10px] text-slate-400 font-mono">Search Index</div>
          </button>
          <button data-service="worker" class="temp-svc-btn p-2.5 rounded-xl border text-left transition-all bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700">
            <div class="text-xs font-bold">Worker SDK</div>
            <div class="text-[10px] text-slate-400 font-mono">Replay + Poll</div>
          </button>
        </div>

        <!-- Selected Service Dossier Content -->
        <div id="temp-service-detail-panel" class="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4"></div>
      </div>

      <!-- Right 5 Cols: Activity Retry Policy & Backoff Simulator + Telemetry Chart -->
      <div class="lg:col-span-5 glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-5">
        <div class="space-y-4">
          <div class="border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="refresh-cw" class="w-4 h-4 text-amber-400"></i>
              Activity Retry Loop &amp; Heartbeat Simulator
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">
              Unlike Workflow Tasks, Activity retries are managed entirely by the History Service Timer Queue in MutableState without appending <code class="text-amber-300">ActivityTaskScheduled</code> events on every failed attempt!
            </p>
          </div>

          <!-- Sliders for Retry Policy -->
          <div class="grid grid-cols-3 gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div>
              <label class="text-[10px] font-mono text-slate-400 block">Initial Interval</label>
              <input id="temp-retry-init" type="range" min="1" max="10" value="2" class="w-full accent-sky-500 mt-1" />
              <span id="temp-retry-init-val" class="font-mono text-sky-300 font-bold">2s</span>
            </div>
            <div>
              <label class="text-[10px] font-mono text-slate-400 block">Backoff Coeff</label>
              <input id="temp-retry-coeff" type="range" min="1.5" max="4.0" step="0.5" value="2.0" class="w-full accent-amber-500 mt-1" />
              <span id="temp-retry-coeff-val" class="font-mono text-amber-300 font-bold">2.0x</span>
            </div>
            <div>
              <label class="text-[10px] font-mono text-slate-400 block">Max Attempts</label>
              <input id="temp-retry-max" type="range" min="3" max="7" value="5" class="w-full accent-emerald-500 mt-1" />
              <span id="temp-retry-max-val" class="font-mono text-emerald-300 font-bold">5 tries</span>
            </div>
          </div>

          <!-- Chart.js Retry Schedule & Latency Telemetry -->
          <div class="h-48 bg-slate-950 rounded-xl p-3 border border-slate-800">
            <canvas id="temp-retry-chart"></canvas>
          </div>

          <!-- Key Architectural Insight Box -->
          <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-slate-300 space-y-1">
            <div class="font-bold text-amber-300 font-mono flex items-center gap-1.5">
              <i data-lucide="info" class="w-3.5 h-3.5"></i> Why Activity Retries Don't Bloat the Event Log
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              When an Activity fails 50 times before succeeding, Temporal updates <code class="text-amber-200">attempt=50</code> and <code class="text-amber-200">last_failure</code> in the History Shard's <code class="text-amber-200">MutableState</code> table and only writes <code class="text-emerald-300">ActivityTaskStarted</code> + <code class="text-emerald-300">ActivityTaskCompleted</code> to the Event Log once it succeeds or exhausts <code class="text-rose-300">MaximumAttempts</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();

  // State for Temporal Replay Simulator
  let currentStepIdx = 0;
  let nonDetBugEnabled = false;
  let autoPlayTimer = null;

  const workflowLinesClean = [
    '1: export async function OrderWorkflow(order) {',
    '2:   // Step 1: Reserve Inventory via Activity',
    '3:   const res = await activities.reserveInventory(order);',
    '4:   // Step 2: Charge Customer Card via Stripe',
    '5:   const tx  = await activities.chargeCard(order, res);',
    '6:   // Step 3: Dispatch Warehouse Shipment',
    '7:   const shp = await activities.emitShipment(order, tx);',
    '8:   return { status: "FULFILLED", shp };',
    '9: }'
  ];

  const workflowLinesBuggy = [
    '1: export async function OrderWorkflow(order) {',
    '2:   // BUG INJECTED: Added SendPromoEmail BEFORE ReserveInventory!',
    '3:   await activities.sendPromoEmail(order); // <-- NON-DETERMINISTIC!',
    '4:   const res = await activities.reserveInventory(order);',
    '5:   const tx  = await activities.chargeCard(order, res);',
    '6:   const shp = await activities.emitShipment(order, tx);',
    '7:   return { status: "FULFILLED", shp };',
    '8: }'
  ];

  function renderStepIndicators() {
    const indContainer = document.getElementById('temp-step-indicators');
    if (!indContainer) return;
    indContainer.innerHTML = TemporalData.replaySteps.map((s, idx) => {
      const isCurrent = idx === currentStepIdx;
      const isCrash = s.phase === 'CRASH_EVENT';
      const isReplay = s.phase === 'REPLAY_RECOVERY';
      let bg = 'bg-slate-900 border-slate-800 text-slate-400';
      if (isCurrent) {
        bg = isCrash ? 'bg-rose-500/25 border-rose-500 text-rose-200 font-bold' :
             isReplay ? 'bg-amber-500/25 border-amber-500 text-amber-200 font-bold' :
             'bg-sky-500/25 border-sky-500 text-sky-200 font-bold';
      } else if (idx < currentStepIdx) {
        bg = 'bg-slate-900/90 border-sky-500/40 text-sky-300';
      }
      return `
        <button data-step-idx="${idx}" class="temp-step-Jump p-2 rounded-lg border text-left transition-all ${bg}">
          <div class="text-[10px] font-mono uppercase">Step ${idx}</div>
          <div class="text-[11px] truncate">${isCrash ? '💥 Crash' : isReplay ? '↺ Replay' : '▶ Exec'}</div>
        </button>
      `;
    }).join('');

    indContainer.querySelectorAll('.temp-step-Jump').forEach(btn => {
      btn.addEventListener('click', () => {
        currentStepIdx = parseInt(btn.getAttribute('data-step-idx'), 10);
        updateReplayUI();
      });
    });
  }

  function updateReplayUI() {
    renderStepIndicators();
    const stepObj = TemporalData.replaySteps[currentStepIdx];
    const badgeEl = document.getElementById('temp-sim-badge');
    const titleEl = document.getElementById('temp-sim-title');
    const workerEl = document.getElementById('temp-sim-worker');
    const modeEl = document.getElementById('temp-sim-mode');
    const descEl = document.getElementById('temp-sim-desc');
    const codeContainer = document.getElementById('temp-workflow-code');
    const codeVerBadge = document.getElementById('temp-code-version-badge');
    const ioBox = document.getElementById('temp-activity-io-box');
    const memTable = document.getElementById('temp-memory-table');
    const detPanel = document.getElementById('temp-determinism-panel');
    const detStatus = document.getElementById('temp-det-status-pill');
    const detDetail = document.getElementById('temp-det-detail');
    const logList = document.getElementById('temp-event-log-list');

    const isNonDetFailure = nonDetBugEnabled && currentStepIdx >= 5;

    if (badgeEl) badgeEl.textContent = `STEP ${currentStepIdx} / ${TemporalData.replaySteps.length - 1}`;
    if (titleEl) {
      titleEl.textContent = isNonDetFailure
        ? '🚨 WorkflowTaskFailed: NonDeterministicWorkflowError!'
        : stepObj.title;
    }
    if (workerEl) {
      workerEl.textContent = stepObj.workerInstance;
      workerEl.className = stepObj.phase === 'CRASH_EVENT' ? 'text-rose-400' : 'text-emerald-300';
    }
    if (modeEl) {
      modeEl.textContent = isNonDetFailure ? 'PANIC: HISTORY MISMATCH' : stepObj.sdkMode;
      modeEl.className = isNonDetFailure ? 'text-rose-400' :
                          stepObj.phase === 'REPLAY_RECOVERY' ? 'text-amber-300' :
                          stepObj.phase === 'CRASH_EVENT' ? 'text-rose-400' : 'text-sky-300';
    }
    if (descEl) {
      descEl.innerHTML = isNonDetFailure
        ? `<span class="text-rose-400 font-bold">[NON-DETERMINISTIC ERROR DETECTED AT EVENT #5]</span> Worker-Pod-B executed hot-deployed code that emitted <code class="text-amber-300">ScheduleActivityTask(SendPromoEmail)</code> as its first command, but the persisted History Log has <code class="text-cyan-300">Event #5: ActivityTaskScheduled(ReserveInventory)</code>! Temporal halts the WorkflowTask and preserves state until code is rolled back or patched with <code class="text-emerald-300">workflow.patched()</code>.`
        : stepObj.description;
    }

    // Render Workflow Code with active line highlight
    const lines = nonDetBugEnabled ? workflowLinesBuggy : workflowLinesClean;
    if (codeVerBadge) {
      codeVerBadge.textContent = nonDetBugEnabled ? 'Mutated Code (Buggy)' : 'Deterministic v1';
      codeVerBadge.className = nonDetBugEnabled
        ? 'text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40'
        : 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300';
    }
    if (codeContainer) {
      codeContainer.innerHTML = lines.map((line, i) => {
        const lineNum = i + 1;
        const active = isNonDetFailure ? (lineNum === 3) : (lineNum === stepObj.codeHighlightLine);
        return `<div class="px-2 py-0.5 rounded ${active ? (isNonDetFailure ? 'bg-rose-500/30 text-white border-l-2 border-rose-400 font-bold' : 'bg-sky-500/25 text-white border-l-2 border-indigo-400 font-semibold') : 'text-slate-400'}">${line}</div>`;
      }).join('');
    }

    if (ioBox) {
      ioBox.textContent = isNonDetFailure
        ? 'BLOCKED: Replay Engine aborted before dispatching any network I/O.'
        : stepObj.activityNetworkCall;
      ioBox.className = `p-2.5 rounded-lg bg-slate-950 border text-xs font-mono ${
        stepObj.phase === 'REPLAY_RECOVERY' ? 'border-amber-500/40 text-amber-300' :
        stepObj.phase === 'CRASH_EVENT' || isNonDetFailure ? 'border-rose-500/40 text-rose-300' :
        'border-emerald-500/30 text-emerald-300'
      }`;
    }

    // Render Worker RAM State
    if (memTable) {
      const m = stepObj.memoryState;
      const entries = [
        ['orderId', m.orderId],
        ['reserveResult', isNonDetFailure ? 'ABORTED (Mismatch)' : m.reserveResult],
        ['chargeResult', isNonDetFailure ? 'ABORTED (Mismatch)' : m.chargeResult],
        ['shipmentId', m.shipmentId],
        ['Program Counter', isNonDetFailure ? 'Line 3 (Exception Thrown)' : m.pcLine]
      ];
      memTable.innerHTML = entries.map(([k, v]) => `
        <div class="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800/80">
          <span class="text-slate-400">${k}:</span>
          <span class="${stepObj.phase === 'CRASH_EVENT' || isNonDetFailure ? 'text-rose-400 font-bold' : 'text-emerald-300'}">${v}</span>
        </div>
      `).join('');
    }

    // Determinism panel
    if (detPanel && detStatus && detDetail) {
      if (isNonDetFailure) {
        detPanel.className = 'p-3 rounded-xl bg-rose-950/30 border border-rose-500/50 space-y-1.5';
        detStatus.textContent = 'MISMATCH AT EVENT #5';
        detStatus.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 font-bold';
        detDetail.textContent = 'Command [ScheduleActivity: SendPromoEmail] != History Event #5 [ActivityTaskScheduled: ReserveInventory]. Use workflow.patched("promo-v2") for safe versioning.';
      } else if (stepObj.phase === 'REPLAY_RECOVERY') {
        detPanel.className = 'p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-1.5';
        detStatus.textContent = `REPLAYING <= EVENT #${stepObj.eventId}`;
        detStatus.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold';
        detDetail.textContent = `Command matched Event #${stepObj.eventId}. Resolved stored result from log in 0.02ms without re-running external Activity.`;
      } else {
        detPanel.className = 'p-3 rounded-xl bg-slate-950 border border-sky-500/30 space-y-1.5';
        detStatus.textContent = 'DETERMINISTIC OK';
        detStatus.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300';
        detDetail.textContent = 'Emitted commands match Event History log sequence.';
      }
    }

    // Render Event Log
    if (logList) {
      const maxEventId = stepObj.eventId === 1 && currentStepIdx === 4 ? 15 : (currentStepIdx === 7 ? 19 : stepObj.eventId);
      logList.innerHTML = TemporalData.fullEventLog.map(ev => {
        const visible = ev.id <= maxEventId || (currentStepIdx >= 4 && ev.id <= 15);
        const isReplayCursor = currentStepIdx >= 4 && currentStepIdx <= 6 && ev.id === stepObj.eventId;
        return `
          <div class="px-2.5 py-1.5 rounded border transition-all flex items-start justify-between gap-2 ${
            !visible ? 'opacity-25 bg-slate-950 border-slate-900' :
            isReplayCursor ? 'bg-amber-500/20 border-amber-400 text-white' :
            ev.cat === 'activity' ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200' :
            ev.cat === 'crash' ? 'bg-rose-950/30 border-rose-500/40 text-rose-200' :
            'bg-slate-950 border-slate-800 text-slate-300'
          }">
            <div>
              <span class="text-slate-500 mr-1">#${ev.id}</span>
              <span class="font-semibold">${ev.type}</span>
              <div class="text-[10px] text-slate-400">${ev.detail}</div>
            </div>
            ${isReplayCursor ? '<span class="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[9px]">REPLAY CURSOR</span>' : ''}
          </div>
        `;
      }).join('');
    }
  }

  // Wire Replay Simulator Buttons
  document.getElementById('temp-prev-btn')?.addEventListener('click', () => {
    currentStepIdx = (currentStepIdx - 1 + TemporalData.replaySteps.length) % TemporalData.replaySteps.length;
    updateReplayUI();
  });
  document.getElementById('temp-next-btn')?.addEventListener('click', () => {
    currentStepIdx = (currentStepIdx + 1) % TemporalData.replaySteps.length;
    updateReplayUI();
  });
  document.getElementById('temp-crash-btn')?.addEventListener('click', () => {
    currentStepIdx = 3; // Jump directly to crash & step into recovery
    updateReplayUI();
  });
  document.getElementById('temp-nondet-btn')?.addEventListener('click', () => {
    nonDetBugEnabled = !nonDetBugEnabled;
    const lbl = document.getElementById('temp-nondet-label');
    if (lbl) lbl.textContent = `Inject Non-Deterministic Bug: ${nonDetBugEnabled ? 'ON' : 'OFF'}`;
    if (nonDetBugEnabled && currentStepIdx < 5) currentStepIdx = 5;
    updateReplayUI();
  });
  document.getElementById('temp-auto-btn')?.addEventListener('click', () => {
    const lbl = document.getElementById('temp-auto-label');
    if (autoPlayTimer) {
      window.clearInterval(autoPlayTimer);
      LifecycleManager.intervals.delete(autoPlayTimer);
      autoPlayTimer = null;
      if (lbl) lbl.textContent = 'Auto-Play';
    } else {
      if (lbl) lbl.textContent = 'Pause';
      autoPlayTimer = LifecycleManager.setInterval(() => {
        currentStepIdx = (currentStepIdx + 1) % TemporalData.replaySteps.length;
        updateReplayUI();
      }, 2400);
    }
  });

  // Render Subsystem Explorer Dossier
  function selectTemporalService(key) {
    const svc = TemporalData.services[key];
    if (!svc) return;
    document.querySelectorAll('.temp-svc-btn').forEach(btn => {
      const active = btn.getAttribute('data-service') === key;
      btn.className = active
        ? 'temp-svc-btn p-2.5 rounded-xl border text-left transition-all bg-sky-500/20 border-sky-500 text-white shadow-md'
        : 'temp-svc-btn p-2.5 rounded-xl border text-left transition-all bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700';
    });
    const panel = document.getElementById('temp-service-detail-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-sm font-bold text-white">${svc.title}</h4>
        <span class="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">${svc.badge}</span>
      </div>
      <p class="text-xs text-slate-300 leading-relaxed">${svc.summary}</p>
      <div class="space-y-1.5">
        <div class="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">Architectural Internals:</div>
        <ul class="space-y-1.5 text-xs text-slate-300">
          ${svc.internals.map(item => `<li class="flex items-start gap-2"><span class="text-sky-400 mt-0.5">▸</span><span>${item}</span></li>`).join('')}
        </ul>
      </div>
      <pre class="code-block bg-slate-950 p-3 rounded-lg border border-slate-800 text-sky-200 overflow-x-auto">${svc.protocolSnippet}</pre>
    `;
  }

  document.querySelectorAll('.temp-svc-btn').forEach(btn => {
    btn.addEventListener('click', () => selectTemporalService(btn.getAttribute('data-service')));
  });
  selectTemporalService('history');

  // Setup Activity Retry Policy Chart.js
  const retryCtx = document.getElementById('temp-retry-chart')?.getContext('2d');
  let retryChart = null;
  if (retryCtx) {
    retryChart = LifecycleManager.registerChart(new Chart(retryCtx, {
      type: 'bar',
      data: {
        labels: ['Attempt 1', 'Attempt 2', 'Attempt 3', 'Attempt 4', 'Attempt 5'],
        datasets: [{
          label: 'Backoff Wait Delay (Seconds)',
          data: [0, 2, 4, 8, 16],
          backgroundColor: 'rgba(14, 165, 233, 0.55)',
          borderColor: '#38bdf8',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { family: 'JetBrains Mono', size: 10 } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: 'rgba(51,65,85,0.2)' } },
          y: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: 'rgba(51,65,85,0.2)' }, title: { display: true, text: 'Delay (s)', color: '#64748b', font: { size: 10 } } }
        }
      }
    }));
  }

  function updateRetryChart() {
    const init = parseFloat(document.getElementById('temp-retry-init')?.value || '2');
    const coeff = parseFloat(document.getElementById('temp-retry-coeff')?.value || '2');
    const maxAtt = parseInt(document.getElementById('temp-retry-max')?.value || '5', 10);
    document.getElementById('temp-retry-init-val').textContent = `${init}s`;
    document.getElementById('temp-retry-coeff-val').textContent = `${coeff.toFixed(1)}x`;
    document.getElementById('temp-retry-max-val').textContent = `${maxAtt} tries`;
    if (!retryChart) return;
    const labels = [];
    const data = [];
    for (let i = 1; i <= maxAtt; i++) {
      labels.push(`Try #${i}`);
      data.push(i === 1 ? 0 : +(init * Math.pow(coeff, i - 2)).toFixed(1));
    }
    retryChart.data.labels = labels;
    retryChart.data.datasets[0].data = data;
    retryChart.update();
  }

  ['temp-retry-init', 'temp-retry-coeff', 'temp-retry-max'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateRetryChart);
  });

  // Setup 2D High-DPI Replay Canvas Animation
  const canvas = document.getElementById('temporal-replay-canvas');
  let animTick = 0;
  function drawReplayCanvas() {
    if (!canvas || !canvas.isConnected) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    animTick += 0.035;
    const stepObj = TemporalData.replaySteps[currentStepIdx];
    const isCrash = stepObj.phase === 'CRASH_EVENT';
    const isReplay = stepObj.phase === 'REPLAY_RECOVERY';
    const isNonDet = nonDetBugEnabled && currentStepIdx >= 5;

    // Node Coordinates
    const historyBox = { x: 28, y: 40, w: 195, h: 150, title: 'HISTORY SERVICE', sub: 'Shard #142 Event Log' };
    const matchingBox = { x: w * 0.37, y: 40, w: 175, h: 150, title: 'MATCHING SERVICE', sub: 'Workflow & Activity TQ' };
    const workerBox = { x: w - 235, y: 40, w: 205, h: 150, title: currentStepIdx >= 4 ? 'WORKER-POD-B (NEW)' : 'WORKER-POD-A', sub: isReplay ? 'Replay Engine Active' : 'SDK State Machine' };

    const drawNode = (b, borderCol, fillCol, badgeText) => {
      ctx.fillStyle = fillCol;
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(b.title, b.x + 12, b.y + 24);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(b.sub, b.x + 12, b.y + 40);

      if (badgeText) {
        ctx.fillStyle = borderCol;
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(badgeText, b.x + 12, b.y + b.h - 14);
      }
    };

    drawNode(historyBox, '#38bdf8', 'rgba(12, 74, 110, 0.55)', `Events Stored: #1..#${currentStepIdx >= 4 ? 15 : stepObj.eventId}`);
    drawNode(matchingBox, '#34d399', 'rgba(6, 78, 59, 0.35)', isCrash ? 'Sticky Timeout (5s)' : 'Long-Poll gRPC');
    drawNode(
      workerBox,
      isCrash || isNonDet ? '#f43f5e' : isReplay ? '#fbbf24' : '#38bdf8',
      isCrash || isNonDet ? 'rgba(136, 19, 55, 0.45)' : isReplay ? 'rgba(120, 53, 15, 0.4)' : 'rgba(12, 74, 110, 0.4)',
      isCrash ? 'SIGKILL / OOM WIPE' : isNonDet ? 'NonDeterministicError!' : isReplay ? 'Side-Effects Suppressed' : 'replaying = false'
    );

    // Draw mini Event blocks inside History Box
    const numBlocks = Math.min(7, currentStepIdx + 2);
    for (let i = 0; i < numBlocks; i++) {
      const bx = historyBox.x + 12 + (i % 4) * 42;
      const by = historyBox.y + 56 + Math.floor(i / 4) * 32;
      ctx.fillStyle = isReplay && i <= (currentStepIdx - 3) ? '#f59e0b' : '#0284c7';
      ctx.beginPath();
      ctx.roundRect(bx, by, 36, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(`E#${i * 2 + 1}`, bx + 5, by + 14);
    }

    // Draw animated packets between History <-> Matching <-> Worker
    const drawBeam = (x1, y1, x2, y2, col, label, reverse = false) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = reverse ? animTick * 16 : -animTick * 16;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Moving packet dot
      const t = (animTick * 0.5) % 1;
      const p = reverse ? 1 - t : t;
      const px = x1 + (x2 - x1) * p;
      const py = y1 + (y2 - y1) * p;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(label, (x1 + x2) / 2 - 48, y1 - 8);
    };

    if (isReplay) {
      drawBeam(historyBox.x + historyBox.w, 95, workerBox.x, 95, '#fbbf24', 'GetWorkflowExecutionHistory(#1..#15)', false);
    } else if (!isCrash) {
      drawBeam(historyBox.x + historyBox.w, 85, matchingBox.x, 85, '#38bdf8', 'TransferTask', false);
      drawBeam(matchingBox.x + matchingBox.w, 85, workerBox.x, 85, '#34d399', 'PollTask Dispatch', false);
      drawBeam(workerBox.x, 145, historyBox.x + historyBox.w, 145, '#38bdf8', 'RespondTaskCompleted(Commands)', true);
    }

    ctx.restore();
    LifecycleManager.requestFrame(drawReplayCanvas);
  }

  updateReplayUI();
  LifecycleManager.requestFrame(drawReplayCanvas);
}
