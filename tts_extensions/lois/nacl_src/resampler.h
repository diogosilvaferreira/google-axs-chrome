// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)
//
// Implementation of TtsDataReceiver that resamples the audio to a
// different sample rate and then passes the resampled audio through
// to another callback.

#include <stdint.h>
#include <cstring>

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_RESAMPLER_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_RESAMPLER_H_

#include "tts_receiver.h"

namespace tts_service {

class Resampler : public TtsDataReceiver {
 public:
  // Resamples the audio passed to this object's Receive method and passes
  // the resampled audio through to the destination.
  Resampler(TtsDataReceiver *destination,
            int source_rate,
            int dest_rate,
            int buffer_size);

  virtual ~Resampler();

  virtual tts_callback_status Receive(int rate,
                                      int num_channels,
                                      const int16_t* data,
                                      int num_samples);

  virtual tts_callback_status Done();

  int source_rate() { return source_rate_; }

  int dest_rate() { return dest_rate_; }

 private:
  TtsDataReceiver* destination_;
  int source_rate_;
  int dest_rate_;
  double factor_;
  int buffer_size_;
  void* resample_handle_;
  float* in_floats_;
  float* out_floats_;
  int16_t* out_int16s_;

  // See comments in .cc.
  tts_callback_status ProcessBuffer(const int16_t* data,
                                    int num_samples);
  tts_callback_status ProcessInFloats(int num_samples,
                                      bool final_padding,
                                      int *input_index);
};
}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_RESAMPLER_H_

