// ============================================================================
// CERTIFICATE AUTHORITIES & PKI (/#pki-ca)
// X.509 Chain of Trust, OCSP Stapling, Certificate Transparency, ACME (RFC 8555)
// ============================================================================

function pkiArchitectureSvg() {
  const m = 'arrow-pki';
  const C = { client: '#94a3b8', root: '#f59e0b', inter: '#38bdf8', leaf: '#34d399', ct: '#a855f7' };
  return `<svg viewBox="0 0 1000 390" class="w-full h-auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PKI and Certificate Authority architecture diagram">
    ${Svg.defs(m)}
    ${Svg.group(180, 20, 480, 350, 'CERTIFICATE AUTHORITY & ISSUANCE FABRIC', C.inter)}
    ${Svg.group(690, 20, 290, 350, 'VALIDATION & AUDIT INFRASTRUCTURE', C.ct)}

    ${Svg.box(20, 150, 130, 60, 'Web Browser', 'OS / Browser Trust Store', C.client)}

    ${Svg.box(205, 55, 200, 58, 'Root CA (Air-Gapped)', 'Offline HSM · Self-signed', C.root)}
    ${Svg.box(205, 175, 200, 58, 'Intermediate CA', 'Online Issuing CA · RFC 5280', C.inter)}
    ${Svg.box(205, 285, 200, 58, 'ACME Engine (Let\'s Encrypt)', 'RFC 8555 · HTTP-01 / DNS-01', C.inter)}

    ${Svg.box(445, 175, 195, 58, 'Edge Server (TLS Leaf)', 'domain.com · 90-day validity', C.leaf)}

    ${Svg.box(720, 65, 230, 60, 'CT Merkle Logs', 'Certificate Transparency · SCTs', C.ct)}
    ${Svg.box(720, 175, 230, 60, 'OCSP Responder / Staple', 'Signed revocation proof', C.leaf)}
    ${Svg.box(720, 275, 230, 60, 'ACME DNS Challenge', '_acme-challenge TXT record', C.client)}

    ${Svg.arrow(m, 150, 180, 203, 190, '1 TLS connect', { lx: 172, ly: 170 })}
    ${Svg.arrow(m, 305, 113, 305, 173, 'signs Intermediate', { lx: 310, ly: 140, anchor: 'start' })}
    ${Svg.arrow(m, 405, 204, 443, 204, 'issues Leaf cert', { lx: 424, ly: 194 })}
    ${Svg.arrow(m, 305, 283, 305, 235, 'automated CSR', { lx: 310, ly: 260, anchor: 'start' })}
    ${Svg.arrow(m, 640, 204, 718, 204, 'pre-fetches OCSP', { lx: 679, ly: 194 })}
    ${Svg.arrow(m, 405, 95, 718, 95, 'submits cert for SCT', { lx: 560, ly: 85 })}
  </svg>`;
}

