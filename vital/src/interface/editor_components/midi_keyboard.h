/* Copyright 2013-2019 Matt Tytel
 *
 * vital is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * vital is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with vital.  If not, see <http://www.gnu.org/licenses/>.
 */

#pragma once

#include "JuceHeader.h"

#include "open_gl_multi_quad.h"
#include "synth_gui_interface.h"

class MidiKeyboard : public OpenGlComponent {
  public:
    static const float kBlackKeyOffsets[];
    static const bool kWhiteKeys[];

    static constexpr int kNumWhiteKeys = 75;
    static constexpr int kNumWhiteKeysPerOctave = 7;
    static constexpr int kNumBlackKeys = vital::kMidiSize - kNumWhiteKeys;
    static constexpr int kNumBlackKeysPerOctave = vital::kNotesPerOctave - kNumWhiteKeysPerOctave;
    static constexpr float kBlackKeyHeightRatio = 0.7f;
    static constexpr float kBlackKeyWidthRatio = 0.8f;

    force_inline static bool isWhiteKey(int midi) {
      return kWhiteKeys[midi % vital::kNotesPerOctave];
    }

    MidiKeyboard(MidiKeyboardState& state);

    void paintBackground(Graphics& g) override;
    void parentHierarchyChanged() override;
    void resized() override;
    int getNoteAtPosition(Point<float> position);
    bool isBlackKeyHeight(Point<float> position) { return position.y / getHeight() < kBlackKeyHeightRatio; }
    float getVelocityForNote(int midi, Point<float> position);

    void init(OpenGlWrapper& open_gl) override {
      black_notes_.init(open_gl);
      white_pressed_notes_.init(open_gl);
      black_pressed_notes_.init(open_gl);
    }
      
    void render(OpenGlWrapper& open_gl, bool animate) override;
    void setPressedKeyPositions();

    void destroy(OpenGlWrapper& open_gl) override {
      black_notes_.destroy(open_gl);
      white_pressed_notes_.destroy(open_gl);
      black_pressed_notes_.destroy(open_gl);
    }

    void mouseDown(const MouseEvent& e) override {
      int note = getNoteAtPosition(e.position);
      int source = sourceKey(e);
      auto existing = source_notes_.find(source);
      if (existing != source_notes_.end())
        releaseSourceNote(existing->second, source);
      source_notes_[source] = note;
      if (e.source.isMouse())
        hover_note_ = note;
      state_.noteOn(midi_channel_, note, getVelocityForNote(note, e.position));
    }

    void mouseUp(const MouseEvent& e) override {
      int source = sourceKey(e);
      auto existing = source_notes_.find(source);
      if (existing != source_notes_.end()) {
        int note = existing->second;
        source_notes_.erase(existing);
        releaseSourceNote(note, source);
      }
      hover_note_ = e.source.isMouse() ? getNoteAtPosition(e.position) : -1;
    }

    void mouseEnter(const MouseEvent& e) override {
      if (e.source.isMouse())
        hover_note_ = getNoteAtPosition(e.position);
    }

    void mouseExit(const MouseEvent& e) override {
      if (e.source.isMouse())
        hover_note_ = -1;
    }

    void mouseDrag(const MouseEvent& e) override {
      int source = sourceKey(e);
      auto existing = source_notes_.find(source);
      if (existing == source_notes_.end())
        return;

      int note = getNoteAtPosition(e.position);
      if (note == existing->second)
        return;

      int old_note = existing->second;
      existing->second = note;
      releaseSourceNote(old_note, source);
      state_.noteOn(midi_channel_, note, getVelocityForNote(note, e.position));
      if (e.source.isMouse())
        hover_note_ = note;
    }

    void mouseMove(const MouseEvent& e) override {
      if (e.source.isMouse())
        hover_note_ = getNoteAtPosition(e.position);
    }

    void setMidiChannel(int channel) { midi_channel_ = channel; }
    void setColors();

  private:
    void setWhiteKeyQuad(OpenGlMultiQuad* quads, int quad_index, int white_key_index);
    void setBlackKeyQuad(OpenGlMultiQuad* quads, int quad_index, int black_key_index);

    MidiKeyboardState& state_;

    static int sourceKey(const MouseEvent& e) {
      return e.source.isTouch() ? 1 + e.source.getIndex() : 0;
    }

    void releaseSourceNote(int note, int source) {
      for (auto& other : source_notes_) {
        if (other.first != source && other.second == note)
          return;
      }
      state_.noteOff(midi_channel_, note, 0.0f);
    }

    int midi_channel_;
    int hover_note_;
    std::map<int, int> source_notes_;

    OpenGlMultiQuad black_notes_;
    OpenGlMultiQuad white_pressed_notes_;
    OpenGlMultiQuad black_pressed_notes_;
    OpenGlQuad hover_note_quad_;

    Colour key_press_color_;
    Colour hover_color_;
    Colour white_key_color_;
    Colour black_key_color_;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MidiKeyboard)
};

