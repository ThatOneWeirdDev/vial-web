#pragma once

#include "JuceHeader.h"
#include "line_generator.h"
#include "load_save.h"
#include "synth_constants.h"
#include "wave_frame.h"
#include "wave_source.h"
#include "wavetable.h"
#include "wavetable_creator.h"
#include "wavetable_group.h"

#include <cmath>
#include <functional>
#include <vector>

namespace web_factory {
  static constexpr const char* kFolderName = "Vial Basics";
  static constexpr const char* kVersion = "3";
  static constexpr const char* kAuthor = "Vial";
  static constexpr float kPi = 3.14159265358979f;

  typedef std::function<float(float phase, float morph)> WaveFunction;

  inline float wrap(float phase) {
    return phase - std::floor(phase);
  }

  inline float sine(float p) { return std::sin(2.0f * kPi * p); }
  inline float triangle(float p) { return 1.0f - 4.0f * std::fabs(wrap(p + 0.25f) - 0.5f); }
  inline float saw(float p) { return 2.0f * wrap(p + 0.5f) - 1.0f; }
  inline float square(float p) { return wrap(p) < 0.5f ? 1.0f : -1.0f; }
  inline float pulse(float p, float width) { return wrap(p) < width ? 1.0f : -1.0f; }

  inline float additive(float p, int harmonics, bool odd_only) {
    float total = 0.0f;
    for (int h = 1; h <= harmonics; ++h) {
      if (odd_only && (h % 2) == 0)
        continue;
      float sign = (!odd_only && (h % 2) == 0) ? -1.0f : 1.0f;
      total += sign * std::sin(2.0f * kPi * h * p) / h;
    }
    return total;
  }

  inline void fillFrame(vital::WaveFrame* frame, const std::function<float(float)>& function) {
    int size = vital::WaveFrame::kWaveformSize;
    float max_value = 0.0f;
    for (int i = 0; i < size; ++i) {
      float phase = (i * 1.0f) / size;
      float value = function(phase);
      frame->time_domain[i] = value;
      max_value = std::max(max_value, std::fabs(value));
    }

    if (max_value > 0.0f) {
      float scale = 1.0f / max_value;
      for (int i = 0; i < size; ++i)
        frame->time_domain[i] *= scale;
    }

    frame->toFrequencyDomain();
  }

  struct TableSpec {
    std::string name;
    int num_keyframes;
    WavetableComponent::InterpolationStyle interpolation;
    WaveFunction function;
  };

  inline void writeTable(const File& folder, const TableSpec& spec) {
    vital::Wavetable wavetable(vital::kNumOscillatorWaveFrames);
    WavetableCreator creator(&wavetable);
    creator.clear();

    WavetableGroup* group = new WavetableGroup();
    WaveSource* source = new WaveSource();
    source->setInterpolationMode(WaveSource::kTime);

    int num_keyframes = std::max(1, spec.num_keyframes);
    for (int k = 0; k < num_keyframes; ++k) {
      float morph = num_keyframes > 1 ? (k * 1.0f) / (num_keyframes - 1) : 0.0f;
      int position = num_keyframes > 1 ? (k * (vital::kNumOscillatorWaveFrames - 1)) / (num_keyframes - 1) : 0;
      source->insertNewKeyframe(position);
      WaveSourceKeyframe* keyframe = source->getKeyframe(k);
      fillFrame(keyframe->wave_frame(), [&](float phase) { return spec.function(phase, morph); });
    }

    source->setInterpolationStyle(spec.interpolation);
    group->addComponent(source);
    creator.addGroup(group);
    creator.setName(spec.name);
    creator.setAuthor(kAuthor);

    File file = folder.getChildFile(spec.name + "." + vital::kWavetableExtension);
    file.replaceWithText(creator.stateToJson().dump());
  }

