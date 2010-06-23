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
 * @fileoverview The main ChromeVis extension content script. This script
 * injects all other content scripts into the HTML head of the document.
 * @author rshearer@google.com (Rachel Shearer)
 */


/**
 * Inject content scripts.
 */
var forceRedownload = '?' + new Date().getTime();
var theScript = document.createElement('script');

var isGMail = false;
var isGMailCanvasFrame = false;

/**
 * @type {String}
 */
theScript.type = 'text/javascript';

/**
 * @type {String}
 */
theScript.src = chrome.extension.getURL('chromevis/chromeVis_main.js') +
    forceRedownload;

if ((document.location.toString().indexOf('https://mail.google.com') == 0) ||
  (document.location.toString().indexOf('http://mail.google.com') == 0)) {
  isGMail = true;
  // GMail is a special case.  Because of the multiple iframes, it is important
  // to make sure that the content scripts are injected into the canvas frame
  // so the event listeners can function properly.
  if (document.body.className == 'cP') {
    // Inside canvas frame - append script here
    document.getElementsByTagName('head')[0].appendChild(theScript);
    loadChromeVis();
    isGMailCanvasFrame = true;
  } else {
    // Not inside canvas frame, do nothing
  }
} else {
  // Not GMail, behave normally
  document.getElementsByTagName('head')[0].appendChild(theScript);
  loadChromeVis();
}

/**
 * Injects the other content scripts in the ChromeVis extension into the HTML
 * head of the document. This takes place across all pages.
 */
function loadChromeVis(){

  // Append this to the end of the script URL to force it to bypass the cache
  // and be redownloaded
  var forceRedownload = '?' + new Date().getTime();

  function loadScript(src) {
    var theScript = document.createElement('script');
    theScript.type = 'text/javascript';
    theScript.src = chrome.extension.getURL(src) + forceRedownload;
    document.getElementsByTagName('head')[0].appendChild(theScript);
  }

  loadScript('chromevis/chromeVis_extensionBridge.js');
  loadScript('common/selectionUtil.js');
  loadScript('common/traverseContent.js');
  loadScript('common/focusUtil.js');
  loadScript('chromevis/chromeVis_reader.js');
  loadScript('chromevis/chromeVis_lens.js');
  loadScript('third_party/keycode.js');
}


// Open a port to the extension's background page.
var port = chrome.extension.connect({name: 'content2Chrome'});


/**
 * Listens for an event fired from the content script in the active document.
 * The content script set the event data at the chromeVisPage2ExtensionDiv
 * before dispatching the event. In this case, the event data indicates a
 * particular action that has been taken by the user of the active document.
 *
 * This method handles the event by inspecting the data in the div and then
 * posting a message to the background page. The background page then decides
 * how to respond to the user action.
 *
 * This process is necessary because the content script cannot communicate
 * directly with the extension.
 *
 * For more information, see:
 * http://code.google.com/chrome/extensions/content_scripts.html
 */
function setupPage2ExtensionBridge(){

  if ((isGMail && isGMailCanvasFrame) || (! isGMail)) {
    var hiddenDiv = document.getElementById('chromeVisPage2ExtensionDiv');

    if (! hiddenDiv) {
      hiddenDiv = document.createElement('div');
      hiddenDiv.id = 'chromeVisPage2ExtensionDiv';
      hiddenDiv.style.display = 'none';
      document.body.appendChild(hiddenDiv);

      window.setTimeout(setupPage2ExtensionBridge, 1000);

    } else {
      hiddenDiv.addEventListener('chromeVisPage2ExtensionEvent', function() {
         var eventData =
               document.getElementById('chromeVisPage2ExtensionDiv').innerHTML;
         port.postMessage({message: 'user action', values: eventData});
      });
    }
  }
}


/**
 * Listens for a message from the background page.
 * The background page sends different types of messages depending
 * on the particular response that needs to happen.
 *
 * If the background page sends a 'command' message, then a response only needs
 * to happen on the current active document.
 * If the background page sends a 'data' message, then a response needs to
 * happen across all pages. The background page sends 'data' when a setting
 * has changed for the lens and it needs to be reflected across all tabs and
 * pages.
 */
