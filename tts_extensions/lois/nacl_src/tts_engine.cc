// Copyright 2010 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)
//
// Implementation of cross-engine TtsEngine code.

#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "tts_engine.h"

namespace tts_service {

int TtsEngine::GetVoiceIndex(const TtsVoice* voice_options) {
  int count = GetVoiceCount();
  for (int i = 0; i < count; i++) {
    const TtsVoice* voice = GetVoiceInfo(i);
    if (TtsEngine::VoiceMatches(voice, voice_options)) {
      return i;
    }
  }
  return -1;
}

bool TtsEngine::VoiceMatches(const TtsVoice* voice, const TtsVoice* pattern) {
  return (pattern->name.empty()
          || strcasecmp(voice->name.c_str(), pattern->name.c_str()) == 0)
      && (pattern->language.empty()
          || strcasecmp(voice->language.c_str(),
                        pattern->language.c_str()) == 0)
      && (pattern->engine.empty()
          || strcasecmp(voice->engine.c_str(), pattern->engine.c_str()) == 0)
      && (pattern->sample_rate == 0
          || voice->sample_rate == pattern->sample_rate)
      && (pattern->quality == TTS_UNSPECIFIED_QUALITY
          || voice->quality == pattern->quality)
      && (pattern->region.empty()
          || strcasecmp(voice->region.c_str(), pattern->region.c_str()) == 0)
      && (pattern->gender == TTS_UNSPECIFIED_GENDER
          || voice->gender == pattern->gender)
      && (pattern->age == 0
          || voice->age == pattern->age);
}

tts_result TtsEngine::SetVoiceByLanguage(const string& language_code) {
  int count = GetVoiceCount();
  for (int i = 0; i < count; i++) {
    if (0 == strcasecmp(GetVoiceInfo(i)->language.c_str(),
                        language_code.c_str())) {
      return SetVoice(i);
    }
  }
  return TTS_FAILURE;
}

}  // namespace tts_service

