(function () {
  "use strict";

  var loader = document.getElementById("loader");
  var progress = document.getElementById("progress");
  var statusEl = document.getElementById("status");
  var audioHint = document.getElementById("audio-hint");

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.className = isError ? "error" : "";
  }

  function setProgress(fraction) {
    progress.style.width = Math.max(0, Math.min(100, fraction * 100)).toFixed(1) + "%";
  }

  function fail(message) {
    setStatus(message, true);
    setProgress(0);
  }

  function checkSupport() {
    if (typeof WebAssembly !== "object")
      return "This browser does not support WebAssembly.";
    if (!window.AudioContext || !window.AudioWorkletNode)
      return "This browser does not support the Web Audio worklets Vial needs.";
    var probe = document.createElement("canvas");
    if (!probe.getContext("webgl2"))
      return "WebGL 2 is not available. Enable hardware acceleration in your browser settings and reload.";
    return null;
  }

  function waitForIsolation() {
    return new Promise(function (resolve) {
      if (window.crossOriginIsolated) {
        resolve(true);
        return;
      }
      setStatus("Preparing secure audio environment…");
      var waited = 0;
      var timer = setInterval(function () {
        waited += 250;
        if (window.crossOriginIsolated) {
          clearInterval(timer);
          resolve(true);
        } else if (waited >= 6000) {
          clearInterval(timer);
          resolve(false);
        }
      }, 250);
    });
  }

  function fetchWithProgress(url, onProgress) {
    return fetch(url).then(function (response) {
      if (!response.ok)
        throw new Error("Failed to download " + url + " (" + response.status + ")");
      var total = parseInt(response.headers.get("content-length") || "0", 10);
      if (!response.body || !total)
        return response.arrayBuffer();
      var reader = response.body.getReader();
      var received = 0;
      var chunks = [];
      function pump() {
        return reader.read().then(function (result) {
          if (result.done)
            return;
          chunks.push(result.value);
          received += result.value.length;
          onProgress(received / total);
          return pump();
        });
      }
      return pump().then(function () {
        var out = new Uint8Array(received);
        var offset = 0;
        chunks.forEach(function (c) { out.set(c, offset); offset += c.length; });
        return out.buffer;
      });
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function setupPersistence(module) {
    var FS = module.FS;
    var syncing = false;
    var pending = false;

    function sync() {
      if (syncing) {
        pending = true;
        return;
      }
      syncing = true;
      FS.syncfs(false, function (err) {
        syncing = false;
        if (err)
          console.warn("Saving data failed", err);
        if (pending) {
          pending = false;
          sync();
        }
      });
    }

    module.vialSync = sync;
    setInterval(sync, 4000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden")
        sync();
    });
    window.addEventListener("pagehide", sync);
    window.addEventListener("beforeunload", sync);
  }

  function hideLoader() {
    loader.classList.add("hidden");
    setTimeout(function () { loader.style.display = "none"; }, 400);
  }

  function setupAudioHint() {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
      audioHint.textContent = "Tap anywhere to start audio";
    audioHint.classList.remove("hidden");
    var dismiss = function () {
      audioHint.classList.add("hidden");
      window.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("keydown", dismiss, true);
    };
    window.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("keydown", dismiss, true);
  }

  async function start() {
    var unsupported = checkSupport();
    if (unsupported) {
      fail(unsupported);
      return;
    }

    var isolated = await waitForIsolation();
    if (!isolated) {
      fail("This page needs cross-origin isolation for multithreaded audio. Reload the page; if this keeps happening, your browser may be blocking service workers (for example in private browsing).");
      return;
    }

    setStatus("Downloading synthesizer…");

    var wasmBinary;
    try {
      var results = await Promise.all([
        fetchWithProgress("vial.wasm", function (f) { setProgress(f * 0.9); }),
        loadScript("vial.js")
      ]);
      wasmBinary = results[0];
    } catch (e) {
      fail(e.message || String(e));
      return;
    }

    setStatus("Starting…");
    setProgress(0.95);

    var moduleConfig = {
      wasmBinary: wasmBinary,
      locateFile: function (path) { return path; },
      print: function (text) { console.log(text); },
      printErr: function (text) { console.warn(text); },
      preRun: [function (module) {
        var FS = module.FS;
        var home = "/home/web_user";
        try { FS.mkdirTree(home); } catch (e) {}
        FS.mount(module.IDBFS, {}, home);
        module.addRunDependency("vial-persistent-data");
        FS.syncfs(true, function (err) {
          if (err)
            console.warn("Loading saved data failed", err);
          module.removeRunDependency("vial-persistent-data");
        });
      }],
      onAbort: function (what) {
        fail("The synthesizer stopped unexpectedly: " + what);
        loader.classList.remove("hidden");
        loader.style.display = "flex";
      }
    };

    try {
      var module = await createVialModule(moduleConfig);
      window.VialModule = module;
      window.dispatchEvent(new Event("vial-ready"));
      setupPersistence(module);
      setProgress(1);
      hideLoader();
      setupAudioHint();
    } catch (e) {
      fail("Failed to start: " + (e && e.message ? e.message : String(e)));
    }
  }

  start();
})();
