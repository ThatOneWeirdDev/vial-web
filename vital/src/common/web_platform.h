#pragma once

#include "JuceHeader.h"

namespace web_platform {
  bool fullscreenSupported();
  bool isFullscreen();
  void toggleFullscreen();
  void showFullscreenHelp();

  bool midiAvailable();
  bool midiEnabled();
  void enableMidi();

  struct ImportSummary {
    int presets = 0;
    int wavetables = 0;
    int lfos = 0;
    int skins = 0;
    int banks = 0;
    int tunings = 0;
    int skipped = 0;
    File last_preset;
    File last_tuning;
  };

  ImportSummary importFiles(const Array<File>& files);
  String describe(const ImportSummary& summary);
}
