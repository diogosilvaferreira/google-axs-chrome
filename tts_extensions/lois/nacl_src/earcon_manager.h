// Copyright 2010 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)
//
// An earcon is like the audio version of an icon. It's a short sound
// used to represent an object or action. This class manages loading a
// set of earcons from audio files and then handles playing them, mixing
// them with an audio stream.
//
// The earcons are stored in memory, uncompressed, and they're resampled
// to the correct rate on load.  The memory requirements should be
// minimal because earcons are short and there shouldn't be a reason
// to have more than a few dozen at most.
//
// Any number of earcons can all be playing at once. This class keeps
// track of the play/pause status of all earcons and their current playback
// position. It doesn't manage any audio output or threading, it just
// implements a FillBuffer method that mixes in all playing earcons
// with whatever audio data is already in the buffer.
//
// A single earcon can only be playing once - playing it again restarts
// it from the beginning.

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_EARCON_MANAGER_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_EARCON_MANAGER_H_

#include <stdint.h>

#include <vector>

#include "resampler.h"

using std::vector;

namespace tts_service {

struct Earcon {
 public:
  int frame_count;
  int16_t* data;
  bool is_playing;
  int position;
  bool loop;
};

class EarconManager {
 public:
  EarconManager(int output_frame_rate, int output_channels);
  virtual ~EarconManager();

  // Load audio data from memory, return an earcon id.  Makes a copy of
  // the audio data, so the caller should free |data| as needed.
  int LoadEarcon(int frame_count,
                 int16_t* data,
                 int source_channels,
                 int source_rate,
                 bool loop);

  // Load audio data from a WAV file, return an earcon id.
  int LoadEarconFromWavFile(const char *path, bool loop);

  // Start playing the given earcon. If it was already playing, this
  // starts it playing again from the beginning.
  void Play(int earcon_id);

  // Stop playing the given earcon.
  void Stop(int earcon_id);

  // Stop all earcons from playing.
  void StopAll();

  // Returns whether or not the given earcon is playing.
  bool IsPlaying(int earcon_id);

  // Returns whether or not any earcon is playing.
  bool IsAnythingPlaying();

  // Mix any playing earcons into the given audio buffer and increment
  // the time by this number of frames.
  void FillAudioBuffer(int16_t* data, int frame_count, int channel_count);

 private:
  vector<Earcon> earcons_;
  int rate_;
  int channels_;
};
}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_EARCON_MANAGER_H_