  inline std::vector<TableSpec> getTables() {
    typedef WavetableComponent::InterpolationStyle Style;
    Style none = WavetableComponent::kNone;
    Style linear = WavetableComponent::kLinear;
    Style cubic = WavetableComponent::kCubic;

    std::vector<TableSpec> tables;
    tables.push_back({ "Sine", 1, none, [](float p, float) { return sine(p); } });
    tables.push_back({ "Triangle", 1, none, [](float p, float) { return triangle(p); } });
    tables.push_back({ "Saw", 1, none, [](float p, float) { return saw(p); } });
    tables.push_back({ "Square", 1, none, [](float p, float) { return square(p); } });
    tables.push_back({ "Pulse 25", 1, none, [](float p, float) { return pulse(p, 0.25f); } });
    tables.push_back({ "Pulse 12", 1, none, [](float p, float) { return pulse(p, 0.125f); } });
    tables.push_back({ "Half Sine", 1, none, [](float p, float) { return wrap(p) < 0.5f ? sine(p) : 0.0f; } });
    tables.push_back({ "Rectified Sine", 1, none, [](float p, float) { return 2.0f * std::fabs(sine(p)) - 1.0f; } });

    tables.push_back({ "Basic Shapes", 4, linear, [](float p, float m) {
      int index = std::min(3, (int)std::round(m * 3.0f));
      if (index == 0)
        return sine(p);
      if (index == 1)
        return triangle(p);
      if (index == 2)
        return saw(p);
      return square(p);
    } });
    tables.push_back({ "Sine to Triangle", 2, linear, [](float p, float m) {
      return (1.0f - m) * sine(p) + m * triangle(p);
    } });
    tables.push_back({ "Sine to Saw", 2, linear, [](float p, float m) { return (1.0f - m) * sine(p) + m * saw(p); } });
    tables.push_back({ "Sine to Square", 2, linear, [](float p, float m) {
      return (1.0f - m) * sine(p) + m * square(p);
    } });
    tables.push_back({ "Triangle to Saw", 2, linear, [](float p, float m) {
      float peak = 0.5f + 0.4999f * m;
      float x = wrap(p);
      return x < peak ? 2.0f * x / peak - 1.0f : 1.0f - 2.0f * (x - peak) / (1.0f - peak);
    } });
    tables.push_back({ "PWM", 33, linear, [](float p, float m) { return pulse(p, 0.5f - 0.48f * m); } });
    tables.push_back({ "Additive Saw", 32, linear, [](float p, float m) {
      int harmonics = std::max(1, (int)std::round(std::pow(128.0f, m)));
      return additive(p, harmonics, false);
    } });
    tables.push_back({ "Additive Square", 32, linear, [](float p, float m) {
      int harmonics = std::max(1, (int)std::round(std::pow(128.0f, m)));
      return additive(p, harmonics, true);
    } });
    tables.push_back({ "Sync Saw", 33, linear, [](float p, float m) { return saw(wrap(p) * (1.0f + 7.0f * m) + 0.5f); } });
    tables.push_back({ "Sync Square", 33, linear, [](float p, float m) {
      return square(wrap(p) * (1.0f + 7.0f * m));
    } });
    tables.push_back({ "FM Sine", 33, cubic, [](float p, float m) { return std::sin(2.0f * kPi * p + 6.0f * m * sine(p)); } });
    tables.push_back({ "FM Ratio 2", 33, cubic, [](float p, float m) {
      return std::sin(2.0f * kPi * p + 4.0f * m * sine(2.0f * p));
    } });
    tables.push_back({ "Wavefold", 33, cubic, [](float p, float m) {
      float gain = 1.0f + 7.0f * m;
      return std::asin(std::sin(0.5f * kPi * gain * sine(p))) / (0.5f * kPi);
    } });
    tables.push_back({ "Soft Square", 33, cubic, [](float p, float m) {
      float drive = 1.0f + 19.0f * m;
      return std::tanh(drive * sine(p));
    } });
    tables.push_back({ "Harmonic Sweep", 16, cubic, [](float p, float m) { return sine((1.0f + std::round(m * 15.0f)) * p); } });
    tables.push_back({ "Vowel Formants", 5, cubic, [](float p, float m) {
      static const float kFormants[5][3] = {
        { 3.5f, 6.0f, 12.0f }, { 2.5f, 9.5f, 13.0f }, { 1.5f, 11.0f, 14.5f },
        { 2.5f, 4.5f, 12.0f }, { 1.5f, 3.5f, 11.0f }
      };
      int vowel = std::min(4, (int)std::round(m * 4.0f));
      float total = 0.0f;
      for (int h = 1; h <= 32; ++h) {
        float amplitude = 0.0f;
        for (int f = 0; f < 3; ++f) {
          float distance = (h - kFormants[vowel][f]) / (1.0f + f);
          amplitude += std::exp(-distance * distance) / (1.0f + f);
        }
        total += amplitude * std::sin(2.0f * kPi * h * p);
      }
      return total;
    } });
    return tables;
  }

  inline void writeLfo(const File& folder, const std::string& name, const std::function<void(LineGenerator&)>& setup) {
    LineGenerator generator;
    setup(generator);
    generator.setName(name);
    File file = folder.getChildFile(String(name) + "." + vital::kLfoExtension);
    file.replaceWithText(generator.stateToJson().dump());
  }

