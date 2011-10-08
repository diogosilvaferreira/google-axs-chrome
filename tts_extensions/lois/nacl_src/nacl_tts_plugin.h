// Copyright 2010 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_NACL_NACL_TTS_PLUGIN_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_NACL_NACL_TTS_PLUGIN_H_

#include <stdio.h>
#include <stdlib.h>
#include <vector>

#include <ppapi/cpp/audio.h>
#include <ppapi/cpp/instance.h>
#include <ppapi/cpp/var.h>

#include "audio_output.h"
#include "tts_engine.h"
#include "tts_service.h"

using std::vector;

namespace tts_service {

class NaClTtsInstance;

// A class that implements the AudioOutput interface
class NaClAudioOutput : public AudioOutput {
 public:
  explicit NaClAudioOutput(pp::Instance* instance);
  ~NaClAudioOutput() {}
  virtual bool Init(AudioProvider* provider);
  virtual void StartAudio();
  virtual void StopAudio();
  virtual int GetSampleRate();
  virtual int GetChannelCount();
  virtual int GetChunkSizeInFrames();
  virtual int GetTotalBufferSizeInFrames();

  // pp::AudioDevice callbacks
  static void AudioCallback(void* samples, uint32_t buffer_size, void* data);

  void FillAudioBuffer(int16_t* buffer, int frame_count, int channel_count);
 private:

  static const int kBytesPerSample = 2;

  pp::Instance* instance_;
  pp::Audio device_;
  AudioProvider* provider_;
  uint32_t chunk_size_in_frames_;
};

// Our plug-in instance.
class NaClTtsPlugin {
 public:
  NaClTtsPlugin(NaClTtsInstance* instance);
  ~NaClTtsPlugin();

  // Calls from NaClTtsInstance
  void Init();

  // External methods, called through the JavaScript messaging system.
  void StartService();
  void Speak(const std::vector<std::string>& args);
  void Stop();
  void Status();
  void StopService();

  void OnUtteranceCompleted(int utterance_id);

 private:
  NaClTtsInstance* instance_;
  bool initialized_;

  Threading* threading_;
  TtsEngine* engine_;
  AudioOutput* audio_output_;
  TtsService* service_;
};

}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_NACL_NACL_TTS_PLUGIN_H_

