# Vial Web

Vial — the open-source build of the Vital spectral warping wavetable synthesizer — compiled to WebAssembly and running entirely in the browser, wrapped in a small Logic-style studio (tracks, drum machine, mixer, MIDI recording). No server, no install: it is a static site that GitHub Pages can host.

**Play it:** https://thatoneweirddev.github.io/vial-web/

This is a straight port of the GPLv3 source at [mtytel/vital](https://github.com/mtytel/vital). The synth engine, the OpenGL interface, the wavetable editor, the modulation system, the effects and the file formats are the original C++ code, compiled with Emscripten. Only the platform layer underneath (windows, input, audio output, MIDI, OpenGL context, files) was rewritten for the browser.

## Using it

- Click anywhere once to start audio (browsers block sound until you interact with the page).
- The bar at the top switches between **Tracks**, **Mixer**, **Synth** (the full Vial editor for the selected track) and **Drums** (the drum machine), and holds the transport: go to start, stop, play, record, cycle, the position/tempo/time-signature display, metronome and count-in.
- Play notes with your computer keyboard (`A W S E D F T G Y H U J K O L P ; '`, `Z`/`X` change octave) or with any Web MIDI controller (Chrome, Edge, Firefox; Safari has no Web MIDI).
- Presets, wavetables, LFO shapes, skins and settings you save are kept in your browser's storage and are still there next time.
- A "Vial Basics" pack of wavetables (sine, triangle, saw, square, pulses, PWM, sync, FM, wavefold, additive, formant sweeps…) and LFO shapes is installed on first launch.
- Main menu (☰) → **Import Files...** adds any mix of presets, wavetables, LFOs, skins, banks and tunings to your library in one go. **Full Screen** is in the same menu; on iPhone, use Share → Add to Home Screen instead.
- "Export" and "Save as" give you a file download (or a native save dialog in Chromium browsers). "Import"/"Open" use your browser's file picker, and you can drag files straight onto the synth.
- Audio sample rate and buffer size are in the About panel (click the logo), exactly like the desktop standalone.

### Studio

- **Tracks:** Vial synth tracks and drum machine tracks. Double-click (double-tap) an empty lane to draw a region, drag regions to move them, drag the right edge to resize, Duplicate / Split / Delete from the toolbar. Drag in the top strip of the ruler to set the cycle range; click the lower part to move the playhead.
- **Editor:** synth regions open in a piano roll (click/tap to add notes, drag to move or resize, double-click to delete, quantize, velocity); drum regions open in a step sequencer.
- **Recording:** select a track and press record (R). Notes from the computer keyboard, a MIDI controller, the Vial on-screen keyboard or the Keyboard/pads panel are recorded with latency compensation, with an optional one-bar count-in. In cycle mode takes merge into the region under the cycle.
- **Drum machine:** 16 pads (C1–D#2) with two built-in synthesized kits. Drop audio files on a pad or use Load Sample(s) to use your own sounds; each pad has volume, pan, pitch and choke group.
- **Mixer:** volume, pan, mute and solo per track, with meters.
- **Files:** projects autosave in the browser; the menu (☰) can save/open `.vialproject` files (samples included), import/export MIDI files and bounce the song (or the cycle range) to WAV.
- Shortcuts: Space play/stop, Return go to start, R record, C cycle, ⌘/Ctrl+Z undo, ⇧⌘Z redo, ⌘D duplicate, Delete removes the selection.

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
| Host DAW | A C++ engine (`vital/src/standalone/daw_engine.*`) on the audio thread: transport, sequencer, extra Vial instances for additional tracks, sample-based drum machine, mixer, metronome, recording and bounce capture. The studio UI (`web/daw.js`) is plain HTML/JS and talks to it through exported functions. |

All changes to the JUCE modules are under `#if JUCE_EMSCRIPTEN` (new files are named `juce_emscripten_*`). Changes to Vital itself are small: modal file dialogs became asynchronous, the standalone window fills the browser tab, the on-screen keyboard tracks one note per finger, and two shader bugs that only show up on OpenGL ES were fixed.

Audio output adapts to the device: the ring buffer between the render thread and the AudioWorklet starts larger on phones and grows automatically if the device can't keep up, and the editor's frame rate drops on slow GPUs instead of stalling the page.

## Building

Requirements: Emscripten 3.1.52 with LLVM 18 (the version this was built and tested with), GNU make, Python 3.

```sh
make -j4            # optimized build into docs/
make CONFIG=Debug OUT=docs-debug   # debug build with assertions
```

Serve the output folder over HTTP (`python3 -m http.server -d docs`) and open it. `docs/` is what GitHub Pages publishes.

## License

GPLv3, same as Vital — see `vital/LICENSE`. The complete corresponding source for the published build is this repository. "Vital" is a trademark of Vital Audio; this project is not affiliated with or endorsed by Vital Audio and does not use their name for the build, following the upstream README.
