// Copyright 2009 Google Inc. All Rights Reserved.
// Author: dmazzoni@google.com (Dominic Mazzoni)
//
// Abstract interfaces for threading classes that need to be implemented
// for each platform.

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_THREADING_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_THREADING_H_

#include "base.h"

namespace tts_service {

// An interface for a runnable class.
class Runnable {
 public:
  virtual ~Runnable() { }

  virtual void Run() = 0;
};

// A simple mutex.  Only one thread can hold the lock at a time.
class Mutex {
 public:
  virtual ~Mutex() { }

  virtual void Lock() = 0;
  virtual void Unlock() = 0;
};

// Scoped lock: locks a Mutex in the constructor, unlocks the same
// Mutex in the destructor.  Useful to make sure that a lock is
// unlocked on all exits (normal and error-related) from a lexical
// scope.
//
// NOTE: similar to MutexLock (from google3).  Can't use the same name
// for technical reasons: one file (google/threading.cc) includes
// base/mutex.h (which contains a #define MutexLock(x) to catch some
// bugs) and next this header.  The attempted constructor definition
// of a MutexLock class here would be interpreted as an invocation of
// that macro, resulting in very cryptic compilation errors.
class ScopedLock {
 public:
  explicit ScopedLock(Mutex *mutex) : mutex_(mutex) {
    mutex_->Lock();
  }

  ~ScopedLock() {
    mutex_->Unlock();
  }

 private:
  Mutex *mutex_;  // Not owned.

  DISALLOW_COPY_AND_ASSIGN(ScopedLock);
};

// A condition variable, used so that Thread B can wait until Thread A has
// signalled it to continue.  Thread B locks a mutex and then checks to see
// if the variable it's looking for is ready.  If not, it calls Wait,
// passing it the mutex.  Meanwhile, when Thread A finishes the work it's
// doing, it locks the mutex, updates the variable, and then calls
// Signal, which instantly wakes up Thread B as soon as Thread A has
// released its lock.
class CondVar {
 public:
  virtual ~CondVar() { }

  // The mutex MUST be locked before calling this method, and unlocked after.
  virtual void Wait(Mutex* mutex) = 0;

  // The mutex MUST be locked before calling this method, and unlocked after.
  // Will exit after the specified number of milliseconds have passed,
  // regardless of the status of the condition variable.
  virtual void WaitWithTimeout(Mutex* mutex, int timeout_ms) = 0;

  // The mutex MUST be locked before calling this method, and unlocked after.
  virtual void Signal() = 0;
};

// A joinable thread.
class Thread {
 public:
  virtual ~Thread() { }

  // Block until this thread has finished.  Deletes this object upon return.
  virtual void Join() = 0;
};

// Abstracts common functions needed for writing multithreaded programs.
class Threading {
 public:
  Threading()
      : sleep_mutex_(NULL),
        sleep_condvar_(NULL) { }

  virtual ~Threading() {
    delete sleep_mutex_;
    delete sleep_condvar_;
  }

  virtual Mutex* CreateMutex();
  virtual CondVar* CreateCondVar();
  virtual Thread* StartJoinableThread(Runnable *action);

  virtual void ThreadSleepMilliseconds(int milliseconds) {
    if (!sleep_mutex_) {
      sleep_mutex_ = CreateMutex();
    }
    if (!sleep_condvar_) {
      sleep_condvar_ = CreateCondVar();
    }

    sleep_mutex_->Lock();
    sleep_condvar_->WaitWithTimeout(sleep_mutex_, milliseconds);
    sleep_mutex_->Unlock();
  }

 private:
  Mutex* sleep_mutex_;
  CondVar* sleep_condvar_;
};

}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_THREADING_H_