port.onMessage.addListener(function(msg) {
  if (msg.command) {
    // Per-page action
    sendMessageToPage(msg.command);
  } else if (msg.data) {
    // Per-extension action
    sendMessageToLens(msg.data, msg.value);
  } else {
    // Unknown message
  }

});


/**
 * Communicates with the content script embedded in the active document.
 * This is achieved by creating a custom event chromeVisExtension2PageEvent,
 * setting the event data to a known location in the DOM (the div
 * chromeVisExtension2PageDiv), and dispatching the custom event to the div.
 * @param {String} message The message to be sent to the content script.
 */
function sendMessageToPage(message) {

  // Check to make sure if we are in GMail, we are in the right frame
  if ((isGMail && isGMailCanvasFrame) || (! isGMail)) {
    var evt = document.createEvent('Event');
    evt.initEvent('chromeVisExtension2PageEvent', true, true);

    var hiddenDiv = document.getElementById('chromeVisExtension2PageDiv');
    if (! hiddenDiv) {
      hiddenDiv = document.createElement('div');
      hiddenDiv.id = 'chromeVisExtension2PageDiv';
      hiddenDiv.style.display = 'none';
      document.body.appendChild(hiddenDiv);
    }
    hiddenDiv.innerHTML = message;
    hiddenDiv.dispatchEvent(evt);
  }

}


/**
 * Communicates with the content scripts embedded in all open pages. This is
 * achieved by creating a custom event for each lens setting that can be
 * changed, setting the event data to a known location in the DOM (the div
 * chromeVisBackground2LensDiv), and then dispatching the custom event to the
 * div. In this instance, sendMessageToLens is used to send settings changes
 * to the lens. chromeVis_lens is watching the div for each custom event  and
 * will update the lens appropriately in response.
 * @param {String} name The type of the setting to be changed.
 * @param {String} value The value of the setting.
 */
function sendMessageToLens(name, value) {

  // Check to make sure if we are in GMail, we are in the right frame
  if ((isGMail && isGMailCanvasFrame) || (! isGMail)) {
    var evt = document.createEvent('Event');

    // Create custom events here
    switch (name) {
      case 'data-isAnchored':
        evt.initEvent('chromeVisAnchorLensEvent', true, true);
        break;
      case 'data-isCentered':
        evt.initEvent('chromeVisCenterLensEvent', true, true);
        break;
      case 'data-textMag':
        evt.initEvent('chromeVisMagEvent', true, true);
        break;
      case 'data-textColor':
        evt.initEvent('chromeVisTextColorEvent', true, true);
        break;
      case 'data-bgColor':
        evt.initEvent('chromeVisBgColorEvent', true, true);
        break;
      default:
        console.log('Invalid lens attribute name: ' + name);
        return;
    }

    var hiddenDiv = document.getElementById('chromeVisBackground2LensDiv');
    if (! hiddenDiv) {
      hiddenDiv = document.createElement('div');
      hiddenDiv.id = 'chromeVisBackground2LensDiv';
      hiddenDiv.style.display = 'none';
      document.body.appendChild(hiddenDiv);
    }
    hiddenDiv.setAttribute(name, value);
    hiddenDiv.dispatchEvent(evt);
  }
}


/**
 * Listens for a request sent from the background page.
 * The background page sends 'data' when a setting has changed for the lens and
 * it needs to be reflected across all tabs and pages. The background page
 * sends 'message' when a lens property has changed.
 */
chrome.extension.onRequest.addListener(
  function(request, sender, sendResponse) {

  if (request.data) {
    sendMessageToLens(request.data, request.value);
  }

  if (request.message) {
    sendMessageToPage(request.message);
  }

  // send empty response to clean up and close request
  sendResponse({});
});


setupPage2ExtensionBridge();
