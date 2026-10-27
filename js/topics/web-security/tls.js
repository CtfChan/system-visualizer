// ============================================================================
// TLS ARCHITECTURE & HANDSHAKE (/#tls)
// TLS 1.3 vs 1.2, 1-RTT & 0-RTT, Ephemeral ECDHE, AEAD, ALPN & ECH
// ============================================================================

function tlsArchitectureSvg() {
  const m = 'arrow-tls';
  const C = { client: '#94a3b8', server: '#10b981', crypto: '#38bdf8', lock: '#f59e0b' };
  return `<svg viewBox="0 0 1000 390" class="w-full h-auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TLS 1.3 handshake architecture diagram">
    ${Svg.defs(m)}
    ${Svg.group(180, 20, 360, 350, 'CLIENT HELLO & KEY EXCHANGE', C.crypto)}
    ${Svg.group(580, 20, 400, 350, 'SERVER RESPONSE & 1-RTT ENCRYPTION', C.server)}

    ${Svg.box(20, 150, 130, 60, 'Client Device', 'TLS 1.3 Client', C.client)}

    ${Svg.box(205, 55, 310, 60, 'ClientHello Frame', 'supported_versions=1.3 · key_share=X25519', C.crypto)}
    ${Svg.box(205, 160, 310, 60, 'ALPN Extension', 'h2, h3, http/1.1 negotiation', C.crypto)}
    ${Svg.box(205, 265, 310, 60, 'Encrypted Client Hello (ECH)', 'Encrypts SNI hostname in DNS', C.lock)}

    ${Svg.box(605, 55, 350, 60, 'ServerHello Frame', 'selected key_share=X25519 (Shared Secret)', C.server)}
    ${Svg.box(605, 160, 350, 60, 'Encrypted Handshake Flight', '{EncryptedExtensions, Cert, CertVerify, Finished}', C.server)}
    ${Svg.box(605, 265, 350, 60, '1-RTT Application Traffic (AEAD)', 'AES-GCM / ChaCha20-Poly1305 Symmetric Keys', C.lock)}

    ${Svg.arrow(m, 150, 180, 203, 85, '1 ClientHello + key_share', { lx: 172, ly: 125 })}
    ${Svg.arrow(m, 515, 85, 603, 85, '2 derive HandshakeSecret', { lx: 558, ly: 75 })}
    ${Svg.arrow(m, 605, 190, 150, 190, '3 ServerHello + Finished (1-RTT Complete)', { lx: 380, ly: 180, both: true })}
    ${Svg.arrow(m, 150, 205, 603, 295, '4 bidirectional application data', { lx: 380, ly: 260 })}
  </svg>`;
}

