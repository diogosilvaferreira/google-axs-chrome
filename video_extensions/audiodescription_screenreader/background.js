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
 * @fileoverview The background script.
 * @author wangt@google.com (Thomas Wang)
 */

/**
 * Gets the accept-languages of the browser. This is for when
 * there are audio descriptions available in different languages.
 * Set up listeners for requests from content_script.js to
 *     get the 'langList'.
 */

function initBackground() {
  var languageList;
  chrome.i18n.getAcceptLanguages(function(list) {
    console.log(list);
    languageList = list;
  });

  chrome.extension.onRequest.addListener(
      function(request, sender, sendResponse) {
        if (request['langList']) {
          console.log(languageList);
          sendResponse({langList: languageList});
        } else if (request['isSpeaking']) {
          chrome.tts.isSpeaking(function(state) {
            console.log('state ' + state);
            sendResponse({isSpeaking: state});
          });
        }
      }
  );
}

initBackground();
