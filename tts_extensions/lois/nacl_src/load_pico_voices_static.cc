// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: chaitanyag@google.com (Chaitanya Gharpure)
//
// Load pico voices and language files using hardcoded paths.
// TODO(chaitanyag): Change this to load voices from a file.

#include "pico_tts_engine.h"

namespace tts_service {

// Load the supported languages and properties from hardcoded paths.
tts_result PicoTtsEngine::LoadVoices(const string& filename) {
  {
    voices_.push_back(PicoTtsVoice());
    PicoTtsVoice* voice = &voices_.back();
    voice->language = "eng";
    voice->region = "USA";
    voice->name = "en-US";
    voice->sample_rate = 16000;
    voice->ta_lingware = "en-US_ta.bin";
    voice->sg_lingware = "en-US_lh0_sg.bin";
    voice->utpp_lingware = "en-US_utpp.bin";
    voice->quality = TTS_NORMAL_QUALITY;

    voices_.push_back(PicoTtsVoice());
    voice = &voices_.back();
    voice->language = "eng";
    voice->region = "GBR";
    voice->name = "en-GB";
    voice->sample_rate = 16000;
    voice->ta_lingware = "en-GB_ta.bin";
    voice->sg_lingware = "en-GB_kh0_sg.bin";
    voice->utpp_lingware = "en-GB_utpp.bin";
    voice->quality = TTS_NORMAL_QUALITY;

    voices_.push_back(PicoTtsVoice());
    voice = &voices_.back();
    voice->language = "deu";
    voice->region = "DEU";
    voice->name = "de-DE";
    voice->sample_rate = 16000;
    voice->ta_lingware = "de-DE_ta.bin";
    voice->sg_lingware = "de-DE_gl0_sg.bin";
    voice->utpp_lingware = "de-DE_utpp.bin";
    voice->quality = TTS_NORMAL_QUALITY;

    voices_.push_back(PicoTtsVoice());
    voice = &voices_.back();
    voice->language = "spa";
    voice->region = "ESP";
    voice->name = "es-ES";
    voice->sample_rate = 16000;
    voice->ta_lingware = "es-ES_ta.bin";
    voice->sg_lingware = "es-ES_zl0_sg.bin";
    voice->utpp_lingware = "es-ES_utpp.bin";
    voice->quality = TTS_NORMAL_QUALITY;

    voices_.push_back(PicoTtsVoice());
    voice = &voices_.back();
    voice->language = "fra";
    voice->region = "FRA";
    voice->name = "fr-FR";
    voice->sample_rate = 16000;
    voice->ta_lingware = "fr-FR_ta.bin";
    voice->sg_lingware = "fr-FR_nk0_sg.bin";
    voice->utpp_lingware = "fr-FR_utpp.bin";
    voice->quality = TTS_NORMAL_QUALITY;

    voices_.push_back(PicoTtsVoice());
    voice = &voices_.back();
    voice->language = "ita";
    voice->region = "ITA";
    voice->name = "it-IT";
    voice->sample_rate = 16000;
    voice->ta_lingware = "it-IT_ta.bin";
    voice->sg_lingware = "it-IT_cm0_sg.bin";
    voice->utpp_lingware = "it-IT_utpp.bin";
    voice->quality = TTS_NORMAL_QUALITY;

    // Load properties
    string rate;
    IntToString(PICO_DEF_RATE, &rate);
    properties_["rate"] = rate;
    string pitch;
    IntToString(PICO_DEF_PITCH, &pitch);
    properties_["pitch"] = pitch;
    string volume;
    IntToString(PICO_DEF_VOL, &volume);
    properties_["volume"] = volume;
  }

  return TTS_SUCCESS;
}

}  // namespace speech_synthesis


