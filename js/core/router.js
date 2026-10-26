// ============================================================================
// HASH-BASED ROUTER (STRICTLY window.location.hash, DEFAULT /#temporal)
// ============================================================================
const Routes = {
  'temporal': renderTemporalView,
  'restate': renderRestateView,
  'compare-durable': renderCompareDurableView,
  'dynamodb': renderDynamoDBView,
  'spanner': renderSpannerView,
  'cockroachdb': renderCockroachDBView,
  'postgresql': renderPostgresView,
  'raft': renderRaftView,
  'paxos': renderPaxosView,
  'kafka': renderKafkaView
};

function normalizeHash(rawHash) {
  const cleaned = String(rawHash || '').replace(/^#\/?/, '').trim().toLowerCase();
  return Routes[cleaned] ? cleaned : 'temporal';
}

function handleRouteChange() {
  const raw = window.location.hash;
  if (!raw || raw === '#' || raw === '#/') {
    window.location.hash = '#temporal';
    return;
  }
  const routeKey = normalizeHash(raw);

  // 1. Strict Lifecycle Cleanup on every route transition
  LifecycleManager.cleanupAll();

  // 2. Update Header Badge & Active Navigation Highlighting
  const badge = document.getElementById('header-route-badge');
  if (badge) badge.textContent = `/#${routeKey}`;

  document.querySelectorAll('.sidebar-link').forEach(link => {
    const isMatch = link.getAttribute('data-route') === routeKey;
    link.classList.toggle('nav-item-active', isMatch);
  });

  document.querySelectorAll('.quick-pill').forEach(pill => {
    const isMatch = pill.getAttribute('data-quick-link') === routeKey;
    pill.className = isMatch
      ? 'quick-pill px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 bg-indigo-500/20 text-white border border-indigo-500/40'
      : 'quick-pill px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 text-slate-400 hover:text-white';
  });

  // 3. Render Selected View
  const viewport = document.getElementById('app-viewport');
  if (viewport) {
    Routes[routeKey](viewport);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 4. Rehydrate Lucide Icons
  rehydrateIcons();
}

// Sidebar Search Filter
document.getElementById('nav-search-input')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const txt = link.textContent.toLowerCase();
    link.style.display = !q || txt.includes(q) ? '' : 'none';
  });
});

// Mobile Sidebar Toggle
document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
  const sb = document.getElementById('sidebar-nav');
  sb?.classList.toggle('-translate-x-full');
});

// 3D Modal Toggle
document.getElementById('toggle-3d-modal-btn')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-3d-topology');
  if (modal) {
    modal.classList.remove('hidden');
    initThreeTopologyModal(normalizeHash(window.location.hash));
  }
});
document.getElementById('close-3d-modal-btn')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-3d-topology');
  modal?.classList.add('hidden');
});

window.addEventListener('hashchange', handleRouteChange);
window.addEventListener('DOMContentLoaded', () => {
  if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
    window.location.hash = '#temporal';
  }
  handleRouteChange();
});
