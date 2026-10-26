// ============================================================================
// THREE.JS (r128) 3D TOPOLOGY MODAL ENGINE WITH STRICT LIFECYCLE DISPOSAL
// ============================================================================
let modalThreeCtx = null;

function initThreeTopologyModal(currentRoute) {
  const container = document.getElementById('three-canvas-container');
  if (!container || !window.THREE) return;

  // Clean up any existing modal Three context first
  if (modalThreeCtx) {
    if (modalThreeCtx.rafId) window.cancelAnimationFrame(modalThreeCtx.rafId);
    if (modalThreeCtx.renderer) modalThreeCtx.renderer.dispose();
    LifecycleManager.threeContexts.delete(modalThreeCtx);
    modalThreeCtx = null;
  }
  container.querySelectorAll('canvas').forEach(c => c.remove());

  const width = container.clientWidth || 720;
  const height = container.clientHeight || 440;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 5.5, 13);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  // Central Coordinator / Ring Core
  const coreGeo = new THREE.IcosahedronGeometry(1.45, 1);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, wireframe: true });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // Orbiting Storage / Worker / Shard Nodes
  const nodeMeshes = [];
  const numNodes = 8;
  for (let i = 0; i < numNodes; i++) {
    const angle = (i / numNodes) * Math.PI * 2;
    const r = 4.6;
    const geo = new THREE.SphereGeometry(0.48, 16, 16);
    const col = i % 2 === 0 ? 0x10b981 : 0xf59e0b;
    const mat = new THREE.MeshBasicMaterial({ color: col, wireframe: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(Math.cos(angle) * r, Math.sin(angle * 2) * 0.6, Math.sin(angle) * r);
    group.add(mesh);
    nodeMeshes.push(mesh);

    // Line to center
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      mesh.position.clone()
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x334155 });
    const line = new THREE.Line(lineGeo, lineMat);
    group.add(line);
  }

  const modeLabel = document.getElementById('modal-3d-mode-label');
  if (modeLabel) modeLabel.textContent = `Active Topology: /#${currentRoute}`;

  const legendEl = document.getElementById('modal-3d-legend');
  if (legendEl) {
    legendEl.innerHTML = `
      <div class="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
        <span class="text-indigo-400 font-bold">Core Wireframe:</span> Coordinator / History Ring / Hash Router
      </div>
      <div class="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
        <span class="text-emerald-400 font-bold">Emerald Nodes:</span> Active Quorum Replicas / Worker Pods
      </div>
      <div class="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
        <span class="text-amber-400 font-bold">Amber Nodes:</span> Storage Partitions / Async Log Tailers
      </div>
    `;
  }

  let boostSpeed = 0.008;
  document.getElementById('modal-3d-pulse-btn')?.addEventListener('click', () => {
    boostSpeed = 0.045;
    setTimeout(() => { boostSpeed = 0.008; }, 1200);
  });

  const ctxObj = { scene, renderer, rafId: null };
  LifecycleManager.registerThree(ctxObj);
  modalThreeCtx = ctxObj;

  function animate3D() {
    if (!renderer.domElement.isConnected) return;
    group.rotation.y += boostSpeed;
    coreMesh.rotation.x += 0.01;
    renderer.render(scene, camera);
    ctxObj.rafId = window.requestAnimationFrame(animate3D);
  }
  animate3D();
}
