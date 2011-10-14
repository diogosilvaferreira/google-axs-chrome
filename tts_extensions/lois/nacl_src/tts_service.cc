// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)

#include <algorithm>
#include <string>

#include "audio_output.h"
#include "earcon_manager.h"
#include "log.h"
#include "resampler.h"
#include "threading.h"
#include "tts_engine.h"
#include "tts_service.h"

using std::string;

namespace tts_service {

TtsService::TtsService(TtsEngine *engine,
                       AudioOutput *audio_output,
                       Threading *threading)
    : engine_(engine),
      audio_output_(audio_output),
      threading_(threading),
      current_utterance_(NULL),
      resampler_(NULL),
      earcon_manager_(NULL),
      stop_when_finished_(false),
      mutex_(threading->CreateMutex()),
      cond_var_(threading->CreateCondVar()),
      service_running_(false),
      utterance_running_(false) {
}

TtsService::~TtsService() {
  delete mutex_;
  delete cond_var_;
  delete[] audio_buffer_;
}

bool TtsService::StartService() {
  LOG(INFO) << "StartService";
  if (!audio_output_->Init(this)) {
    LOG(ERROR) << "TTS Service unable to open audio output.";
    return false;
  }
  audio_buffer_size_ = audio_output_->GetChunkSizeInFrames();
  ring_buffer_ = new RingBuffer<int16_t>(
      threading_,
      audio_output_->GetTotalBufferSizeInFrames(),
      audio_output_->GetChannelCount());
  audio_buffer_ = new int16_t[audio_buffer_size_];
  if (engine_->Init() != TTS_SUCCESS) {
    return false;
  }
  earcon_manager_ = new EarconManager(
      audio_output_->GetSampleRate(), audio_output_->GetChannelCount());
  LOG(INFO) << "StartService";
  audio_output_->StartAudio();
  service_running_ = true;
  thread_ = threading_->StartJoinableThread(this);
  return true;
}

void TtsService::StopService() {
  if (!service_running_) {
    return;
  }
  LOG(INFO) << "Stopping audio.";
  audio_output_->StopAudio();

  LOG(INFO) << "Stopping main service.";
  {
    ScopedLock sl(mutex_);
    service_running_ = false;
    cond_var_->Signal();
  }

  LOG(INFO) << "Joining main thread.";
  thread_->Join();
  LOG(INFO) << "Joined";

  earcon_manager_->StopAll();
  delete earcon_manager_;
  earcon_manager_ = NULL;
}

int TtsService::LoadEarconFromWavFile(const char *path, bool loop) {
  if (!service_running_) {
    LOG(ERROR) << "Fatal: can't load earcons before service is running.";
    exit(0);
  }

  return earcon_manager_->LoadEarconFromWavFile(path, loop);
}

void TtsService::Speak(string text, UtteranceOptions* options /*= NULL*/) {
  if (!service_running_) {
    return;
  }
  Utterance *utterance = new Utterance;
  utterance->text = text;
  if (options == NULL || options->voice_options == NULL) {
    utterance->voice_index = 0;
  } else {
    if ((utterance->voice_index =
        engine_->GetVoiceIndex(options->voice_options)) == -1) {
      utterance->voice_index = 0;
    }
  }
  utterance->options = new UtteranceOptions(*options);

  {
    ScopedLock sl(mutex_);
    utterances_.push_back(utterance);
    cond_var_->Signal();
  }
}

void TtsService::Stop() {
  if (!service_running_) {
    return;
  }

  ScopedLock sl(mutex_);
  ring_buffer_->Reset();
  while (!utterances_.empty()) {
    delete utterances_.front();
    utterances_.pop_front();
  }
  utterance_running_ = false;
  cond_var_->Signal();
}

void TtsService::PlayEarcon(int earcon_id) {
  ScopedLock sl(mutex_);
  earcon_manager_->Play(earcon_id);
}

void TtsService::StopEarcon(int earcon_id) {
  ScopedLock sl(mutex_);
  earcon_manager_->Stop(earcon_id);
}

void TtsService::StopAllEarcons() {
  ScopedLock sl(mutex_);
  earcon_manager_->StopAll();
}

tts_status TtsService::GetStatus() {
  if (!service_running_) {
    return TTS_ERROR;
  }
  ScopedLock sl(mutex_);
  if (utterances_.empty() && !utterance_running_) {
    return TTS_IDLE;
  } else {
    return TTS_BUSY;
  }
}

void TtsService::WaitUntilFinished() {
  if (!service_running_) {
    return;
  }
  ScopedLock sl(mutex_);
  while (!utterances_.empty() || utterance_running_) {
    cond_var_->Wait(mutex_);
  }
}

void TtsService::SetStopWhenFinished(bool stop_when_finished) {
  stop_when_finished_ = stop_when_finished;
}

void TtsService::Run() {
  if (!service_running_) {
    return;
  }
  LOG(INFO) << "Running background thread";
  for (;;) {
    {
      ScopedLock sl(mutex_);
      // If there are no utterances and there's no signal to stop,
      // wait on our condition variable, which will allow this thread to
      // sleep with no CPU usage and wake up immediately when there's
      // work for us to do.
      if (utterances_.empty() && service_running_ == true) {
        cond_var_->Wait(mutex_);
      }

      if (service_running_ == false) {
        LOG(INFO) << "Exiting background thread";
        while (!utterances_.empty()) {
          delete utterances_.front();
          utterances_.pop_front();
        }
        return;
      }

      if (current_utterance_ == NULL && !utterances_.empty()) {
        current_utterance_ = utterances_.front();
        utterances_.pop_front();
      }

      utterance_running_ = true;
    }  // ScopedLock sl(mutex_);

    if (!current_utterance_) {
      continue;
    }

    if (current_utterance_->options) {
      engine_->SetRate(current_utterance_->options->rate);
      engine_->SetPitch(current_utterance_->options->pitch);
      engine_->SetVolume(current_utterance_->options->volume);
    }

    // Synthesize the current utterance.  The TTS engine will call our
    // callback method, Receive, repeatedly while it performs synthesis.
    // During that callback, we check if Stop was called and can cause
    // this method to exit prematurely.  Otherwise this method won't exit
    // until this utterance is done synthesizing, and then current_utterance_
    // will be set to NULL.
    int samples_output = 0;
    engine_->SetVoice(current_utterance_->voice_index);

    resampler_ = NULL;
    if (audio_output_->GetSampleRate() != engine_->GetSampleRate()) {
      resampler_ = new Resampler(this,
                                 engine_->GetSampleRate(),
                                 audio_output_->GetSampleRate(),
                                 audio_buffer_size_);
      engine_->SetReceiver(resampler_);
    } else {
      engine_->SetReceiver(this);
    }

    // Save the utterance text and the completion callback because
    // current_utterance_ is deleted by the Done() callback before the call to
    // SynthesizeText exits.
    string utterance_text = current_utterance_->text;
    Runnable* completion_callback = NULL;
    if (current_utterance_->options) {
      completion_callback = current_utterance_->options->completion;
    }

    engine_->SynthesizeText(
        utterance_text.c_str(),
        audio_buffer_,
        audio_buffer_size_,
        &samples_output);

    ring_buffer_->AddCallback(completion_callback);
    LOG(INFO) << "Done: " << utterance_text;

    {
      ScopedLock sl(mutex_);
      if (utterance_running_ == false) {
        // The utterance was interrupted
        engine_->Stop();
      }
      utterance_running_ = false;
      cond_var_->Signal();
    }

    delete current_utterance_;
    current_utterance_ = NULL;

    if (resampler_) {
      delete resampler_;
    }
  }
}

tts_callback_status TtsService::Receive(int rate,
                                        int num_channels,
                                        const int16_t* data,
                                        int num_frames) {
  // Check if we need to exit prematurely
  {
    ScopedLock sl(mutex_);
    if (service_running_ == false || utterance_running_ == false) {
      return TTS_CALLBACK_HALT;
    }
  }

  // If there's no audio data, just return success
  if (num_frames == 0) {
    return TTS_CALLBACK_CONTINUE;
  }

  int output_num_channels = audio_output_->GetChannelCount();
  if (output_num_channels != ring_buffer_->GetChannelCount()) {
    LOG(ERROR) << "Audio output wants " << audio_output_->GetChannelCount()
               << " channels, but the ring buffer is "
               << ring_buffer_->GetChannelCount()
               << " channels.";
    exit(-1);
  }

  int16_t* output_data = NULL;
  if (num_channels != output_num_channels) {
    // If the number of channels the engine supports is different from the
    // number that the audio output supports, convert accordingly.
    if (num_channels == 1 && output_num_channels > 1) {
      int output_num_samples = num_frames * output_num_channels;
      output_data = new int16_t[output_num_samples];

      int output_index = 0;
      for (int i = 0; i < num_frames; i++) {
        // Copy the first input channel's sample to every output channel
        for (int j = 0; j < output_num_channels; j++) {
          output_data[output_index++] = data[i];
        }
      }
    } else {
      LOG(ERROR) << "The audio output must have at least as many channels as "
                 << "the engine. Audio Output: " << output_num_channels
                 << "Engine: " << num_channels;
      exit(1);
    }
  }

  // If the ring buffer is full, compute the amount of time we expect
  // it to take for that many audio samples to be output, and sleep for
  // that long.
  while (ring_buffer_->WriteAvail() < num_frames) {
    int ms_to_sleep = num_frames * 1000 / rate;
    ScopedLock sl(mutex_);
    cond_var_->WaitWithTimeout(mutex_, ms_to_sleep);
    if (service_running_ == false || utterance_running_ == false) {
      return TTS_CALLBACK_HALT;
    }
  }

  bool success;
  if (output_data) {
    success = ring_buffer_->Write(output_data, num_frames);
    delete[] output_data;
  } else {
    success = ring_buffer_->Write(data, num_frames);
  }
  if (!success) {
    LOG(INFO) << "Unable to write to ring buffer";
    exit(0);
  }

  return TTS_CALLBACK_CONTINUE;
}

tts_callback_status TtsService::Done() {
  current_utterance_ = NULL;
  return TTS_CALLBACK_HALT;
}

bool TtsService::FillAudioBuffer(int16_t* samples,
                                 int frame_count,
                                 int channel_count) {
  int avail = ring_buffer_->ReadAvail();

  // If the ring buffer is finished, play until the end.  Otherwise,
  // only play if we have a full buffer.
  int copy_len;
  if (ring_buffer_->IsFinished()) {
    copy_len = avail < frame_count ? avail : frame_count;
  } else {
    copy_len = avail >= frame_count ? frame_count : 0;
  }

  ring_buffer_->Read(samples, copy_len);
  for (int i = copy_len * channel_count; i < frame_count * channel_count; i++)
    samples[i] = 0;

  earcon_manager_->FillAudioBuffer(samples, frame_count, channel_count);

  if (stop_when_finished_)
    return !ring_buffer_->IsFinished() || earcon_manager_->IsAnythingPlaying();

  return true;
}

}  // namespace tts_service

