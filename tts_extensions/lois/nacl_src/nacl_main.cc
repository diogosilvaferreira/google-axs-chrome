// Copyright (c) 2011 The Native Client Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <ppapi/cpp/completion_callback.h>
#include <ppapi/cpp/instance.h>
#include <ppapi/cpp/module.h>
#include <ppapi/cpp/var.h>

#include "nacl_main.h"

namespace tts_service {

// A constant for each of our external methods exposed to JavaScript.
enum {
  METHOD_START_SERVICE = 0,
  METHOD_SPEAK,
  METHOD_STOP,
  METHOD_STATUS,
  METHOD_STOP_SERVICE,
  NUM_METHOD_IDENTIFIERS
};

// The external name of each method.
static const char* const method_names[NUM_METHOD_IDENTIFIERS] = {
  "startService",
  "speak",
  "stop",
  "status",
  "stopService",
};
static const char kMethodArgumentSeperator = ':';

bool NaClTtsInstance::Init(uint32_t argc,
                           const char* argn[],
                           const char* argv[]) {
  plugin_.Init();
  return true;
}

void NaClTtsInstance::HandleMessage(const pp::Var& var_message) {
  if (!var_message.is_string()) {
    return;
  }

  std::string message = var_message.AsString();
  std::string method_name;
  std::vector<std::string> args;

  std::string arg;
  for (size_t i = 0; i <= message.size(); i++) {
    if (i < message.size() - 1 && message[i] == '\\') {
      i++;
      arg += message[i];
    } else if (i == message.size() || message[i] == kMethodArgumentSeperator) {
      if (method_name.empty()) {
        method_name = arg;
      } else {
        args.push_back(arg);
      }
      arg.clear();
    } else {
      arg += message[i];
    }
  }

  if (method_name == method_names[METHOD_START_SERVICE]) {
    plugin_.StartService();
  } else if (method_name == method_names[METHOD_SPEAK]) {
    plugin_.Speak(args);
  } else if (method_name == method_names[METHOD_STOP]) {
    plugin_.Stop();
  } else if (method_name == method_names[METHOD_STATUS]) {
    plugin_.Status();
  } else if (method_name == method_names[METHOD_STOP_SERVICE]) {
    plugin_.StopService();
  }
}

void NaClTtsInstance::PostMessage(const pp::Var& status) {
  if (module_->core()->IsMainThread()) {
    pp::Instance::PostMessage(status);
  } else {
    NaClTtsStatusMessage* message = new NaClTtsStatusMessage;
    message->instance = this;
    message->status = status;
    pp::CompletionCallback cc = pp::CompletionCallback(StatusCallback, message);
    module_->core()->CallOnMainThread(0, cc);
  }
}

class NaClTtsModule : public pp::Module {
 public:
  NaClTtsModule() : pp::Module() {}
  ~NaClTtsModule() {}

  virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new NaClTtsInstance(instance, this);
  }
};

}  // namespace tts_service

namespace pp {
Module* CreateModule() {
  return new tts_service::NaClTtsModule();
}
}  // namespace pp

