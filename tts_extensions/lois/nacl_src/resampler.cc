// Copyright 2009 Google Inc. All Rights Reserved.
// Author: dmazzoni@google.com (Dominic Mazzoni)

#include <stdio.h>
#include <stdlib.h>

#include "log.h"
#include "resampler.h"
#include "libresample/libresample.h"

namespace tts_service {

Resampler::Resampler(TtsDataReceiver *destination,
                     int source_rate,
                     int dest_rate,
                     int buffer_size)
    : destination_(destination),
      source_rate_(source_rate),
      dest_rate_(dest_rate),
      buffer_size_(buffer_size) {
  const int high_quality = 0;
  factor_ = dest_rate_ * 1.0 / source_rate_;
  resample_handle_ = resample_open(high_quality, factor_, factor_);
  in_floats_ = new float[buffer_size_];
  out_floats_ = new float[buffer_size_];
  out_int16s_ = new int16_t[buffer_size_];
}

Resampler::~Resampler() {
  resample_close(resample_handle_);
  delete[] in_floats_;
  delete[] out_floats_;
  delete[] out_int16s_;
}

tts_callback_status Resampler::Receive(int rate,
                                       int num_channels,
                                       const int16_t* data,
                                       int num_samples) {
  // We support only mono audio (see ProcessInFloats implementation).
  if (num_channels != 1) {
    LOG(ERROR) << "Unsupported num_channels " << num_channels;
    exit(-1);
  }

  if (rate != source_rate_) {
    LOG(ERROR) << "Got input rate of " << rate << " expected " << source_rate_;
    exit(-1);
  }

  // Process the input, one buffer-full at a time.
  int num_samples_remaining = num_samples;
  const int16_t* input_pointer = data;
  for (;;) {
    int num_samples_to_process =
        ( num_samples_remaining > buffer_size_ ? buffer_size_
        : num_samples_remaining );
    if (num_samples_to_process == 0) break;

    tts_callback_status callback_status =
        ProcessBuffer(input_pointer, num_samples_to_process);
    if (callback_status != TTS_CALLBACK_CONTINUE) {
      return callback_status;
    }

    input_pointer += num_samples_to_process;
    num_samples_remaining -= num_samples_to_process;
  }

  return TTS_CALLBACK_CONTINUE;
}

// Auxiliary for Receive().
// Semantics are the same as for Receive(), except that the caller
// is responsible for ensuring that num_samples_to_process <= buffer_size_,
// and we don't pass in rate and num_channels.
tts_callback_status Resampler::ProcessBuffer(const int16_t* data,
                                             int num_samples_to_process) {
  for (int i = 0; i < num_samples_to_process; i++) {
    in_floats_[i] = data[i];
  }

  int input_index = 0;
  while (input_index < num_samples_to_process) {
    tts_callback_status callback_status =
        ProcessInFloats(num_samples_to_process,
                        /* final_padding = */ false,
                        &input_index);
    if (callback_status != TTS_CALLBACK_CONTINUE) {
      return callback_status;
    }
  }
  return TTS_CALLBACK_CONTINUE;
}

tts_callback_status Resampler::Done() {
  int input_index = 0;
  // For final audio padding:
  tts_callback_status callback_status =
      ProcessInFloats(/* num_samples = */ 0,
                      /* final_padding = */ true,
                      &input_index);
  if (callback_status != TTS_CALLBACK_CONTINUE) {
    return callback_status;
  }
  return destination_->Done();
}

// Auxiliary for Receive() and Done().
//
// Processes the in_floats_ (incoming audio data, converted to
// floats), starting with position *input_index (by using the
// resample_process function from the underlying libresample).  On
// exit, increments *input_index with the number of in_floats_
// elements that were processed in this call (such that this function
// can be called in a loop, until the entire content of in_floats_ is
// processed).
//
// @param num_samples   number of elements in the in_floats_ array;
//                      may be zero, e.g., when final_padding is true.
// @param final_padding if true, this call is just to pad the generated
//                      audio; num_samples must be 0 in this case;
//                      in_floats_ content irrelevant in this case
// @param input_index   in/out parameter (see paragraph above).
tts_callback_status Resampler::ProcessInFloats(int num_samples,
                                               bool final_padding,
                                               int *input_index) {
  if (final_padding && (num_samples != 0)) {
    LOG(ERROR) << "final_padding is true but num_samples == "
               << num_samples << "!= 0";
    exit(-1);
  }

  int last_flag = final_padding ? 1 : 0;

  int in_buffer_used;
  int out_samples = resample_process(resample_handle_,
                                     factor_,
                                     &in_floats_[*input_index],
                                     num_samples - *input_index,
                                     last_flag,
                                     &in_buffer_used,
                                     out_floats_,
                                     buffer_size_);
  for (int i = 0; i < out_samples; i++) {
    int value = static_cast<int>(out_floats_[i]);
    if (value > 32767)
      value = 32767;
    if (value < -32768)
      value = -32768;
    out_int16s_[i] = static_cast<int16_t>(value);
  }

  tts_callback_status callback_status = destination_->Receive(
      dest_rate_, 1, out_int16s_, out_samples);
  *input_index += in_buffer_used;

  return callback_status;
}

}  // namespace tts_service

