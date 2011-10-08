// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)
//
// Templatized, thread-safe RingBuffer.  Acts like a FIFO, but using a
// fixed-size buffer that wraps around and optimized for operations that
// read or write many elements at a time.  Commonly used to buffer audio
// samples that need to be passed from one thread to another.
//
// Supports a flag "finished" so the writing thread can notify the reading
// thread that there's no more data.
//
// Each element in the RingBuffer is an audio frame consisting of consecutive
// samples: for example, in 2-channel audio, each audio frame is two audio
// samples. Each Read or Write operating must operate on an integer number of
// frames: it's not allowed to read a partial frame.
//
// The implementation is all contained within this .h file because
// it's templatized.

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_RINGBUFFER_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_RINGBUFFER_H_

#include "threading.h"

namespace tts_service {

template<typename T> class RingBuffer {
 public:
  // Construct a RingBuffer using a given Threading object (used for
  // locking - may not be NULL) of a given capacity (cannot be increased
  // later). Each element in the RingBuffer is an audio frame consisting
  // of |channel_count| consecutive samples.
  RingBuffer(Threading* theading, int frame_capacity, int channel_count);

  // Destructor.
  ~RingBuffer();

  //
  // Methods for either thread
  //

  int GetFrameCapacity() { return frame_capacity_; }

  int GetChannelCount() { return channel_count_; }

  //
  // Methods for the writer thread
  //

  // Reset to the initial state: the ring buffer is empty and marked as
  // unfinished.
  void Reset();

  // Get the number of frames that are available to be written.
  // This will be a number between 0 and frame_capacity, inclusive.
  int WriteAvail();

  // Write |frame_count| frames to the end of the ring buffer.  Returns
  // true on success.  If all |frame_count| frames cannot be written without
  // blocking, returns false and writes nothing.
  bool Write(const T* data, int frame_count);

  // Mark the buffer as finished.  Future write operations will fail.
  // Read operations will succeed until the buffer is empty, but
  // IsFinished() will return true immediately.
  void MarkFinished();

  //
  // Methods for the reader thread
  //

  // Get the number of items of type T that are available to be read.
  // This will be a number between 0 and capacity, inclusive.
  int ReadAvail();

  // Read |frame_count| elements from the front of the ring buffer.
  // Returns true on success.  If all |frame_count| elements cannot be
  // read without blocking, returns false and reads nothing.
  bool Read(T* data, int frame_count);

  // Returns true if the buffer has been marked as finished by a call to
  // MarkFinished, whether the buffer is empty or not.
  bool IsFinished();

 private:
  Mutex* mutex_;
  T* buffer_;
  bool finished_;
  const int capacity_;
  const int frame_capacity_;
  const int channel_count_;
  volatile int read_pos_;
  volatile int write_pos_;
};

//
// Implementation notes:
//
// We use a simple mutex to protect all of the fields.
//
// A special value of -1 is used for read_pos_ to indicate that the buffer
// is empty, otherwise there would be no way to distinguish between an empty
// buffer and a full buffer when read_pos_ == write_pos_.
//

template<typename T> RingBuffer<T>::RingBuffer(
    Threading* threading, int frame_capacity, int channel_count)
    : capacity_(frame_capacity * channel_count),
      frame_capacity_(frame_capacity),
      channel_count_(channel_count) {
  mutex_ = threading->CreateMutex();
  buffer_ = new T[capacity_];
  Reset();
}

template<typename T> RingBuffer<T>::~RingBuffer() {
  delete mutex_;
  delete[] buffer_;
}

template<typename T> void RingBuffer<T>::Reset() {
  ScopedLock sl(mutex_);
  finished_ = false;
  read_pos_ = -1;
  write_pos_ = 0;
};

template<typename T> int RingBuffer<T>::WriteAvail() {
  int avail = capacity_;
  {
    ScopedLock sl(mutex_);
    if (read_pos_ != -1) {
      avail = read_pos_ - write_pos_;
    }
  }
  if (avail < 0) {
    avail += capacity_;
  }

  return avail / channel_count_;
}

template<typename T> bool RingBuffer<T>::Write(const T* data, int len) {
  ScopedLock sl(mutex_);
  if (finished_) {
    return false;
  }
  len *= channel_count_;
  int avail = capacity_;
  if (read_pos_ != -1) {
    avail = read_pos_ - write_pos_;
  }
  if (avail < 0) {
    avail += capacity_;
  }
  if (len > avail) {
    return false;
  }

  if (read_pos_ == -1) {
    read_pos_ = write_pos_;
  }
  for (int i = 0; i < len; i++) {
    buffer_[write_pos_] = data[i];
    write_pos_ = (write_pos_ + 1) % capacity_;
  }

  return true;
}

template<typename T> void RingBuffer<T>::MarkFinished() {
  ScopedLock sl(mutex_);
  finished_ = true;
}

template<typename T> int RingBuffer<T>::ReadAvail() {
  int avail;
  {
    ScopedLock sl(mutex_);
    if (read_pos_ == -1) {
      return 0;
    }
    avail = write_pos_ - read_pos_;
  }
  if (avail <= 0) {
    avail += capacity_;
  }
  return avail / channel_count_;
}

template<typename T> bool RingBuffer<T>::Read(T* data, int len) {
  ScopedLock sl(mutex_);
  int avail;
  len *= channel_count_;
  if (read_pos_ == -1) {
    avail = 0;
  } else {
    avail = write_pos_ - read_pos_;
    if (avail <= 0) {
      avail += capacity_;
    }
  }
  if (len > avail) {
    return false;
  }

  for (int i = 0; i < len; i++) {
    data[i] = buffer_[read_pos_];
    read_pos_ = (read_pos_ + 1) % capacity_;
  }

  if (read_pos_ == write_pos_) {
    read_pos_ = -1;
  }

  return true;
}

template<typename T> bool RingBuffer<T>::IsFinished() {
  ScopedLock sl(mutex_);
  return finished_;
}

}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_RINGBUFFER_H_

