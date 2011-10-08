// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)
//
// Implementation of threading classes using Linux pthreads.
// Also works under Native Client.

#include <pthread.h>
#include <sys/time.h>

#include "threading.h"

namespace tts_service {

// Implementation of a Mutex using pthreads
class PthreadMutex : public Mutex {
 public:
  PthreadMutex() {
    pthread_mutex_init(&mutex_, NULL);
  }
  virtual ~PthreadMutex() {
    pthread_mutex_destroy(&mutex_);
  }
  void Lock() {
    pthread_mutex_lock(&mutex_);
  }
  void Unlock() {
    pthread_mutex_unlock(&mutex_);
  }
 private:
  pthread_mutex_t mutex_;
  friend class PthreadCondVar;
};

class PthreadCondVar : public CondVar {
 public:
  PthreadCondVar() {
    pthread_cond_init(&cond_var_, NULL);
  }

  virtual ~PthreadCondVar() {
    pthread_cond_destroy(&cond_var_);
  }

  virtual void Wait(Mutex* mutex) {
    pthread_cond_wait(&cond_var_, &(static_cast<PthreadMutex*>(mutex))->mutex_);
  }

  virtual void WaitWithTimeout(Mutex* mutex, int timeout_ms) {
    struct timeval now;
    struct timespec timeout;
    int future_us;

    gettimeofday(&now, NULL);
    future_us = now.tv_usec + timeout_ms * 1000;
    timeout.tv_nsec = (future_us % 1000000) * 1000;
    timeout.tv_sec = now.tv_sec + future_us / 1000000;

    pthread_cond_timedwait(&cond_var_,
                           &(static_cast<PthreadMutex*>(mutex))->mutex_,
                           &timeout);
  }

  virtual void Signal() {
    pthread_cond_signal(&cond_var_);
  }

 private:
  pthread_cond_t cond_var_;
};

// Implementation of a joinable Thread using Pthread's Thread class
class PthreadThread : public Thread {
 public:
  explicit PthreadThread(pthread_t *thread)
      : thread_(thread) { }

  virtual void Join() {
    pthread_join(*thread_, NULL);
    delete thread_;
  }

 private:
  pthread_t* thread_;
};

Mutex* Threading::CreateMutex() {
  return new PthreadMutex();
}

CondVar* Threading::CreateCondVar() {
  return new PthreadCondVar();
}

void* ThreadStart(void *userdata) {
  Runnable *action = static_cast<Runnable *>(userdata);
  action->Run();

  return NULL;
}

Thread* Threading::StartJoinableThread(Runnable *action) {
  pthread_t* thread = new pthread_t;
  pthread_create(thread, NULL, ThreadStart, action);

  return new PthreadThread(thread);
}

}  // namespace tts_service

