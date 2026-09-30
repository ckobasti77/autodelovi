// perf-3d track (step 21 audit): WebGL instrumentation injected with addInitScript.
// Counts contexts (WeakRef, so a retained renderer shows up after GC), draw calls and triangles
// per rendered frame, and estimates GPU memory (buffers + textures + renderbuffers + drawing
// buffer) per live context. Counting only — no behaviour change.
export const GL_INSTRUMENT = String.raw`(() => {
  if (window.__gl) return;
  const S = (window.__gl = { contexts: [], draws: 0, tris: 0, lines: 0, firstDrawAt: null, frames: [], maxDraws: 0, maxTris: 0 });
  const stats = new WeakMap();
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = origGetContext.call(this, type, attrs);
    if (ctx && (type === 'webgl2' || type === 'webgl') && !stats.has(ctx)) {
      const st = { at: performance.now(), buf: 0, tex: 0, rb: 0, lost: false, bufs: 0, texs: 0, progs: 0, attrs: JSON.stringify(attrs || {}), boundBuf: {}, boundTex: {}, boundRb: null };
      stats.set(ctx, st);
      S.contexts.push({ ref: new WeakRef(ctx), canvas: new WeakRef(this), st });
      this.addEventListener('webglcontextlost', () => { st.lost = true; st.boundBuf = {}; st.boundTex = {}; st.boundRb = null; });
    }
    return ctx;
  };
  const P = WebGL2RenderingContext.prototype;
  const wrap = (name, fn) => { const o = P[name]; P[name] = function () { try { fn.call(this, stats.get(this), arguments); } catch (e) {} return o.apply(this, arguments); }; };
  const draw = (mode, count) => {
    S.draws++;
    if (S.firstDrawAt === null) S.firstDrawAt = performance.now();
    if (mode === 4) S.tris += count / 3; else if (mode === 1) S.lines += count / 2;
  };
  wrap('drawElements', function (st, a) { draw(a[0], a[1]); });
  wrap('drawArrays', function (st, a) { draw(a[0], a[2]); });
  wrap('drawElementsInstanced', function (st, a) { draw(a[0], a[1] * a[4]); });
  wrap('drawArraysInstanced', function (st, a) { draw(a[0], a[2] * a[3]); });
  wrap('drawRangeElements', function (st, a) { draw(a[0], a[3]); });
  // buffers
  const bufSize = new WeakMap();
  wrap('createBuffer', function (st) { if (st) st.bufs++; });
  wrap('bindBuffer', function (st, a) { if (st) st.boundBuf[a[0]] = a[1] ? new WeakRef(a[1]) : null; });
  wrap('bufferData', function (st, a) {
    if (!st) return;
    const b = st.boundBuf[a[0]] && st.boundBuf[a[0]].deref(); if (!b) return;
    const bytes = typeof a[1] === 'number' ? a[1] : (a[1] && a[1].byteLength) || 0;
    st.buf += bytes - (bufSize.get(b) || 0); bufSize.set(b, bytes);
  });
  wrap('deleteBuffer', function (st, a) { if (!st || !a[0]) return; st.bufs--; st.buf -= bufSize.get(a[0]) || 0; bufSize.delete(a[0]); });
  // textures
  const BPP = { 0x8058: 4, 0x8c43: 4, 0x881a: 8, 0x8814: 16, 0x8051: 4, 0x8229: 1, 0x822b: 2, 0x81a6: 4, 0x88f0: 4, 0x81a5: 2, 0x8cac: 4, 0x881b: 8, 0x822d: 2, 0x822f: 4, 0x8c3a: 4, 0x8d62: 2 };
  const TYPE_BPC = { 0x1401: 1, 0x140b: 2, 0x8d61: 2, 0x1406: 4 };
  const texSize = new WeakMap();
  const texBytes = (ifmt, fmt, type) => BPP[ifmt] || (ifmt === 0x1908 || ifmt === 0x1907 ? 4 * (TYPE_BPC[type] || 1) : 4);
  wrap('createTexture', function (st) { if (st) st.texs++; });
  wrap('bindTexture', function (st, a) { if (st) st.boundTex[a[0] === 0x8513 || (a[0] >= 0x8515 && a[0] <= 0x851a) ? 0x8513 : a[0]] = a[1] ? new WeakRef(a[1]) : null; });
  const addTex = (st, target, key, bytes) => {
    const tr = st.boundTex[target >= 0x8515 && target <= 0x851a ? 0x8513 : target]; const t = tr && tr.deref(); if (!t) return;
    let m = texSize.get(t); if (!m) { m = {}; texSize.set(t, m); }
    st.tex += bytes - (m[key] || 0); m[key] = bytes;
  };
  wrap('texStorage2D', function (st, a) {
    if (!st) return; const [target, levels, ifmt, w, h] = a;
    const faces = target === 0x8513 ? 6 : 1;
    addTex(st, target, 'storage', w * h * texBytes(ifmt) * faces * (levels > 1 ? 4 / 3 : 1));
  });
  wrap('texStorage3D', function (st, a) { if (!st) return; const [target, levels, ifmt, w, h, d] = a; addTex(st, target, 'storage', w * h * d * texBytes(ifmt) * (levels > 1 ? 4 / 3 : 1)); });
  wrap('texImage2D', function (st, a) {
    if (!st) return; let w, h, ifmt = a[2], fmt, type;
    if (a.length >= 9 || typeof a[5] === 'number' && a.length === 9) { w = a[3]; h = a[4]; fmt = a[6]; type = a[7]; }
    else { const src = a[5]; w = (src && (src.width || src.videoWidth || src.displayWidth)) || 0; h = (src && (src.height || src.videoHeight || src.displayHeight)) || 0; fmt = a[3]; type = a[4]; }
    addTex(st, a[0], 'l' + a[1] + 't' + a[0], w * h * texBytes(ifmt, fmt, type));
  });
  wrap('compressedTexImage2D', function (st, a) { if (!st) return; const d = a[6]; addTex(st, a[0], 'c' + a[1] + 't' + a[0], (d && d.byteLength) || 0); });
  wrap('deleteTexture', function (st, a) { if (!st || !a[0]) return; st.texs--; const m = texSize.get(a[0]); if (m) for (const k in m) st.tex -= m[k]; texSize.delete(a[0]); });
  // renderbuffers
  const rbSize = new WeakMap();
  wrap('bindRenderbuffer', function (st, a) { if (st) st.boundRb = a[1] ? new WeakRef(a[1]) : null; });
  const setRb = (st, bytes) => { const r = st.boundRb && st.boundRb.deref(); if (!r) return; st.rb += bytes - (rbSize.get(r) || 0); rbSize.set(r, bytes); };
  wrap('renderbufferStorage', function (st, a) { if (st) setRb(st, a[2] * a[3] * texBytes(a[1])); });
  wrap('renderbufferStorageMultisample', function (st, a) { if (st) setRb(st, a[3] * a[4] * texBytes(a[2]) * Math.max(1, a[1])); });
  wrap('deleteRenderbuffer', function (st, a) { if (!st || !a[0]) return; st.rb -= rbSize.get(a[0]) || 0; rbSize.delete(a[0]); });
  wrap('createProgram', function (st) { if (st) st.progs++; });
  wrap('deleteProgram', function (st) { if (st) st.progs--; });
  // per-frame draw accounting
  let lastDraws = 0, lastTris = 0;
  const tick = () => {
    const d = S.draws - lastDraws, t = S.tris - lastTris;
    if (d > 0) {
      S.frames.push(d);
      if (d > S.maxDraws) S.maxDraws = d;
      if (t > S.maxTris) S.maxTris = t;
      S.lastDraws = d; S.lastTris = Math.round(t);
      if (S.frames.length > 5000) S.frames.shift();
    }
    lastDraws = S.draws; lastTris = S.tris;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__glSnapshot = () => {
    let live = 0, alive = 0, bytes = 0, list = [];
    for (const c of S.contexts) {
      const ctx = c.ref.deref();
      if (ctx) alive++;
      const lost = c.st.lost || (ctx ? ctx.isContextLost() : true);
      if (!lost) {
        live++;
        const attrs = ctx.getContextAttributes() || {};
        const samples = attrs.antialias ? 4 : 1;
        const db = ctx.drawingBufferWidth * ctx.drawingBufferHeight * ((4 + (attrs.depth ? 4 : 0)) * samples + (samples > 1 ? 4 : 0));
        const total = c.st.buf + c.st.tex + c.st.rb + db;
        bytes += total;
        list.push({ at: Math.round(c.st.at), bufMB: +(c.st.buf / 1048576).toFixed(1), texMB: +(c.st.tex / 1048576).toFixed(1), rbMB: +(c.st.rb / 1048576).toFixed(1), drawingBufferMB: +(db / 1048576).toFixed(1), totalMB: +(total / 1048576).toFixed(1), buffers: c.st.bufs, textures: c.st.texs, programs: c.st.progs, dbw: ctx.drawingBufferWidth, dbh: ctx.drawingBufferHeight, antialias: !!attrs.antialias });
      }
    }
    return { created: S.contexts.length, alive, live, gpuMB: +(bytes / 1048576).toFixed(1), perContext: list, draws: S.draws, maxDrawsPerFrame: S.maxDraws, maxTrisPerFrame: Math.round(S.maxTris), lastDraws: S.lastDraws, lastTris: S.lastTris, renderedFrames: S.frames.length };
  };
})();`;

export const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};

export const GPU_ARGS = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
export const SWIFT_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
