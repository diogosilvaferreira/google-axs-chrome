// Copyright 2010 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Text-To-Speech engine that is using the Emacspeak
 * local speech server.
 *
 * TODO(raman,clchen): Add support for callback on completion!
 *
 * @author dmazzoni@google.com (Dominic Mazzoni)
 * @author clchen@google.com (Charles L. Chen)
 */

var serverUrl = 'http://127.0.0.1:8000';

function createEmacspeakXhr() {
  var xhr = new XMLHttpRequest();
  xhr.overrideMimeType('text/xml');
  xhr.open('POST', serverUrl, true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  return xhr;
}

var stopListener = function() {
  var xhr = createEmacspeakXhr();
  xhr.send('stop');
};

var speakListener = function(utterance, options, callback) {
  try {
    if (!options.enqueue) {
      stopListener();
    }
    var xhr = createEmacspeakXhr();
    xhr.send('speak: ' + utterance);
    if (chrome.ttsEngine || chrome.experimental.ttsEngine) {
    } else {
      callback();
    }
  } catch (err) {
    if (chrome.ttsEngine || chrome.experimental.ttsEngine) {
      callback({type: 'error', errorMessage: String(err)});
    } else {
      callback(String(err));
    }
  }
};

// TODO(dmazzoni): remove the special cases when the stable version is
// shipping.
if (chrome.ttsEngine) {
  chrome.ttsEngine.onSpeak.addListener(speakListener);
  chrome.ttsEngine.onStop.addListener(stopListener);
} else if (chrome.experimental.ttsEngine) {
  chrome.experimental.ttsEngine.onSpeak.addListener(speakListener);
  chrome.experimental.ttsEngine.onStop.addListener(stopListener);
} else {
  chrome.experimental.tts.onSpeak.addListener(speakListener);
  chrome.experimental.tts.onStop.addListener(stopListener);
}
