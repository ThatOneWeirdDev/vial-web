# Vial Web

Vial — the open-source build of the Vital spectral warping wavetable synthesizer — compiled to WebAssembly and running entirely in the browser. No server, no install: it is a static site that GitHub Pages can host.

**Play it:** https://thatoneweirddev.github.io/vial-web/

This is a straight port of the GPLv3 source at [mtytel/vital](https://github.com/mtytel/vital). The synth engine, the OpenGL interface, the wavetable editor, the modulation system, the effects and the file formats are the original C++ code, compiled with Emscripten. Only the platform layer underneath (windows, input, audio output, MIDI, OpenGL context, files) was rewritten for the browser.

## Using it

- Click anywhere once to start audio (browsers block sound until you interact with the page).
- Play notes with your computer keyboard (`A W S E D F T G Y H U J K O L P ; '`, `Z`/`X` change octave) or with any Web MIDI controller (Chrome, Edge, Firefox; Safari has no Web MIDI).
- Presets, wavetables, LFO shapes, skins and settings you save are kept in your browser's storage and are still there next time.
- "Export" and "Save as" give you a file download (or a native save dialog in Chromium browsers). "Import"/"Open" use your browser's file picker, and you can drag files straight onto the synth.
- Audio sample rate and buffer size are in the About panel (click the logo), exactly like the desktop standalone.

Factory presets and the account/download/"text to wavetable" services are not part of the open-source release, so they are not here either.

## Browser support

Needs WebAssembly SIMD, WebGL 2, AudioWorklet and SharedArrayBuffer — any current Chrome, Edge, Firefox or Safari. GitHub Pages cannot send the cross-origin isolation headers that SharedArrayBuffer requires, so the page installs a small service worker ([coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker), MIT) that adds them; the first visit reloads itself once to activate it.

## How the port works

| Desktop | Browser |
| --- | --- |
| JUCE message loop | Browser event loop (`requestAnimationFrame` + `MessageChannel` dispatch) |
| Native windows (X11/Win32/Cocoa) | One `<div>` + `<canvas>` per JUCE peer, software-rendered and blitted |
| OpenGL 3.2 context on a render thread | WebGL 2 context on its own canvas, rendered every animation frame |
| Audio device callback | A render pthread fills a lock-free ring buffer in shared wasm memory; an `AudioWorklet` reads it |
| ALSA/CoreMIDI | Web MIDI |
| Native file dialogs | `<input type=file>`, `showSaveFilePicker` / download fallback |
| Home folder | IndexedDB-backed filesystem mounted at `~` |

All changes to the JUCE modules are under `#if JUCE_EMSCRIPTEN` (new files are named `juce_emscripten_*`). Changes to Vital itself are small: modal file dialogs became asynchronous, the standalone window fills the browser tab, and two shader bugs that only show up on OpenGL ES were fixed.

## Building

Requirements: Emscripten 3.1.52 with LLVM 18 (the version this was built and tested with), GNU make, Python 3.

```sh
make -j4            # optimized build into docs/
make CONFIG=Debug OUT=docs-debug   # debug build with assertions
```

Serve the output folder over HTTP (`python3 -m http.server -d docs`) and open it. `docs/` is what GitHub Pages publishes.

## License

GPLv3, same as Vital — see `vital/LICENSE`. The complete corresponding source for the published build is this repository. "Vital" is a trademark of Vital Audio; this project is not affiliated with or endorsed by Vital Audio and does not use their name for the build, following the upstream README.
