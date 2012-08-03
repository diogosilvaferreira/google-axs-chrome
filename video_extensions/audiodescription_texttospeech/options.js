// Copyright 2012 Google Inc.
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
 * @fileoverview Sets the options on the options.html page
 * Derived from: options.js by The Chromium Authors
 * Speak Selection sample extension found at
 * http://code.google.com/chrome/extensions/samples.html .
 * @author wangt@google.com (Thomas Wang)
 */

/**
 * On options.html load, sets up all the options.
 * Sets up the default button and test speech button.
 */

function load() {
  var rateElement = document.getElementById('rate');
  var pitchElement = document.getElementById('pitch');
  var volumeElement = document.getElementById('volume');
  var rate = localStorage['rate'] || 1.0;
  var pitch = localStorage['pitch'] || 1.0;
  var volume = localStorage['volume'] || 1.0;
  rateElement.value = rate;
  pitchElement.value = pitch;
  volumeElement.value = volume;
  function listener(evt) {
    rate = rateElement.value;
    localStorage['rate'] = rate;
    pitch = pitchElement.value;
    localStorage['pitch'] = pitch;
    volume = volumeElement.value;
    localStorage['volume'] = volume;
  }
  rateElement.addEventListener('keyup', listener, false);
  pitchElement.addEventListener('keyup', listener, false);
  volumeElement.addEventListener('keyup', listener, false);
  rateElement.addEventListener('mouseup', listener, false);
  pitchElement.addEventListener('mouseup', listener, false);
  volumeElement.addEventListener('mouseup', listener, false);

  var defaultsButton = document.getElementById('defaults');
  defaultsButton.addEventListener('click', function(evt) {
    rate = 1.0;
    pitch = 1.0;
    volume = 1.0;
    localStorage['rate'] = rate;
    localStorage['pitch'] = pitch;
    localStorage['volume'] = volume;
    rateElement.value = rate;
    pitchElement.value = pitch;
    volumeElement.value = volume;
  }, false);

  var voice = document.getElementById('voice');
  var voiceArray = [];
  chrome.tts.getVoices(function(va) {
    voiceArray = va;
    for (var i = 0; i < voiceArray.length; i++) {
      var opt = document.createElement('option');
      var name = voiceArray[i].voiceName;
      if (name == localStorage['voice']) {
        opt.setAttribute('selected', '');
      }
      opt.setAttribute('value', name);
      opt.innerText = voiceArray[i].voiceName;
      voice.appendChild(opt);
    }
  });
  voice.addEventListener('change', function() {
    var i = voice.selectedIndex;
    localStorage['voice'] = voiceArray[i].voiceName;
  }, false);

  var testButton = document.getElementById('test');
  testButton.addEventListener('click', function(evt) {
    chrome.tts.speak(
        'Testing speech synthesis',
        {voiceName: localStorage['voice'],
         rate: parseFloat(rate),
         pitch: parseFloat(pitch),
         volume: parseFloat(volume)});
  });
}

document.addEventListener('DOMContentLoaded', load);
