// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)
//
// This header defines the interface to access a Text-To-Speech service
// that manages background threads and presents a real-time, nonblocking
// interface.

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_TTS_SERVICE_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_TTS_SERVICE_H_

#include <stdint.h>

#include <list>
#include <string>

#include "audio_output.h"
#include "ringbuffer.h"
#include "tts_engine.h"
#include "tts_receiver.h"

using std::list;
using std::string;

namespace tts_service {

enum tts_status {
  TTS_IDLE = 0,
  TTS_BUSY = 1,
  TTS_ERROR = 2,
};

class EarconManager;
class Resampler;

// Add more such as rate, pitch etc. in the future.
struct UtteranceOptions {
 public:
  Runnable *completion;
  struct TtsVoice *voice_options;
  // Default is 1. Use higher or lower values to increase or decrease the
  // speaking rate. Map default to ~100 words/min if possible. Speech
  // engines may or may not support this mapping.
  float rate;
  // Default is 1. Use higher or lower values to increase or decrease the
  // speaking pitch. Map default to 200 Hz if possible. Speech
  // engines may or may not support this exact mapping.
  float pitch;
  // Default is 1. Use higher or lower values to increase or decrease the
  // speaking volume.
  float volume;
  UtteranceOptions()
      : completion(NULL),
        voice_options(NULL),
        rate(1),
        pitch(1),
        volume(1) { }

  UtteranceOptions(const UtteranceOptions& options)
      : completion(options.completion),
        voice_options(NULL),
        rate(options.rate),
        pitch(options.pitch),
        volume(options.volume) {
    if (options.voice_options)
      voice_options = new TtsVoice(*options.voice_options);
  }
};

class Utterance {
 public:
  Utterance() : options(NULL) {}
  virtual ~Utterance() {
    delete options;
  }

  string text;
  int voice_index;
  struct UtteranceOptions *options;
};

class TtsService
    : public AudioProvider,
      public Runnable,
      public TtsDataReceiver {
 public:
  TtsService(TtsEngine *engine,
             AudioOutput *audio_output,
             Threading *threading);

  virtual ~TtsService();

  //
  // External interface
  //

  // Start the background service
  bool StartService();

  // Stop the background service.
  void StopService();

  // Load an earcon from a WAV file, return an earcon_id. You must call
  // this after StartService so that the earcon manager can resample to the
  // audio output's desired sample rate.
  int LoadEarconFromWavFile(const char *path, bool loop);

  // Queue up this text to be spoken and return immediately. The
  // UtteranceOptions contains other settings such as language name, voice,
  // pitch, rate etc. Currently language name specified as:
  // <language>-<locale> is supported. Example: en-US, fr-FR, etc.
  void Speak(string text, UtteranceOptions *options = NULL);

  // Interrupts the current utterance and discards other utterances
  // in the queue. Does not interrupt earcons.
  void Stop();

  // Start playing the given earcon. If it was already playing, this
  // starts playing it again from the beginning.
  void PlayEarcon(int earcon_id);

  // Stop playing the given earcon id.
  void StopEarcon(int earcon_id);

  // Stop all earcons from playing.
  void StopAllEarcons();

  // Determine if the service is busy or speaking.
  tts_status GetStatus();

  // Block until all queued utterances are done speaking.
  void WaitUntilFinished();

  // If this is set to true, the audio output will be signaled to stop
  // after the current utterance is finished. Otherwise, audio output
  // will be kept open continuously.
  void SetStopWhenFinished(bool stop_when_finished);

  //
  // Internal implementation
  //

  // Implementation of AudioProvider, called by the audio output thread.
  bool FillAudioBuffer(int16_t* frames, int frame_count, int channel_count);

  // Implementation of Runnable, for our background thread.
  void Run();

  // Implementation of TtsDataReceiver, where the TtsEngine calls us
  // with the generated audio data.
  tts_callback_status Receive(int rate,
                              int num_channels,
                              const int16_t* data,
                              int num_samples);

  // Part of the implementation of TtsDataReceive.
  tts_callback_status Done();


 private:
  TtsEngine *engine_;
  AudioOutput *audio_output_;
  RingBuffer<int16_t> *ring_buffer_;
  Threading *threading_;
  Thread *thread_;
  Utterance *current_utterance_;
  Resampler *resampler_;
  int16_t *audio_buffer_;
  EarconManager* earcon_manager_;
  int audio_buffer_size_;
  bool stop_when_finished_;

  // Notes on synchronization: There are three thread contexts here:
  //
  // 1. The thread of the external interface - code like StartService,
  // StopService, Speak, etc.
  //
  // 2. Our internal thread, everything called from Run(). The TTS
  // engine is in this thread, and this is the thread that writes to
  // the ring buffer.
  //
  // 3. The audio I/O thread, which calls FillAudioBuffer and is the
  // thread that reads from the ring buffer.
  //
  // We use the mutex and the condvar below to synchronize
  // communication between #1 and #2.  The ring buffer already
  // provides its own thread safety so we don't need to do anything
  // additional to communicate between #2 and #3. Code to initiate TTS
  // and callbacks from the TTS engine all happen in #2, so they don't
  // need any mutex protection.
  Mutex *mutex_;
  CondVar *cond_var_;

  // Variables that are protected by the mutex and signaled by the
  // condition variable.
  list<Utterance*> utterances_;
  bool service_running_;
  bool utterance_running_;
};
}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_TTS_SERVICE_H_