const TlsMeta = {
  accent: 'emerald',
  category: 'Web & Network Security',
  title: 'TLS Architecture & Handshake',
  tags: ['TLS 1.3 (RFC 8446)', '1-RTT Handshake', '0-RTT PSK Resumption', 'PFS via ECDHE', 'AEAD Ciphers'],
  summary: 'Transport Layer Security (TLS 1.3 / RFC 8446) redesigned web transport security. It cut handshake latency from 2-RTT to <strong>1-RTT</strong>, eliminated vulnerable static RSA key exchanges in favor of mandatory <strong>Ephemeral Diffie-Hellman (ECDHE)</strong> guaranteeing <strong>Perfect Forward Secrecy (PFS)</strong>, encrypted the entire server certificate flight, and introduced <strong>0-RTT Pre-Shared Key (PSK) Early Data</strong> resumption alongside <strong>ALPN</strong> protocol negotiation.',
  diagram: {
    title: 'High-Level TLS 1.3 1-RTT Handshake Architecture',
    svg: tlsArchitectureSvg(),
    steps: [
      'The client connects and immediately sends <code>ClientHello</code> with its ephemeral Diffie-Hellman public key share (e.g. X25519) and ALPN options (<code>h2</code>, <code>http/1.1</code>).',
      'The server chooses the cipher suite, calculates the shared secret via ECDHE, and replies with <code>ServerHello</code> + its own key share.',
      'From this exact packet onward, all subsequent handshake frames (EncryptedExtensions, Certificate, CertificateVerify, Finished) are <strong>fully encrypted</strong>.',
      'In just 1 network round trip (1-RTT), mutual cryptographic keys are finalized and full-duplex HTTP/2 or HTTP/3 application data flows.',
      'For repeat visitors, <strong>0-RTT PSK Resumption</strong> allows clients to send application data on the very first TCP packet of the connection!'
    ]
  },
  constraints: [
    ['0-RTT Replay Attack vulnerability', 'Data transmitted in a 0-RTT Early Data packet can be intercepted and replayed multiple times by an on-path attacker before the server confirms forward secrecy. Critical rule: <strong>Never permit non-idempotent state mutations (POST /transfer) over 0-RTT</strong>; restrict 0-RTT strictly to safe GET requests.'],
    ['Static RSA eliminated (PFS enforced)', 'TLS 1.3 completely removed static RSA key exchange. An attacker who records encrypted network packets today cannot decrypt them in the future even if they compromise the server’s private RSA key, because ephemeral keys are wiped from RAM after session teardown.'],
    ['SNI leakage vs Encrypted Client Hello (ECH)', 'Traditional Server Name Indication (SNI) transmits the domain name in plaintext in the first packet, allowing ISPs and middleboxes to log visited domains. Encrypted Client Hello (ECH) resolves this by encrypting the inner SNI using a public key published in the target domain’s DNS HTTPS record.'],
    ['Symmetric cipher restriction to AEAD', 'Only Authenticated Encryption with Associated Data (AEAD) algorithms are allowed (<code>AES-128-GCM</code>, <code>AES-256-GCM</code>, <code>CHACHA20-POLY1305</code>). Obsolete CBC ciphers (vulnerable to padding oracles like POODLE and Lucky13) and RC4 are completely banned.'],
    ['Handshake compute overhead', 'X25519 elliptic curve key exchange is highly optimized (~0.05 ms CPU time), but high-traffic edge gateways (100k handshakes/sec) benefit significantly from hardware cryptographic offloading (Intel QAT / AVX-512) and session ticket caching.']
  ],
  useWhen: [
    'Terminating external HTTPS traffic on modern reverse proxies, CDNs, ingress controllers, and API gateways.',
    'High-performance mobile and web applications where saving 1 RTT (50–150 ms) on cold connection setup directly improves user perceived latency and conversion.',
    'Implementing zero-trust service-to-service communication requiring strict Perfect Forward Secrecy.'
  ],
  avoidWhen: [
    'Attempting to use legacy TLS 1.0 or 1.1 (deprecated and blocked by PCI-DSS and all modern browsers due to fundamental cryptographic vulnerabilities).'
  ]
};

