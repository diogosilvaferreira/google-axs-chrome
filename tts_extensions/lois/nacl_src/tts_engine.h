// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: chaitanyag@google.com (Chaitanya Gharpure)
//
// This header defines the interface to access Text-To-Speech functionality
// in shared libraries that implement speech synthesis and the management
// of resources associated with the synthesis.
// An example of the implementation of this interface can be found in
// pico/tts_engine.cc

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_TTS_ENGINE_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_TTS_ENGINE_H_

#include <string>

#include "tts_receiver.h"

using std::string;

namespace tts_service {

enum tts_result {
  TTS_SUCCESS = 0,
  TTS_FAILURE = -1,
  TTS_FEATURE_UNSUPPORTED = -2,
  TTS_VALUE_INVALID = -3,
  TTS_PROPERTY_UNSUPPORTED = -4,
  TTS_MISSING_RESOURCES = -5
};

enum tts_gender {
  TTS_UNSPECIFIED_GENDER = 0,
  TTS_MALE = 1,
  TTS_FEMALE = 2
};

enum tts_quality {
  TTS_UNSPECIFIED_QUALITY = 0,
  TTS_EXPERIMENTAL_QUALITY = 1,
  TTS_LOW_QUALITY = 2,
  TTS_NORMAL_QUALITY = 3,
  TTS_HIGH_QUALITY = 4
};

struct TtsVoice {
 public:
  // Required
  string name;
  string language;
  string engine;
  int sample_rate;
  tts_quality quality;

  // Optional
  string region;
  tts_gender gender;
  int age;

  TtsVoice()
      : name(),
        language(),
        engine(),
        sample_rate(0),
        quality(TTS_UNSPECIFIED_QUALITY),
        region(),
        gender(TTS_UNSPECIFIED_GENDER),
        age(0) {
  }
};

class TtsEngine {
 public:
  virtual ~TtsEngine() {}

  // Initialize the TTS engine and returns whether initialization succeeded.
  // @return TTS_SUCCESS, or TTS_FAILURE
  virtual tts_result Init() = 0;

  // Shut down the TTS engine and releases all associated resources.
  // @return TTS_SUCCESS, or TTS_FAILURE
  virtual tts_result Shutdown() = 0;

  // Interrupt synthesis and flushes any synthesized data that hasn't been
  // output yet. This will block until callbacks underway are completed.
  // @return TTS_SUCCESS, or TTS_FAILURE
  virtual tts_result Stop() = 0;

  // Return the number of loaded voices
  virtual int GetVoiceCount() = 0;

  // Return information about the ith voice
  virtual const TtsVoice * GetVoiceInfo(int voice_index) = 0;

  // Returns true iff the specified voice matches the pattern given in
  // voice_options.  Default values in voice_options are treated as wildcards.
  static bool VoiceMatches(const TtsVoice* voice,
                           const TtsVoice *voice_options);

  // Return the voice index for the first voice matching the specified
  // voice options, or -1 if there are no matching voices.
  int GetVoiceIndex(const TtsVoice* voice_options);

  // Switch to the voice with the given index.
  // @return TTS_SUCCESS or TTS_FAILURE
  virtual tts_result SetVoice(int voice_index) = 0;

  // Switch to the first voice in the given language code.
  // @return TTS_SUCCESS or TTS_FAILURE
  tts_result SetVoiceByLanguage(const string& language_code);

  // Switch to the first voice with matching properties.
  // @return TTS_SUCCESS or TTS_FAILURE
  tts_result SetVoiceByProperties(const TtsVoice* voice_options) {
    return SetVoice(GetVoiceIndex(voice_options));
  }

  // Set the object that will receive completed audio samples
  virtual void SetReceiver(TtsDataReceiver* receiver) = 0;

  // Set a property for the the TTS engine
  // @param property pointer to the property name
  // @param value    pointer to the new property value, null-terminated utf-8
  // @return         TTS_PROPERTY_UNSUPPORTED, or TTS_SUCCESS, or
  //                   TTS_FAILURE, or TTS_VALUE_INVALID
  virtual tts_result SetProperty(const char *property, const char *value) = 0;

  // Set the speaking rate/speed.
  // @param rate the speaking rate in the range of 0 to 1.
  // @return     TTS_SUCCESS, or TTS_FAILURE, or TTS_VALUE_INVALID
  virtual tts_result SetRate(float rate) = 0;

  // Set the speaking pitch.
  // @param pitch the speaking pitch in the range of 0 to 1.
  // @return      TTS_SUCCESS, or TTS_FAILURE, or TTS_VALUE_INVALID
  virtual tts_result SetPitch(float pitch) = 0;

  // Set the speaking volume.
  // @param volume the speaking volume in the range of 0 to 1.
  // @return       TTS_SUCCESS, or TTS_FAILURE, or TTS_VALUE_INVALID
  virtual tts_result SetVolume(float volume) = 0;

  // Restore the speed, pitch and volume back to the default values
  // for this engine/voice.
  // @return       TTS_SUCCESS or TTS_FAILURE
  virtual tts_result RestoreDefaults() = 0;

  // Retrieve a property from the TTS engine
  // @param        property   pointer to the property name
  // @param[out]   out_value  will return a const pointer to the
  //                            retrieved value, or null if it doesn't exist
  // @return TTS_PROPERTY_UNSUPPORTED, or TTS_SUCCESS
  virtual tts_result GetProperty(const char *property, const char **value) = 0;

  // Get the sample rate of the currently selected voice
  // @return the sample rate in Hz
  virtual int GetSampleRate() = 0;

  // Synthesize the text.
  // As the synthesis is performed, the engine invokes the callback
  // (i.e., the receiver set by SetReceiver) to notify the TTS
  // framework that it has filled the given buffer, and indicates how
  // many bytes it wrote. The callback is called repeatedly until the
  // engine has generated all the audio data corresponding to the
  // text.  Text is coded in UTF-8 and supports SSML.
  //
  // @param text                 null-terminated UTF-8 text to synthesize
  // @param audio_buffer         buffer to write output audio samples
  // @param audio_buffer_size    capacity of audio_buffer, in int16_t's.
  // @param out_total_samples    receives total number of samples output
  // @return                     TTS_SUCCESS or TTS_FAILURE
  virtual tts_result SynthesizeText(const char *text,
                                    int16_t* audio_buffer,
                                    int audio_buffer_size,
                                    int* out_total_samples) = 0;
};

}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_TTS_ENGINE_H_

