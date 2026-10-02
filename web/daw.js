(function () {
  "use strict";

  var PPQ = 960;
  var RULER_H = 30;
  var DIR = "/home/web_user/.vial-daw";
  var coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  var lowMemory = coarse || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  var MAX_SYNTHS = lowMemory ? 3 : 6;
  var MAX_KITS = 4;
  var MAX_TRACKS = 16;
  var SYNTH_COLOR = "#5dbb63";
  var DRUM_COLOR = "#e0b93e";
  var PAD_NAMES = ["Kick", "Rim", "Snare", "Clap", "Snare 2", "Low Tom", "Closed Hat", "Mid Tom",
                   "Pedal Hat", "High Tom", "Open Hat", "Conga", "Cowbell", "Crash", "Shaker", "Ride"];
  var PAD_CHOKE = [0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var KITS = { "808": "Vial 808", "909": "Vial 909" };

  var ICONS = {
    menu: '<svg viewBox="0 0 24 24" class="stroke"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    start: '<svg viewBox="0 0 24 24"><path d="M5 5h2.5v14H5zM19 5v14L8.5 12z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    rec: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/></svg>',
    cycle: '<svg viewBox="0 0 24 24" class="stroke"><path d="M5 10a7 6 0 0 1 12.5-3.5M19 14a7 6 0 0 1-12.5 3.5"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>',
    metro: '<svg viewBox="0 0 24 24" class="stroke"><path d="M9 3h6l4 18H5z"/><path d="M12 16l5-9"/><path d="M8 16h8"/></svg>',
    countin: '<svg viewBox="0 0 24 24" class="stroke"><path d="M4 18V8M9 18V6M14 18v-8M19 18V4"/></svg>',
    undo: '<svg viewBox="0 0 24 24" class="stroke"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    redo: '<svg viewBox="0 0 24 24" class="stroke"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" class="stroke"><path d="M12 5v14M5 12h14"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    trash: '<svg viewBox="0 0 24 24" class="stroke"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    zoomIn: '<svg viewBox="0 0 24 24" class="stroke"><circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M7 10h6M10 7v6"/></svg>',
    zoomOut: '<svg viewBox="0 0 24 24" class="stroke"><circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M7 10h6"/></svg>',
    close: '<svg viewBox="0 0 24 24" class="stroke"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function h(tag, props, children) {
    var e = document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v == null) continue;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k === "html") e.innerHTML = v;
        else if (k === "style") e.style.cssText = v;
        else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return e;
  }

  function btn(content, title, onclick, cls) {
    var b = h("button", { class: "btn" + (cls ? " " + cls : ""), title: title || null, tabindex: "-1" });
    if (content.indexOf("<svg") === 0) b.innerHTML = content;
    else b.textContent = content;
    if (onclick) b.addEventListener("click", function (e) { onclick(e, b); });
    return b;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dbToGain(db) { return db <= -60 ? 0 : Math.pow(10, db / 20); }
  function fmtDb(db) { return db <= -60 ? "-inf" : (db > 0 ? "+" : "") + db.toFixed(1); }
  function noteName(n) { return NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 2); }
  function isBlack(n) { return [1, 3, 6, 8, 10].indexOf(n % 12) >= 0; }
  function barTicks() { return project.beatsPerBar * PPQ; }
  function uid() { return Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36); }

  var toastTimer = null;
  function toast(text, ms) {
    var t = document.querySelector(".toast");
    if (!t) {
      t = h("div", { class: "toast" });
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = "0"; }, ms || 2600);
  }

  function closeMenus() {
    document.querySelectorAll(".menu, .menu-back").forEach(function (m) { m.remove(); });
  }

  function showMenu(anchor, items) {
    closeMenus();
    var back = h("div", { class: "menu-back", style: "position:fixed;inset:0;z-index:199999" });
    back.addEventListener("pointerdown", function (e) { e.preventDefault(); closeMenus(); });
    var m = h("div", { class: "menu" });
    items.forEach(function (it) {
      if (it === "-") { m.appendChild(h("div", { class: "sep" })); return; }
      if (it.head) { m.appendChild(h("div", { class: "head", text: it.head })); return; }
      var row = h("div", { class: "item" }, [h("span", { text: (it.checked ? "✓ " : "") + it.label }), it.key ? h("span", { class: "key", text: it.key }) : null]);
      row.addEventListener("click", function () { closeMenus(); it.action(); });
      m.appendChild(row);
    });
    document.body.appendChild(back);
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    var mw = m.offsetWidth, mh = m.offsetHeight;
    var x = clamp(r.left, 6, window.innerWidth - mw - 6);
    var y = r.bottom + 4;
    if (y + mh > window.innerHeight - 6) y = Math.max(6, r.top - mh - 4);
    m.style.left = x + "px";
    m.style.top = y + "px";
  }

  function modal(title, body, actions) {
    var back = h("div", { class: "modal-back" });
    var box = h("div", { class: "modal" }, [h("h3", { text: title })]);
    if (body) (Array.isArray(body) ? body : [body]).forEach(function (b) { box.appendChild(typeof b === "string" ? h("p", { text: b }) : b); });
    var row = h("div", { class: "actions" });
    var close = function () { back.remove(); };
    (actions || [{ label: "OK" }]).forEach(function (a) {
      row.appendChild(btn(a.label, null, function () { if (!a.action || a.action() !== false) close(); }, a.primary ? "on" : ""));
    });
    box.appendChild(row);
    back.appendChild(box);
    document.body.appendChild(back);
    return { close: close, box: box };
  }

  function askText(title, value, done) {
    var input = h("input", { type: "text", value: value || "" });
    var m = modal(title, [input], [
      { label: "Cancel" },
      { label: "OK", primary: true, action: function () { done(input.value); } }
    ]);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { m.close(); done(input.value); }
      if (e.key === "Escape") m.close();
    });
    setTimeout(function () { input.focus(); input.select(); }, 30);
  }

  function pickFiles(accept, multiple, done) {
    var input = h("input", { type: "file", style: "position:fixed;left:-1000px;top:0;opacity:0" });
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (accept && (!ios || accept.indexOf("audio") === 0)) input.accept = accept;
    if (multiple) input.multiple = true;
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      input.remove();
      if (files.length) done(files);
    });
    document.body.appendChild(input);
    input.click();
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(file);
    });
  }

  function saveBlob(blob, name, description, ext) {
    if (window.showSaveFilePicker) {
      var types = [{ description: description, accept: {} }];
      types[0].accept[blob.type || "application/octet-stream"] = ["." + ext];
      return window.showSaveFilePicker({ suggestedName: name, types: types }).then(function (handle) {
        return handle.createWritable().then(function (w) {
          return w.write(blob).then(function () { return w.close(); });
        });
      }).catch(function (err) {
        if (err && err.name === "AbortError") return;
        downloadBlob(blob, name);
      });
    }
    downloadBlob(blob, name);
    return Promise.resolve();
  }

  function downloadBlob(blob, name) {
    var a = h("a", { href: URL.createObjectURL(blob), download: name, style: "display:none" });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  }

  function safeName(s) {
    return (s || "Untitled").replace(/[\\/:*?"<>|]+/g, "_").trim() || "Untitled";
  }

  var E = {
    M: null,
    buf: null,
    f64: null,
    f32: null,
    i32: null,
    u8: null,
    fn: function (name) { return this.M ? this.M["_" + name] : null; },
    call: function (name) {
      var f = this.fn(name);
      if (!f) return 0;
      return f.apply(null, Array.prototype.slice.call(arguments, 1));
    },
    mem: function () {
      var b = this.M.wasmMemory ? this.M.wasmMemory.buffer : this.M.HEAPU8.buffer;
      if (b !== this.buf) {
        this.buf = b;
        this.f64 = new Float64Array(b);
        this.f32 = new Float32Array(b);
        this.i32 = new Int32Array(b);
        this.u8 = new Uint8Array(b);
      }
    },
    statusPtr: 0,
    status: function () {
      if (!this.statusPtr) this.statusPtr = this.call("vial_daw_status");
      if (!this.statusPtr) return null;
      this.mem();
      return this.f64.subarray(this.statusPtr >> 3, (this.statusPtr >> 3) + 64);
    },
    str: function (p) {
      if (!p) return "";
      var s = this.M.UTF8ToString(p);
      this.M._free(p);
      return s;
    },
    withString: function (s, f) {
      var n = this.M.lengthBytesUTF8(s) + 1;
      var p = this.M._malloc(n);
      this.M.stringToUTF8(s, p, n);
      try { return f(p); } finally { this.M._free(p); }
    },
    getState: function (slot) { return this.str(this.call("vial_daw_synth_get_state", slot)); },
    setState: function (slot, s) {
      var self = this;
      return this.withString(s, function (p) { return self.call("vial_daw_synth_set_state", slot, p); });
    },
    synthName: function (slot) { return this.str(this.call("vial_daw_synth_name", slot)); },
    setEvents: function (ints) {
      var count = ints.length / 5;
      var p = this.M._malloc(Math.max(4, ints.length * 4));
      this.mem();
      this.i32.set(ints, p >> 2);
      this.call("vial_daw_set_events", p, count);
      this.M._free(p);
    },
    padSample: function (kit, pad, channels, rate) {
      if (!channels || !channels.length) {
        this.call("vial_daw_set_pad_sample", kit, pad, 0, 0, 0, rate || 44100);
        return;
      }
      var frames = channels[0].length;
      var nch = Math.min(2, channels.length);
      var p = this.M._malloc(frames * nch * 4);
      this.mem();
      for (var c = 0; c < nch; c++) this.f32.set(channels[c], (p >> 2) + c * frames);
      this.call("vial_daw_set_pad_sample", kit, pad, p, frames, nch, rate);
      this.M._free(p);
    },
    recBuf: 0,
    pollRecorded: function () {
      if (!this.recBuf) this.recBuf = this.M._malloc(256 * 4 * 8);
      var n = this.call("vial_daw_poll_recorded", this.recBuf, 256);
      var out = [];
      if (n > 0) {
        this.mem();
        var base = this.recBuf >> 3;
        for (var i = 0; i < n; i++)
          out.push({ on: this.f64[base + i * 4] > 0.5, note: this.f64[base + i * 4 + 1] | 0, vel: this.f64[base + i * 4 + 2] | 0, tick: this.f64[base + i * 4 + 3] });
      }
      return out;
    }
  };

  var rt = {
    ready: false,
    slots: new Map(),
    kits: new Map(),
    deletedStates: new Map(),
    samples: new Map(),
    decoded: new Map(),
    defaults: {},
    sampleRate: 44100,
    position: 0,
    playing: false,
    recording: false,
    take: null,
    undo: [],
    redo: [],
    saveTimer: null,
    prevKeyboardOffset: 48,
    drumOffsetActive: false,
    bounce: null,
    hist: [],
    playFrom: 0
  };

  var ui = {
    view: "tracks",
    pxPerBeat: coarse ? 22 : 26,
    trackH: coarse ? 58 : 54,
    snap: "bar",
    sel: new Set(),
    editorRegionId: null,
    paneMode: "editor",
    paneOpen: true,
    paneH: 0,
    prPxPerBeat: coarse ? 90 : 80,
    prSnap: 240,
    prVel: 100,
    prSel: new Set(),
    prNoteH: coarse ? 16 : 12,
    stepRowH: coarse ? 32 : 26,
    stepCell: coarse ? 30 : 24,
    kbOctave: 4,
    selectedPad: 0,
    follow: true
  };

  var project = null;

  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 2147483648 - 1;
    };
  }

  function biquad(x, type, f, q, sr) {
    var w = 2 * Math.PI * f / sr, cs = Math.cos(w), sn = Math.sin(w), a = sn / (2 * q);
    var b0, b1, b2, a0 = 1 + a, a1 = -2 * cs, a2 = 1 - a;
    if (type === "bp") { b0 = a; b1 = 0; b2 = -a; }
    else if (type === "hp") { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
    else { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }

  function normalize(x, level) {
    var peak = 0;
    for (var i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
    var g = peak > 0 ? level / peak : 1;
    var fade = Math.min(x.length, 256);
    for (var j = 0; j < x.length; j++) {
      x[j] *= g;
      if (j >= x.length - fade) x[j] *= (x.length - j) / fade;
    }
    return x;
  }

  function metallic(n, sr, base) {
    var freqs = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
    var out = new Float32Array(n);
    var k = (base || 1);
    for (var i = 0; i < n; i++) {
      var t = i / sr, v = 0;
      for (var f = 0; f < freqs.length; f++) v += Math.sin(2 * Math.PI * freqs[f] * k * t) > 0 ? 1 : -1;
      out[i] = v / freqs.length;
    }
    return out;
  }

  function synthDrum(pad, style, sr) {
    var rnd = seeded(1234 + pad * 77 + (style === "909" ? 5000 : 0));
    var is9 = style === "909";
    var len = function (s) { return Math.floor(s * sr); };
    var noise = function (n) { var a = new Float32Array(n); for (var i = 0; i < n; i++) a[i] = rnd(); return a; };
    var x, n, i, t, ph;

    if (pad === 0) {
      n = len(is9 ? 0.55 : 0.75); x = new Float32Array(n); ph = 0;
      var f0 = is9 ? 230 : 160, f1 = is9 ? 52 : 46, tp = is9 ? 0.028 : 0.045, ta = is9 ? 0.2 : 0.33;
      var clickN = noise(n);
      for (i = 0; i < n; i++) {
        t = i / sr;
        var f = f1 + (f0 - f1) * Math.exp(-t / tp);
        ph += 2 * Math.PI * f / sr;
        var v = Math.sin(ph) * Math.exp(-t / ta) + clickN[i] * Math.exp(-t / 0.0025) * (is9 ? 0.5 : 0.25);
        x[i] = is9 ? Math.tanh(v * 1.8) : v;
      }
      return normalize(x, 0.95);
    }
    if (pad === 1) {
      n = len(0.09); x = new Float32Array(n);
      var nb = biquad(noise(n), "bp", 3200, 2, sr);
      for (i = 0; i < n; i++) { t = i / sr; x[i] = Math.sin(2 * Math.PI * 1720 * t) * Math.exp(-t / 0.011) + nb[i] * Math.exp(-t / 0.007) * 1.5; }
      return normalize(x, 0.7);
    }
    if (pad === 2 || pad === 4) {
      var hi = pad === 4;
      n = len(0.38); x = new Float32Array(n);
      var sn = biquad(noise(n), "hp", hi ? 2200 : 1400, 0.7, sr);
      var ft = hi ? 235 : (is9 ? 200 : 182), nd = hi ? 0.075 : (is9 ? 0.15 : 0.11);
      for (i = 0; i < n; i++) {
        t = i / sr;
        x[i] = Math.sin(2 * Math.PI * ft * t) * Math.exp(-t / 0.055) * 0.55 + Math.sin(2 * Math.PI * ft * 1.8 * t) * Math.exp(-t / 0.035) * 0.3 +
               sn[i] * Math.exp(-t / nd) * (is9 ? 0.85 : 0.6);
      }
      return normalize(x, 0.85);
    }
    if (pad === 3) {
      n = len(0.42); x = new Float32Array(n);
      var cb = biquad(noise(n), "bp", is9 ? 1300 : 1050, 1.2, sr);
      for (i = 0; i < n; i++) {
        t = i / sr;
        var env = 0;
        [0, 0.011, 0.022].forEach(function (o) { if (t >= o) env += Math.exp(-(t - o) / 0.0055); });
        if (t >= 0.031) env += Math.exp(-(t - 0.031) / (is9 ? 0.15 : 0.12)) * 0.9;
        x[i] = cb[i] * env;
      }
      return normalize(x, 0.85);
    }
    if (pad === 5 || pad === 7 || pad === 9) {
      var base = pad === 5 ? 82 : pad === 7 ? 122 : 172;
      if (is9) base *= 1.12;
      n = len(0.65); x = new Float32Array(n); ph = 0;
      var tn = noise(n);
      for (i = 0; i < n; i++) {
        t = i / sr;
        ph += 2 * Math.PI * base * (1 + 0.55 * Math.exp(-t / 0.05)) / sr;
        x[i] = Math.sin(ph) * Math.exp(-t / 0.24) + tn[i] * Math.exp(-t / 0.006) * 0.25;
      }
      return normalize(x, 0.85);
    }
    if (pad === 6 || pad === 8 || pad === 10) {
      var decay = pad === 6 ? 0.045 : pad === 8 ? 0.085 : 0.42;
      n = len(decay * 5 + 0.05);
      var src = metallic(n, sr, is9 ? 1.25 : 1);
      if (is9) { var nz = noise(n); for (i = 0; i < n; i++) src[i] = src[i] * 0.5 + nz[i] * 0.6; }
      x = biquad(biquad(src, "bp", 10000, 0.9, sr), "hp", 7000, 0.7, sr);
      for (i = 0; i < n; i++) { t = i / sr; x[i] *= Math.exp(-t / decay); }
      return normalize(x, pad === 10 ? 0.6 : 0.55);
    }
    if (pad === 11) {
      n = len(0.36); x = new Float32Array(n); ph = 0;
      for (i = 0; i < n; i++) {
        t = i / sr;
        ph += 2 * Math.PI * (is9 ? 360 : 330) * (1 + 0.12 * Math.exp(-t / 0.01)) / sr;
        x[i] = Math.sin(ph) * Math.exp(-t / 0.11);
      }
      return normalize(x, 0.75);
    }
    if (pad === 12) {
      n = len(0.5); x = new Float32Array(n);
      for (i = 0; i < n; i++) {
        t = i / sr;
        var sq = (Math.sin(2 * Math.PI * 540 * t) > 0 ? 1 : -1) + (Math.sin(2 * Math.PI * 800 * t) > 0 ? 1 : -1);
        x[i] = sq * (Math.exp(-t / 0.018) * 0.6 + Math.exp(-t / 0.16) * 0.4);
      }
      x = biquad(x, "bp", 900, 1.4, sr);
      return normalize(x, 0.6);
    }
    if (pad === 13 || pad === 15) {
      var ride = pad === 15;
      n = len(ride ? 1.7 : 2.1);
      var m = metallic(n, sr, ride ? 1.9 : 1.45), cn = noise(n);
      x = new Float32Array(n);
      for (i = 0; i < n; i++) {
        t = i / sr;
        x[i] = m[i] * (ride ? 0.8 : 0.45) + cn[i] * (ride ? 0.2 : 0.7);
        if (ride) x[i] += (Math.sin(2 * Math.PI * 3150 * t) + Math.sin(2 * Math.PI * 4720 * t)) * 0.25 * Math.exp(-t / 0.5);
      }
      x = biquad(x, "hp", ride ? 4200 : 5000, 0.7, sr);
      for (i = 0; i < n; i++) {
        t = i / sr;
        x[i] *= Math.exp(-t / (ride ? 0.55 : 0.65)) * Math.min(1, t / 0.002);
      }
      return normalize(x, ride ? 0.45 : 0.55);
    }
    n = len(0.2); x = biquad(noise(len(0.2)), "bp", 6200, 1.1, sr);
    for (i = 0; i < n; i++) { t = i / sr; x[i] *= Math.min(1, t / 0.025) * Math.exp(-Math.max(0, t - 0.025) / 0.05); }
    return normalize(x, 0.5);
  }

  function defaultSample(style, pad) {
    var key = style + ":" + pad + ":" + rt.sampleRate;
    if (!rt.defaults[key]) rt.defaults[key] = synthDrum(pad, style, rt.sampleRate);
    return rt.defaults[key];
  }

  function newKit(style) {
    var pads = [];
    for (var i = 0; i < 16; i++)
      pads.push({ name: PAD_NAMES[i], sample: null, gain: 0, pan: 0, pitch: 0, choke: PAD_CHOKE[i] });
    return { style: style || "808", pads: pads };
  }

  function newTrack(type, name) {
    var t = { id: uid(), name: name, type: type, color: type === "drums" ? DRUM_COLOR : SYNTH_COLOR, volume: 0, pan: 0, mute: false, solo: false };
    if (type === "drums") t.kit = newKit("808");
    return t;
  }

  function demoProject() {
    var synth = newTrack("synth", "Vial 1");
    var drums = newTrack("drums", "Drums");
    synth.volume = -6;
    drums.volume = -3;
    var bar = 4 * PPQ;
    var beat = [];
    for (var b = 0; b < 4; b++) {
      var o = b * bar;
      beat.push({ t: o, len: 240, note: 36, vel: 112 });
      beat.push({ t: o + 2 * PPQ + PPQ / 2, len: 240, note: 36, vel: 96 });
      beat.push({ t: o + PPQ, len: 240, note: 38, vel: 108 });
      beat.push({ t: o + 3 * PPQ, len: 240, note: 38, vel: 108 });
      for (var hh = 0; hh < 8; hh++) beat.push({ t: o + hh * PPQ / 2, len: 240, note: hh === 7 && b === 3 ? 46 : 42, vel: hh % 2 ? 72 : 96 });
    }
    var chords = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]];
    var notes = [];
    chords.forEach(function (c, i) {
      c.forEach(function (n) { notes.push({ t: i * bar, len: bar - 60, note: n, vel: 90 }); });
      notes.push({ t: i * bar, len: PPQ * 1.5, note: c[0] - 12, vel: 100 });
      notes.push({ t: i * bar + PPQ * 2, len: PPQ * 1.5, note: c[0] - 12, vel: 92 });
    });
    return {
      version: 1,
      name: "Untitled",
      bpm: 112,
      beatsPerBar: 4,
      loop: { on: true, start: 0, end: 4 * bar },
      metronome: false,
      countIn: 1,
      master: 0,
      tracks: [synth, drums],
      regions: [
        { id: uid(), trackId: synth.id, start: 0, length: 4 * bar, name: "Chords", notes: notes },
        { id: uid(), trackId: drums.id, start: 0, length: 4 * bar, name: "Beat", notes: beat }
      ],
      selectedTrackId: synth.id
    };
  }

  function emptyProject() {
    var p = demoProject();
    p.regions = [];
    p.bpm = 120;
    p.loop.on = false;
    return p;
  }

  function trackById(id) {
    for (var i = 0; i < project.tracks.length; i++) if (project.tracks[i].id === id) return project.tracks[i];
    return null;
  }
  function trackIndex(id) {
    for (var i = 0; i < project.tracks.length; i++) if (project.tracks[i].id === id) return i;
    return -1;
  }
  function regionById(id) {
    for (var i = 0; i < project.regions.length; i++) if (project.regions[i].id === id) return project.regions[i];
    return null;
  }
  function selectedTrack() { return trackById(project.selectedTrackId) || project.tracks[0] || null; }
  function trackWithSlot(slot) {
    var found = null;
    rt.slots.forEach(function (s, id) { if (s === slot && trackById(id)) found = trackById(id); });
    return found;
  }
  function songEnd() {
    var end = 0;
    project.regions.forEach(function (r) { end = Math.max(end, r.start + r.length); });
    return end;
  }

  function snapshot() {
    return JSON.stringify({
      bpm: project.bpm, beatsPerBar: project.beatsPerBar, loop: project.loop,
      tracks: project.tracks.map(function (t) { var c = Object.assign({}, t); delete c.state; return c; }),
      regions: project.regions, selectedTrackId: project.selectedTrackId
    });
  }

  function pushUndo(snap) {
    rt.undo.push(snap || snapshot());
    if (rt.undo.length > 120) rt.undo.shift();
    rt.redo = [];
    updateUndoButtons();
  }

  function restoreSnapshot(s) {
    var p = JSON.parse(s);
    var current = new Map(project.tracks.map(function (t) { return [t.id, t]; }));
    p.tracks.forEach(function (t) {
      var c = current.get(t.id);
      if (c) {
        t.volume = c.volume; t.pan = c.pan; t.mute = c.mute; t.solo = c.solo;
        if (c.kit) t.kit = c.kit;
      }
    });
    project.tracks = p.tracks;
    project.regions = p.regions;
    project.selectedTrackId = p.selectedTrackId;
    project.loop = p.loop;
    ui.sel.forEach(function (id) { if (!regionById(id)) ui.sel.delete(id); });
    if (ui.editorRegionId && !regionById(ui.editorRegionId)) ui.editorRegionId = null;
    ui.prSel.clear();
    reconcile();
    renderAll();
    scheduleSave();
  }

  function undo() {
    if (!rt.undo.length) return;
    rt.redo.push(snapshot());
    restoreSnapshot(rt.undo.pop());
    updateUndoButtons();
  }

  function redo() {
    if (!rt.redo.length) return;
    rt.undo.push(snapshot());
    restoreSnapshot(rt.redo.pop());
    updateUndoButtons();
  }

  function freeSynthSlot() {
    var used = new Set();
    rt.slots.forEach(function (s, id) { if (trackById(id)) used.add(s); });
    for (var s = 0; s < MAX_SYNTHS; s++) if (!used.has(s)) return s;
    return -1;
  }

  function freeKit() {
    var used = new Set();
    rt.kits.forEach(function (k, id) { if (trackById(id)) used.add(k); });
    for (var k = 0; k < MAX_KITS; k++) if (!used.has(k)) return k;
    return -1;
  }

  function reconcile() {
    rt.slots.forEach(function (slot, id) {
      if (!trackById(id) || trackById(id).type !== "synth") {
        rt.slots.delete(id);
        if (slot > 0) E.call("vial_daw_synth_release", slot);
      }
    });
    rt.kits.forEach(function (kit, id) {
      if (!trackById(id) || trackById(id).type !== "drums") rt.kits.delete(id);
    });

    project.tracks.forEach(function (t) {
      if (t.type === "synth" && !rt.slots.has(t.id)) {
        var slot = freeSynthSlot();
        if (slot < 0) return;
        rt.slots.set(t.id, slot);
        E.call("vial_daw_synth_ensure", slot);
        var st = t.state || rt.deletedStates.get(t.id);
        if (st) E.setState(slot, st);
        else E.call("vial_daw_synth_init", slot);
      }
      if (t.type === "drums" && !rt.kits.has(t.id)) {
        var kit = freeKit();
        if (kit < 0) return;
        rt.kits.set(t.id, kit);
        pushKit(t);
      }
    });
    pushTracks();
    pushEvents();
  }

  function pushTracks() {
    if (!rt.ready) return;
    var tracks = project.tracks;
    E.call("vial_daw_set_num_tracks", tracks.length);
    tracks.forEach(function (t, i) {
      var type = 0, slot = 0;
      if (t.type === "synth" && rt.slots.has(t.id)) { type = 1; slot = rt.slots.get(t.id); }
      if (t.type === "drums" && rt.kits.has(t.id)) { type = 2; slot = rt.kits.get(t.id); }
      E.call("vial_daw_set_track", i, type, slot, dbToGain(t.volume), t.pan, t.mute ? 1 : 0, t.solo ? 1 : 0);
    });
    E.call("vial_daw_set_selected", trackIndex(project.selectedTrackId));
    E.call("vial_daw_set_master", dbToGain(project.master));
  }

  function pushEvents() {
    if (!rt.ready) return;
    var out = [];
    project.regions.forEach(function (r) {
      var ti = trackIndex(r.trackId);
      if (ti < 0) return;
      r.notes.forEach(function (n) {
        if (n.t >= r.length || n.t < 0) return;
        out.push(Math.round(r.start + n.t), Math.max(1, Math.round(Math.min(n.len, r.length - n.t))), ti, n.note, n.vel);
      });
    });
    E.setEvents(new Int32Array(out));
  }

  function pushTransport() {
    if (!rt.ready) return;
    E.call("vial_daw_set_bpm", project.bpm);
    E.call("vial_daw_set_beats_per_bar", project.beatsPerBar);
    E.call("vial_daw_set_loop", project.loop.on ? 1 : 0, project.loop.start, project.loop.end);
    E.call("vial_daw_set_metronome", project.metronome ? 1 : 0);
  }

  function padChannels(t, i) {
    var pad = t.kit.pads[i];
    if (pad.sample && rt.decoded.has(pad.sample.id)) return rt.decoded.get(pad.sample.id);
    return { channels: [defaultSample(t.kit.style, i)], rate: rt.sampleRate };
  }

  function pushPad(t, i) {
    if (!rt.ready || !rt.kits.has(t.id)) return;
    var kit = rt.kits.get(t.id);
    var pad = t.kit.pads[i];
    var data = padChannels(t, i);
    E.padSample(kit, i, data.channels, data.rate);
    E.call("vial_daw_set_pad", kit, i, dbToGain(pad.gain), pad.pan, pad.pitch, pad.choke | 0);
  }

  function pushPadParams(t, i) {
    if (!rt.ready || !rt.kits.has(t.id)) return;
    var pad = t.kit.pads[i];
    E.call("vial_daw_set_pad", rt.kits.get(t.id), i, dbToGain(pad.gain), pad.pan, pad.pitch, pad.choke | 0);
  }

  function pushKit(t) {
    if (!t.kit) return;
    for (var i = 0; i < 16; i++) pushPad(t, i);
    t.kit.pads.forEach(function (pad, i) {
      if (pad.sample && !rt.decoded.has(pad.sample.id))
        loadSampleData(pad.sample.id).then(function (ok) { if (ok) pushPad(t, i); });
    });
  }

  var decodeCtx = null;
  function decodeAudio(bytes) {
    var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!decodeCtx) decodeCtx = new Ctx(2, 1, rt.sampleRate);
    var copy = bytes.slice(0);
    return new Promise(function (resolve, reject) {
      var done = false;
      var p = decodeCtx.decodeAudioData(copy, function (b) { if (!done) { done = true; resolve(b); } }, function (e) { if (!done) { done = true; reject(e || new Error("decode failed")); } });
      if (p && p.then) p.then(function (b) { if (!done) { done = true; resolve(b); } }, function (e) { if (!done) { done = true; reject(e); } });
    }).then(function (buffer) {
      var maxFrames = Math.min(buffer.length, Math.floor(buffer.sampleRate * 30));
      var chans = [];
      for (var c = 0; c < Math.min(2, buffer.numberOfChannels); c++) chans.push(buffer.getChannelData(c).slice(0, maxFrames));
      return { channels: chans, rate: buffer.sampleRate };
    });
  }

  function fsReady() {
    try { E.M.FS.mkdirTree(DIR + "/samples"); } catch (e) { }
  }

  function loadSampleData(id) {
    if (rt.decoded.has(id)) return Promise.resolve(true);
    var bytes = rt.samples.has(id) ? rt.samples.get(id).bytes : null;
    if (!bytes) {
      try { bytes = E.M.FS.readFile(DIR + "/samples/" + id); } catch (e) { bytes = null; }
      if (bytes) rt.samples.set(id, { bytes: bytes });
    }
    if (!bytes) return Promise.resolve(false);
    var ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return decodeAudio(ab).then(function (d) { rt.decoded.set(id, d); return true; }).catch(function () { return false; });
  }

  function importSample(file) {
    return readFile(file).then(function (ab) {
      return decodeAudio(ab).then(function (d) {
        var id = "s" + uid();
        var bytes = new Uint8Array(ab);
        fsReady();
        try { E.M.FS.writeFile(DIR + "/samples/" + id, bytes); } catch (e) { }
        rt.samples.set(id, { bytes: bytes, name: file.name });
        rt.decoded.set(id, d);
        return { id: id, name: file.name };
      });
    });
  }

  function scheduleSave() {
    clearTimeout(rt.saveTimer);
    rt.saveTimer = setTimeout(saveLocal, 1500);
  }

  function serialize(withSamples) {
    var p = JSON.parse(JSON.stringify(project));
    p.tracks.forEach(function (t) {
      if (t.type === "synth" && rt.slots.has(t.id)) t.state = E.getState(rt.slots.get(t.id));
    });
    if (withSamples) {
      p.samples = {};
      p.tracks.forEach(function (t) {
        if (!t.kit) return;
        t.kit.pads.forEach(function (pad) {
          if (!pad.sample || p.samples[pad.sample.id]) return;
          var s = rt.samples.get(pad.sample.id);
          var bytes = s ? s.bytes : null;
          if (!bytes) { try { bytes = E.M.FS.readFile(DIR + "/samples/" + pad.sample.id); } catch (e) { } }
          if (bytes) p.samples[pad.sample.id] = { name: pad.sample.name, data: toBase64(bytes) };
        });
      });
    }
    return p;
  }

  function toBase64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return btoa(s);
  }

  function fromBase64(b64) {
    var s = atob(b64), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function saveLocal() {
    if (!rt.ready || !project || rt.bounce) return;
    try {
      fsReady();
      E.M.FS.writeFile(DIR + "/project.json", JSON.stringify(serialize(false)));
      if (E.M.vialSync) E.M.vialSync();
    } catch (e) { console.warn("Autosave failed", e); }
  }

  function loadLocal() {
    try {
      var text = E.M.FS.readFile(DIR + "/project.json", { encoding: "utf8" });
      return JSON.parse(text);
    } catch (e) { return null; }
  }

  function normalizeProject(p) {
    var d = emptyProject();
    var out = {
      version: 1,
      name: p.name || "Untitled",
      bpm: clamp(+p.bpm || 120, 20, 400),
      beatsPerBar: clamp(p.beatsPerBar | 0 || 4, 1, 16),
      loop: p.loop && typeof p.loop.start === "number" ? p.loop : d.loop,
      metronome: !!p.metronome,
      countIn: p.countIn == null ? 1 : p.countIn | 0,
      master: typeof p.master === "number" ? p.master : 0,
      tracks: [],
      regions: [],
      selectedTrackId: p.selectedTrackId
    };
    var synths = 0, kits = 0;
    (p.tracks || []).forEach(function (t) {
      if (out.tracks.length >= MAX_TRACKS) return;
      if (t.type === "synth" && synths >= MAX_SYNTHS) return;
      if (t.type === "drums" && kits >= MAX_KITS) return;
      if (t.type !== "synth" && t.type !== "drums") return;
      if (t.type === "synth") synths++; else kits++;
      var nt = { id: t.id || uid(), name: t.name || (t.type === "synth" ? "Vial" : "Drums"), type: t.type, color: t.color || (t.type === "drums" ? DRUM_COLOR : SYNTH_COLOR),
        volume: typeof t.volume === "number" ? t.volume : 0, pan: +t.pan || 0, mute: !!t.mute, solo: !!t.solo };
      if (t.state) nt.state = t.state;
      if (t.type === "drums") {
        var k = newKit(t.kit && t.kit.style);
        if (t.kit && t.kit.pads) t.kit.pads.forEach(function (pad, i) { if (i < 16) k.pads[i] = Object.assign(k.pads[i], pad); });
        nt.kit = k;
      }
      out.tracks.push(nt);
    });
    var ids = new Set(out.tracks.map(function (t) { return t.id; }));
    (p.regions || []).forEach(function (r) {
      if (!ids.has(r.trackId)) return;
      out.regions.push({ id: r.id || uid(), trackId: r.trackId, start: Math.max(0, r.start | 0), length: Math.max(60, r.length | 0), name: r.name || "Region",
        notes: (r.notes || []).map(function (n) { return { t: Math.max(0, +n.t || 0), len: Math.max(1, +n.len || 240), note: clamp(n.note | 0, 0, 127), vel: clamp(n.vel | 0 || 100, 1, 127) }; }) });
    });
    if (!ids.has(out.selectedTrackId)) out.selectedTrackId = out.tracks.length ? out.tracks[0].id : null;
    return out;
  }

  function loadProject(p, fromFile) {
    stopTransport(true);
    if (p.samples) {
      fsReady();
      Object.keys(p.samples).forEach(function (id) {
        var s = p.samples[id];
        try {
          var bytes = fromBase64(s.data);
          E.M.FS.writeFile(DIR + "/samples/" + id, bytes);
          rt.samples.set(id, { bytes: bytes, name: s.name });
        } catch (e) { }
      });
    }
    rt.slots.forEach(function (slot) { if (slot > 0) E.call("vial_daw_synth_release", slot); });
    rt.slots.clear();
    rt.kits.clear();
    rt.undo = [];
    rt.redo = [];
    project = normalizeProject(p);
    ui.sel.clear();
    ui.prSel.clear();
    ui.editorRegionId = null;

    var sel = selectedTrack();
    var guiTrack = sel && sel.type === "synth" ? sel : project.tracks.find(function (t) { return t.type === "synth"; });
    if (guiTrack) {
      rt.slots.set(guiTrack.id, 0);
      if (guiTrack.state) E.setState(0, guiTrack.state);
      else if (fromFile) E.call("vial_daw_synth_init", 0);
    }
    reconcile();
    project.tracks.forEach(function (t) { delete t.state; });
    pushTransport();
    rt.position = 0;
    E.call("vial_daw_locate", 0);
    var first = project.regions[0];
    if (first) ui.editorRegionId = first.id;
    updateKeyboardOffset();
    renderAll();
    updateUndoButtons();
  }

  function selectTrack(id) {
    if (!trackById(id)) return;
    if (project.selectedTrackId === id) return;
    project.selectedTrackId = id;
    E.call("vial_daw_set_selected", trackIndex(id));
    updateKeyboardOffset();
    renderHeaders();
    renderLanesSelection();
    if (ui.view === "mixer") renderMixer();
    if (ui.paneMode === "keys") renderPane();
    scheduleSave();
  }

  function updateKeyboardOffset() {
    var t = selectedTrack();
    var drums = !!(t && t.type === "drums");
    if (drums && !rt.drumOffsetActive) {
      rt.prevKeyboardOffset = E.call("vial_daw_keyboard_offset", 36);
      rt.drumOffsetActive = true;
    }
    else if (!drums && rt.drumOffsetActive) {
      E.call("vial_daw_keyboard_offset", rt.prevKeyboardOffset);
      rt.drumOffsetActive = false;
    }
  }

  function bringToSynth(t) {
    if (!t || t.type !== "synth" || !rt.slots.has(t.id)) return;
    var slot = rt.slots.get(t.id);
    if (slot === 0) return;
    var current = trackWithSlot(0);
    var incoming = E.getState(slot);
    if (current) {
      var outgoing = E.getState(0);
      E.setState(slot, outgoing);
      rt.slots.set(current.id, slot);
    }
    else {
      rt.slots.delete(t.id);
      E.call("vial_daw_synth_release", slot);
    }
    E.setState(0, incoming);
    rt.slots.set(t.id, 0);
    pushTracks();
  }

  function addTrack(type) {
    if (project.tracks.length >= MAX_TRACKS) { toast("This project already has the maximum of " + MAX_TRACKS + " tracks."); return; }
    var count = project.tracks.filter(function (t) { return t.type === type; }).length;
    if (type === "synth" && count >= MAX_SYNTHS) { toast("This device can run up to " + MAX_SYNTHS + " Vial instruments at once."); return; }
    if (type === "drums" && count >= MAX_KITS) { toast("Up to " + MAX_KITS + " drum machines per project."); return; }
    pushUndo();
    var name = type === "synth" ? "Vial " + (count + 1) : (count ? "Drums " + (count + 1) : "Drums");
    var t = newTrack(type, name);
    var idx = trackIndex(project.selectedTrackId);
    project.tracks.splice(idx >= 0 ? idx + 1 : project.tracks.length, 0, t);
    reconcile();
    project.selectedTrackId = t.id;
    pushTracks();
    updateKeyboardOffset();
    renderAll();
    scheduleSave();
    return t;
  }

  function deleteTrack(id) {
    var t = trackById(id);
    if (!t) return;
    pushUndo();
    if (t.type === "synth" && rt.slots.has(id)) {
      var slot = rt.slots.get(id);
      rt.deletedStates.set(id, E.getState(slot));
      if (slot === 0) {
        rt.slots.delete(id);
        var other = project.tracks.find(function (x) { return x.type === "synth" && x.id !== id; });
        if (other) {
          var oslot = rt.slots.get(other.id);
          if (oslot > 0) {
            E.setState(0, E.getState(oslot));
            rt.slots.set(other.id, 0);
            E.call("vial_daw_synth_release", oslot);
          }
        }
      }
    }
    var idx = trackIndex(id);
    project.tracks.splice(idx, 1);
    project.regions = project.regions.filter(function (r) { return r.trackId !== id; });
    if (project.selectedTrackId === id) project.selectedTrackId = project.tracks.length ? project.tracks[Math.max(0, idx - 1)].id : null;
    if (ui.editorRegionId && !regionById(ui.editorRegionId)) ui.editorRegionId = null;
    reconcile();
    updateKeyboardOffset();
    renderAll();
    scheduleSave();
  }

  function commit(opts) {
    pushEvents();
    renderArrange();
    if (!opts || !opts.keepPane) renderPane();
    scheduleSave();
  }

  var bar, stage, views = {};
  var lcd = {};
  var tv = {};

  function buildBar() {
    bar = document.getElementById("bar");
    bar.innerHTML = "";
    var menuBtn = btn(ICONS.menu, "Menu", function () { openMainMenu(menuBtn); });

    var seg = h("div", { class: "seg" });
    [["tracks", "Tracks"], ["mixer", "Mixer"], ["synth", "Synth"], ["drums", "Drums"]].forEach(function (v) {
      var b = h("button", { "data-view": v[0], text: v[1], tabindex: "-1" });
      b.addEventListener("click", function () { showView(v[0]); });
      seg.appendChild(b);
    });
    lcd.seg = seg;

    var transport = h("div", { class: "grp transport" }, [
      btn(ICONS.start, "Go to beginning (Return)", function () { gotoStart(); }, "narrow-hide"),
      lcd.stop = btn(ICONS.stop, "Stop", function () { stopTransport(); }),
      lcd.play = btn(ICONS.play, "Play / Stop (Space)", function () { togglePlay(); }),
      lcd.rec = btn(ICONS.rec, "Record (R)", function () { toggleRecord(); }),
      lcd.cycle = btn(ICONS.cycle, "Cycle (C)", function () { toggleCycle(); })
    ]);
    lcd.play.id = "btn-play";
    lcd.rec.id = "btn-rec";

    lcd.pos = h("div", { class: "big", text: "1 . 1 . 1" });
    lcd.time = h("div", { class: "big", text: "0:00.0" });
    lcd.bpm = h("input", { type: "text", inputmode: "decimal", value: "120", title: "Tempo" });
    lcd.bpm.addEventListener("change", function () {
      var v = parseFloat(lcd.bpm.value);
      if (isFinite(v)) setBpm(v);
      lcd.bpm.value = fmtBpm(project.bpm);
    });
    lcd.bpm.addEventListener("keydown", function (e) { if (e.key === "Enter") lcd.bpm.blur(); });
    lcd.sig = h("select", { title: "Time signature" });
    for (var i = 2; i <= 7; i++) lcd.sig.appendChild(h("option", { value: String(i), text: i + "/4" }));
    lcd.sig.addEventListener("change", function () {
      project.beatsPerBar = parseInt(lcd.sig.value, 10);
      pushTransport();
      renderAll();
      scheduleSave();
    });
    lcd.box = h("div", { class: "lcd" }, [
      h("div", null, [lcd.pos, h("div", { class: "lbl", text: "bar  beat  div" })]),
      h("div", { class: "opt" }, [lcd.time, h("div", { class: "lbl", text: "time" })]),
      h("div", null, [lcd.bpm, h("div", { class: "lbl", text: "bpm" })]),
      h("div", { class: "opt" }, [lcd.sig, h("div", { class: "lbl", text: "sig" })])
    ]);

    lcd.metro = btn(ICONS.metro, "Metronome", function () { project.metronome = !project.metronome; pushTransport(); updateBar(); scheduleSave(); });
    lcd.countIn = btn(ICONS.countin, "Count-in before recording", function () { project.countIn = project.countIn ? 0 : 1; updateBar(); scheduleSave(); }, "narrow-hide");
    lcd.undo = btn(ICONS.undo, "Undo", function () { undo(); }, "wide-only");
    lcd.redo = btn(ICONS.redo, "Redo", function () { redo(); }, "wide-only");

    bar.appendChild(menuBtn);
    bar.appendChild(seg);
    bar.appendChild(h("div", { class: "spacer" }));
    bar.appendChild(transport);
    bar.appendChild(lcd.box);
    bar.appendChild(h("div", { class: "grp" }, [lcd.metro, lcd.countIn]));
    bar.appendChild(h("div", { class: "spacer" }));
    bar.appendChild(h("div", { class: "grp" }, [lcd.undo, lcd.redo]));
    updateBar();
  }

  function fmtBpm(v) { return (Math.round(v * 10) / 10).toString(); }

  function setBpm(v) {
    project.bpm = clamp(v, 20, 400);
    pushTransport();
    scheduleSave();
  }

  function updateBar() {
    if (!project) return;
    lcd.seg.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-view") === ui.view); });
    lcd.cycle.classList.toggle("on", !!project.loop.on);
    lcd.metro.classList.toggle("on", !!project.metronome);
    lcd.countIn.classList.toggle("on", !!project.countIn);
    if (document.activeElement !== lcd.bpm) lcd.bpm.value = fmtBpm(project.bpm);
    lcd.sig.value = String(project.beatsPerBar);
  }

  function updateUndoButtons() {
    if (!lcd.undo) return;
    lcd.undo.disabled = !rt.undo.length;
    lcd.redo.disabled = !rt.redo.length;
  }

  function openMainMenu(anchor) {
    showMenu(anchor, [
      { head: "Project" },
      { label: "New Project", action: newProjectPrompt },
      { label: "Open Project…", action: openProjectFile },
      { label: "Save Project…", key: "⌘S", action: saveProjectFile },
      { label: "Rename Project…", action: function () { askText("Project name", project.name, function (v) { project.name = v.trim() || "Untitled"; scheduleSave(); }); } },
      "-",
      { label: "Import MIDI File…", action: importMidiFile },
      { label: "Export MIDI File…", action: exportMidiFile },
      { label: "Bounce to WAV…", action: bounce },
      "-",
      { label: "New Vial Track", action: function () { addTrack("synth"); } },
      { label: "New Drum Machine Track", action: function () { addTrack("drums"); } },
      "-",
      { label: "Undo", key: "⌘Z", action: undo },
      { label: "Redo", key: "⇧⌘Z", action: redo },
      { label: "Metronome", checked: project.metronome, action: function () { project.metronome = !project.metronome; pushTransport(); updateBar(); } },
      { label: "Count-in (1 bar)", checked: !!project.countIn, action: function () { project.countIn = project.countIn ? 0 : 1; updateBar(); } },
      { label: "All Notes Off", action: function () { E.call("vial_daw_panic"); } },
      "-",
      { label: "Help & Shortcuts", action: showHelp }
    ]);
  }

  function showHelp() {
    var lines = [
      "Space — play / stop    Return — go to start",
      "R — record    C — cycle",
      "Play notes with A W S E D F T G Y H U J K O L P (Z / X change octave) or a MIDI keyboard. Notes go to the selected track.",
      "Tracks: double-click (double-tap) an empty lane to draw a region; double-click a region to edit it below.",
      "Piano roll: click (tap) to add a note, drag to move or resize, double-click to delete. Drum regions open in the step sequencer.",
      "⌘Z undo, ⇧⌘Z redo, ⌘D duplicate, Delete removes the selection.",
      "Synth shows the Vial instrument of the selected track. Drums is the drum machine: tap pads, drop audio files on them or use Load Sample."
    ];
    modal("Vial Studio", lines.map(function (l) { return h("p", { text: l, style: "margin:0 0 8px" }); }));
  }

  function newProjectPrompt() {
    modal("New project", "Start a new empty project? Unsaved changes in the current one are lost (it is not saved as a file unless you used Save Project).", [
      { label: "Cancel" },
      { label: "Demo Song", action: function () { loadProject(demoProject(), true); saveLocal(); } },
      { label: "Empty", primary: true, action: function () { loadProject(emptyProject(), true); saveLocal(); } }
    ]);
  }

  function saveProjectFile() {
    var data = serialize(true);
    var blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    saveBlob(blob, safeName(project.name) + ".vialproject", "Vial project", "vialproject");
  }

  function openProjectFile() {
    pickFiles(".vialproject,.json", false, function (files) {
      readFile(files[0]).then(function (ab) {
        var p = JSON.parse(new TextDecoder().decode(ab));
        if (!p || !p.tracks) throw new Error("not a project");
        if (!p.name || p.name === "Untitled") p.name = files[0].name.replace(/\.[^.]+$/, "");
        loadProject(p, true);
        saveLocal();
        toast("Opened " + project.name);
      }).catch(function () { toast("That file isn't a Vial project."); });
    });
  }

  function showView(v) {
    if (v === "synth") {
      var t = selectedTrack();
      var target = t && t.type === "synth" ? t : project.tracks.find(function (x) { return x.type === "synth"; });
      if (target) {
        if (project.selectedTrackId !== target.id) selectTrack(target.id);
        bringToSynth(target);
      }
    }
    if (v === "drums") {
      var d = selectedTrack();
      if (!d || d.type !== "drums") {
        var first = project.tracks.find(function (x) { return x.type === "drums"; });
        if (first) selectTrack(first.id);
      }
    }
    var leavingSynth = ui.view === "synth" && v !== "synth";
    ui.view = v;
    views.tracks.classList.toggle("hidden", v !== "tracks");
    views.mixer.classList.toggle("hidden", v !== "mixer");
    views.drums.classList.toggle("hidden", v !== "drums");
    stage.classList.toggle("hide-synth", v !== "synth");
    if (E.M) E.M.vialHideGL = v !== "synth";
    if (leavingSynth) scheduleSave();
    if (v === "tracks") renderAll();
    if (v === "mixer") renderMixer();
    if (v === "drums") renderDrums();
    updateBar();
  }

  function buildTracksView() {
    var root = views.tracks;
    root.innerHTML = "";
    var addBtn = btn(ICONS.plus, "New track", function () {
      showMenu(addBtn, [
        { label: "Vial Synth Track", action: function () { addTrack("synth"); } },
        { label: "Drum Machine Track", action: function () { addTrack("drums"); } }
      ]);
    }, "small");
    tv.snap = h("select", { title: "Snap" });
    [["bar", "Bar"], ["beat", "Beat"], ["8", "1/8"], ["16", "1/16"], ["off", "Off"]].forEach(function (o) { tv.snap.appendChild(h("option", { value: o[0], text: o[1] })); });
    tv.snap.value = ui.snap;
    tv.snap.addEventListener("change", function () { ui.snap = tv.snap.value; });

    var toolbar = h("div", { class: "toolbar" }, [
      btn("+ Track", "New track", function (e, b) {
        showMenu(b, [
          { label: "Vial Synth Track", action: function () { addTrack("synth"); } },
          { label: "Drum Machine Track", action: function () { addTrack("drums"); } }
        ]);
      }, "small"),
      btn("New Region", "Create an empty region at the playhead on the selected track", function () { createRegionAtPlayhead(); }, "small"),
      btn("Edit", "Open the selected region in the editor", function () { openSelectedInEditor(); }, "small"),
      btn("Duplicate", "Duplicate selected regions (⌘D)", function () { duplicateSelected(); }, "small"),
      btn("Split", "Split selected regions at the playhead", function () { splitAtPlayhead(); }, "small"),
      btn(ICONS.trash, "Delete selected regions", function () { deleteSelectedRegions(); }, "small"),
      h("label", null, ["Snap", tv.snap]),
      btn(ICONS.zoomOut, "Zoom out", function () { zoomArrange(1 / 1.4); }, "small"),
      btn(ICONS.zoomIn, "Zoom in", function () { zoomArrange(1.4); }, "small"),
      h("div", { class: "spacer" }),
      tv.paneEditor = btn("Editor", "Show the region editor", function () { togglePane("editor"); }, "small"),
      tv.paneKeys = btn("Keyboard", "Show an on-screen keyboard / pads", function () { togglePane("keys"); }, "small")
    ]);

    tv.headers = h("div", { class: "arr-headers" });
    tv.corner = h("div", { class: "corner" }, [addBtn, h("span", { text: "Tracks", style: "color:#9a9ea4;font-size:12px" })]);
    tv.hinner = h("div", { class: "inner" });
    tv.headers.appendChild(tv.corner);
    tv.headers.appendChild(tv.hinner);

    tv.scroll = h("div", { class: "arr-scroll" });
    tv.content = h("div", { class: "arr-content" });
    tv.ruler = h("div", { class: "ruler" });
    tv.rulerCanvas = h("canvas");
    tv.ruler.appendChild(tv.rulerCanvas);
    tv.rulerCanvas.style.position = "sticky";
    tv.rulerCanvas.style.left = "0";
    tv.lanes = h("div");
    tv.regions = h("div");
    tv.cycleShade = h("div", { class: "cycle-shade" });
    tv.playhead = h("div", { class: "playhead" });
    tv.content.appendChild(tv.ruler);
    tv.content.appendChild(tv.lanes);
    tv.content.appendChild(tv.cycleShade);
    tv.content.appendChild(tv.regions);
    tv.content.appendChild(tv.playhead);
    tv.scroll.appendChild(tv.content);

    tv.arr = h("div", { class: "arr" }, [tv.headers, tv.scroll]);
    tv.splitter = h("div", { class: "splitter" });
    tv.pane = h("div", { class: "pane" });
    tv.paneBar = h("div", { class: "toolbar" });
    tv.paneBody = h("div", { class: "pane-body" });
    tv.pane.appendChild(tv.paneBar);
    tv.pane.appendChild(tv.paneBody);

    root.appendChild(toolbar);
    root.appendChild(tv.arr);
    root.appendChild(tv.splitter);
    root.appendChild(tv.pane);

    tv.scroll.addEventListener("scroll", function () {
      tv.hinner.style.transform = "translateY(" + (-tv.scroll.scrollTop) + "px)";
      drawRuler();
    }, { passive: true });

    tv.scroll.addEventListener("touchstart", function (e) {
      var t = e.target;
      if (t.closest && (t.closest(".region") || t.closest(".ruler"))) e.preventDefault();
    }, { passive: false });
    tv.scroll.addEventListener("pointerdown", arrangePointerDown);
    tv.scroll.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomArrange(e.deltaY < 0 ? 1.1 : 1 / 1.1, e);
      }
    }, { passive: false });

    setupSplitter();
    window.addEventListener("resize", function () { layoutPane(); drawRuler(); renderPane(); });
  }

  function layoutPane() {
    var total = views.tracks.clientHeight;
    if (!total) return;
    if (!ui.paneH) ui.paneH = Math.round(total * (coarse ? 0.42 : 0.4));
    var h2 = ui.paneOpen ? clamp(ui.paneH, 120, Math.max(130, total - 160)) : 0;
    tv.pane.style.height = h2 + "px";
    tv.pane.style.display = ui.paneOpen ? "flex" : "none";
    tv.splitter.style.display = ui.paneOpen ? "flex" : "none";
    tv.paneEditor.classList.toggle("on", ui.paneOpen && ui.paneMode === "editor");
    tv.paneKeys.classList.toggle("on", ui.paneOpen && ui.paneMode === "keys");
  }

  function togglePane(mode) {
    if (ui.paneOpen && ui.paneMode === mode) ui.paneOpen = false;
    else { ui.paneOpen = true; ui.paneMode = mode; }
    layoutPane();
    renderPane();
  }

  function setupSplitter() {
    var startY = 0, startH = 0, id = null;
    tv.splitter.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      id = e.pointerId;
      startY = e.clientY;
      startH = tv.pane.offsetHeight;
      tv.splitter.setPointerCapture(id);
    });
    tv.splitter.addEventListener("pointermove", function (e) {
      if (id !== e.pointerId) return;
      ui.paneH = startH - (e.clientY - startY);
      layoutPane();
    });
    var end = function (e) {
      if (id !== e.pointerId) return;
      id = null;
      renderPane();
    };
    tv.splitter.addEventListener("pointerup", end);
    tv.splitter.addEventListener("pointercancel", end);
  }

  function pxPerTick() { return ui.pxPerBeat / PPQ; }
  function contentBars() { return Math.max(64, Math.ceil(songEnd() / barTicks()) + 16, Math.ceil(project.loop.end / barTicks()) + 8); }

  function zoomArrange(f, e) {
    var old = pxPerTick();
    var anchorX = e ? e.clientX - tv.scroll.getBoundingClientRect().left : tv.scroll.clientWidth / 2;
    var tick = (tv.scroll.scrollLeft + anchorX) / old;
    ui.pxPerBeat = clamp(ui.pxPerBeat * f, 4, 240);
    renderArrange();
    tv.scroll.scrollLeft = tick * pxPerTick() - anchorX;
    drawRuler();
  }

  function renderAll() {
    if (!project) return;
    updateBar();
    if (ui.view === "tracks") {
      renderHeaders();
      renderArrange();
      layoutPane();
      renderPane();
    }
    if (ui.view === "mixer") renderMixer();
    if (ui.view === "drums") renderDrums();
  }

  function trackSubtitle(t) {
    if (t.type === "drums") return KITS[t.kit.style] || "Drum Machine";
    var slot = rt.slots.get(t.id);
    var name = slot != null ? E.synthName(slot) : "";
    return "Vial · " + (name || "Init");
  }

  function renderHeaders() {
    if (!tv.hinner) return;
    tv.hinner.innerHTML = "";
    project.tracks.forEach(function (t) {
      var m = h("button", { class: "ms m" + (t.mute ? " on" : ""), text: "M", title: "Mute", tabindex: "-1" });
      var s = h("button", { class: "ms s" + (t.solo ? " on" : ""), text: "S", title: "Solo", tabindex: "-1" });
      var more = h("button", { class: "ms", html: ICONS.dots, title: "Track options", tabindex: "-1", style: "display:flex;align-items:center;justify-content:center" });
      more.firstChild.style.cssText = "width:14px;height:14px;fill:currentColor";
      m.addEventListener("click", function (e) { e.stopPropagation(); t.mute = !t.mute; pushTracks(); renderHeaders(); scheduleSave(); });
      s.addEventListener("click", function (e) { e.stopPropagation(); t.solo = !t.solo; pushTracks(); renderHeaders(); scheduleSave(); });
      more.addEventListener("click", function (e) { e.stopPropagation(); trackMenu(t, more); });
      var row = h("div", { class: "thead" + (t.id === project.selectedTrackId ? " sel" : ""), style: "height:" + ui.trackH + "px;--tc:" + t.color }, [
        h("div", { class: "tinfo" }, [h("div", { class: "tname", text: t.name }), h("div", { class: "tsub", text: trackSubtitle(t) })]),
        h("div", { class: "tbtns" }, [m, s, more])
      ]);
      row.addEventListener("click", function () { selectTrack(t.id); });
      row.addEventListener("dblclick", function () { renameTrack(t); });
      tv.hinner.appendChild(row);
    });
  }

  function renameTrack(t) {
    askText("Track name", t.name, function (v) {
      v = v.trim();
      if (!v) return;
      pushUndo();
      t.name = v;
      renderAll();
      scheduleSave();
    });
  }

  function trackMenu(t, anchor) {
    var items = [
      { label: "Rename…", action: function () { renameTrack(t); } },
      t.type === "synth" ? { label: "Open Synth", action: function () { selectTrack(t.id); showView("synth"); } }
                         : { label: "Open Drum Machine", action: function () { selectTrack(t.id); showView("drums"); } },
      { label: "New Region at Playhead", action: function () { selectTrack(t.id); createRegionAtPlayhead(); } },
      "-",
      { label: "Delete Track", action: function () { deleteTrack(t.id); } }
    ];
    showMenu(anchor, items);
  }

  function renderLanesSelection() {
    if (!tv.lanes) return;
    Array.prototype.forEach.call(tv.lanes.children, function (lane, i) {
      var t = project.tracks[i];
      lane.classList.toggle("sel", !!t && t.id === project.selectedTrackId);
    });
  }

  function renderArrange() {
    if (!tv.content || ui.view !== "tracks") return;
    var ppt = pxPerTick();
    var barW = barTicks() * ppt;
    var width = contentBars() * barW + 40;
    var height = RULER_H + project.tracks.length * ui.trackH + 120;
    tv.content.style.width = width + "px";
    tv.content.style.height = height + "px";
    tv.ruler.style.width = width + "px";

    var beatW = PPQ * ppt;
    var bg = "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px)";
    var bg2 = "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px)";
    tv.lanes.innerHTML = "";
    project.tracks.forEach(function (t, i) {
      var lane = h("div", { class: "lane" + (t.id === project.selectedTrackId ? " sel" : ""), style: "top:" + (RULER_H + i * ui.trackH) + "px;height:" + ui.trackH + "px" });
      lane.style.backgroundImage = beatW >= 8 ? bg + "," + bg2 : bg;
      lane.style.backgroundSize = beatW >= 8 ? barW + "px 100%," + beatW + "px 100%" : barW + "px 100%";
      tv.lanes.appendChild(lane);
    });

    tv.regions.innerHTML = "";
    project.regions.forEach(function (r) {
      var ti = trackIndex(r.trackId);
      if (ti < 0) return;
      tv.regions.appendChild(regionElement(r, ti));
    });
    if (rt.take) tv.regions.appendChild(rt.take.el = h("div", { class: "region recording" }));
    updateTakeElement();

    tv.cycleShade.style.display = project.loop.on ? "block" : "none";
    tv.cycleShade.style.left = project.loop.start * ppt + "px";
    tv.cycleShade.style.width = (project.loop.end - project.loop.start) * ppt + "px";
    tv.cycleShade.style.height = height + "px";
    tv.playhead.style.height = height + "px";
    tv.hinner.style.transform = "translateY(" + (-tv.scroll.scrollTop) + "px)";
    drawRuler();
    updatePlayhead();
  }

  function regionElement(r, ti) {
    var ppt = pxPerTick();
    var t = project.tracks[ti];
    var x = r.start * ppt, w = Math.max(6, r.length * ppt), top = RULER_H + ti * ui.trackH + 2, hh = ui.trackH - 5;
    var el = h("div", { class: "region" + (ui.sel.has(r.id) ? " sel" : ""), "data-id": r.id,
      style: "left:" + x + "px;top:" + top + "px;width:" + w + "px;height:" + hh + "px;--rc:" + (t.type === "drums" ? DRUM_COLOR : SYNTH_COLOR) });
    el.appendChild(h("div", { class: "rname", text: r.name }));
    var c = h("canvas");
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cw = Math.max(1, Math.min(8000, Math.floor(w))), ch = Math.max(1, hh - 17);
    c.width = Math.floor(cw * dpr);
    c.height = Math.floor(ch * dpr);
    c.style.width = cw + "px";
    c.style.height = ch + "px";
    el.appendChild(c);
    el.appendChild(h("div", { class: "rhandle", style: coarse ? "width:18px" : "" }));
    drawRegionNotes(c, r, ppt, dpr, t.type === "drums");
    return el;
  }

  function drawRegionNotes(c, r, ppt, dpr, drums) {
    var ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    var hh = c.height / dpr;
    if (!r.notes.length) return;
    var lo = 127, hi = 0;
    r.notes.forEach(function (n) { lo = Math.min(lo, n.note); hi = Math.max(hi, n.note); });
    if (drums) { lo = 36; hi = 51; }
    var span = Math.max(8, hi - lo + 1);
    var mid = (lo + hi) / 2;
    lo = mid - span / 2;
    var rowH = Math.max(1.5, (hh - 2) / span);
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    r.notes.forEach(function (n) {
      if (n.t >= r.length) return;
      var x = n.t * ppt, w = drums ? Math.max(2, 120 * ppt) : Math.max(1.5, Math.min(n.len, r.length - n.t) * ppt - 0.5);
      var y = hh - 1 - (n.note - lo + 1) * (hh - 2) / span;
      ctx.fillRect(x, y, w, Math.min(rowH, 3));
    });
  }

  function updateTakeElement() {
    var take = rt.take;
    if (!take || !take.el) return;
    var ppt = pxPerTick();
    var ti = trackIndex(take.trackId);
    if (ti < 0) return;
    var start = take.loop ? project.loop.start : take.start;
    var end = take.loop ? project.loop.end : Math.max(take.start + 1, rt.position);
    take.el.style.left = start * ppt + "px";
    take.el.style.width = Math.max(2, (end - start) * ppt) + "px";
    take.el.style.top = (RULER_H + ti * ui.trackH + 2) + "px";
    take.el.style.height = (ui.trackH - 5) + "px";
  }

  function drawRuler() {
    if (!tv.rulerCanvas || ui.view !== "tracks") return;
    var c = tv.rulerCanvas;
    var w = tv.scroll.clientWidth, hh = RULER_H;
    var dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(hh * dpr)) {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(hh * dpr);
      c.style.width = w + "px";
      c.style.height = hh + "px";
    }
    var ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    var sl = tv.scroll.scrollLeft;
    var ppt = pxPerTick();
    var bt = barTicks();
    var barW = bt * ppt;

    ctx.fillStyle = "#26292d";
    ctx.fillRect(0, 0, w, 12);
    if (project.loop.end > project.loop.start) {
      ctx.fillStyle = project.loop.on ? "#d6b93d" : "rgba(214,185,61,0.35)";
      var lx = project.loop.start * ppt - sl, lw = (project.loop.end - project.loop.start) * ppt;
      ctx.fillRect(lx, 1, lw, 10);
    }

    var every = 1;
    while (barW * every < 34) every *= 2;
    var first = Math.floor(sl / barW);
    var last = Math.ceil((sl + w) / barW);
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    for (var b = first; b <= last; b++) {
      var x = b * barW - sl;
      if (b % every === 0) {
        ctx.fillStyle = "#8f949a";
        ctx.fillRect(x, 12, 1, hh - 12);
        ctx.fillStyle = "#d0d3d8";
        ctx.fillText(String(b + 1), x + 4, 21);
      }
      else if (barW >= 10) {
        ctx.fillStyle = "#4b4f55";
        ctx.fillRect(x, 22, 1, hh - 22);
      }
      if (barW >= 60) {
        ctx.fillStyle = "#4b4f55";
        for (var k = 1; k < project.beatsPerBar; k++) ctx.fillRect(x + k * PPQ * ppt, 25, 1, hh - 25);
      }
    }
    var px = rt.position * ppt - sl;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(px - 5, 12);
    ctx.lineTo(px + 5, 12);
    ctx.lineTo(px, 19);
    ctx.fill();
  }

  function snapTicks(kind) {
    var k = kind || ui.snap;
    if (k === "bar") return barTicks();
    if (k === "beat") return PPQ;
    if (k === "8") return PPQ / 2;
    if (k === "16") return PPQ / 4;
    return 1;
  }

  function arrPoint(e) {
    var r = tv.scroll.getBoundingClientRect();
    return { x: e.clientX - r.left + tv.scroll.scrollLeft, y: e.clientY - r.top + tv.scroll.scrollTop, vx: e.clientX - r.left };
  }

  var lastTap = { time: 0, key: "", x: 0, y: 0 };
  function isDoubleTap(key, e) {
    var now = performance.now();
    var dbl = lastTap.key === key && now - lastTap.time < 380 && Math.abs(e.clientX - lastTap.x) < 30 && Math.abs(e.clientY - lastTap.y) < 30;
    lastTap = dbl ? { time: 0, key: "", x: 0, y: 0 } : { time: now, key: key, x: e.clientX, y: e.clientY };
    return dbl;
  }

  function arrangePointerDown(e) {
    if (e.button === 2) return;
    var p = arrPoint(e);
    var target = e.target;
    if (target.closest(".ruler") || p.y - tv.scroll.scrollTop < RULER_H) {
      rulerPointerDown(e, p);
      return;
    }
    var regionEl = target.closest(".region");
    if (regionEl && !regionEl.classList.contains("recording")) {
      regionPointerDown(e, regionEl, target.classList.contains("rhandle") ? "resize" : "move");
      return;
    }
    lanePointerDown(e, p);
  }

  function lanePointerDown(e, p) {
    var idx = Math.floor((p.y - RULER_H) / ui.trackH);
    var startX = e.clientX, startY = e.clientY;
    var up = function (ev) {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (ev.type === "pointercancel" || Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8) return;
      if (idx >= 0 && idx < project.tracks.length) {
        var t = project.tracks[idx];
        selectTrack(t.id);
        if (ui.sel.size) { ui.sel.clear(); renderArrange(); }
        if (isDoubleTap("lane" + idx, ev)) {
          var bt = barTicks();
          createRegion(t, Math.floor(p.x / pxPerTick() / bt) * bt, bt);
        }
      }
      else if (ui.sel.size) { ui.sel.clear(); renderArrange(); }
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function createRegion(t, start, length) {
    pushUndo();
    var r = { id: uid(), trackId: t.id, start: Math.max(0, start), length: length, name: t.name, notes: [] };
    project.regions.push(r);
    ui.sel = new Set([r.id]);
    ui.editorRegionId = r.id;
    ui.prSel.clear();
    if (!ui.paneOpen || ui.paneMode !== "editor") { ui.paneOpen = true; ui.paneMode = "editor"; layoutPane(); }
    commit();
    return r;
  }

  function createRegionAtPlayhead() {
    var t = selectedTrack();
    if (!t) { toast("Add a track first."); return; }
    var bt = barTicks();
    createRegion(t, Math.floor(rt.position / bt) * bt, t.type === "drums" ? bt : bt * 2);
  }

  function openSelectedInEditor() {
    var id = ui.sel.values().next().value;
    if (!id) { toast("Select a region first."); return; }
    openEditor(id);
  }

  function openEditor(id) {
    var r = regionById(id);
    if (!r) return;
    ui.editorRegionId = id;
    ui.prSel.clear();
    selectTrack(r.trackId);
    ui.paneOpen = true;
    ui.paneMode = "editor";
    layoutPane();
    renderPane(true);
  }

  function regionPointerDown(e, el, mode) {
    e.preventDefault();
    var id = el.getAttribute("data-id");
    var r = regionById(id);
    if (!r) return;
    var additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (additive) {
      if (ui.sel.has(id)) ui.sel.delete(id); else ui.sel.add(id);
    }
    else if (!ui.sel.has(id)) ui.sel = new Set([id]);
    if (!additive) selectTrack(r.trackId);
    Array.prototype.forEach.call(tv.regions.children, function (c) { c.classList.toggle("sel", ui.sel.has(c.getAttribute("data-id"))); });

    var p0 = arrPoint(e);
    var before = snapshot();
    var orig = new Map();
    ui.sel.forEach(function (sid) {
      var sr = regionById(sid);
      if (sr) orig.set(sid, { start: sr.start, length: sr.length, ti: trackIndex(sr.trackId) });
    });
    var copy = e.altKey;
    var moved = false;
    var pid = e.pointerId;
    try { tv.scroll.setPointerCapture(pid); } catch (err) { }
    var ppt = pxPerTick();
    var snap = snapTicks();

    var move = function (ev) {
      if (ev.pointerId !== pid) return;
      var p = arrPoint(ev);
      var dx = p.x - p0.x, dy = p.y - p0.y;
      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      moved = true;
      var dt = Math.round(dx / ppt / snap) * snap;
      var dtr = Math.round(dy / ui.trackH);
      orig.forEach(function (o, sid) {
        var re = tv.regions.querySelector('[data-id="' + sid + '"]');
        if (!re) return;
        if (mode === "move") {
          var ns = Math.max(0, o.start + dt);
          var nt = clamp(o.ti + dtr, 0, project.tracks.length - 1);
          re.style.left = ns * ppt + "px";
          re.style.top = (RULER_H + nt * ui.trackH + 2) + "px";
          o.ns = ns; o.nt = nt;
        }
        else {
          var end = Math.round((o.start + o.length + dx / ppt) / snap) * snap;
          var nl = Math.max(snap > 1 ? snap : 60, end - o.start);
          re.style.width = Math.max(6, nl * ppt) + "px";
          o.nl = nl;
        }
      });
    };
    var up = function (ev) {
      if (ev.pointerId !== pid) return;
      tv.scroll.removeEventListener("pointermove", move);
      tv.scroll.removeEventListener("pointerup", up);
      tv.scroll.removeEventListener("pointercancel", up);
      if (!moved) {
        if (ev.type !== "pointercancel" && isDoubleTap("region" + id, ev)) openEditor(id);
        else if (ui.paneOpen && ui.paneMode === "editor" && ui.editorRegionId !== id && !additive) {
          ui.editorRegionId = id;
          ui.prSel.clear();
          renderPane(true);
        }
        return;
      }
      pushUndo(before);
      orig.forEach(function (o, sid) {
        var sr = regionById(sid);
        if (!sr) return;
        if (mode === "move") {
          var target = sr;
          if (copy) {
            target = JSON.parse(JSON.stringify(sr));
            target.id = uid();
            project.regions.push(target);
          }
          target.start = o.ns != null ? o.ns : sr.start;
          if (o.nt != null) target.trackId = project.tracks[o.nt].id;
        }
        else if (o.nl != null) sr.length = o.nl;
      });
      commit();
    };
    tv.scroll.addEventListener("pointermove", move);
    tv.scroll.addEventListener("pointerup", up);
    tv.scroll.addEventListener("pointercancel", up);
  }

  function rulerPointerDown(e, p) {
    e.preventDefault();
    var ppt = pxPerTick();
    var bt = barTicks();
    var vy = p.y - tv.scroll.scrollTop;
    var pid = e.pointerId;
    try { tv.scroll.setPointerCapture(pid); } catch (err) { }
    var startTick = p.x / ppt;
    var moved = false;
    var mode;
    var loop = project.loop;
    var orig = { start: loop.start, end: loop.end };
    if (vy < 12) {
      var sx = loop.start * ppt, ex = loop.end * ppt;
      var edge = coarse ? 14 : 7;
      if (loop.end > loop.start && Math.abs(p.x - sx) < edge) mode = "cs";
      else if (loop.end > loop.start && Math.abs(p.x - ex) < edge) mode = "ce";
      else if (loop.end > loop.start && p.x > sx && p.x < ex) mode = "cm";
      else mode = "cn";
    }
    else {
      mode = "loc";
      locate(Math.max(0, Math.round(startTick / snapTicks("16")) * snapTicks("16")));
    }
    var move = function (ev) {
      if (ev.pointerId !== pid) return;
      var q = arrPoint(ev);
      if (!moved && Math.abs(q.x - p.x) < 4) return;
      moved = true;
      var tick = Math.max(0, q.x / ppt);
      var snapped = Math.round(tick / bt) * bt;
      if (mode === "loc") locate(Math.max(0, Math.round(tick / snapTicks("16")) * snapTicks("16")));
      else if (mode === "cs") { loop.start = Math.min(snapped, loop.end - bt); }
      else if (mode === "ce") { loop.end = Math.max(snapped, loop.start + bt); }
      else if (mode === "cm") {
        var d = Math.round((tick - startTick) / bt) * bt;
        var len = orig.end - orig.start;
        loop.start = Math.max(0, orig.start + d);
        loop.end = loop.start + len;
      }
      else if (mode === "cn") {
        var a = Math.floor(Math.min(startTick, tick) / bt) * bt;
        var b = Math.ceil(Math.max(startTick, tick) / bt) * bt;
        if (b - a < bt) b = a + bt;
        loop.start = a; loop.end = b; loop.on = true;
      }
      if (mode !== "loc") { pushTransport(); renderCycle(); }
    };
    var up = function (ev) {
      if (ev.pointerId !== pid) return;
      tv.scroll.removeEventListener("pointermove", move);
      tv.scroll.removeEventListener("pointerup", up);
      tv.scroll.removeEventListener("pointercancel", up);
      if (mode !== "loc" && !moved && ev.type !== "pointercancel") {
        if (mode === "cn" && !(loop.end > loop.start)) { loop.start = Math.floor(startTick / bt) * bt; loop.end = loop.start + 4 * bt; }
        loop.on = !loop.on;
      }
      if (mode !== "loc") { pushTransport(); renderCycle(); updateBar(); scheduleSave(); }
    };
    tv.scroll.addEventListener("pointermove", move);
    tv.scroll.addEventListener("pointerup", up);
    tv.scroll.addEventListener("pointercancel", up);
  }

  function renderCycle() {
    var ppt = pxPerTick();
    tv.cycleShade.style.display = project.loop.on ? "block" : "none";
    tv.cycleShade.style.left = project.loop.start * ppt + "px";
    tv.cycleShade.style.width = (project.loop.end - project.loop.start) * ppt + "px";
    drawRuler();
  }

  function deleteSelectedRegions() {
    if (!ui.sel.size) return false;
    pushUndo();
    project.regions = project.regions.filter(function (r) { return !ui.sel.has(r.id); });
    if (ui.editorRegionId && ui.sel.has(ui.editorRegionId)) ui.editorRegionId = null;
    ui.sel.clear();
    commit();
    return true;
  }

  function duplicateSelected() {
    if (!ui.sel.size) { toast("Select a region first."); return; }
    pushUndo();
    var start = Infinity, end = 0;
    ui.sel.forEach(function (id) { var r = regionById(id); if (r) { start = Math.min(start, r.start); end = Math.max(end, r.start + r.length); } });
    var shift = end - start;
    var bt = barTicks();
    shift = Math.ceil(shift / bt) * bt;
    var next = new Set();
    ui.sel.forEach(function (id) {
      var r = regionById(id);
      if (!r) return;
      var c = JSON.parse(JSON.stringify(r));
      c.id = uid();
      c.start = r.start + shift;
      project.regions.push(c);
      next.add(c.id);
    });
    ui.sel = next;
    commit();
  }

  function splitAtPlayhead() {
    var pos = Math.round(rt.position);
    var targets = project.regions.filter(function (r) { return (ui.sel.size ? ui.sel.has(r.id) : r.trackId === project.selectedTrackId) && pos > r.start && pos < r.start + r.length; });
    if (!targets.length) { toast("Place the playhead inside a region to split it."); return; }
    pushUndo();
    targets.forEach(function (r) {
      var cut = pos - r.start;
      var right = { id: uid(), trackId: r.trackId, start: pos, length: r.length - cut, name: r.name, notes: [] };
      r.notes = r.notes.filter(function (n) {
        if (n.t >= cut) { right.notes.push({ t: n.t - cut, len: n.len, note: n.note, vel: n.vel }); return false; }
        if (n.t + n.len > cut) n.len = cut - n.t;
        return true;
      });
      r.length = cut;
      project.regions.push(right);
    });
    commit();
  }

  function updatePlayhead() {
    if (!tv.playhead || ui.view !== "tracks") return;
    var x = rt.position * pxPerTick();
    tv.playhead.style.transform = "translateX(" + x + "px)";
    if (rt.playing && ui.follow) {
      var sl = tv.scroll.scrollLeft, w = tv.scroll.clientWidth;
      if (x > sl + w - 30 || x < sl) tv.scroll.scrollLeft = Math.max(0, x - 40);
    }
  }

  function editorRegion() { return ui.editorRegionId ? regionById(ui.editorRegionId) : null; }

  var pr = null;

  function renderPane(scrollToNotes) {
    if (!tv.pane || !ui.paneOpen || ui.view !== "tracks") return;
    tv.paneBar.innerHTML = "";
    tv.paneBody.innerHTML = "";
    pr = null;
    if (ui.paneMode === "keys") { renderKeysPane(); return; }
    var r = editorRegion();
    if (!r) {
      tv.paneBar.appendChild(h("span", { class: "title", text: "Editor" }));
      tv.paneBody.appendChild(h("div", { class: "pane-empty", text: "Double-click (or double-tap) a region to edit its notes here. Double-click an empty spot in a track lane to make a new region." }));
      return;
    }
    var t = trackById(r.trackId);
    if (t && t.type === "drums") renderStepEditor(r, t, scrollToNotes);
    else renderPianoRoll(r, t, scrollToNotes);
  }

  function editorToolbar(r, t, drums) {
    var snap = h("select", { title: "Grid" });
    [[960, "1/4"], [480, "1/8"], [240, "1/16"], [120, "1/32"], [320, "1/8T"], [160, "1/16T"], [1, "Off"]].forEach(function (o) { snap.appendChild(h("option", { value: String(o[0]), text: o[1] })); });
    snap.value = String(ui.prSnap);
    snap.addEventListener("change", function () { ui.prSnap = parseInt(snap.value, 10); renderPane(); });
    var vel = h("input", { type: "range", min: "1", max: "127", value: String(ui.prVel), title: "Velocity" });
    var velVal = h("span", { text: String(ui.prVel), style: "width:26px;color:#c9cbd0;font-size:12px" });
    vel.addEventListener("input", function () {
      ui.prVel = parseInt(vel.value, 10);
      velVal.textContent = String(ui.prVel);
      if (ui.prSel.size) {
        r.notes.forEach(function (n, i) { if (ui.prSel.has(i)) n.vel = ui.prVel; });
        pushEvents();
        drawPr();
      }
    });
    vel.addEventListener("change", function () { if (ui.prSel.size) { scheduleSave(); renderArrange(); } });
    var name = h("span", { class: "title", text: r.name + " — " + (t ? t.name : "") });
    name.style.cursor = "pointer";
    name.title = "Rename region";
    name.addEventListener("click", function () {
      askText("Region name", r.name, function (v) { if (v.trim()) { pushUndo(); r.name = v.trim(); commit(); } });
    });
    tv.paneBar.appendChild(name);
    tv.paneBar.appendChild(h("label", null, ["Grid", snap]));
    tv.paneBar.appendChild(h("label", null, ["Vel", vel, velVal]));
    tv.paneBar.appendChild(btn("Quantize", "Quantize selected notes (or all) to the grid", function () { quantize(r); }, "small"));
    tv.paneBar.appendChild(btn(ICONS.trash, "Delete selected notes", function () { deleteSelectedNotes(); }, "small"));
    if (!drums) {
      tv.paneBar.appendChild(btn(ICONS.zoomOut, "Zoom out", function () { ui.prPxPerBeat = clamp(ui.prPxPerBeat / 1.3, 20, 600); renderPane(); }, "small"));
      tv.paneBar.appendChild(btn(ICONS.zoomIn, "Zoom in", function () { ui.prPxPerBeat = clamp(ui.prPxPerBeat * 1.3, 20, 600); renderPane(); }, "small"));
    }
    tv.paneBar.appendChild(h("div", { class: "spacer" }));
    tv.paneBar.appendChild(btn(ICONS.close, "Close editor", function () { ui.paneOpen = false; layoutPane(); }, "small"));
  }

  function quantize(r) {
    var g = ui.prSnap > 1 ? ui.prSnap : 240;
    pushUndo();
    r.notes.forEach(function (n, i) {
      if (ui.prSel.size && !ui.prSel.has(i)) return;
      n.t = Math.max(0, Math.round(n.t / g) * g);
      if (n.len >= g * 0.75) n.len = Math.max(g, Math.round(n.len / g) * g);
    });
    commit();
  }

  function deleteSelectedNotes() {
    var r = editorRegion();
    if (!r || !ui.prSel.size) return false;
    pushUndo();
    r.notes = r.notes.filter(function (n, i) { return !ui.prSel.has(i); });
    ui.prSel.clear();
    commit();
    return true;
  }

  function preview(note, vel, ms) {
    E.call("vial_daw_live_note", note, vel || 100, 1);
    setTimeout(function () { E.call("vial_daw_live_note", note, 0, 0); }, ms || 180);
  }

  function buildGrid(keysWidth, rowH, rows, contentW) {
    var wrap = h("div", { class: "pr", style: "grid-template-columns:" + keysWidth + "px 1fr" });
    var corner = h("div", { class: "corner" });
    var ruler = h("canvas", { class: "ruler2" });
    var keys = h("canvas", { class: "keys" });
    var main = h("div", { class: "main" });
    var scroll = h("div", { class: "scroll" });
    var sizer = h("div", { style: "width:" + contentW + "px;height:" + rows * rowH + "px" });
    var grid = h("canvas", { class: "grid" });
    scroll.appendChild(sizer);
    main.appendChild(scroll);
    main.appendChild(grid);
    wrap.appendChild(corner);
    wrap.appendChild(ruler);
    wrap.appendChild(keys);
    wrap.appendChild(main);
    tv.paneBody.appendChild(wrap);
    return { wrap: wrap, ruler: ruler, keys: keys, main: main, scroll: scroll, grid: grid, sizer: sizer };
  }

  function sizeCanvas(c, w, hh) {
    var dpr = Math.min(2.5, window.devicePixelRatio || 1);
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(hh * dpr)) {
      c.width = Math.max(1, Math.floor(w * dpr));
      c.height = Math.max(1, Math.floor(hh * dpr));
      c.style.width = w + "px";
      c.style.height = hh + "px";
    }
    var ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function renderPianoRoll(r, t, scrollToNotes) {
    editorToolbar(r, t, false);
    var ppt = ui.prPxPerBeat / PPQ;
    var rowH = ui.prNoteH;
    var contentW = (r.length + barTicks() * 2) * ppt;
    var g = buildGrid(52, rowH, 128, contentW);
    pr = { r: r, t: t, g: g, ppt: ppt, rowH: rowH, drums: false, rows: 128 };
    var prevScroll = ui.prScroll && ui.prScroll.id === r.id ? ui.prScroll : null;
    requestAnimationFrame(function () {
      if (!pr || pr.r !== r) return;
      if (prevScroll && !scrollToNotes) {
        g.scroll.scrollTop = prevScroll.top;
        g.scroll.scrollLeft = prevScroll.left;
      }
      else {
        var lo = 127, hi = 0;
        r.notes.forEach(function (n) { lo = Math.min(lo, n.note); hi = Math.max(hi, n.note); });
        if (!r.notes.length) { lo = 55; hi = 76; }
        var mid = (lo + hi) / 2;
        g.scroll.scrollTop = Math.max(0, (127 - mid) * rowH - g.scroll.clientHeight / 2);
      }
      drawPr();
    });
    attachEditorEvents();
  }

  function renderStepEditor(r, t, scrollToNotes) {
    editorToolbar(r, t, true);
    var step = ui.prSnap > 1 ? ui.prSnap : 240;
    var ppt = ui.stepCell / step;
    var rowH = ui.stepRowH;
    var contentW = (r.length + barTicks()) * ppt;
    var g = buildGrid(coarse ? 84 : 96, rowH, 16, contentW);
    pr = { r: r, t: t, g: g, ppt: ppt, rowH: rowH, drums: true, rows: 16, step: step };
    var prevScroll = ui.prScroll && ui.prScroll.id === r.id ? ui.prScroll : null;
    requestAnimationFrame(function () {
      if (!pr || pr.r !== r) return;
      if (prevScroll && !scrollToNotes) g.scroll.scrollLeft = prevScroll.left;
      drawPr();
    });
    attachEditorEvents();
  }

  function rowToNote(row) { return pr.drums ? 36 + row : 127 - row; }
  function noteToRow(note) { return pr.drums ? note - 36 : 127 - note; }

  var prDrawQueued = false;
  function drawPr() {
    if (prDrawQueued) return;
    prDrawQueued = true;
    requestAnimationFrame(function () { prDrawQueued = false; drawPrNow(); });
  }

  function drawPrNow() {
    if (!pr || !pr.g.main.isConnected) return;
    var g = pr.g, r = pr.r, ppt = pr.ppt, rowH = pr.rowH;
    ui.prScroll = { id: r.id, top: g.scroll.scrollTop, left: g.scroll.scrollLeft };
    var w = g.main.clientWidth, hh = g.main.clientHeight;
    var sl = g.scroll.scrollLeft, st = g.scroll.scrollTop;
    var ctx = sizeCanvas(g.grid, w, hh);
    ctx.fillStyle = "#1b1d20";
    ctx.fillRect(0, 0, w, hh);
    var r0 = Math.floor(st / rowH), r1 = Math.min(pr.rows - 1, Math.ceil((st + hh) / rowH));
    for (var row = r0; row <= r1; row++) {
      var y = row * rowH - st;
      var note = rowToNote(row);
      if (pr.drums) ctx.fillStyle = row % 2 ? "#1e2024" : "#23262a";
      else ctx.fillStyle = isBlack(note) ? "#1a1c1f" : "#24272b";
      ctx.fillRect(0, y, w, rowH);
      ctx.fillStyle = (!pr.drums && note % 12 === 0) ? "#3a3e44" : "#16181b";
      ctx.fillRect(0, y + rowH - 1, w, 1);
    }
    var endX = r.length * ppt - sl;
    var grid = pr.drums ? pr.step : (ui.prSnap > 1 ? ui.prSnap : PPQ);
    var bt = barTicks();
    var t0 = Math.floor(sl / ppt / grid) * grid, t1 = (sl + w) / ppt;
    for (var tk = t0; tk <= t1; tk += grid) {
      var x = Math.round(tk * ppt - sl) + 0.5;
      ctx.fillStyle = tk % bt === 0 ? "rgba(255,255,255,0.28)" : tk % PPQ === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(x, 0, 1, hh);
    }
    if (endX < w) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(Math.max(0, endX), 0, w - Math.max(0, endX), hh);
      ctx.fillStyle = "#e0b93e";
      ctx.fillRect(endX, 0, 2, hh);
    }
    var color = pr.drums ? "#e0b93e" : "#6fd17a";
    r.notes.forEach(function (n, i) {
      var row = noteToRow(n.note);
      if (row < r0 - 1 || row > r1 + 1) return;
      var x = n.t * ppt - sl;
      var nw = pr.drums ? ui.stepCell - 3 : Math.max(3, n.len * ppt - 1);
      if (x + nw < 0 || x > w) return;
      var y = row * rowH - st;
      var a = 0.45 + 0.55 * (n.vel / 127);
      ctx.globalAlpha = n.t >= r.length ? 0.35 : 1;
      ctx.fillStyle = color;
      ctx.globalAlpha *= a;
      roundRect(ctx, x + (pr.drums ? 1.5 : 0), y + 1.5, nw, rowH - 3, pr.drums ? 4 : 2.5);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (ui.prSel.has(i)) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        roundRect(ctx, x + (pr.drums ? 1.5 : 0), y + 1.5, nw, rowH - 3, pr.drums ? 4 : 2.5);
        ctx.stroke();
      }
    });
    var rel = rt.position - r.start;
    if (rel >= 0 && rel <= r.length) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(Math.round(rel * ppt - sl), 0, 1, hh);
    }

    var kctx = sizeCanvas(g.keys, g.keys.clientWidth, hh);
    var kw = g.keys.clientWidth;
    kctx.fillStyle = "#2a2c30";
    kctx.fillRect(0, 0, kw, hh);
    kctx.font = (pr.drums ? "12px" : "10px") + " system-ui, sans-serif";
    kctx.textBaseline = "middle";
    for (var rr = r0; rr <= r1; rr++) {
      var yy = rr * rowH - st;
      var nn = rowToNote(rr);
      if (pr.drums) {
        kctx.fillStyle = rr === ui.selectedPad ? "#3a3550" : (rr % 2 ? "#26282c" : "#2c2f33");
        kctx.fillRect(0, yy, kw, rowH);
        kctx.fillStyle = "#d8dade";
        var pad = pr.t && pr.t.kit ? pr.t.kit.pads[rr] : null;
        kctx.fillText(pad ? pad.name : PAD_NAMES[rr], 8, yy + rowH / 2, kw - 12);
      }
      else {
        kctx.fillStyle = isBlack(nn) ? "#1d1f22" : "#e8e9eb";
        kctx.fillRect(0, yy, kw, rowH - 1);
        if (nn % 12 === 0) {
          kctx.fillStyle = "#555";
          kctx.fillText(noteName(nn), kw - 30, yy + rowH / 2);
        }
      }
      kctx.fillStyle = "#111";
      kctx.fillRect(0, yy + rowH - 1, kw, 1);
    }

    var rc = sizeCanvas(g.ruler, g.ruler.clientWidth, 20);
    var rw = g.ruler.clientWidth;
    rc.fillStyle = "#2d3034";
    rc.fillRect(0, 0, rw, 20);
    rc.font = "10px system-ui, sans-serif";
    rc.textBaseline = "middle";
    for (var b = Math.floor(sl / ppt / bt) * bt; b <= (sl + rw) / ppt; b += PPQ) {
      var bx = b * ppt - sl;
      if (b % bt === 0) {
        rc.fillStyle = "#9a9ea4";
        rc.fillRect(bx, 4, 1, 16);
        rc.fillStyle = "#d0d3d8";
        rc.fillText(String((r.start + b) / bt + 1 | 0), bx + 3, 10);
      }
      else {
        rc.fillStyle = "#555a60";
        rc.fillRect(bx, 13, 1, 7);
      }
    }
  }

  function roundRect(ctx, x, y, w, hh, rad) {
    rad = Math.min(rad, w / 2, hh / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + hh, rad);
    ctx.arcTo(x + w, y + hh, x, y + hh, rad);
    ctx.arcTo(x, y + hh, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function prPoint(e) {
    var rect = pr.g.scroll.getBoundingClientRect();
    return { x: e.clientX - rect.left + pr.g.scroll.scrollLeft, y: e.clientY - rect.top + pr.g.scroll.scrollTop };
  }

  function prHit(p) {
    var row = Math.floor(p.y / pr.rowH);
    var note = rowToNote(row);
    var r = pr.r;
    for (var i = r.notes.length - 1; i >= 0; i--) {
      var n = r.notes[i];
      if (n.note !== note) continue;
      var x0 = n.t * pr.ppt;
      var x1 = pr.drums ? x0 + ui.stepCell : x0 + Math.max(3, n.len * pr.ppt);
      if (p.x >= x0 && p.x <= x1) return { i: i, n: n, edge: !pr.drums && x1 - p.x < (coarse ? 12 : 7) };
    }
    return null;
  }

  function attachEditorEvents() {
    var g = pr.g;
    g.scroll.addEventListener("scroll", drawPr, { passive: true });
    g.scroll.addEventListener("touchstart", function (e) {
      if (!pr) return;
      var touch = e.touches[0];
      if (e.touches.length > 1) return;
      if (prHit(prPoint(touch))) e.preventDefault();
    }, { passive: false });
    g.scroll.addEventListener("pointerdown", editorPointerDown);
    g.keys.addEventListener("pointerdown", function (e) {
      if (!pr) return;
      var rect = g.keys.getBoundingClientRect();
      var row = Math.floor((e.clientY - rect.top + g.scroll.scrollTop) / pr.rowH);
      if (row < 0 || row >= pr.rows) return;
      if (pr.drums) { ui.selectedPad = row; drawPr(); }
      preview(rowToNote(row), ui.prVel, 220);
    });
    g.keys.addEventListener("wheel", function (e) { g.scroll.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });
    g.ruler.addEventListener("pointerdown", function (e) {
      if (!pr) return;
      var rect = g.ruler.getBoundingClientRect();
      var tick = (e.clientX - rect.left + g.scroll.scrollLeft) / pr.ppt;
      locate(Math.max(0, pr.r.start + Math.round(tick / 240) * 240));
    });
  }

  function editorPointerDown(e) {
    if (!pr || e.button === 2) return;
    var p = prPoint(e);
    var r = pr.r;
    var hit = prHit(p);
    var touch = e.pointerType === "touch";
    var pid = e.pointerId;
    var grid = pr.drums ? pr.step : ui.prSnap;
    var snapT = function (t) { return grid > 1 ? Math.floor(t / grid) * grid : Math.round(t); };
    var row = Math.floor(p.y / pr.rowH);
    if (row < 0 || row >= pr.rows) return;
    var note = rowToNote(row);
    var before = snapshot();

    if (pr.drums) {
      if (!touch) e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var cellT = snapT(p.x / pr.ppt);
      var painted = new Set();
      var adding = !hit;
      var toggleCell = function (t, nt) {
        var key = t + ":" + nt;
        if (painted.has(key)) return;
        painted.add(key);
        var idx = -1;
        r.notes.forEach(function (n, i) { if (n.note === nt && n.t >= t && n.t < t + pr.step) idx = i; });
        if (adding && idx < 0) {
          r.notes.push({ t: t, len: pr.step, note: nt, vel: ui.prVel });
          preview(nt, ui.prVel, 120);
        }
        else if (!adding && idx >= 0) r.notes.splice(idx, 1);
      };
      ui.selectedPad = row;
      var el = pr.g.scroll;
      if (!touch) {
        pushUndo(before);
        toggleCell(cellT, note);
        pushEvents();
        drawPr();
      }
      var moveD = function (ev) {
        if (ev.pointerId !== pid || touch) return;
        var q = prPoint(ev);
        var rr = Math.floor(q.y / pr.rowH);
        if (rr < 0 || rr >= pr.rows) return;
        toggleCell(snapT(q.x / pr.ppt), rowToNote(rr));
        pushEvents();
        drawPr();
      };
      var upD = function (ev) {
        if (ev.pointerId !== pid) return;
        el.removeEventListener("pointermove", moveD);
        el.removeEventListener("pointerup", upD);
        el.removeEventListener("pointercancel", upD);
        if (touch && ev.type !== "pointercancel" && Math.abs(ev.clientX - startX) < 10 && Math.abs(ev.clientY - startY) < 10) {
          pushUndo(before);
          toggleCell(cellT, note);
        }
        if (painted.size) commit({ keepPane: true });
        drawPr();
      };
      if (!touch) {
        try { el.setPointerCapture(pid); } catch (err) { }
      }
      el.addEventListener("pointermove", moveD);
      el.addEventListener("pointerup", upD);
      el.addEventListener("pointercancel", upD);
      return;
    }

    var scrollEl = pr.g.scroll;
    if (hit) {
      e.preventDefault();
      if (isDoubleTap("note" + hit.i, e)) {
        pushUndo(before);
        r.notes.splice(hit.i, 1);
        ui.prSel.clear();
        commit({ keepPane: true });
        drawPr();
        return;
      }
      if (e.shiftKey) { if (ui.prSel.has(hit.i)) ui.prSel.delete(hit.i); else ui.prSel.add(hit.i); }
      else if (!ui.prSel.has(hit.i)) ui.prSel = new Set([hit.i]);
      ui.prVel = hit.n.vel;
      dragNotes(e, p, hit.edge ? "resize" : "move", hit.n, before, scrollEl);
      drawPr();
      return;
    }

    if (touch) {
      var sx = e.clientX, sy = e.clientY;
      var upT = function (ev) {
        if (ev.pointerId !== pid) return;
        scrollEl.removeEventListener("pointerup", upT);
        scrollEl.removeEventListener("pointercancel", upT);
        if (ev.type === "pointercancel" || Math.abs(ev.clientX - sx) > 10 || Math.abs(ev.clientY - sy) > 10) return;
        if (ui.prSel.size) { ui.prSel.clear(); drawPr(); return; }
        addNote(snapT(p.x / pr.ppt), note, before);
      };
      scrollEl.addEventListener("pointerup", upT);
      scrollEl.addEventListener("pointercancel", upT);
      return;
    }

    e.preventDefault();
    if (ui.prSel.size && !e.shiftKey) { ui.prSel.clear(); }
    var n = addNote(snapT(p.x / pr.ppt), note, before, true);
    dragNotes(e, p, "resize", n, null, scrollEl, true);
  }

  function addNote(t, note, before, quiet) {
    var r = pr.r;
    var len = ui.prLastLen || (ui.prSnap > 1 ? Math.max(ui.prSnap, 240) : 240);
    var n = { t: Math.max(0, t), len: len, note: note, vel: ui.prVel };
    pushUndo(before);
    r.notes.push(n);
    ui.prSel = new Set([r.notes.length - 1]);
    preview(note, ui.prVel, 200);
    if (!quiet) commit({ keepPane: true });
    else pushEvents();
    drawPr();
    return n;
  }

  function dragNotes(e, p0, mode, anchor, before, scrollEl, created) {
    var r = pr.r;
    var pid = e.pointerId;
    var grid = ui.prSnap > 1 ? ui.prSnap : 1;
    var orig = [];
    ui.prSel.forEach(function (i) { var n = r.notes[i]; if (n) orig.push({ n: n, t: n.t, len: n.len, note: n.note }); });
    var moved = false;
    var lastNote = anchor.note;
    try { scrollEl.setPointerCapture(pid); } catch (err) { }
    if (mode === "move") E.call("vial_daw_live_note", anchor.note, anchor.vel, 1);
    var move = function (ev) {
      if (ev.pointerId !== pid || !pr) return;
      var q = prPoint(ev);
      var dx = q.x - p0.x, dy = q.y - p0.y;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      moved = true;
      if (mode === "move") {
        var dt = Math.round(dx / pr.ppt / grid) * grid;
        var dn = -Math.round(dy / pr.rowH);
        orig.forEach(function (o) {
          o.n.t = Math.max(0, o.t + dt);
          o.n.note = clamp(o.note + dn, 0, 127);
        });
        if (anchor.note !== lastNote) {
          E.call("vial_daw_live_note", lastNote, 0, 0);
          E.call("vial_daw_live_note", anchor.note, anchor.vel, 1);
          lastNote = anchor.note;
        }
      }
      else {
        orig.forEach(function (o) {
          var end = o.t + o.len + dx / pr.ppt;
          if (grid > 1) end = Math.round(end / grid) * grid;
          o.n.len = Math.max(grid > 1 ? grid : 30, Math.round(end - o.t));
        });
        ui.prLastLen = anchor.len;
      }
      pushEvents();
      drawPr();
    };
    var up = function (ev) {
      if (ev.pointerId !== pid) return;
      scrollEl.removeEventListener("pointermove", move);
      scrollEl.removeEventListener("pointerup", up);
      scrollEl.removeEventListener("pointercancel", up);
      if (mode === "move") E.call("vial_daw_live_note", lastNote, 0, 0);
      if (moved || created) {
        if (moved && before) pushUndo(before);
        extendRegionToNotes(r);
        commit({ keepPane: true });
      }
      drawPr();
    };
    scrollEl.addEventListener("pointermove", move);
    scrollEl.addEventListener("pointerup", up);
    scrollEl.addEventListener("pointercancel", up);
  }

  function extendRegionToNotes(r) {
    var end = 0;
    r.notes.forEach(function (n) { end = Math.max(end, n.t + n.len); });
    var bt = barTicks();
    if (end > r.length) {
      r.length = Math.ceil(end / bt) * bt;
      var w = (r.length + bt * 2) * (pr ? pr.ppt : 0);
      if (pr) pr.g.sizer.style.width = w + "px";
    }
  }

  function renderKeysPane() {
    var t = selectedTrack();
    tv.paneBar.appendChild(h("span", { class: "title", text: t ? "Play: " + t.name : "Play" }));
    if (!t) return;
    if (t.type === "drums") {
      var holder = h("div", { style: "position:absolute;inset:8px;display:flex;justify-content:center" });
      var pads = buildPads(t, true);
      pads.style.width = "min(100%, " + Math.max(240, tv.paneBody.clientHeight * 1.6) + "px)";
      holder.appendChild(pads);
      tv.paneBody.appendChild(holder);
      return;
    }
    var oct = h("span", { text: "C" + (ui.kbOctave - 2), style: "width:30px;text-align:center;color:#c9cbd0" });
    tv.paneBar.appendChild(btn("−", "Octave down", function () { ui.kbOctave = clamp(ui.kbOctave - 1, 0, 8); renderPane(); }, "small"));
    tv.paneBar.appendChild(oct);
    tv.paneBar.appendChild(btn("+", "Octave up", function () { ui.kbOctave = clamp(ui.kbOctave + 1, 0, 8); renderPane(); }, "small"));
    tv.paneBar.appendChild(h("span", { text: "Touch near the bottom of a key to play louder.", class: "narrow-hide", style: "color:#80858c;font-size:12px;white-space:nowrap" }));
    var kb = h("div", { class: "kb" });
    var keys = h("div", { class: "kb-keys" });
    kb.appendChild(keys);
    tv.paneBody.appendChild(kb);
    requestAnimationFrame(function () { buildKeyboard(keys, ui.kbOctave * 12); });
  }

  function buildKeyboard(container, low) {
    var w = container.clientWidth, hh = container.clientHeight;
    var whiteW = coarse ? 42 : 34;
    var whites = clamp(Math.floor(w / whiteW), 8, 52);
    whiteW = w / whites;
    var notes = [];
    var n = low, wi = 0;
    while (wi < whites && n < 128) {
      if (!isBlack(n)) { notes.push({ note: n, white: true, x: wi * whiteW, w: whiteW }); wi++; }
      else notes.push({ note: n, white: false, x: wi * whiteW - whiteW * 0.32, w: whiteW * 0.64 });
      n++;
    }
    var els = new Map();
    notes.forEach(function (k) {
      var e = h("div", { class: "kb-key " + (k.white ? "white" : "black"), style: "left:" + k.x + "px;width:" + k.w + "px;top:0;height:" + (k.white ? hh : hh * 0.6) + "px" });
      if (k.white && k.note % 12 === 0) e.textContent = noteName(k.note);
      e.setAttribute("data-note", String(k.note));
      container.appendChild(e);
      els.set(k.note, e);
    });
    attachPlaySurface(container, function (x, y) {
      var el = document.elementFromPoint(x, y);
      if (!el || !el.classList || !el.classList.contains("kb-key")) return null;
      var rect = el.getBoundingClientRect();
      var vel = clamp(Math.round(40 + 87 * (y - rect.top) / rect.height), 1, 127);
      return { note: parseInt(el.getAttribute("data-note"), 10), vel: vel, el: el };
    });
  }

  function attachPlaySurface(container, resolve, onHit) {
    var active = new Map();
    var counts = new Map();
    var on = function (k) {
      if (onHit) onHit(k);
      counts.set(k.note, (counts.get(k.note) || 0) + 1);
      E.call("vial_daw_live_note", k.note, k.vel, 1);
      if (k.el) k.el.classList.add(k.el.classList.contains("pad") ? "hit" : "down");
    };
    var off = function (k) {
      var c = (counts.get(k.note) || 1) - 1;
      counts.set(k.note, c);
      if (c <= 0) {
        E.call("vial_daw_live_note", k.note, 0, 0);
        if (k.el) { k.el.classList.remove("down"); k.el.classList.remove("hit"); }
      }
    };
    container.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var k = resolve(e.clientX, e.clientY);
      if (!k) return;
      try { container.setPointerCapture(e.pointerId); } catch (err) { }
      active.set(e.pointerId, k);
      on(k);
    });
    container.addEventListener("pointermove", function (e) {
      if (!active.has(e.pointerId)) return;
      var prev = active.get(e.pointerId);
      if (prev.pad) return;
      var k = resolve(e.clientX, e.clientY);
      if (!k || k.note === prev.note) return;
      off(prev);
      active.set(e.pointerId, k);
      on(k);
    });
    var end = function (e) {
      if (!active.has(e.pointerId)) return;
      off(active.get(e.pointerId));
      active.delete(e.pointerId);
    };
    container.addEventListener("pointerup", end);
    container.addEventListener("pointercancel", end);
    container.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  function buildPads(t, compact) {
    var grid = h("div", { class: "pads" });
    var order = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3];
    order.forEach(function (i) {
      var pad = t.kit.pads[i];
      var el = h("div", { class: "pad" + (i === ui.selectedPad && !compact ? " sel" : "") + (pad.sample ? " custom" : ""), "data-pad": String(i) }, [
        h("div", { class: "pname", text: pad.name }),
        h("div", { class: "pnote", text: noteName(36 + i) })
      ]);
      if (!compact) {
        el.addEventListener("dragover", function (e) { e.preventDefault(); el.classList.add("drop"); });
        el.addEventListener("dragleave", function () { el.classList.remove("drop"); });
        el.addEventListener("drop", function (e) {
          e.preventDefault();
          e.stopPropagation();
          el.classList.remove("drop");
          var files = e.dataTransfer && e.dataTransfer.files ? Array.prototype.slice.call(e.dataTransfer.files) : [];
          if (files.length) loadPadFiles(t, i, files);
        });
      }
      grid.appendChild(el);
    });
    attachPlaySurface(grid, function (x, y) {
      var el = document.elementFromPoint(x, y);
      el = el && el.closest ? el.closest(".pad") : null;
      if (!el) return null;
      var i = parseInt(el.getAttribute("data-pad"), 10);
      var rect = el.getBoundingClientRect();
      var vel = clamp(Math.round(60 + 67 * (1 - (y - rect.top) / rect.height)), 1, 127);
      return { note: 36 + i, vel: vel, el: el, pad: true, index: i };
    }, function (k) {
      if (project.selectedTrackId !== t.id) selectTrack(t.id);
      if (!compact && ui.selectedPad !== k.index) {
        ui.selectedPad = k.index;
        grid.querySelectorAll(".pad").forEach(function (p) { p.classList.toggle("sel", parseInt(p.getAttribute("data-pad"), 10) === k.index); });
        renderPadPanel(t);
      }
    });
    return grid;
  }

  var dm = {};

  function renderDrums() {
    var root = views.drums;
    root.innerHTML = "";
    var drumsTracks = project.tracks.filter(function (t) { return t.type === "drums"; });
    var toolbar = h("div", { class: "toolbar" });
    root.appendChild(toolbar);
    if (!drumsTracks.length) {
      toolbar.appendChild(h("span", { class: "title", text: "Drum Machine" }));
      var empty = h("div", { class: "pane-empty" }, [h("div", null, [
        h("p", { text: "This project has no drum machine track yet." }),
        btn("Add Drum Machine Track", null, function () { addTrack("drums"); showView("drums"); }, "on")
      ])]);
      root.appendChild(h("div", { style: "position:relative;flex:1" }, [empty]));
      return;
    }
    var t = selectedTrack();
    if (!t || t.type !== "drums") t = drumsTracks[0];
    var sel = h("select", { title: "Drum track" });
    drumsTracks.forEach(function (d) { sel.appendChild(h("option", { value: d.id, text: d.name })); });
    sel.value = t.id;
    sel.addEventListener("change", function () { selectTrack(sel.value); renderDrums(); });
    var kitSel = h("select", { title: "Kit" });
    Object.keys(KITS).forEach(function (k) { kitSel.appendChild(h("option", { value: k, text: KITS[k] })); });
    kitSel.value = t.kit.style;
    kitSel.addEventListener("change", function () {
      t.kit.style = kitSel.value;
      pushKit(t);
      renderDrums();
      renderHeaders();
      scheduleSave();
    });
    toolbar.appendChild(h("span", { class: "title", text: "Drum Machine" }));
    toolbar.appendChild(sel);
    toolbar.appendChild(h("label", null, ["Kit", kitSel]));
    toolbar.appendChild(btn("Load Samples…", "Load one or more audio files onto pads, starting at the selected pad", function () {
      pickFiles("audio/*", true, function (files) { loadPadFiles(t, ui.selectedPad, files); });
    }, "small"));
    toolbar.appendChild(btn("Reset Kit", "Restore every pad to the built-in sound", function () {
      t.kit = newKit(t.kit.style);
      pushKit(t);
      renderDrums();
      scheduleSave();
    }, "small"));
    var body = h("div", { class: "dm" });
    dm.pads = buildPads(t, false);
    dm.panel = h("div", { class: "dm-panel" });
    body.appendChild(dm.pads);
    body.appendChild(dm.panel);
    root.appendChild(body);
    renderPadPanel(t);
  }

  function loadPadFiles(t, startPad, files) {
    var audio = files.filter(function (f) { return !/\.(vialproject|json|mid|midi)$/i.test(f.name); });
    if (!audio.length) return;
    toast("Loading " + audio.length + (audio.length === 1 ? " sample…" : " samples…"));
    var pad = startPad;
    var jobs = audio.slice(0, 16).map(function (file) {
      var target = pad;
      pad = (pad + 1) % 16;
      return importSample(file).then(function (s) {
        var p = t.kit.pads[target];
        p.sample = s;
        p.name = file.name.replace(/\.[^.]+$/, "").slice(0, 24);
        p.pitch = 0;
        pushPad(t, target);
        return true;
      }).catch(function () { return false; });
    });
    Promise.all(jobs).then(function (results) {
      var ok = results.filter(Boolean).length;
      if (ok < results.length) toast((results.length - ok) + " file(s) couldn't be decoded. Use WAV, MP3, AAC/M4A, OGG or FLAC.");
      else toast("Loaded " + ok + (ok === 1 ? " sample." : " samples."));
      if (ui.view === "drums") renderDrums();
      renderPane();
      scheduleSave();
    });
  }

  function renderPadPanel(t) {
    var panel = dm.panel;
    if (!panel) return;
    panel.innerHTML = "";
    var i = ui.selectedPad;
    var pad = t.kit.pads[i];
    var name = h("input", { type: "text", value: pad.name });
    name.addEventListener("change", function () {
      pad.name = name.value.trim() || PAD_NAMES[i];
      var el = dm.pads.querySelector('[data-pad="' + i + '"] .pname');
      if (el) el.textContent = pad.name;
      scheduleSave();
    });
    panel.appendChild(h("div", { class: "row" }, [h("h3", { text: "Pad " + (i + 1) + " · " + noteName(36 + i) }), name]));
    var wave = h("canvas", { class: "wave" });
    panel.appendChild(wave);
    requestAnimationFrame(function () { drawWave(wave, padChannels(t, i).channels[0]); });
    panel.appendChild(h("div", { style: "font-size:12px;color:#969aa1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis", text: pad.sample ? "Sample: " + pad.sample.name : "Built-in sound (" + (KITS[t.kit.style] || "") + ")" }));

    var slider = function (label, min, max, step, value, fmt, onInput) {
      var input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value) });
      var val = h("span", { class: "val", text: fmt(value) });
      input.addEventListener("input", function () { var v = parseFloat(input.value); val.textContent = fmt(v); onInput(v); });
      input.addEventListener("change", scheduleSave);
      input.addEventListener("dblclick", function () { var d = label === "Volume" ? 0 : 0; input.value = String(d); val.textContent = fmt(d); onInput(d); scheduleSave(); });
      panel.appendChild(h("div", { class: "row" }, [h("label", { text: label }), input, val]));
    };
    slider("Volume", -30, 6, 0.5, pad.gain, function (v) { return fmtDb(v) + " dB"; }, function (v) { pad.gain = v; pushPadParams(t, i); });
    slider("Pan", -1, 1, 0.02, pad.pan, function (v) { return Math.abs(v) < 0.01 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100); }, function (v) { pad.pan = v; pushPadParams(t, i); });
    slider("Pitch", -24, 24, 1, pad.pitch, function (v) { return (v > 0 ? "+" : "") + v + " st"; }, function (v) { pad.pitch = v; pushPadParams(t, i); });
    var choke = h("select");
    ["Off", "Group 1", "Group 2", "Group 3", "Group 4"].forEach(function (c, ci) { choke.appendChild(h("option", { value: String(ci), text: c })); });
    choke.value = String(pad.choke | 0);
    choke.addEventListener("change", function () { pad.choke = parseInt(choke.value, 10); pushPadParams(t, i); scheduleSave(); });
    panel.appendChild(h("div", { class: "row" }, [h("label", { text: "Choke" }), choke]));
    panel.appendChild(h("div", { class: "btns" }, [
      btn("Load Sample…", "Replace this pad's sound with an audio file", function () { pickFiles("audio/*", false, function (files) { loadPadFiles(t, i, files); }); }, "small"),
      btn("Reset Pad", "Go back to the built-in sound", function () {
        t.kit.pads[i] = { name: PAD_NAMES[i], sample: null, gain: 0, pan: 0, pitch: 0, choke: PAD_CHOKE[i] };
        pushPad(t, i);
        renderDrums();
        scheduleSave();
      }, "small"),
      btn("Audition", "Play this pad", function () { selectTrack(t.id); preview(36 + i, 110, 200); }, "small")
    ]));
    panel.appendChild(h("div", { style: "font-size:11px;color:#7d8288;line-height:1.5", text: "Tip: drop audio files straight onto a pad. Pads play notes C1–D#2 (36–51), so MIDI drum maps line up." }));
  }

  function drawWave(c, data) {
    var w = c.clientWidth, hh = c.clientHeight;
    if (!w || !hh) return;
    var ctx = sizeCanvas(c, w, hh);
    ctx.clearRect(0, 0, w, hh);
    ctx.fillStyle = "#9a82ea";
    var n = data.length, step = n / w;
    for (var x = 0; x < w; x++) {
      var a = Math.floor(x * step), b = Math.min(n, Math.floor((x + 1) * step) + 1), peak = 0;
      for (var i = a; i < b; i++) peak = Math.max(peak, Math.abs(data[i]));
      var y = peak * hh / 2;
      ctx.fillRect(x, hh / 2 - y, 1, Math.max(1, y * 2));
    }
  }

  var mx = { strips: [] };

  function renderMixer() {
    var root = views.mixer;
    root.innerHTML = "";
    root.appendChild(h("div", { class: "toolbar" }, [h("span", { class: "title", text: "Mixer" }),
      h("span", { text: "Drag faders; double-click (double-tap) to reset.", style: "color:#80858c;font-size:12px;white-space:nowrap" })]));
    var wrap = h("div", { class: "mixer" });
    mx.strips = [];
    project.tracks.forEach(function (t, i) { wrap.appendChild(strip(t, i)); });
    wrap.appendChild(masterStrip());
    root.appendChild(wrap);
  }

  function fader(value, onChange) {
    var el = h("div", { class: "fader" }, [h("div", { class: "track" })]);
    var cap = h("div", { class: "cap" });
    el.appendChild(cap);
    var toPos = function (db) { return db <= -60 ? 0 : Math.pow(10, (db - 6) / 40); };
    var toDb = function (pos) { return pos < 0.023 ? -60 : clamp(6 + 40 * Math.log10(pos), -60, 6); };
    var place = function (db) {
      var hh = el.clientHeight - 16;
      cap.style.top = (8 + (1 - toPos(db)) * hh) + "px";
    };
    var current = value;
    requestAnimationFrame(function () { place(current); });
    var pid = null, startY = 0, startPos = 0;
    el.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      if (isDoubleTap("fader" + onChange.id, e)) { current = 0; place(0); onChange(0, true); return; }
      pid = e.pointerId;
      startY = e.clientY;
      startPos = toPos(current);
      el.setPointerCapture(pid);
    });
    el.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pid) return;
      var hh = el.clientHeight - 16;
      var pos = clamp(startPos - (e.clientY - startY) / hh * (e.shiftKey ? 0.2 : 1), 0, 1);
      current = Math.round(toDb(pos) * 10) / 10;
      place(current);
      onChange(current, false);
    });
    var end = function (e) {
      if (e.pointerId !== pid) return;
      pid = null;
      onChange(current, true);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return el;
  }

  function strip(t, i) {
    var db = h("div", { class: "db", text: fmtDb(t.volume) + " dB" });
    var meter = h("canvas", { class: "meter" });
    var change = function (v, done) {
      t.volume = v;
      db.textContent = fmtDb(v) + " dB";
      pushTracks();
      if (done) scheduleSave();
    };
    change.id = t.id;
    var f = fader(t.volume, change);
    var pan = h("input", { type: "range", min: "-1", max: "1", step: "0.02", value: String(t.pan), title: "Pan" });
    pan.addEventListener("input", function () { t.pan = parseFloat(pan.value); pushTracks(); });
    pan.addEventListener("change", scheduleSave);
    pan.addEventListener("dblclick", function () { t.pan = 0; pan.value = "0"; pushTracks(); scheduleSave(); });
    var m = h("button", { class: "ms m" + (t.mute ? " on" : ""), text: "M", tabindex: "-1" });
    var s = h("button", { class: "ms s" + (t.solo ? " on" : ""), text: "S", tabindex: "-1" });
    m.addEventListener("click", function () { t.mute = !t.mute; m.classList.toggle("on", t.mute); pushTracks(); scheduleSave(); });
    s.addEventListener("click", function () { t.solo = !t.solo; s.classList.toggle("on", t.solo); pushTracks(); scheduleSave(); });
    var inst = btn(t.type === "drums" ? "Drums" : "Vial", t.type === "drums" ? "Open drum machine" : "Open synth", function () {
      selectTrack(t.id);
      showView(t.type === "drums" ? "drums" : "synth");
    }, "small inst");
    var el = h("div", { class: "strip" + (t.id === project.selectedTrackId ? " sel" : ""), style: "--tc:" + t.color }, [
      h("div", { class: "sname", text: t.name }), inst, pan,
      h("div", { class: "fader-wrap" }, [f, meter]), db,
      h("div", { class: "msrow" }, [m, s])
    ]);
    el.addEventListener("pointerdown", function () { if (project.selectedTrackId !== t.id) { selectTrack(t.id); el.parentNode && el.parentNode.querySelectorAll(".strip").forEach(function (x) { x.classList.toggle("sel", x === el); }); } });
    mx.strips.push({ meter: meter, index: i });
    return el;
  }

  function masterStrip() {
    var db = h("div", { class: "db", text: fmtDb(project.master) + " dB" });
    var meter = h("canvas", { class: "meter" });
    var change = function (v, done) {
      project.master = v;
      db.textContent = fmtDb(v) + " dB";
      E.call("vial_daw_set_master", dbToGain(v));
      if (done) scheduleSave();
    };
    change.id = "master";
    var el = h("div", { class: "strip master", style: "--tc:#aa88ff" }, [
      h("div", { class: "sname", text: "Master" }),
      h("div", { class: "fader-wrap" }, [fader(project.master, change), meter]), db
    ]);
    mx.strips.push({ meter: meter, index: -1 });
    return el;
  }

  function drawMeters(st) {
    mx.strips.forEach(function (s) {
      var c = s.meter;
      var w = c.clientWidth, hh = c.clientHeight;
      if (!w || !hh) return;
      var ctx = sizeCanvas(c, w, hh);
      ctx.fillStyle = "#121416";
      ctx.fillRect(0, 0, w, hh);
      var l, r;
      if (s.index < 0) { l = st[7]; r = st[8]; }
      else { l = st[16 + s.index * 2]; r = st[17 + s.index * 2]; }
      [l, r].forEach(function (v, ch) {
        var db = v > 0 ? 20 * Math.log10(v) : -90;
        var frac = clamp((db + 60) / 66, 0, 1);
        var bh = frac * hh;
        var grad = ctx.createLinearGradient(0, hh, 0, 0);
        grad.addColorStop(0, "#3fbf5a");
        grad.addColorStop(0.75, "#c9d13d");
        grad.addColorStop(1, "#e0453b");
        ctx.fillStyle = grad;
        ctx.fillRect(ch * w / 2 + 0.5, hh - bh, w / 2 - 1, bh);
      });
    });
  }

  function locate(tick) {
    rt.position = tick;
    E.call("vial_daw_locate", tick);
    updatePlayhead();
    drawRuler();
    updateLcd(tick);
    if (pr) drawPr();
  }

  function gotoStart() {
    locate(project.loop.on && rt.playing ? project.loop.start : 0);
  }

  function togglePlay() {
    if (rt.playing) stopTransport();
    else startPlay(false);
  }

  function startPlay(record) {
    if (rt.bounce) return;
    if (window.VialModule && window.VialModule.juceAudio && window.VialModule.juceAudio.resumeAll) window.VialModule.juceAudio.resumeAll();
    pushEvents();
    pushTransport();
    var from = rt.position;
    if (record) {
      var t = selectedTrack();
      if (!t) { toast("Add a track to record onto."); return; }
      beginTake(t, from);
      E.call("vial_daw_set_recording", 1, project.countIn ? 1 : 0);
    }
    else E.call("vial_daw_set_recording", 0, 0);
    E.call("vial_daw_play", from);
    rt.hist = [];
    rt.playFrom = record && project.countIn ? from - project.countIn * barTicks() : from;
    rt.playing = true;
    lcd.play.classList.add("on");
  }

  function stopTransport(silent) {
    if (!rt.ready) return;
    var wasPlaying = rt.playing;
    E.call("vial_daw_stop");
    rt.playing = false;
    if (rt.take) finishTake();
    if (lcd.play) lcd.play.classList.remove("on");
    if (lcd.rec) lcd.rec.classList.remove("on");
    if (lcd.box) lcd.box.classList.remove("recording");
    if (silent) return;
    if (!wasPlaying) locate(0);
    else locate(Math.max(0, Math.round(rt.position)));
  }

  function toggleRecord() {
    if (rt.take) {
      E.call("vial_daw_set_recording", 0, 0);
      finishTake();
      lcd.rec.classList.remove("on");
      lcd.box.classList.remove("recording");
      return;
    }
    if (rt.playing) {
      var t = selectedTrack();
      if (!t) return;
      beginTake(t, rt.position);
      E.call("vial_daw_set_recording", 1, 0);
    }
    else startPlay(true);
    lcd.rec.classList.add("on");
    lcd.box.classList.add("recording");
  }

  function toggleCycle() {
    var loop = project.loop;
    if (!(loop.end > loop.start)) { loop.start = 0; loop.end = 4 * barTicks(); }
    loop.on = !loop.on;
    pushTransport();
    updateBar();
    if (ui.view === "tracks") renderCycle();
    scheduleSave();
  }

  function beginTake(t, from) {
    rt.take = { trackId: t.id, start: from, loop: project.loop.on && from < project.loop.end, open: new Map(), notes: [], drums: t.type === "drums", el: null };
    if (ui.view === "tracks") {
      rt.take.el = h("div", { class: "region recording" });
      tv.regions.appendChild(rt.take.el);
      updateTakeElement();
    }
  }

  function processRecorded() {
    var events = E.pollRecorded();
    var take = rt.take;
    if (!take) return;
    events.forEach(function (ev) {
      if (take.drums) {
        if (ev.on) take.notes.push({ t: ev.tick, len: 240, note: ev.note, vel: Math.max(1, ev.vel) });
        return;
      }
      if (ev.on) {
        if (take.open.has(ev.note)) closeNote(take, ev.note, ev.tick);
        take.open.set(ev.note, { t: ev.tick, vel: Math.max(1, ev.vel) });
      }
      else closeNote(take, ev.note, ev.tick);
    });
  }

  function closeNote(take, note, tick) {
    var o = take.open.get(note);
    if (!o) return;
    take.open.delete(note);
    var len = tick - o.t;
    if (len <= 0 && take.loop) len += project.loop.end - project.loop.start;
    take.notes.push({ t: o.t, len: Math.max(30, len), note: note, vel: o.vel });
  }

  function finishTake() {
    var take = rt.take;
    rt.take = null;
    processRecordedInto(take);
    if (take.el) take.el.remove();
    take.open.forEach(function (o, note) { closeNote(take, note, rt.position); });
    if (!take.notes.length) { toast("Nothing was recorded. Play notes with your computer keyboard, a MIDI keyboard or the on-screen keys."); return; }
    var bt = barTicks();
    var start, end;
    if (take.loop) { start = project.loop.start; end = project.loop.end; }
    else {
      var first = Infinity, last = 0;
      take.notes.forEach(function (n) { first = Math.min(first, n.t); last = Math.max(last, n.t + n.len); });
      start = Math.floor(Math.min(first, take.start) / bt) * bt;
      end = Math.max(start + bt, Math.ceil(last / bt) * bt);
    }
    var t = trackById(take.trackId);
    if (!t) return;
    pushUndo();
    var host = project.regions.find(function (x) { return x.trackId === t.id && x.start <= start && x.start + x.length >= end; });
    var r = host || { id: uid(), trackId: t.id, start: start, length: end - start, name: t.name, notes: [] };
    var added = 0;
    take.notes.forEach(function (n) {
      var rel = Math.round(n.t - r.start);
      if (rel < 0 || rel >= r.length) return;
      r.notes.push({ t: rel, len: Math.round(n.len), note: n.note, vel: n.vel });
      added++;
    });
    if (!host) project.regions.push(r);
    ui.sel = new Set([r.id]);
    ui.editorRegionId = r.id;
    ui.prSel.clear();
    commit();
    toast("Recorded " + added + (added === 1 ? " note" : " notes") + (host ? " into “" + r.name + "”." : "."));
  }

  function processRecordedInto(take) {
    var saved = rt.take;
    rt.take = take;
    processRecorded();
    rt.take = saved;
  }

  function updateLcd(pos) {
    var bt = barTicks();
    var barN = Math.floor(pos / bt);
    var rem = pos - barN * bt;
    var beat = Math.floor(rem / PPQ);
    var div = Math.floor((rem - beat * PPQ) / (PPQ / 4));
    lcd.pos.textContent = (barN >= 0 ? barN + 1 : barN) + " . " + (beat + 1) + " . " + (div + 1);
    var secs = pos / PPQ * 60 / project.bpm;
    var s = Math.abs(secs);
    lcd.time.textContent = (secs < 0 ? "-" : "") + Math.floor(s / 60) + ":" + ("0" + Math.floor(s % 60)).slice(-2) + "." + Math.floor((s * 10) % 10);
  }

  var lastStatusPos = null;
  function frame() {
    requestAnimationFrame(frame);
    if (!rt.ready) return;
    var st = E.status();
    if (!st) return;
    rt.sampleRate = st[5] || rt.sampleRate;
    var playing = st[1] > 0.5;
    if (playing) {
      var now = performance.now();
      var latency = st[4] / rt.sampleRate * 1000;
      rt.hist.push({ t: now, p: st[0] });
      while (rt.hist.length > 2 && rt.hist[1].t < now - latency - 500) rt.hist.shift();
      var pos = rt.playFrom;
      for (var hi = rt.hist.length - 1; hi >= 0; hi--) {
        if (rt.hist[hi].t <= now - latency) { pos = rt.hist[hi].p; break; }
      }
      rt.position = pos;
      if (pos !== lastStatusPos) {
        lastStatusPos = pos;
        updateLcd(pos);
        updatePlayhead();
        drawRuler();
        if (rt.take) updateTakeElement();
        if (pr && pr.r && rt.position >= pr.r.start - PPQ && rt.position <= pr.r.start + pr.r.length + PPQ) drawPr();
      }
    }
    if (rt.take) processRecorded();
    if (ui.view === "mixer") drawMeters(st);
    if (rt.bounce) bounceTick(st);
  }

  function writeVlq(out, v) {
    var bytes = [v & 0x7f];
    while ((v >>= 7) > 0) bytes.unshift((v & 0x7f) | 0x80);
    bytes.forEach(function (b) { out.push(b); });
  }

  function midiTrackChunk(events) {
    events.sort(function (a, b) { return a.tick - b.tick || a.order - b.order; });
    var data = [], last = 0;
    events.forEach(function (e) {
      writeVlq(data, Math.max(0, Math.round(e.tick - last)));
      last = Math.max(last, Math.round(e.tick));
      e.bytes.forEach(function (b) { data.push(b); });
    });
    data.push(0, 0xff, 0x2f, 0);
    var head = [0x4d, 0x54, 0x72, 0x6b, (data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255];
    return head.concat(data);
  }

  function textBytes(s) {
    var enc = new TextEncoder().encode(s);
    var out = [];
    writeVlq(out, enc.length);
    return Array.prototype.slice.call(enc).length ? out.concat(Array.prototype.slice.call(enc)) : out;
  }

  function exportMidiFile() {
    var chunks = [];
    var us = Math.round(60000000 / project.bpm);
    chunks.push(midiTrackChunk([
      { tick: 0, order: 0, bytes: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] },
      { tick: 0, order: 0, bytes: [0xff, 0x58, 4, project.beatsPerBar, 2, 24, 8] },
      { tick: 0, order: 0, bytes: [0xff, 0x03].concat(textBytes(project.name)) }
    ]));
    var synthCh = 0;
    project.tracks.forEach(function (t) {
      var ch = t.type === "drums" ? 9 : (synthCh++ % 9);
      var evs = [{ tick: 0, order: 0, bytes: [0xff, 0x03].concat(textBytes(t.name)) }];
      project.regions.forEach(function (r) {
        if (r.trackId !== t.id) return;
        r.notes.forEach(function (n) {
          if (n.t >= r.length) return;
          var s = r.start + n.t, len = Math.min(n.len, r.length - n.t);
          evs.push({ tick: s, order: 2, bytes: [0x90 | ch, n.note, n.vel] });
          evs.push({ tick: s + len, order: 1, bytes: [0x80 | ch, n.note, 0] });
        });
      });
      chunks.push(midiTrackChunk(evs));
    });
    var header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (chunks.length >> 8) & 255, chunks.length & 255, (PPQ >> 8) & 255, PPQ & 255];
    var all = header;
    chunks.forEach(function (c) { all = all.concat(c); });
    saveBlob(new Blob([new Uint8Array(all)], { type: "audio/midi" }), safeName(project.name) + ".mid", "MIDI file", "mid");
  }

  function parseMidi(buf) {
    var d = new DataView(buf), pos = 0;
    var str = function (n) { var s = ""; for (var i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(pos + i)); return s; };
    if (str(4) !== "MThd") throw new Error("not midi");
    var hlen = d.getUint32(4);
    var ntracks = d.getUint16(10), division = d.getUint16(12);
    if (division & 0x8000) throw new Error("SMPTE timing not supported");
    pos = 8 + hlen;
    var notes = [], tempo = null, sig = null, names = {};
    for (var tr = 0; tr < ntracks && pos < d.byteLength; tr++) {
      var id = str(4), len = d.getUint32(pos + 4);
      pos += 8;
      var end = pos + len;
      if (id !== "MTrk") { pos = end; continue; }
      var tick = 0, status = 0, open = {};
      while (pos < end) {
        var delta = 0, b;
        do { b = d.getUint8(pos++); delta = (delta << 7) | (b & 0x7f); } while (b & 0x80);
        tick += delta;
        var ev = d.getUint8(pos);
        if (ev & 0x80) { status = ev; pos++; }
        if (status === 0xff) {
          var type = d.getUint8(pos++);
          var ml = 0;
          do { b = d.getUint8(pos++); ml = (ml << 7) | (b & 0x7f); } while (b & 0x80);
          if (type === 0x51 && tempo == null) tempo = 60000000 / ((d.getUint8(pos) << 16) | (d.getUint8(pos + 1) << 8) | d.getUint8(pos + 2));
          if (type === 0x58 && sig == null) sig = d.getUint8(pos);
          if (type === 0x03) { var nm = ""; for (var q = 0; q < ml; q++) nm += String.fromCharCode(d.getUint8(pos + q)); names[tr] = nm; }
          pos += ml;
          continue;
        }
        if (status === 0xf0 || status === 0xf7) {
          var sl = 0;
          do { b = d.getUint8(pos++); sl = (sl << 7) | (b & 0x7f); } while (b & 0x80);
          pos += sl;
          continue;
        }
        var hi = status & 0xf0, ch = status & 0x0f;
        var a1 = d.getUint8(pos++);
        var a2 = (hi === 0xc0 || hi === 0xd0) ? 0 : d.getUint8(pos++);
        var key = ch * 128 + a1;
        if (hi === 0x90 && a2 > 0) {
          if (open[key]) notes.push({ ch: ch, track: tr, note: a1, vel: open[key].vel, t: open[key].t, len: tick - open[key].t });
          open[key] = { t: tick, vel: a2 };
        }
        else if (hi === 0x80 || (hi === 0x90 && a2 === 0)) {
          if (open[key]) {
            notes.push({ ch: ch, track: tr, note: a1, vel: open[key].vel, t: open[key].t, len: tick - open[key].t });
            delete open[key];
          }
        }
      }
      pos = end;
    }
    var scale = PPQ / division;
    notes.forEach(function (n) { n.t = Math.round(n.t * scale); n.len = Math.max(30, Math.round(n.len * scale)); });
    return { notes: notes, tempo: tempo, sig: sig };
  }

  function importMidiFile() {
    pickFiles(".mid,.midi", false, function (files) {
      readFile(files[0]).then(function (ab) {
        var m = parseMidi(ab);
        if (!m.notes.length) { toast("That MIDI file has no notes."); return; }
        pushUndo();
        if (m.tempo) project.bpm = clamp(Math.round(m.tempo * 100) / 100, 20, 400);
        if (m.sig) project.beatsPerBar = clamp(m.sig, 1, 16);
        var drumNotes = m.notes.filter(function (n) { return n.ch === 9; });
        var otherNotes = m.notes.filter(function (n) { return n.ch !== 9; });
        var bt = barTicks();
        var base = Math.floor(rt.position / bt) * bt;
        var place = function (type, list) {
          if (!list.length) return;
          var t = selectedTrack();
          if (!t || t.type !== type) t = project.tracks.find(function (x) { return x.type === type; });
          if (!t) {
            var count = project.tracks.filter(function (x) { return x.type === type; }).length;
            if ((type === "synth" && count >= MAX_SYNTHS) || project.tracks.length >= MAX_TRACKS) return;
            t = newTrack(type, type === "synth" ? "Vial " + (count + 1) : "Drums");
            project.tracks.push(t);
            reconcile();
          }
          var end = 0;
          list.forEach(function (n) { end = Math.max(end, n.t + n.len); });
          var r = { id: uid(), trackId: t.id, start: base, length: Math.max(bt, Math.ceil(end / bt) * bt), name: files[0].name.replace(/\.[^.]+$/, ""), notes: list.map(function (n) { return { t: n.t, len: type === "drums" ? 240 : n.len, note: n.note, vel: n.vel }; }) };
          project.regions.push(r);
          ui.editorRegionId = r.id;
          ui.sel = new Set([r.id]);
        };
        place("synth", otherNotes);
        place("drums", drumNotes);
        pushTransport();
        reconcile();
        renderAll();
        scheduleSave();
        toast("Imported " + m.notes.length + " notes.");
      }).catch(function () { toast("That file couldn't be read as a MIDI file."); });
    });
  }

  function encodeWav(left, right, rate) {
    var n = left.length;
    var buf = new ArrayBuffer(44 + n * 4);
    var v = new DataView(buf);
    var w = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); w(8, "WAVE"); w(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, n * 4, true);
    var o = 44;
    for (var i = 0; i < n; i++) {
      var l = clamp(left[i], -1, 1), r = clamp(right[i], -1, 1);
      v.setInt16(o, l < 0 ? l * 32768 : l * 32767, true);
      v.setInt16(o + 2, r < 0 ? r * 32768 : r * 32767, true);
      o += 4;
    }
    return new Blob([buf], { type: "audio/wav" });
  }

  function bounce() {
    if (rt.bounce) return;
    var start, end;
    if (project.loop.on) { start = project.loop.start; end = project.loop.end; }
    else { start = 0; end = songEnd(); }
    if (end <= start) { toast("There's nothing to bounce yet — add some regions first."); return; }
    stopTransport(true);
    var seconds = (end - start) / PPQ * 60 / project.bpm + 2.0;
    var frames = Math.ceil(seconds * rt.sampleRate);
    var bar2 = h("div");
    var m = modal("Bouncing…", [h("p", { text: "Playing the project in real time and recording the output (" + Math.round(seconds) + " s)." }), h("div", { class: "bar2" }, [bar2])], [
      { label: "Cancel", action: function () { endBounce(false); } }
    ]);
    rt.bounce = { start: start, end: end, frames: frames, modal: m, bar: bar2, loopWas: project.loop.on };
    E.call("vial_daw_set_loop", 0, project.loop.start, project.loop.end);
    E.call("vial_daw_set_metronome", 0);
    E.call("vial_daw_capture_start", frames);
    rt.hist = [];
    rt.playFrom = start;
    rt.position = start;
    E.call("vial_daw_set_recording", 0, 0);
    E.call("vial_daw_play", start);
    rt.playing = true;
    lcd.play.classList.add("on");
  }

  function bounceTick(st) {
    var b = rt.bounce;
    var got = st[6];
    b.bar.style.width = clamp(got / b.frames * 100, 0, 100) + "%";
    if (got >= b.frames) endBounce(true);
  }

  function endBounce(ok) {
    var b = rt.bounce;
    if (!b) return;
    rt.bounce = null;
    var frames = E.call("vial_daw_capture_stop");
    E.call("vial_daw_stop");
    rt.playing = false;
    lcd.play.classList.remove("on");
    pushTransport();
    if (ok && frames > 0) {
      E.mem();
      var pl = E.call("vial_daw_capture_data", 0), pr2 = E.call("vial_daw_capture_data", 1);
      var left = E.f32.slice(pl >> 2, (pl >> 2) + frames);
      var right = E.f32.slice(pr2 >> 2, (pr2 >> 2) + frames);
      var blob = encodeWav(left, right, Math.round(rt.sampleRate));
      saveBlob(blob, safeName(project.name) + ".wav", "WAV audio", "wav");
    }
    E.call("vial_daw_capture_free");
    b.modal.close();
    locate(b.start);
  }

  function isTextTarget(e) {
    var t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  window.addEventListener("keydown", function (e) {
    if (!rt.ready || isTextTarget(e) || document.querySelector(".modal-back")) return;
    var cmd = e.metaKey || e.ctrlKey;
    var synthView = ui.view === "synth";
    if (synthView && E.call("vial_daw_text_focused")) return;
    var handled = true;
    if (e.code === "Space" && !cmd) { if (!e.repeat) togglePlay(); }
    else if ((e.code === "Enter" || e.code === "NumpadEnter") && !cmd && !synthView) gotoStart();
    else if (e.code === "KeyR" && !cmd && !e.altKey) { if (!e.repeat) toggleRecord(); }
    else if (e.code === "KeyC" && !cmd && !e.altKey) { if (!e.repeat) toggleCycle(); }
    else if (cmd && e.code === "KeyZ" && !synthView) { if (e.shiftKey) redo(); else undo(); }
    else if (cmd && e.code === "KeyY" && !synthView) redo();
    else if (cmd && e.code === "KeyS") saveProjectFile();
    else if (cmd && e.code === "KeyD" && ui.view === "tracks") duplicateSelected();
    else if ((e.code === "Delete" || e.code === "Backspace") && ui.view === "tracks") {
      if (!(ui.prSel.size && deleteSelectedNotes()) && !deleteSelectedRegions()) handled = false;
    }
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("dragover", function (e) {
    if (ui.view !== "synth" && e.dataTransfer) e.preventDefault();
  });
  window.addEventListener("drop", function (e) {
    if (ui.view === "synth" || !e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    var files = Array.prototype.slice.call(e.dataTransfer.files);
    var f = files[0];
    if (/\.(mid|midi)$/i.test(f.name)) {
      pickFilesFromList(files);
      return;
    }
    if (/\.(vialproject)$/i.test(f.name)) {
      readFile(f).then(function (ab) { loadProject(JSON.parse(new TextDecoder().decode(ab)), true); saveLocal(); });
      return;
    }
    var t = selectedTrack();
    if (t && t.type === "drums") loadPadFiles(t, ui.selectedPad, files);
  });

  function pickFilesFromList(files) {
    var old = pickFiles;
    pickFiles = function (a, m, done) { done(files); };
    try { importMidiFile(); } finally { pickFiles = old; }
  }

  function init() {
    var M = window.VialModule;
    if (!M) return;
    E.M = M;
    var tries = 0;
    var wait = function () {
      if (E.call("vial_daw_ready")) start();
      else if (tries++ < 600) setTimeout(wait, 50);
    };
    wait();
  }

  function start() {
    if (rt.ready) return;
    rt.ready = true;
    stage = document.getElementById("stage");
    views.tracks = document.getElementById("view-tracks");
    views.mixer = document.getElementById("view-mixer");
    views.drums = document.getElementById("view-drums");
    var st = E.status();
    if (st && st[5]) rt.sampleRate = st[5];
    fsReady();
    var saved = loadLocal();
    project = demoProject();
    buildBar();
    buildTracksView();
    if (saved && saved.tracks && saved.tracks.length) loadProject(saved, false);
    else loadProject(demoProject(), false);
    showView("tracks");
    requestAnimationFrame(frame);
    setInterval(function () { if (!rt.playing) saveLocal(); }, 30000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") saveLocal(); });
    window.addEventListener("pagehide", saveLocal);
  }

  window.addEventListener("vial-ready", init);
  if (window.VialModule) init();

  window.VialStudio = {
    get project() { return project; },
    ui: ui,
    rt: rt,
    showView: function (v) { showView(v); },
    addTrack: addTrack,
    play: function () { startPlay(false); },
    stop: function () { stopTransport(); },
    record: toggleRecord,
    openEditor: openEditor,
    locate: locate,
    exportMidi: exportMidiFile,
    bounce: bounce,
    serialize: serialize
  };
})();