function renderTlsView(container) {
  container.innerHTML = `
    ${renderTopicIntro(TlsMeta)}

    <!-- SECTION 1: INTERACTIVE HANDSHAKE PACKET STEPPER (TLS 1.3 vs 1.2 vs 0-RTT) -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i data-lucide="radio" class="w-5 h-5 text-emerald-400"></i>
            Interactive Handshake Packet &amp; RTT Latency Simulator
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            Compare round-trip times, packet flights, and cryptographic boundaries between <strong>TLS 1.3 (1-RTT)</strong>, <strong>Legacy TLS 1.2 (2-RTT)</strong>, and <strong>TLS 1.3 0-RTT Resumption</strong>.
          </p>
        </div>
        <div class="flex flex-wrap gap-2" id="tls-mode-tabs">
          <button data-mode="TLS13" class="tls-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-emerald-500/20 border-emerald-400 text-white shadow-md">TLS 1.3 (1-RTT)</button>
          <button data-mode="TLS12" class="tls-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-slate-900 border-slate-800 text-slate-300">TLS 1.2 (2-RTT Legacy)</button>
          <button data-mode="ZERO_RTT" class="tls-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-slate-900 border-slate-800 text-slate-300">TLS 1.3 (0-RTT PSK)</button>
        </div>
      </div>

      <!-- Live Packet Flight Canvas -->
      <div class="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3 font-mono text-xs">
        <div class="flex items-center justify-between text-slate-400">
          <span id="tls-mode-title" class="text-white font-bold">Protocol Flight: TLS 1.3 Initial Connection (1-RTT)</span>
          <span id="tls-rtt-badge" class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">Latency: 1 Network RTT</span>
        </div>
        <div id="tls-packets-stream" class="space-y-2">
          <!-- Dynamically populated via updateTlsUI() -->
        </div>
      </div>

      <!-- Security & Architectural Metric Cards -->
      <div id="tls-metrics-container" class="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        <!-- Dynamically rendered -->
      </div>
    </div>

    <!-- SECTION 2: HKDF KEY SCHEDULE & CRYPTOGRAPHIC DERIVATION -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
      <div class="border-b border-slate-800 pb-3">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i data-lucide="key" class="w-5 h-5 text-sky-400"></i>
          HKDF Key Derivation Pipeline (RFC 5869)
        </h3>
        <p class="text-xs text-slate-400 mt-0.5">
          How TLS 1.3 derives separate ephemeral cryptographic keys for handshake encryption and application data traffic.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div class="text-amber-300 font-bold">1. Ephemeral Secret</div>
          <div class="text-[11px] text-slate-400">Diffie-Hellman Key Share: $g^{ab} \\pmod p$ calculated via X25519 elliptic curve.</div>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div class="text-sky-300 font-bold">2. Handshake Traffic Secret</div>
          <div class="text-[11px] text-slate-400">HKDF-Extract &amp; Expand creates client/server keys encrypting Certificate &amp; Finished.</div>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div class="text-emerald-300 font-bold">3. Master Traffic Secret</div>
          <div class="text-[11px] text-slate-400">Derives <code>client_app_traffic_secret</code> and <code>server_app_traffic_secret</code> for bidirectional data.</div>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div class="text-purple-300 font-bold">4. Resumption PSK Secret</div>
          <div class="text-[11px] text-slate-400">Pre-shared key generated for future 0-RTT session tickets.</div>
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();

  let activeMode = 'TLS13';

  function updateTlsUI() {
    const streamEl = document.getElementById('tls-packets-stream');
    const titleEl = document.getElementById('tls-mode-title');
    const badgeEl = document.getElementById('tls-rtt-badge');
    const metricsEl = document.getElementById('tls-metrics-container');
    if (!streamEl || !metricsEl) return;

    if (activeMode === 'TLS13') {
      titleEl.textContent = 'Protocol Flight: TLS 1.3 Full Handshake (1-RTT)';
      badgeEl.textContent = 'Total Handshake: 1 RTT (~40ms)';
      badgeEl.className = 'px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold';

      streamEl.innerHTML = `
        <div class="p-3 rounded-lg bg-slate-900 border border-sky-500/40 space-y-1">
          <div class="flex justify-between items-center text-sky-300 font-bold">
            <span>[Client $\\rightarrow$ Server] Flight 1 (0.5 RTT)</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20">PLAINTEXT PACKET</span>
          </div>
          <div class="text-slate-300 text-[11px]">
            <code>ClientHello</code>: ClientRandom + SupportedGroups[X25519] + KeyShare[Pub_C] + ALPN["h2", "http/1.1"]
          </div>
        </div>

        <div class="p-3 rounded-lg bg-slate-900 border border-emerald-500/40 space-y-1">
          <div class="flex justify-between items-center text-emerald-300 font-bold">
            <span>[Server $\\rightarrow$ Client] Flight 2 (1.0 RTT)</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20">TRANSITION TO ENCRYPTION</span>
          </div>
          <div class="text-slate-300 text-[11px] space-y-0.5">
            <div><code>ServerHello</code>: ServerRandom + KeyShare[Pub_S] <span class="text-slate-500">(ECDHE Secret Established!)</span></div>
            <div class="text-emerald-400 font-semibold">{EncryptedExtensions + Certificate + CertVerify + Finished}</div>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/60 text-emerald-200">
          <div class="font-bold flex items-center justify-between">
            <span>✓ HANDSHAKE COMPLETE: Full-Duplex Application Traffic Flowing!</span>
            <span class="text-[10px] font-bold">1 RTT ACHIEVED</span>
          </div>
          <div class="text-[11px] text-slate-300 mt-1">
            HTTP/2 requests transmitted with AES-GCM symmetric keys. Server certificates were completely hidden from eavesdroppers.
          </div>
        </div>
      `;

      metricsEl.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1">
          <div class="text-emerald-400 font-bold">Handshake Latency</div>
          <div class="text-lg font-bold text-white">1 Network RTT</div>
          <div class="text-[10px] text-slate-400">50% faster than TLS 1.2</div>
        </div>
        <div class="p-4 rounded-xl bg-slate-950 border border-sky-500/30 space-y-1">
          <div class="text-sky-400 font-bold">Forward Secrecy (PFS)</div>
          <div class="text-lg font-bold text-white">Mandatory (ECDHE)</div>
          <div class="text-[10px] text-slate-400">Static RSA banned</div>
        </div>
        <div class="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1">
          <div class="text-amber-400 font-bold">Certificate Privacy</div>
          <div class="text-lg font-bold text-white">Fully Encrypted</div>
          <div class="text-[10px] text-slate-400">Hidden from network MITM</div>
        </div>
      `;
    } else if (activeMode === 'TLS12') {
      titleEl.textContent = 'Protocol Flight: Legacy TLS 1.2 Handshake (2-RTT)';
      badgeEl.textContent = 'Total Handshake: 2 Network RTTs (~80ms)';
      badgeEl.className = 'px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold';

      streamEl.innerHTML = `
        <div class="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-0.5">
          <span class="text-slate-400 font-bold">[Roundtrip 1]: ClientHello $\\rightarrow$ ServerHello + Certificate + ServerKeyExchange + ServerHelloDone</span>
          <div class="text-rose-400 text-[10px]">Server Certificate transmitted completely in PLAINTEXT!</div>
        </div>

        <div class="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-0.5">
          <span class="text-slate-400 font-bold">[Roundtrip 2]: ClientKeyExchange + ChangeCipherSpec + Finished $\\rightarrow$ Server Finished</span>
          <div class="text-amber-400 text-[10px]">Takes 2 complete network round trips before first byte of application data can be sent.</div>
        </div>
      `;

      metricsEl.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-950 border border-rose-500/30 space-y-1">
          <div class="text-rose-400 font-bold">Handshake Latency</div>
          <div class="text-lg font-bold text-white">2 Network RTTs</div>
          <div class="text-[10px] text-slate-400">High latency penalty on mobile</div>
        </div>
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div class="text-slate-400 font-bold">Forward Secrecy</div>
          <div class="text-lg font-bold text-white">Optional</div>
          <div class="text-[10px] text-slate-400">Static RSA susceptible to retrospective decryption</div>
        </div>
        <div class="p-4 rounded-xl bg-slate-950 border border-rose-500/30 space-y-1">
          <div class="text-rose-400 font-bold">Certificate Privacy</div>
          <div class="text-lg font-bold text-white">PLAINTEXT</div>
          <div class="text-[10px] text-slate-400">Leaked to all on-path observers</div>
        </div>
      `;
    } else {
      titleEl.textContent = 'Protocol Flight: TLS 1.3 0-RTT PSK Resumption (Early Data)';
      badgeEl.textContent = 'Total Handshake: 0 RTT (Instant Send!)';
      badgeEl.className = 'px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold';

      streamEl.innerHTML = `
        <div class="p-3 rounded-lg bg-slate-900 border border-cyan-500/40 space-y-1">
          <div class="flex justify-between items-center text-cyan-300 font-bold">
            <span>[Client $\\rightarrow$ Server] Packet 1 (0-RTT!)</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20">RESUMPTION TICKET</span>
          </div>
          <div class="text-slate-300 text-[11px] space-y-1">
            <div><code>ClientHello</code> + PreSharedKey[SessionTicket]</div>
            <div class="text-emerald-400 font-bold">Encrypted Early Data: GET /user/profile HTTP/2 (Sent on First Packet!)</div>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-amber-950/25 border border-amber-500/40 text-[11px] text-amber-200">
          <strong class="text-amber-300">⚠️ Architectural Replay Warning:</strong> Because 0-RTT Early Data packets can be copied and replayed by a network attacker, edge proxies MUST reject non-idempotent HTTP methods (<code>POST</code>, <code>PUT</code>, <code>DELETE</code>) over 0-RTT!
        </div>
      `;

      metricsEl.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-1">
          <div class="text-cyan-400 font-bold">Handshake Latency</div>
          <div class="text-lg font-bold text-white">0 Network RTT</div>
          <div class="text-[10px] text-slate-400">Instant application data transmission</div>
        </div>
        <div class="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1">
          <div class="text-amber-400 font-bold">Replay Safety</div>
          <div class="text-lg font-bold text-white">Idempotent Only</div>
          <div class="text-[10px] text-slate-400">Must guard with Anti-Replay caches</div>
        </div>
        <div class="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1">
          <div class="text-emerald-400 font-bold">Resumption Crypto</div>
          <div class="text-lg font-bold text-white">PSK + ECDHE</div>
          <div class="text-[10px] text-slate-400">Maintains forward secrecy after 1-RTT</div>
        </div>
      `;
    }
  }

  document.querySelectorAll('.tls-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMode = btn.getAttribute('data-mode');
      document.querySelectorAll('.tls-tab-btn').forEach(b => {
        const isAct = b.getAttribute('data-mode') === activeMode;
        b.className = isAct
          ? 'tls-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-emerald-500/20 border-emerald-400 text-white shadow-md'
          : 'tls-tab-btn px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700';
      });
      updateTlsUI();
    });
  });

  updateTlsUI();
}
