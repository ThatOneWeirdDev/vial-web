#include "web_platform.h"
#include "load_save.h"
#include "synth_constants.h"

#if JUCE_EMSCRIPTEN
#include <emscripten.h>

EM_JS(int, vial_web_fullscreen_supported, (), {
  var el = document.documentElement;
  return (el.requestFullscreen || el.webkitRequestFullscreen) ? 1 : 0;
});

EM_JS(int, vial_web_is_fullscreen, (), {
  if (document.fullscreenElement || document.webkitFullscreenElement)
    return 1;
  return (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) ? 1 : 0;
});

EM_JS(void, vial_web_toggle_fullscreen, (), {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        var r = exit.call(document);
        if (r && r.catch) r.catch(function() {});
      }
      return;
    }

    var el = document.documentElement;
    var request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (request) {
      var result = request.call(el, { navigationUI: "hide" });
      if (result && result.catch) result.catch(function() {});
      if (screen.orientation && screen.orientation.lock)
        screen.orientation.lock("landscape").catch(function() {});
    }
  } catch (err) {}
});

EM_JS(int, vial_web_midi_available, (), {
  return navigator.requestMIDIAccess ? 1 : 0;
});

EM_JS(int, vial_web_midi_enabled, (), {
  return (Module.juceMidi && Module.juceMidi.access) ? 1 : 0;
});

EM_JS(void, vial_web_enable_midi, (), {
  if (Module.juceMidi && Module.juceMidi.request) {
    Module.juceMidi.requested = false;
    Module.juceMidi.request();
  }
});

EM_JS(void, vial_web_fullscreen_help, (), {
  var gap = String.fromCharCode(10, 10);
  window.alert("This browser can't put web pages in full screen." + gap +
               "To run Vial full screen, tap the Share button, choose 'Add to Home Screen', " +
               "then open Vial from the new icon on your home screen. Turn your phone sideways for the biggest view.");
});
#endif

namespace web_platform {
  bool fullscreenSupported() {
  #if JUCE_EMSCRIPTEN
    return vial_web_fullscreen_supported() != 0;
  #else
    return false;
  #endif
  }

  bool isFullscreen() {
  #if JUCE_EMSCRIPTEN
    return vial_web_is_fullscreen() != 0;
  #else
    return false;
  #endif
  }

  void toggleFullscreen() {
  #if JUCE_EMSCRIPTEN
    vial_web_toggle_fullscreen();
  #endif
  }

  void showFullscreenHelp() {
  #if JUCE_EMSCRIPTEN
    vial_web_fullscreen_help();
  #endif
  }

  bool midiAvailable() {
  #if JUCE_EMSCRIPTEN
    return vial_web_midi_available() != 0;
  #else
    return false;
  #endif
  }

  bool midiEnabled() {
  #if JUCE_EMSCRIPTEN
    return vial_web_midi_enabled() != 0;
  #else
    return false;
  #endif
  }

  void enableMidi() {
  #if JUCE_EMSCRIPTEN
    vial_web_enable_midi();
  #endif
  }

  namespace {
    bool copyInto(const File& source, const File& folder) {
      folder.createDirectory();
      File destination = folder.getChildFile(source.getFileName());
      if (destination == source)
        return true;
      destination.deleteFile();
      return source.copyFileTo(destination);
    }

    bool importBank(const File& file) {
      FileInputStream input_stream(file);
      if (!input_stream.openedOk())
        return false;

      File data_directory = LoadSave::getDataDirectory();
      data_directory.createDirectory();
      if (!LoadSave::hasDataDirectory())
        LoadSave::saveDataDirectory(data_directory);

      ZipFile zip(input_stream);
      if (zip.getNumEntries() == 0)
        return false;

      Result result = zip.uncompressTo(data_directory);
      if (result.failed())
        return false;

      LoadSave::markPackInstalled(file.getFileNameWithoutExtension().toStdString());
      return true;
    }
  }

  ImportSummary importFiles(const Array<File>& files) {
    ImportSummary summary;

    for (const File& file : files) {
      if (!file.existsAsFile()) {
        summary.skipped++;
        continue;
      }

      String extension = file.getFileExtension().toLowerCase().trimCharactersAtStart(".");

      if (extension == String(vital::kPresetExtension)) {
        if (copyInto(file, LoadSave::getUserPresetDirectory())) {
          summary.presets++;
          summary.last_preset = LoadSave::getUserPresetDirectory().getChildFile(file.getFileName());
        }
        else
          summary.skipped++;
      }
      else if (extension == String(vital::kWavetableExtension) || extension == "wav" || extension == "flac") {
        if (copyInto(file, LoadSave::getUserWavetableDirectory()))
          summary.wavetables++;
        else
          summary.skipped++;
      }
      else if (extension == String(vital::kLfoExtension)) {
        if (copyInto(file, LoadSave::getUserLfoDirectory()))
          summary.lfos++;
        else
          summary.skipped++;
      }
      else if (extension == String(vital::kSkinExtension)) {
        if (copyInto(file, LoadSave::getUserSkinDirectory()))
          summary.skins++;
        else
          summary.skipped++;
      }
      else if (extension == String(vital::kBankExtension) || extension == "zip") {
        if (importBank(file))
          summary.banks++;
        else
          summary.skipped++;
      }
      else if (extension == "scl" || extension == "tun" || extension == "kbm") {
        summary.tunings++;
        summary.last_tuning = file;
      }
      else
        summary.skipped++;
    }

    return summary;
  }

  String describe(const ImportSummary& summary) {
    StringArray parts;
    auto add = [&parts](int count, const String& singular, const String& plural) {
      if (count > 0)
        parts.add(String(count) + " " + (count == 1 ? singular : plural));
    };

    add(summary.presets, "preset", "presets");
    add(summary.wavetables, "wavetable", "wavetables");
    add(summary.lfos, "LFO shape", "LFO shapes");
    add(summary.skins, "skin", "skins");
    add(summary.banks, "bank", "banks");
    add(summary.tunings, "tuning", "tunings");

    String result;
    if (parts.isEmpty())
      result = "Nothing was imported.";
    else
      result = "Imported " + parts.joinIntoString(", ") + ".";

    if (summary.skipped > 0)
      result += "\n" + String(summary.skipped) + (summary.skipped == 1 ? " file was" : " files were") +
                " skipped because Vial can't use that file type.";

    return result;
  }
}
