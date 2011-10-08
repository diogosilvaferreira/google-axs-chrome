// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: chaitanyag@google.com (Chaitanya Gharpure)
//
// Defined an interface to be implemented for passing as a callback
// to receive synthesized audio data from the TTS engine.

#include <stdint.h>
#include <cstring>

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_TTS_RECEIVER_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_TTS_RECEIVER_H_

namespace tts_service {

enum tts_callback_status {
  TTS_CALLBACK_CONTINUE = 1,  // The normal case: continue if there's more data.
  TTS_CALLBACK_HALT = 0,      // Stop synthesis.  The engine should
                              // return TTS_SUCCESS from SynthesizeText().
  TTS_CALLBACK_ERROR = 2      // Stop synthesis due to error.  The engine should
                              // return TTS_FAILURE from SynthesizeText().
};

template <class DataElement>
class TtsGenericDataReceiver {
 public:
  virtual ~TtsGenericDataReceiver() {}
  // Method that the TTS Engine calls on each chunk of synthesized
  // audio data.  There are very few restrictions on a "chunk": the
  // synthesized audio data is composed of a series of audio "chunks";
  // each chunk is a buffer of DataElements.  Different chunks may
  // have different sizes.  The TTS engine calls the receiver on all
  // chunks, in the order in which the chunks appear in the original
  // audio data (i.e., the TTS engine does not shuffle / skip audio
  // data).
  //
  // In multi-channel data, the channels are stored interleaved: each
  // frame contains all of the data elements for frame 0 for all channels,
  // before any data elements for frame 1.  The total number of data elements
  // is num_data_frames * num_channels.
  //
  // @param rate               Sampling rate of generated audio, in Hz.
  // @param num_channels       Number of audio channels: 1 (mono), 2
  //                           (stereo), etc.
  // @param data               Pointer to audio data buffer.
  // @param num_data_frames    Number of frames of data, where each frame
  //                             contains one element for each channel.
  //
  // Note that 'data' may be NULL if num_data_elements is zero;
  virtual tts_callback_status Receive(int rate,
                                      int num_channels,
                                      const DataElement* data,
                                      int num_data_frames) = 0;

  // Method that the TTS Engine calls after it has called Receive for
  // all synthesized audio data.  Should return TTS_CALLBACK_HALT on
  // success and TTS_CALLBACK_ERROR on error.  The non-sensical (in
  // this context) TTS_CALLBACK_CONTINUE is interpreted as an error.
  virtual tts_callback_status Done() = 0;
};

// For raw audio (linear 16 bit encoding).
typedef TtsGenericDataReceiver<int16_t> TtsDataReceiver;

// For compressed audio (arbitrary encoding).
typedef TtsGenericDataReceiver<char> TtsEncodedDataReceiver;
}

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_TTS_RECEIVER_H_

