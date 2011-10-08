// Copyright 2009 and beyond, Google Inc. All Rights Reserved.
//
// Author: chaitanyag@google.com (Chaitanya Gharpure)
//
// Header for SVOX Pico TTS engine implementation.

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_PICO_PICO_TTS_ENGINE_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_PICO_PICO_TTS_ENGINE_H_

#include <iostream>
#include <sstream>

#include <stdio.h>
#include <stdlib.h>

#include <map>
#include <string>
#include <vector>

#include "pico/picoapi.h"
#include "pico/picodbg.h"
#include "pico/picodefs.h"

#include "tts_engine.h"

using tts_service::TtsEngine;
using tts_service::TtsDataReceiver;
using tts_service::tts_result;

using std::map;
using std::endl;
using std::ostream;
using std::stringstream;
using std::string;
using std::vector;

namespace tts_service {

//TODO(chaitanyag): Add a comment about the units of these values once we hear
// back from the SVox.
// Speaking speed
const int PICO_MIN_RATE = 20;
const int PICO_MAX_RATE = 500;
const int PICO_DEF_RATE = 100;

// Speaking pitch
const int PICO_MIN_PITCH = 50;
const int PICO_MAX_PITCH = 200;
const int PICO_DEF_PITCH = 100;

// Speaking volume
const int PICO_MIN_VOL = 0;
const int PICO_MAX_VOL = 500;
const int PICO_DEF_VOL = 100;

inline bool IntToString(int x, string *str) {
  std::ostringstream o;
  if (!(o << x))
    return false;
  *str = o.str();
  return true;
}

struct PicoTtsVoice : public TtsVoice {
 public:
  string ta_lingware;
  string sg_lingware;
  string utpp_lingware;
  PicoTtsVoice() {
    engine = "SVOX Pico";
  }
};

// Thread-safe.  Unfortunately Pico is not 64-bit clean.
class PicoTtsEngine : public TtsEngine {
 public:
  // A hack to prevent infinite loops.
  static int max_iterations_without_apparent_progress;

  explicit PicoTtsEngine(const string& base_path)
      : base_path_(base_path),
        mem_area_(NULL),
        system_(NULL),
        engine_(NULL),
        ta_resource_(NULL),
        sg_resource_(NULL),
        receiver_(NULL) {
  }

  ~PicoTtsEngine() {
    Shutdown();
  }

  tts_result Init();
  tts_result Shutdown();
  tts_result Stop();
  int GetVoiceCount();
  const TtsVoice * GetVoiceInfo(int voice_index);
  tts_result SetVoice(int voice_index);
  int GetVoiceIndex(TtsVoice *voice_options);
  void SetReceiver(TtsDataReceiver* receiver);
  tts_result SetProperty(const char *property, const char *value);
  tts_result SetRate(float rate);
  tts_result SetPitch(float pitch);
  tts_result SetVolume(float volume);
  tts_result RestoreDefaults();
  tts_result GetProperty(const char *property, const char **value);
  int GetSampleRate();
  tts_result SynthesizeText(const char *text,
                            int16_t* audio_buffer,
                            int audio_buffer_size,
                            int* out_total_samples);

 private:
  tts_result LoadVoices(const string& filename);
  void CleanResources();
  tts_result InitVoice(int voice_index);
  tts_result GetAudioFromTts(int16_t* audio_buffer,
                             int audio_buffer_size,
                             int* out_total_samples);
  tts_result SetProperty(const char *property, float value);
  tts_result SetParameter(const char *property, int min, int max, float value);
  void AddPropertyMarkup(const char *text, string *synth_text);
  void RepairEngine();

  string base_path_;

  vector<PicoTtsVoice> voices_;
  int current_voice_index_;

  map<string, string> properties_;

  void *          mem_area_;
  pico_System     system_;
  pico_Engine     engine_;
  pico_Resource   ta_resource_;
  pico_Resource   sg_resource_;

  TtsDataReceiver *receiver_;
};

}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_PICO_PICO_TTS_ENGINE_H_

