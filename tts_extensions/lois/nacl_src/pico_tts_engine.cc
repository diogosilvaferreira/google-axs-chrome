// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: chaitanyag@google.com (Chaitanya Gharpure)
//
// Pico specific implementation of the TtsEngine interface defined in
// tts_engine.h.

#include <cstdio>
#include <math.h>

#include "log.h"
#include "pico_tts_engine.h"

#define FAILERR(X) \
  if (PICO_OK != (X)) { \
    LOG(ERROR) << "Fail line " << __LINE__; \
    return TTS_FAILURE; \
  } \
  else

namespace tts_service {

const char* PROP_RATE = "rate";
const char* PROP_PITCH = "pitch";
const char* PROP_VOLUME = "volume";

const int PICO_MEM_SIZE = 2500000;
const pico_Char * PICO_VOICE_NAME =
    reinterpret_cast<const pico_Char *>("PicoVoice");

// Unloads the Pico engine and any loaded Pico resources, but does not
// shut down.
void PicoTtsEngine::CleanResources(void) {
  if (engine_) {
    pico_disposeEngine(system_, &engine_);
    pico_releaseVoiceDefinition(system_, PICO_VOICE_NAME);
    engine_ = NULL;
  }
  if (ta_resource_) {
    pico_unloadResource(system_, &ta_resource_);
    ta_resource_ = NULL;
  }
  if (sg_resource_) {
    pico_unloadResource(system_, &sg_resource_);
    sg_resource_ = NULL;
  }

  current_voice_index_ = -1;
}

// Initializes the engine for the specified voice.
tts_result PicoTtsEngine::InitVoice(int voice_index) {
  if (voice_index < 0 || voice_index >= GetVoiceCount()) {
    LOG(INFO) << "Voice index out of range: " << voice_index;
    return TTS_FAILURE;
  }
  const PicoTtsVoice * voice = &voices_[voice_index];

  pico_Char ta_resource_name[PICO_MAX_RESOURCE_NAME_SIZE];
  pico_Char sg_resource_name[PICO_MAX_RESOURCE_NAME_SIZE];

  string tafile = base_path_ + voice->ta_lingware;
  string sgfile = base_path_ + voice->sg_lingware;
  const pico_Char *ta_filename =
      reinterpret_cast<const pico_Char *>(tafile.c_str());
  const pico_Char *sg_filename =
      reinterpret_cast<const pico_Char *>(sgfile.c_str());

  FAILERR(pico_loadResource(system_, ta_filename, &ta_resource_));
  FAILERR(pico_loadResource(system_, sg_filename, &sg_resource_));
  FAILERR(pico_getResourceName(system_, ta_resource_,
      reinterpret_cast<char *>(ta_resource_name)));
  FAILERR(pico_getResourceName(system_, sg_resource_,
      reinterpret_cast<char *>(sg_resource_name)));
  FAILERR(pico_createVoiceDefinition(system_, PICO_VOICE_NAME));
  FAILERR(pico_addResourceToVoiceDefinition(
      system_, PICO_VOICE_NAME, ta_resource_name));
  FAILERR(pico_addResourceToVoiceDefinition(
      system_, PICO_VOICE_NAME, sg_resource_name));
  pico_newEngine(system_, PICO_VOICE_NAME, &engine_);
  current_voice_index_ = voice_index;

  return TTS_SUCCESS;
}

// Initialize TTS engine.
tts_result PicoTtsEngine::Init() {
  LOG(INFO) << "Start.";
  LoadVoices(base_path_ + "tts_support.xml");
  mem_area_ = malloc(PICO_MEM_SIZE);
  if (!mem_area_) {
    LOG(ERROR) << "Failed to allocate memory for Pico system";
    return TTS_FAILURE;
  }
  memset(mem_area_, 0, PICO_MEM_SIZE);

  FAILERR(pico_initialize(mem_area_, PICO_MEM_SIZE, &system_));
  // Set the first language in the data file as the default.

  FAILERR(InitVoice(0));

  LOG(INFO) << "Init done.";
  return TTS_SUCCESS;
}

// Shuts down the TTS engine, cleans up resources.
tts_result PicoTtsEngine::Shutdown() {
  CleanResources();
  if (system_) {
    pico_terminate(&system_);
    system_ = NULL;
  }
  if (mem_area_) {
    free(mem_area_);
    mem_area_ = NULL;
  }
  return TTS_SUCCESS;
}

tts_result PicoTtsEngine::Stop() {
  // TODO(fergus): use PICO_RESET_SOFT here instead?
  pico_resetEngine(engine_, PICO_RESET_FULL);
  return TTS_SUCCESS;
}

int PicoTtsEngine::GetVoiceCount() {
  return static_cast<int>(voices_.size());
}

const TtsVoice * PicoTtsEngine::GetVoiceInfo(int voice_index) {
  if (voice_index >= 0 && voice_index < GetVoiceCount()) {
    return &voices_[voice_index];
  } else {
    return NULL;
  }
}

tts_result PicoTtsEngine::SetVoice(int voice_index) {
  if (current_voice_index_ != voice_index) {
    CleanResources();
    return InitVoice(voice_index);
  } else {
    return TTS_SUCCESS;
  }
}

void PicoTtsEngine::SetReceiver(TtsDataReceiver* receiver) {
  receiver_ = receiver;
}

// Sets the property for the engine.
tts_result PicoTtsEngine::SetProperty(const char *property,
                                      const char *value) {
  if (properties_.count(property) > 0) {
    properties_[property] = value;
    return TTS_SUCCESS;
  } else {
    return TTS_PROPERTY_UNSUPPORTED;
  }
}

// Converts the float to an int, DISCARDING THE FRACTIONAL PART, and then
// sets the property to the string for that integer value (in decimal).
tts_result PicoTtsEngine::SetProperty(const char *property,
                                      float pico_value) {
  string str;
  IntToString(static_cast<int>(pico_value), &str);
  SetProperty(property, str.c_str());
  return TTS_SUCCESS;
}

// Checks that parameter value is in the range [0.0, 1.0],
// and if so, scales it to the range [min, max] and then calls SetProperty().
tts_result PicoTtsEngine::SetParameter(const char *property, int min, int max,
                                       float value) {
  if (!(value >= 0 && value <= 1)) {  // True for Nan, Inf, -Inf.
    return TTS_VALUE_INVALID;
  }
  float pico_value = min + value * (max - min);
  return SetProperty(property, pico_value);
}

tts_result PicoTtsEngine::SetRate(float rate) {
  return SetParameter(PROP_RATE, PICO_MIN_RATE, PICO_MAX_RATE, rate);
}

tts_result PicoTtsEngine::SetPitch(float pitch) {
  return SetParameter(PROP_PITCH, PICO_MIN_PITCH, PICO_MAX_PITCH, pitch);
}

tts_result PicoTtsEngine::SetVolume(float volume) {
  return SetParameter(PROP_VOLUME, PICO_MIN_VOL, PICO_MAX_VOL, volume);
}

tts_result PicoTtsEngine::RestoreDefaults() {
  SetProperty(PROP_RATE, PICO_DEF_RATE);
  SetProperty(PROP_PITCH, PICO_DEF_PITCH);
  SetProperty(PROP_VOLUME, PICO_DEF_VOL);
  return TTS_SUCCESS;
}

tts_result PicoTtsEngine::GetProperty(const char *property,
    const char **value) {
  map<string, string>::const_iterator iter = properties_.find(property);
  if (iter != properties_.end()) {
    if (value != NULL) {
      (*value) = iter->second.c_str();
    }
    return TTS_SUCCESS;
  }
  return TTS_PROPERTY_UNSUPPORTED;
}

int PicoTtsEngine::GetSampleRate() {
  return voices_[current_voice_index_].sample_rate;
}

tts_result PicoTtsEngine::SynthesizeText(const char* text,
                                         int16_t* audio_buffer,
                                         int audio_buffer_size,
                                         int* out_total_samples) {
  if (out_total_samples != NULL) {
    *out_total_samples = 0;
  }

  string synth_text = "";
  AddPropertyMarkup(text, &synth_text);

  int text_pos = 0;
  const pico_Char* text_ptr =
      reinterpret_cast<const pico_Char*>(synth_text.c_str());
  int text_buffer_len = synth_text.size() + 1;
  while (text_pos < text_buffer_len) {
    pico_Int16 text_bytes_consumed = 0;
    if (PICO_OK != pico_putTextUtf8(
            engine_, text_ptr, text_buffer_len - text_pos,
            &text_bytes_consumed)) {
      RepairEngine();
      return TTS_FAILURE;
    }

    int out_samples;
    tts_result result = GetAudioFromTts(
        audio_buffer, audio_buffer_size, &out_samples);
    if (out_total_samples != NULL) {
      *out_total_samples += out_samples;
    }

    if (result != TTS_SUCCESS) {
      RepairEngine();
      receiver_->Done();
      return result;
    }

    text_pos += text_bytes_consumed;
    text_ptr += text_bytes_consumed;
  }

  // Tell the destination receiver that we're done.
  if (receiver_->Done() != TTS_CALLBACK_HALT) {
    return TTS_FAILURE;
  }
  return TTS_SUCCESS;
}

// According to the Pico manual section on "Other Errors",
// "The safest action to take after such a case is to
// completely shut down the engine that caused the problem
// (pico_disposeEngine) and to create a new engine (pico_newEngine)".
void PicoTtsEngine::RepairEngine() {
  pico_disposeEngine(system_, &engine_);
  pico_newEngine(system_, PICO_VOICE_NAME, &engine_);
}

// This method adds the SSML tags for the supported properties if their
// values are different from the default values.
void PicoTtsEngine::AddPropertyMarkup(const char *text, string *synth_text) {
  int rate_level_ = floor(atof(properties_[PROP_RATE].c_str()));
  int pitch_level_ = floor(atof(properties_[PROP_PITCH].c_str()));
  int volume_level_ = floor(atof(properties_[PROP_VOLUME].c_str()));

  if (rate_level_ < PICO_MIN_RATE || rate_level_ > PICO_MAX_RATE) {
    LOG(WARNING) << "Rate is outside the allowed range.";
  }
  if (pitch_level_ < PICO_MIN_PITCH || pitch_level_ > PICO_MAX_PITCH) {
    LOG(WARNING) << "Pitch is outside the allowed range.";
  }
  if (volume_level_ < PICO_MIN_VOL || volume_level_ > PICO_MAX_VOL) {
    LOG(WARNING) << "Volume is outside the allowed range.";
  }

  *synth_text = "";

  // Append opening tags
  if (rate_level_ != PICO_DEF_RATE) {
    *synth_text += "<speed level='" + properties_[PROP_RATE] + "'>";
  }
  if (pitch_level_ != PICO_DEF_PITCH) {
    *synth_text += "<pitch level='" + properties_[PROP_PITCH] + "'>";
  }
  if (volume_level_ != PICO_DEF_VOL) {
    *synth_text += "<volume level='" + properties_[PROP_VOLUME] + "'>";
  }
  // Append text
  *synth_text += text;
  // Append closing tags in the reverse order
  if (volume_level_ != PICO_DEF_VOL) {
    *synth_text += "</volume>";
  }
  if (pitch_level_ != PICO_DEF_PITCH) {
    *synth_text += "</pitch>";
  }
  if (rate_level_ != PICO_DEF_RATE) {
    *synth_text += "</speed>";
  }
}

// max_iterations_without_apparent_progress is a hack to prevent infinite loops.
// This needs to be more than 200 to pass simple tests such as hello world.
// TODO(fergus): we should fix the underlying bug <http://b/2501315> in the
// //third_party/svox/pico sources, and then delete all the code relating to
// max_iterations_without_apparent_progress.
int PicoTtsEngine::max_iterations_without_apparent_progress = 10000;

tts_result PicoTtsEngine::GetAudioFromTts(int16_t* audio_buffer,
                                          int audio_buffer_size,
                                          int* out_total_samples) {
  int total_samples_output = 0;
  int status;
  tts_callback_status callback_status = TTS_CALLBACK_CONTINUE;
  pico_Int16 data_type = PICO_DATA_PCM_16BIT;
  uint32_t sample_rate = voices_[current_voice_index_].sample_rate;
  int iterations_without_apparent_progress = 0;
  while (1) {
    pico_Int16 bytes_received = 0;
    data_type = 0;
    int8_t* buffer_ptr = reinterpret_cast<int8_t *>(audio_buffer);
    pico_Int16 buffer_size_bytes = audio_buffer_size * sizeof(int16_t);

    status = pico_getData(engine_, buffer_ptr, buffer_size_bytes,
        &bytes_received, &data_type);

    if (status != PICO_STEP_ERROR && bytes_received > 0) {
      if (data_type != PICO_DATA_PCM_16BIT) {
        break;
      }

      int samples_output = bytes_received / sizeof(const pico_Int16);
      total_samples_output += samples_output;

      // make the callback here...note that it's important to call this
      // method even if no data was received.
      if (receiver_) {
        callback_status =
            receiver_->Receive(sample_rate, 1, audio_buffer, samples_output);

        if (callback_status != TTS_CALLBACK_CONTINUE) {
          break;
        }
      }
    }
    if (status != PICO_STEP_BUSY) {
      break;
    }
    if (bytes_received == 0) {
      iterations_without_apparent_progress++;
      if (iterations_without_apparent_progress >
          max_iterations_without_apparent_progress) {
        break;
      }
    } else {
      iterations_without_apparent_progress = 0;
    }
  };

  if (out_total_samples != NULL) {
    *out_total_samples = total_samples_output;
  }

  if (status == PICO_STEP_ERROR ||
      callback_status == TTS_CALLBACK_ERROR ||
      data_type != PICO_DATA_PCM_16BIT ||
      iterations_without_apparent_progress >
      max_iterations_without_apparent_progress) {
    return TTS_FAILURE;
  }

  return TTS_SUCCESS;
}

}  // namespace tts_service