const PkiMeta = {
  accent: 'sky',
  category: 'Web & Network Security',
  title: 'Certificate Authorities & PKI',
  tags: ['X.509 Hierarchy', 'OCSP Stapling', 'Certificate Transparency', 'ACME / Let\'s Encrypt'],
  summary: 'Public Key Infrastructure (PKI) forms the trust anchor of the modern Internet. Root Certificate Authorities (safeguarded offline in air-gapped Hardware Security Modules) delegate cryptographic trust to online <strong>Intermediate CAs</strong>, which issue short-lived <strong>Leaf Certificates</strong> to domains. Rather than relying on slow, privacy-leaking CRLs and OCSP checks, high-performance infrastructure employs <strong>OCSP Stapling</strong>, cryptographic <strong>Certificate Transparency (CT) Merkle logs</strong>, and fully automated issuance via the <strong>ACME protocol (RFC 8555)</strong>.',
  diagram: {
    title: 'High-Level PKI Architecture: Trust Hierarchy, CT Logs & OCSP Stapling',
    svg: pkiArchitectureSvg(),
    steps: [
      'The browser ships with a pre-installed Trust Store of trusted Root CA public keys (managed by Apple, Google, Microsoft, Mozilla).',
      'The Root CA signs one or more Intermediate CAs and is immediately taken offline in a secure, air-gapped physical vault.',
      'An automated ACME client on your edge proxy (Nginx, Caddy, Envoy) requests a certificate using an <code>HTTP-01</code> or <code>DNS-01</code> challenge.',
      'Before issuing the certificate, the CA submits it to public Certificate Transparency (CT) Merkle tree logs, embedding Signed Certificate Timestamps (SCTs) into the certificate.',
      'The edge server receives the Leaf Certificate and pre-fetches an OCSP response from the CA’s responder once every 24 hours.',
      'During client TLS handshakes, the server sends the full certificate chain plus the stapled OCSP response, allowing the browser to verify trust in 0 additional network round-trips!'
    ]
  },
  constraints: [
    ['Root CA key compromise', 'If a private Root CA key is compromised, all certificates issued down the entire chain can be forged. Remediation requires an emergency OS/browser patch to revoke the Root from trust stores.'],
    ['Certificate validity reduction', 'Industry standards (CA/Browser Forum) reduced maximum validity from 5 years $\\rightarrow$ 398 days $\\rightarrow$ 90 days. Manual certificate renewal at scale guarantees eventual production outages — automated ACME rotation is mandatory.'],
    ['OCSP privacy and latency penalty', 'Without OCSP Stapling, the browser must query the CA’s OCSP responder on every new domain visited. This leaks the client’s browsing history and IP to the CA and adds 80–200 ms of blocking latency to the TLS handshake.'],
    ['Certificate Transparency (CT) enforcement', 'Google Chrome and Apple Safari hard-reject any TLS certificate that does not contain verifiable Signed Certificate Timestamps (SCTs) from at least two independent CT logs.'],
    ['HTTP-01 vs DNS-01 challenges', '<code>HTTP-01</code> requires port 80 to be routed publicly to your edge proxy. Wildcard certificates (e.g. <code>*.internal.net</code>) cannot be issued via HTTP-01 and strictly require <code>DNS-01</code> API automation.'],
    ['Chain size & MTU bloat', 'Serving redundant root certificates or bloated intermediate chains inflates the TLS handshake payload past the initial TCP Congestion Window ($10 \\times \\text{MSS} \\approx 14.6 \\text{ KB}$), forcing an extra TCP roundtrip before the first byte of application data.']
  ],
  useWhen: [
    'Terminating TLS across internet-facing APIs, microservices, mobile backends, and customer-facing web applications.',
    'Implementing zero-trust internal service mesh mutual TLS (mTLS) with short-lived certificates issued by HashiCorp Vault or SPIFFE/SPIRE.',
    'Automating zero-downtime certificate renewals using ACME protocols (Let’s Encrypt, DigiCert, AWS ACM).'
  ],
  avoidWhen: [
    'Low-power, air-gapped IoT microcontrollers with no RTC clock or storage space for public trust store bundles (use symmetric pre-shared keys).',
    'Custom internal architectures where developers attempt to act as manual CAs using unmanaged self-signed OpenSSL certificates without automated rotation.'
  ]
};

