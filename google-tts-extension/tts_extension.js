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

var speechServerUrl =
    'http://www.google.com/speech-api/v1/synthesize?lang=en-us&text=';
var audioElem = document.createElement('audio');
var callbackQueue = [];

var stopListener = function() {
  audioElem.pause();
  for (var i = 0; i < callbackQueue.length; i++) {
    callbackQueue[i]();
  }
  callbackQueue = [];
};

var speakListener = function(utterance, options, callback) {
  try {
    stopListener();
    callbackQueue.push(callback);
    audioElem.src = speechServerUrl + escape(utterance);
    audioElem.autoplay = true;
  } catch (err) {
    callback(String(err));
  }
};

audioElem.addEventListener('ended', function() {
  // Delay the callback a bit because we seem to get the ended message
  // from the HTML audio element a bit early.
  window.setTimeout(stopListener, 250);
});

chrome.experimental.tts.onSpeak.addListener(speakListener);
chrome.experimental.tts.onStop.addListener(stopListener);
