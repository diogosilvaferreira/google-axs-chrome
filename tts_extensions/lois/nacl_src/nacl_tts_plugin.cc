// Copyright 2010 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)

#include <string>

#include "log.h"
#include "nacl_tts_plugin.h"
#include "nacl_main.h"
#include "pico_tts_engine.h"

using tts_service::ERROR;
using tts_service::LoggingMessage;
using tts_service::PicoTtsEngine;

// All of the response messages that can be sent using PostMessage.
static const char* RESPONSE_IDLE = "idle";
static const char* RESPONSE_BUSY = "busy";
static const char* RESPONSE_ERROR = "error";
static const char* RESPONSE_END = "end";

using std::string;

namespace tts_service {

// The number of chunks of audio to buffer. The chunk size is hinted by
// us but ultimately determined by PPAPI based on how often it can reliably
// call our audio callback. The number of chunks is the amount of data we
// should have buffered ahead of time so that whenever a chunk is requested,
// we can fill it immediately without underflow.
const int kNumChunks = 4;

//
// UtteranceCallback
//

// This class implements the Runnable interface so that it can notify
// the plug-in when an utterance completes, passing it the utterance id.
class UtteranceCallback : public Runnable
{
 public:
  UtteranceCallback(NaClTtsPlugin* target, int utterance_id)
      : target_(target), utterance_id_(utterance_id) {}

  virtual void Run() {
    target_->OnUtteranceCompleted(utterance_id_);
    delete this;
  }

 private:
  NaClTtsPlugin* target_;
  int utterance_id_;
};

//
// NaClAudioOutput
//

NaClAudioOutput::NaClAudioOutput(pp::Instance* instance)
  : instance_(instance),
    provider_(NULL),
    chunk_size_in_frames_(4096) {
}

bool NaClAudioOutput::Init(AudioProvider* provider) {
  provider_ = provider;
  chunk_size_in_frames_ = pp::AudioConfig::RecommendSampleFrameCount(
      PP_AUDIOSAMPLERATE_44100, chunk_size_in_frames_);
  device_ = pp::Audio(instance_,
                      pp::AudioConfig(instance_,
                                      PP_AUDIOSAMPLERATE_44100,
                                      chunk_size_in_frames_),
                      AudioCallback,
                      this);
  return true;
}

void NaClAudioOutput::StartAudio() {
  device_.StartPlayback();
}

void NaClAudioOutput::StopAudio() {
  device_.StopPlayback();
}

int NaClAudioOutput::GetSampleRate() {
  return 44100;
}

int NaClAudioOutput::GetChannelCount() {
  return 2;
}

int NaClAudioOutput::GetChunkSizeInFrames() {
  return chunk_size_in_frames_;
}

int NaClAudioOutput::GetTotalBufferSizeInFrames() {
  return GetChunkSizeInFrames() * kNumChunks;
}

// static
void NaClAudioOutput::AudioCallback(
    void* frames, uint32_t buffer_size, void* data) {
  NaClAudioOutput* audio_output =
      reinterpret_cast<NaClAudioOutput*>(data);
  int16_t* buffer = reinterpret_cast<int16_t*>(frames);
  int num_channels = audio_output->GetChannelCount();
  int num_frames = buffer_size / (sizeof(int16_t) * num_channels);

  if (buffer_size % (sizeof(int16_t) * num_channels) != 0) {
    LOG(ERROR) << "Fatal: got odd buffer size: " << buffer_size;
    exit(0);
  }

  audio_output->FillAudioBuffer(buffer, num_frames, num_channels);
}

void NaClAudioOutput::FillAudioBuffer(int16_t* buffer,
                                      int frame_count,
                                      int channel_count) {
  if (provider_)
    provider_->FillAudioBuffer(buffer, frame_count, channel_count);
}

//
// NaClTtsPlugin
//

NaClTtsPlugin::NaClTtsPlugin(NaClTtsInstance* instance)
    : instance_(instance),
      initialized_(false) {
  audio_output_ = new NaClAudioOutput(instance_);
  threading_ = new Threading();
  engine_ = new PicoTtsEngine("");
  service_ = new TtsService(engine_, audio_output_, threading_);
}

NaClTtsPlugin::~NaClTtsPlugin() {
  if(!initialized_) {
    StopService();
    delete service_;
    delete engine_;
    delete threading_;
  }
}

void NaClTtsPlugin::Init() {
  initialized_ = true;
}

void NaClTtsPlugin::StartService() {
  if (!initialized_) {
    instance_->PostMessage(pp::Var(RESPONSE_ERROR));
    return;
  }
  if (service_->StartService()) {
    instance_->PostMessage(pp::Var(RESPONSE_IDLE));
  } else {
    instance_->PostMessage(pp::Var(RESPONSE_ERROR));
  }
}

void NaClTtsPlugin::Speak(const std::vector<std::string>& args) {
  if (args.size() != 5)
    return;

  double rate = atof(args[0].c_str());
  double pitch = atof(args[1].c_str());
  double volume = atof(args[2].c_str());
  int id = atoi(args[3].c_str());
  std::string text = args[4];

  UtteranceOptions utterance_options;

  UtteranceCallback* callback = new UtteranceCallback(this, id);
  utterance_options.completion = callback;
  utterance_options.voice_options = NULL;

  // Normalized rate, pitch, and volume - maps to 100 in the PICO
  // tts_engine.  The exact mapping is `y = 48x + 20`
  utterance_options.rate = rate / 5.0;
  utterance_options.pitch = pitch / 3.4;
  utterance_options.volume = volume / 7.0;

  service_->Speak(text, &utterance_options);

  instance_->PostMessage(pp::Var(RESPONSE_BUSY));
}

void NaClTtsPlugin::Stop() {
  service_->Stop();
}

void NaClTtsPlugin::Status() {
  switch (service_->GetStatus()) {
    case tts_service::TTS_BUSY:
      instance_->PostMessage(pp::Var(RESPONSE_BUSY));
      return;
    case tts_service::TTS_ERROR:
      instance_->PostMessage(pp::Var(RESPONSE_ERROR));
      return;
    case tts_service::TTS_IDLE:
      instance_->PostMessage(pp::Var(RESPONSE_IDLE));
      return;
  }
}

void NaClTtsPlugin::StopService() {
  service_->StopService();
}

void NaClTtsPlugin::OnUtteranceCompleted(int utterance_id) {
  char msg[100];
  snprintf(msg, 100, "%s:%d", RESPONSE_END, utterance_id);
  instance_->PostMessage(pp::Var(msg));
}

}  // namespace tts_service

