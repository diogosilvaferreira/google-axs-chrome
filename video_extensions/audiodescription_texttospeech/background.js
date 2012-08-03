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
 * @fileoverview The background script that handles the speaking.
 * @author wangt@google.com (Thomas Wang)
 */

/**
 * Speaks text and send message to content_script.js to play
 *     <video> at end of cue or if did not finish (either the user
 *     or another extension stops the speaking).
 * Sends a message to content_script.js if no voice exists.
 * @param {string} utterance The text to be spoken.
 * @param {MessageSender=} sender The sender of the message.
 * @param {number=} videoId The id number of the <video> on the page.
 */
function speak(utterance, sender, videoId) {
  console.log(utterance);
  var rate = parseFloat(localStorage['rate']) || 1.0;
  var pitch = parseFloat(localStorage['pitch']) || 1.0;
  var volume = parseFloat(localStorage['volume']) || 1.0;
  var voice = localStorage['voice'];

  // Check whether there is a Chrome voice engine. If not, send
  // message to content_script.js to alert user to install one.
  // We are checking every utterance because a user can install/
  // unistall a voice engine at any time.
  chrome.tts.getVoices(
      function(voices) {
        console.log('voice length ' + voices.length);
        if (voices.length == 0) {
          console.log('send novoice');
          chrome.tabs.sendRequest(
              sender.tab.id, {'novoice': true});
        }
      }
  );
  chrome.tts.speak(
      utterance,
      {'enqueue': true,
       'voiceName': voice,
       'rate': rate,
       'pitch': pitch,
       'volume': volume,
       'onEvent': function(event) {
         // 'end' when the end of the utterance is reached, 'interrupted' when
         // the utterance is stopped or interrupted before reaching the end,
         // 'cancelled' when it's removed from the queue before ever being
         // synthesized
         if (sender &&
             (event.type == 'end' || event.type == 'interrupted' ||
             event.type == 'cancelled')) {
           chrome.tabs.sendRequest(
               sender.tab.id, {'play': true, 'videoId': videoId});
         }
       }
      }
  );
}

/**
 * Gets the accept-languages of the browser. This is for when
 * there are audio descriptions available in different languages.
 * Set up listeners for requests from content_script.js to
 *     'speak', 'stop', or get the 'langList'.
 */
function initBackground() {
  var languageList;
  chrome.i18n.getAcceptLanguages(function(list) {
    console.log(list);
    languageList = list;
  });

  chrome.extension.onRequest.addListener(
      function(request, sender, sendResponse) {
        if (request['speak']) {
          speak(request['speak'], sender, request['videoId']);
        } else if (request['stop']) {
          chrome.tts.stop();
        } else if (request['langList']) {
          console.log(languageList);
          sendResponse({langList: languageList});
        } else if (request['isSpeaking']) {
          chrome.tts.isSpeaking(function(state) {
            console.log('state ' + state);
            sendResponse({isSpeaking: state});
          });
        } else if (request['increaserate']) {
          var rate = parseFloat(localStorage['rate']) || 1.0;
          rate += .1;
          if (rate > 10.0) {
            rate = 10.0;
          }
          rate = Math.round(10 * rate) / 10;
          localStorage['rate'] = rate;
          var text = 'Rate ' + rate;
          speak(text);
        } else if (request['decreaserate']) {
          var rate = parseFloat(localStorage['rate']) || 1.0;
          rate -= .1;
          if (rate < 0.1) {
            rate = 0.1;
          }
          rate = Math.round(10 * rate) / 10;
          localStorage['rate'] = rate;
          var text = 'Rate ' + rate;
          speak(text);
        } else if (request['increasevolume']) {
          var volume = parseFloat(localStorage['volume']) || 1.0;
          volume += .1;
          if (volume > 1.0) {
            volume = 1.0;
          }
          volume = Math.round(10 * volume) / 10;
          localStorage['volume'] = volume;
          var text = 'Volume ' + volume;
          speak(text);
        } else if (request['decreasevolume']) {
          var volume = parseFloat(localStorage['volume']) || 1.0;
          volume -= .1;
          if (volume < 0.1) {
            volume = 0.1;
          }
          volume = Math.round(10 * volume) / 10;
          localStorage['volume'] = volume;
          var text = 'Volume ' + volume;
          speak(text);
        } else if (request['increasepitch']) {
          var pitch = parseFloat(localStorage['pitch']) || 1.0;
          pitch += .1;
          if (pitch > 2.0) {
            pitch = 2.0;
          }
          pitch = Math.round(10 * pitch) / 10;
          localStorage['pitch'] = pitch;
          var text = 'Pitch ' + pitch;
          speak(text);
        } else if (request['decreasepitch']) {
          var pitch = parseFloat(localStorage['pitch']) || 1.0;
          pitch -= .1;
          if (pitch < 0.1) {
            pitch = 0.1;
          }
          pitch = Math.round(10 * pitch) / 10;
          localStorage['pitch'] = pitch;
          var text = 'Pitch ' + pitch;
          speak(text);
        } else if (request['defaulttts']) {
          localStorage['pitch'] = 1.0;
          localStorage['rate'] = 1.0;
          localStorage['volume'] = 1.0;
          var text = 'Default tts settings';
          speak(text);
        }
      }
  );
}

initBackground();
