// Copyright 2010 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)

#ifndef SPEECH_CLIENT_SYNTHESIS_SERVICE_NACL_NACL_MAIN_H_
#define SPEECH_CLIENT_SYNTHESIS_SERVICE_NACL_NACL_MAIN_H_

#include "nacl_tts_plugin.h"

namespace pp {
class Module;
}

namespace tts_service {

class NaClTtsInstance;

struct NaClTtsStatusMessage {
  NaClTtsInstance* instance;
  pp::Var status;
};

class NaClTtsInstance : public pp::Instance {
 public:
  NaClTtsInstance(PP_Instance instance, pp::Module* module)
      : pp::Instance(instance),
        plugin_(this),
        module_(module) {}
  virtual ~NaClTtsInstance() {}

  virtual bool Init(uint32_t argc, const char* argn[], const char* argv[]);
  virtual void HandleMessage(const pp::Var& var_message);

  virtual void PostMessage(const pp::Var& message);

 private:
  static void StatusCallback(void* data, int32_t result) {
    NaClTtsStatusMessage* message =
      reinterpret_cast<NaClTtsStatusMessage*>(data);
    message->instance->PostMessage(message->status);
    delete message;
  }

  NaClTtsPlugin plugin_;
  pp::Module* module_;
};

}  // namespace tts_service

#endif  // SPEECH_CLIENT_SYNTHESIS_SERVICE_NACL_NACL_MAIN_H_

