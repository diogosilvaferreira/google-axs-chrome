// Copyright 2010 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: chaitanyag@google.com (Chaitanya Gharpure)

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_LOG_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_LOG_H_

#include <ctime>
#include <iostream>
#include <sstream>
#include <stdio.h>

#include "base.h"
#include "threading.h"

using std::endl;
using std::ostream;
using std::stringstream;

namespace tts_service {
enum LogSeverity {
  INFO = 0,
  WARNING = 1,
  ERROR = 2
};

#define LOG(severity) LoggingMessage((severity), __FILE__, __LINE__) \
    .get_stream()

// This class is required to make the initialization of the mutex thread safe.
class MutexPtr {
 public:
  MutexPtr() : mutex_(Threading().CreateMutex()) {}

  ~MutexPtr() {
    delete mutex_;
  }

  void Lock() {
    mutex_->Lock();
  }

  void Unlock() {
    mutex_->Unlock();
  }

 private:
  Mutex *mutex_;

  DISALLOW_COPY_AND_ASSIGN(MutexPtr);
};
extern MutexPtr log_mutex_;

class LoggingMessage {

 public:
  LoggingMessage(enum LogSeverity severity, const char *filename, int line)
      : stream(severity == INFO ? std::cout : std::cerr),
        buffer("") {
    time_t curr_time = time(NULL);
    char time_str[32];
    buffer << ctime_r(&curr_time, time_str) << ' ' <<
        "IWE"[severity] << ": " <<
        filename << ":" << line << ": ";
  }

  ~LoggingMessage() {
    log_mutex_.Lock();
    buffer << endl;
    stream << buffer.str();
    log_mutex_.Unlock();
  }

  ostream& get_stream() {
    return buffer;
  }

 private:
  ostream& stream;
  stringstream buffer;

  DISALLOW_COPY_AND_ASSIGN(LoggingMessage);
};
} // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_LOG_H_

