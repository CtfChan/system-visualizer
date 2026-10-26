// ============================================================================
// SHARED TOPIC LAYOUT
// Every topic page opens with the same structure so readers can scan it fast:
//   1. Header       — what the system is, in 2–3 sentences
//   2. Diagram      — optional high-level architecture + request flow
//   3. Decision     — hard constraints, when to use, when to avoid
// Interactive simulators follow below the intro.
// ============================================================================

// Full class strings (not interpolated) so Tailwind always generates them.
const TOPIC_ACCENTS = {
  amber:   { border: 'border-amber-500/30',   chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',       text: 'text-amber-400' },
  blue:    { border: 'border-blue-500/30',    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30',          text: 'text-blue-400' },
  teal:    { border: 'border-teal-500/30',    chip: 'bg-teal-500/15 text-teal-300 border-teal-500/30',          text: 'text-teal-400' },
  sky:     { border: 'border-sky-500/30',     chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',             text: 'text-sky-400' },
  rose:    { border: 'border-rose-500/30',    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30',          text: 'text-rose-400' },
  fuchsia: { border: 'border-fuchsia-500/30', chip: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30', text: 'text-fuchsia-400' },
  indigo:  { border: 'border-indigo-500/30',  chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',    text: 'text-indigo-400' },
  emerald: { border: 'border-emerald-500/30', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', text: 'text-emerald-400' },
  cyan:    { border: 'border-cyan-500/30',    chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',          text: 'text-cyan-400' },
  orange:  { border: 'border-orange-500/30',  chip: 'bg-orange-500/15 text-orange-300 border-orange-500/30',    text: 'text-orange-400' }
};

function renderTopicIntro(meta) {
  const a = TOPIC_ACCENTS[meta.accent] || TOPIC_ACCENTS.sky;

  const header = `
    <div class="glass-card rounded-2xl p-6 lg:p-8 border ${a.border}">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider border ${a.chip}">${meta.category}</span>
        ${(meta.tags || []).map(t => `<span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800/80 text-slate-300 border border-slate-700">${t}</span>`).join('')}
      </div>
      <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">${meta.title}</h1>
      <p class="mt-3 text-sm text-slate-300 leading-relaxed max-w-4xl">${meta.summary}</p>
    </div>
  `;

  const diagram = meta.diagram ? `
    <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
      <div class="flex items-center gap-2">
        <i data-lucide="workflow" class="w-4 h-4 ${a.text}"></i>
        <h2 class="text-base font-bold text-white">${meta.diagram.title || 'High-Level Architecture'}</h2>
      </div>
      <div class="rounded-xl bg-slate-950 border border-slate-800 p-3 overflow-x-auto">
        <div class="min-w-[760px]">${meta.diagram.svg}</div>
      </div>
      ${meta.diagram.steps ? `
        <ol class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-300">
          ${meta.diagram.steps.map((s, i) => `
            <li class="flex gap-2.5">
              <span class="shrink-0 w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-white flex items-center justify-center">${i + 1}</span>
              <span class="leading-relaxed">${s}</span>
            </li>`).join('')}
        </ol>` : ''}
    </div>
  ` : '';

  const decision = meta.constraints ? `
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div class="xl:col-span-7 glass-card rounded-2xl p-6 border border-slate-800">
        <div class="flex items-center gap-2 mb-4">
          <i data-lucide="ruler" class="w-4 h-4 text-amber-400"></i>
          <h2 class="text-base font-bold text-white">Hard Constraints &amp; Limits</h2>
        </div>
        <dl class="divide-y divide-slate-800/80 text-xs">
          ${meta.constraints.map(([k, v]) => `
            <div class="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4">
              <dt class="sm:col-span-4 font-mono font-semibold text-slate-200">${k}</dt>
              <dd class="sm:col-span-8 text-slate-400 leading-relaxed">${v}</dd>
            </div>`).join('')}
        </dl>
      </div>
      <div class="xl:col-span-5 flex flex-col gap-6">
        <div class="glass-card rounded-2xl p-6 border border-emerald-500/25 flex-1">
          <div class="flex items-center gap-2 mb-3">
            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
            <h2 class="text-sm font-bold text-white">Use it when</h2>
          </div>
          <ul class="space-y-2 text-xs text-slate-300">
            ${meta.useWhen.map(u => `<li class="flex gap-2"><span class="text-emerald-400">+</span><span class="leading-relaxed">${u}</span></li>`).join('')}
          </ul>
        </div>
        <div class="glass-card rounded-2xl p-6 border border-rose-500/25 flex-1">
          <div class="flex items-center gap-2 mb-3">
            <i data-lucide="x-circle" class="w-4 h-4 text-rose-400"></i>
            <h2 class="text-sm font-bold text-white">Avoid it when</h2>
          </div>
          <ul class="space-y-2 text-xs text-slate-300">
            ${meta.avoidWhen.map(u => `<li class="flex gap-2"><span class="text-rose-400">−</span><span class="leading-relaxed">${u}</span></li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
  ` : '';

  return header + diagram + decision + `
    <div class="flex items-center gap-3 pt-2">
      <i data-lucide="mouse-pointer-click" class="w-4 h-4 text-slate-500"></i>
      <span class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Interactive deep-dive</span>
      <div class="flex-1 h-px bg-slate-800"></div>
    </div>
  `;
}

// Toolbar wrapper for controls that drive the simulators on a page.
function renderTopicToolbar(innerHtml) {
  return `<div class="glass-card rounded-2xl px-5 py-3 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
    <span class="text-[11px] font-mono uppercase tracking-wider text-slate-400">Simulator controls</span>
    ${innerHtml}
  </div>`;
}

// ---------------------------------------------------------------------------
// SVG diagram primitives (used by architecture diagrams)
// ---------------------------------------------------------------------------
const Svg = {
  defs(id) {
    return `<defs>
      <marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8"></path>
      </marker>
    </defs>`;
  },
  group(x, y, w, h, label, stroke) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="rgba(15,23,42,0.35)" stroke="${stroke}" stroke-dasharray="5 5" stroke-width="1.2"></rect>
      <text x="${x + 14}" y="${y + 22}" fill="${stroke}" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" letter-spacing="1">${label}</text>`;
  },
  box(x, y, w, h, title, sub, stroke) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#0f172a" stroke="${stroke}" stroke-width="1.6"></rect>
      <text x="${x + w / 2}" y="${y + (sub ? h / 2 - 4 : h / 2 + 4)}" text-anchor="middle" fill="#f8fafc" font-family="Inter, sans-serif" font-size="12.5" font-weight="700">${title}</text>
      ${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 13}" text-anchor="middle" fill="#94a3b8" font-family="JetBrains Mono, monospace" font-size="9.5">${sub}</text>` : ''}`;
  },
  arrow(markerId, x1, y1, x2, y2, label, opts = {}) {
    const color = opts.color || '#94a3b8';
    const lx = opts.lx !== undefined ? opts.lx : (x1 + x2) / 2;
    const ly = opts.ly !== undefined ? opts.ly : (y1 + y2) / 2 - 6;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5" ${opts.dashed ? 'stroke-dasharray="4 4"' : ''} marker-end="url(#${markerId})" ${opts.both ? `marker-start="url(#${markerId})"` : ''}></line>
      ${label ? `<text x="${lx}" y="${ly}" text-anchor="${opts.anchor || 'middle'}" fill="#cbd5e1" font-family="JetBrains Mono, monospace" font-size="9.5">${label}</text>` : ''}`;
  }
};
