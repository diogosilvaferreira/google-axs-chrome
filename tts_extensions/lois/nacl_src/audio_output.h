// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)
//
// An interface representing a real-time audio output system on a particular
// platform.

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_AUDIO_OUTPUT_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_AUDIO_OUTPUT_H_

#include <stdlib.h>

namespace tts_service {

class Threading;

//
// Definitions of terms
//
// Sample:  One audio *sample* is a single number representing the
//          amplitude of a single channel of an audio waveform at one
//          instant in time.  A common sampling rate is 44,100 samples
//          per second.
//
// Frame:   The samples for all channels. For 1-channel (mono) audio,
//          one sample is the same as one frame. For stereo, each frame
//          contains two samples - the left channel and the right channel.
//          5.1 Surround audio would contain 6 channels per frame.
//          These should not be confused with frames in some audio & video
//          codecs, which are typically larger.
//

// This is an interface defining the method that fills an audio buffer
// for real-time audio output.  Typically the TtsService implements this
// method for AudioOutput, so that the service has all of the logic for
// computing the samples to be computed, but AudioOutput has all of the logic
// for dealing with the platform-specific audio hardware abstraction.
class AudioProvider {
 public:
  virtual ~AudioProvider() { }

  // This method must return quickly and not block.  It must always
  // fill all of the frames, with silence padding as needed.
  // |samples| is an array of length |frame_count| * |channel_count|.
  // The samples are interleaved: the samples for all channels of frame 0
  // appear before any samples from frame 1.
  // Returns false if audio should completely stop.
  virtual bool FillAudioBuffer(int16_t* samples,
                               int frame_count,
                               int channel_count) = 0;
};

// This is the abstract definition of a class that does real-time audio
// output.  You must provide an implementation of an AudioProvider that
// provides the actual samples to output on demand (or silence, if there
// are not enough samples available immediately).  Subclasses of AudioOutput
// implement these methods using various platform-specific methods.
class AudioOutput {
 protected:
  AudioOutput() { }

 public:
  // Static factory method, creates whatever AudioOutput subclass
  // has been linked in.
  static AudioOutput* Create(Threading *threading);

  virtual ~AudioOutput() {}

  // Initialize audio output, getting audio samples from the given provider.
  // Returns true on success.  Safe to call more than once.
  virtual bool Init(AudioProvider *provider) = 0;

  virtual void StartAudio() = 0;

  virtual void StopAudio() = 0;

  virtual int GetSampleRate() = 0;

  virtual int GetChannelCount() = 0;

  // The typical number of frames that will be requested at once.
  // See above for the definitions of frames and samples.
  //
  // The TTS system may want to generate audio in increments of this
  // many frames, but it's just a hint.
  virtual int GetChunkSizeInFrames() = 0;

  // The number of frames needed to completely fill the audio buffers.
  // The provider must be able to quickly produce at least this many
  // frames in order to avoid underflow.  See above for the definitions
  // of frames and samples.
  virtual int GetTotalBufferSizeInFrames() = 0;
};

}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_AUDIO_OUTPUT_H_

