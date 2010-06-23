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
 * @fileoverview Establishes communication in the shared DOM between the main
 * content script embedded in each page and the extension.
 * @author rshearer@google.com (Rachel Shearer)
 */


/**
 * Creates a div in the shared DOM in which event data will be stored. This div
 * will be watched by the content scripts and the extension.
 */
var ChromeVisExtensionBridge = function() {
  var hiddenDiv = document.getElementById('chromeVisPage2ExtensionDiv');
  if (! hiddenDiv) {
    hiddenDiv = document.createElement('div');
    hiddenDiv.id = 'chromeVisPage2ExtensionDiv';
    hiddenDiv.style.display = 'none';
    document.body.appendChild(hiddenDiv);
  }
};

/**
 * Communicates with the extension by setting the specified message as the
 * innerHTML of the watched div and then dispatching a custom event.
 * @param {string} message The message to be communicated to the extension.
 */
ChromeVisExtensionBridge.prototype.sendMessageToExtension = function(message) {
  var evt = document.createEvent('Event');
  evt.initEvent('chromeVisPage2ExtensionEvent', true, true);

  var hiddenDiv = document.getElementById('chromeVisPage2ExtensionDiv');
  if (! hiddenDiv) {
    hiddenDiv = document.createElement('div');
    hiddenDiv.id = 'chromeVisPage2ExtensionDiv';
    hiddenDiv.style.display = 'none';
    document.body.appendChild(hiddenDiv);
  }
  hiddenDiv.innerHTML = message;
  hiddenDiv.dispatchEvent(evt);
};