  inline void setPoints(LineGenerator& generator, const std::vector<std::pair<float, float>>& points,
                        const std::vector<float>& powers, bool smooth) {
    generator.setNumPoints((int)points.size());
    for (int i = 0; i < (int)points.size(); ++i) {
      generator.setPoint(i, points[i]);
      generator.setPower(i, i < (int)powers.size() ? powers[i] : 0.0f);
    }
    generator.setSmooth(smooth);
  }

  inline void writeLfos(const File& folder) {
    writeLfo(folder, "Sine", [](LineGenerator& g) { g.initSin(); });
    writeLfo(folder, "Triangle", [](LineGenerator& g) { g.initTriangle(); });
    writeLfo(folder, "Square", [](LineGenerator& g) { g.initSquare(); });
    writeLfo(folder, "Saw Up", [](LineGenerator& g) { g.initSawUp(); });
    writeLfo(folder, "Saw Down", [](LineGenerator& g) { g.initSawDown(); });
    writeLfo(folder, "Ramp Exponential", [](LineGenerator& g) {
      setPoints(g, { { 0.0f, 1.0f }, { 1.0f, 0.0f } }, { 4.0f, 0.0f }, false);
    });
    writeLfo(folder, "Decay", [](LineGenerator& g) {
      setPoints(g, { { 0.0f, 0.0f }, { 1.0f, 1.0f } }, { -4.0f, 0.0f }, false);
    });
    writeLfo(folder, "Pulse 25", [](LineGenerator& g) {
      setPoints(g, { { 0.0f, 0.0f }, { 0.25f, 0.0f }, { 0.25f, 1.0f }, { 1.0f, 1.0f } }, {}, false);
    });
    writeLfo(folder, "Steps 4", [](LineGenerator& g) {
      setPoints(g, { { 0.0f, 1.0f }, { 0.25f, 1.0f }, { 0.25f, 0.6667f }, { 0.5f, 0.6667f },
                     { 0.5f, 0.3333f }, { 0.75f, 0.3333f }, { 0.75f, 0.0f }, { 1.0f, 0.0f } }, {}, false);
    });
    writeLfo(folder, "Steps 8 Random", [](LineGenerator& g) {
      static const float kValues[8] = { 0.2f, 0.9f, 0.45f, 0.7f, 0.05f, 0.6f, 0.3f, 1.0f };
      std::vector<std::pair<float, float>> points;
      for (int i = 0; i < 8; ++i) {
        float y = 1.0f - kValues[i];
        points.push_back({ i / 8.0f, y });
        points.push_back({ (i + 1) / 8.0f, y });
      }
      setPoints(g, points, {}, false);
    });
    writeLfo(folder, "Bounce", [](LineGenerator& g) {
      setPoints(g, { { 0.0f, 0.0f }, { 0.5f, 1.0f }, { 0.75f, 0.0f }, { 0.875f, 0.5f }, { 1.0f, 0.0f } },
                { 3.0f, -3.0f, 3.0f, -3.0f, 0.0f }, false);
    });
    writeLfo(folder, "Trance Gate", [](LineGenerator& g) {
      static const bool kGates[8] = { true, false, true, true, false, true, false, true };
      std::vector<std::pair<float, float>> points;
      for (int i = 0; i < 8; ++i) {
        float y = kGates[i] ? 0.0f : 1.0f;
        points.push_back({ i / 8.0f, y });
        points.push_back({ (i + 0.8f) / 8.0f, y });
        points.push_back({ (i + 0.8f) / 8.0f, 1.0f });
        points.push_back({ (i + 1.0f) / 8.0f, 1.0f });
      }
      setPoints(g, points, {}, false);
    });
  }

  inline void install() {
    File data_directory = LoadSave::getDataDirectory();
    data_directory.createDirectory();
    if (!LoadSave::hasDataDirectory()) {
      LoadSave::saveDataDirectory(data_directory);
      LoadSave::markPackInstalled(kFolderName);
    }

    File folder = data_directory.getChildFile(kFolderName);
    File marker = folder.getChildFile(".version");

    if (marker.existsAsFile() && marker.loadFileAsString().trim() == kVersion)
      return;

    File wavetables = folder.getChildFile(LoadSave::kWavetableFolderName);
    File lfos = folder.getChildFile(LoadSave::kLfoFolderName);
    wavetables.deleteRecursively();
    lfos.deleteRecursively();
    wavetables.createDirectory();
    lfos.createDirectory();

    for (const TableSpec& spec : getTables())
      writeTable(wavetables, spec);

    writeLfos(lfos);
    marker.replaceWithText(kVersion);
  }
}