function renderPkiCaView(container) {
  container.innerHTML = `
    ${renderTopicIntro(PkiMeta)}

    <!-- SECTION 1: X.509 CHAIN OF TRUST VERIFICATION SIMULATOR -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i data-lucide="check-check" class="w-5 h-5 text-sky-400"></i>
            Interactive X.509 Chain of Trust Verification Stepper
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            Step through how modern cryptographic engines validate a domain certificate by verifying asymmetric signatures upwards through Intermediate CAs to a pre-installed Trust Anchor.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="pki-valid-btn" class="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-semibold transition">
            ✓ Load Valid Trust Chain
          </button>
          <button id="pki-bad-sig-btn" class="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono">
            Inject Tampered Signature
          </button>
          <button id="pki-untrusted-root-btn" class="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-mono">
            Inject Untrusted Root
          </button>
        </div>
      </div>

      <!-- Chain Visualizer Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4" id="pki-chain-cards">
        <!-- Dynamically rendered via updatePkiChainUI() -->
      </div>

      <!-- Verification Result Banner -->
      <div id="pki-verification-result" class="p-4 rounded-xl border text-xs font-mono space-y-1.5">
        <!-- Dynamically updated -->
      </div>
    </div>

    <!-- SECTION 2: OCSP vs. OCSP STAPLING & CERTIFICATE TRANSPARENCY -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left 6 Cols: OCSP Stapling Latency & Privacy Diff -->
      <div class="lg:col-span-6 glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div class="border-b border-slate-800 pb-3">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <i data-lucide="zap" class="w-4 h-4 text-emerald-400"></i>
            OCSP vs. OCSP Stapling (RFC 6066)
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Why high-performance edge architectures always enable OCSP Stapling.
          </p>
        </div>

        <div class="space-y-3 font-mono text-xs">
          <div class="p-3.5 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-1.5">
            <div class="text-rose-300 font-bold flex items-center justify-between">
              <span>Traditional Client OCSP Query</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20">+80–200ms &amp; Privacy Leak</span>
            </div>
            <p class="text-slate-300 text-[11px] leading-relaxed">
              Browser pauses TLS handshake, makes separate HTTP connection to CA’s OCSP responder. Leaks user’s browsing destination directly to the CA. If CA responder is slow or offline, browser must "soft-fail", rendering revocation checks toothless against active MITM attacks!
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/40 space-y-1.5">
            <div class="text-emerald-300 font-bold flex items-center justify-between">
              <span>OCSP Stapling (TLS Certificate Status Request)</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20">0ms Overhead &amp; Zero Leak</span>
            </div>
            <p class="text-slate-300 text-[11px] leading-relaxed">
              Edge server periodically pre-fetches a cryptographically signed, timestamped OCSP response from the CA (valid for 24–48h). Server "staples" this signed ticket directly into the TLS <code>Certificate</code> handshake message. Zero extra client round-trips!
            </p>
          </div>
        </div>
      </div>

      <!-- Right 6 Cols: Certificate Transparency & Merkle Audit Logs -->
      <div class="lg:col-span-6 glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div class="border-b border-slate-800 pb-3">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <i data-lucide="git-commit" class="w-4 h-4 text-purple-400"></i>
            Certificate Transparency (CT Logs) &amp; SCTs
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Cryptographic audit trail preventing rogue CA issuance.
          </p>
        </div>

        <div class="space-y-3 text-xs text-slate-300">
          <p class="leading-relaxed">
            In 2011, compromised CAs (DigiNotar) secretly issued fraudulent certificates for <code>google.com</code> used in state-sponsored interception. <strong>Certificate Transparency (RFC 6962)</strong> solved this by mandating that all publicly trusted certificates must be appended to publicly auditable, append-only <strong>Merkle tree logs</strong>.
          </p>

          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] space-y-1">
            <div class="text-sky-300 font-bold">Signed Certificate Timestamp (SCT) Proof</div>
            <p class="text-slate-400">
              When submitted to a CT log, the log returns an SCT. The CA embeds this cryptographic proof directly into the X.509 certificate extension (OID <code>1.3.6.1.4.1.11129.2.4.2</code>). If a rogue certificate is generated without CT logging, browsers refuse connection!
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  rehydrateIcons();

  // State for Chain of Trust Simulator
  let chainState = 'VALID'; // 'VALID', 'BAD_SIG', 'UNTRUSTED_ROOT'

  function updatePkiChainUI() {
    const cardsEl = document.getElementById('pki-chain-cards');
    const resultEl = document.getElementById('pki-verification-result');
    if (!cardsEl || !resultEl) return;

    const isBadSig = chainState === 'BAD_SIG';
    const isUntrusted = chainState === 'UNTRUSTED_ROOT';

    cardsEl.innerHTML = `
      <div class="p-4 rounded-xl bg-slate-950 border ${isBadSig ? 'border-rose-500/60' : 'border-sky-500/40'} space-y-2 font-mono text-xs">
        <div class="flex items-center justify-between">
          <span class="text-emerald-400 font-bold">1. Leaf Certificate</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">CN: api.prod.com</span>
        </div>
        <div class="text-[11px] text-slate-400 space-y-1">
          <div>Issuer: <span class="text-sky-300">Let's Encrypt R3</span></div>
          <div>Subject: <span class="text-white">api.prod.com</span></div>
          <div>Valid: <span class="text-slate-300">90 Days (ACME Managed)</span></div>
          <div>Signature: <span class="${isBadSig ? 'text-rose-400 font-bold' : 'text-slate-300'}">${isBadSig ? '0xDEADBEEF (TAMPERED!)' : '0x9A4F..81B (SHA256-RSA)'}</span></div>
        </div>
      </div>

      <div class="p-4 rounded-xl bg-slate-950 border border-sky-500/40 space-y-2 font-mono text-xs">
        <div class="flex items-center justify-between">
          <span class="text-sky-400 font-bold">2. Intermediate CA</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">R3 Issuing CA</span>
        </div>
        <div class="text-[11px] text-slate-400 space-y-1">
          <div>Issuer: <span class="${isUntrusted ? 'text-rose-400 font-bold' : 'text-amber-300'}">${isUntrusted ? 'Untrusted Self-Signed CA' : 'ISRG Root X1'}</span></div>
          <div>Subject: <span class="text-white">Let's Encrypt R3</span></div>
          <div>Key Usage: <span class="text-slate-300">Certificate Sign, CRL Sign</span></div>
          <div>PathLen: <span class="text-slate-300">0 (Cannot issue more CAs)</span></div>
        </div>
      </div>

      <div class="p-4 rounded-xl bg-slate-950 border ${isUntrusted ? 'border-rose-500/60' : 'border-amber-500/40'} space-y-2 font-mono text-xs">
        <div class="flex items-center justify-between">
          <span class="text-amber-400 font-bold">3. Trust Anchor (Root CA)</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded ${isUntrusted ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/15 text-amber-300'}">${isUntrusted ? 'NOT IN STORE' : 'OS Trust Store'}</span>
        </div>
        <div class="text-[11px] text-slate-400 space-y-1">
          <div>Issuer: <span class="text-amber-300">${isUntrusted ? 'Hacker Root CA' : 'ISRG Root X1 (Self-signed)'}</span></div>
          <div>Storage: <span class="text-white">${isUntrusted ? 'Unknown Untrusted Origin' : 'Offline Air-gapped HSM'}</span></div>
          <div>Embedded in: <span class="text-slate-300">Apple Keychain, Mozilla NSS, Windows</span></div>
          <div>Fingerprint: <span class="text-slate-300">0x96BCE...882E</span></div>
        </div>
      </div>
    `;

    if (isBadSig) {
      resultEl.className = 'p-4 rounded-xl border border-rose-500 bg-rose-950/30 text-xs font-mono space-y-1.5';
      resultEl.innerHTML = `
        <div class="text-rose-300 font-bold flex items-center gap-2">
          <span>❌ VERIFICATION FAILURE: ERR_CERT_AUTHORITY_INVALID / BAD_SIGNATURE</span>
        </div>
        <p class="text-slate-200">
          The cryptographic hash of the Leaf Certificate does not match the decrypted signature using Intermediate CA's public key. The certificate was modified in transit or maliciously forged. Connection terminated!
        </p>
      `;
    } else if (isUntrusted) {
      resultEl.className = 'p-4 rounded-xl border border-rose-500 bg-rose-950/30 text-xs font-mono space-y-1.5';
      resultEl.innerHTML = `
        <div class="text-rose-300 font-bold flex items-center gap-2">
          <span>❌ VERIFICATION FAILURE: SEC_ERROR_UNKNOWN_ISSUER / UNTRUSTED_ROOT</span>
        </div>
        <p class="text-slate-200">
          Signature chain resolved up to "Hacker Root CA", but this root key is NOT present in the client's local OS/Browser Trust Store. Connection blocked to prevent man-in-the-middle attacks!
        </p>
      `;
    } else {
      resultEl.className = 'p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/25 text-xs font-mono space-y-1.5';
      resultEl.innerHTML = `
        <div class="text-emerald-300 font-bold flex items-center gap-2">
          <span>✓ VERIFICATION SUCCESSFUL: 256-Bit SHA256-RSA Chain Validated to Trust Anchor</span>
        </div>
        <p class="text-slate-300">
          Leaf signature verified by R3 Intermediate $\rightarrow$ Intermediate verified by ISRG Root X1 $\rightarrow$ ISRG Root X1 is trusted locally in OS root store. Handshake proceeds!
        </p>
      `;
    }
  }

  document.getElementById('pki-valid-btn')?.addEventListener('click', () => {
    chainState = 'VALID';
    updatePkiChainUI();
  });
  document.getElementById('pki-bad-sig-btn')?.addEventListener('click', () => {
    chainState = 'BAD_SIG';
    updatePkiChainUI();
  });
  document.getElementById('pki-untrusted-root-btn')?.addEventListener('click', () => {
    chainState = 'UNTRUSTED_ROOT';
    updatePkiChainUI();
  });

  updatePkiChainUI();
}
