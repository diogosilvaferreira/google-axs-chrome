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
 * @fileoverview The main ChromeVis event listener script. This script listens
 * for keyboard events and then sends them to the background page. This script
 * also handles any page-specific update requests from the background page. In
 * this context, page-specific events include showing/hiding the lens and
 * moving the selection around the page.
 * @author rshearer@google.com (Rachel Shearer)
 */


var CHROMEVIS_extensionBridgeObj;

var myChromeVisReader;
var lensShown;

/**
 * Handles keyboard events. Checks if the key event is being sent from a text
 * input field, in which case the event will be ignored by the extension. If
 * not, sends a message to the background page with the event keycode. The
 * background page will check the user-defined keyboard shortcuts and determine
 * the appropriate action.
 * @param {Event} evt The keyboard event.
 * @return {Boolean} True to allow the default action.
 */
keyHandler = function(evt) {

  // If focus is inside field that accepts text input, ignore key event
  if (FocusUtil.isFocusInTextInputField()) {
    return true;
  }

  var k = KeyCode;
  // The keycode library takes a keydown event and returns a string that
  // represents the keys that were pressed. But, it returns only uppercase
  // letters.
  var keyString = k.hot_key(k.translate_event(evt));

  // We turn everything into lowercase and allow the user to specify
  // Shift+[Key] for uppercase characters
  if (keyString.length == 1) {
    // Single character
    keyString = keyString.toLowerCase();
  }

  // TODO: regexp this?
  else if (keyString.indexOf('+') != -1) {
    // This is a combination, the part after the + should be lowercase
    var splits = keyString.split('+');
    splits[1] = splits[1].toLowerCase();
    keyString = splits[0].concat('+', splits[1]);
  }

  // Because of keycode conflicts, the keycode library turns the:
  //  '-' character into '_',
  // the '`' character into '~',
  // and the '.' character into '>'
  // We change them back.
  keyString = keyString.replace('_', '-');
  keyString = keyString.replace('~', '`');
  keyString = keyString.replace('>', '.');

  // Tell the background page what the keycode string is
  CHROMEVIS_extensionBridgeObj.sendMessageToExtension(keyString);

  return true;
};

/**
 * Handles mouseup events, which indicate that the user may have made a new
 * selection with the mouse. Signals that the text in the lens should be
 * updated.
 * @param {Event} evt The mouseup event.
 * @return {Boolean} True to allow the default action.
 *
 */
mouseUpHandler = function(evt) {

  if (evt.button == 0) {
    // Update the text in the lens to contain the new selected text.
    myChromeVisReader.getLens().updateText();
  }

  return true;
};

/**
 * Handles window resize events. In response, the position of the lens might
 * need to be changed.
 * @param {Event} evt The resize event.
 * @return {Boolean} True to allow the default action.
 */
resizeHandler = function(evt) {
  myChromeVisReader.getLens().updateResized();
  return true;
};

/**
 * Handles document scroll events. In response, the position of the lens might
 * need to be changed.
 * @param {Event} evt The scroll event.
 * @return {Boolean} True to allow the default action.
 */
scrollHandler = function(evt) {
  myChromeVisReader.getLens().updateScrolled();
  return true;
};

/**
 * Establishes a connection with the background page. Sets up the document and
 * window event listeners.
 */
function startListening() {

  // Establish a connection with the extension
  CHROMEVIS_extensionBridgeObj = new ChromeVisExtensionBridge();

  setupExtension2PageBridge();

  lensShown = false;

  myChromeVisReader = new ChromeVisReader();

  document.addEventListener('keydown', keyHandler, true);
  document.addEventListener('mouseup', mouseUpHandler, true);

  window.addEventListener('resize', resizeHandler, true);
  document.addEventListener('scroll', scrollHandler, true);

}

/**
 * Sets up the connection with the background page by establishing a particular
 * div known to both and firing custom DOM events. A listener on the div
 * (chromeVisExtension2PageDiv) waits for a response from the background page .
 */
function setupExtension2PageBridge() {
  var hiddenDiv = document.getElementById('chromeVisExtension2PageDiv');
  if (! hiddenDiv) {
    hiddenDiv = document.createElement('div');
    hiddenDiv.id = 'chromeVisExtension2PageDiv';
    hiddenDiv.style.display = 'none';
    document.body.appendChild(hiddenDiv);
  }

  // Listens for response from the background page. This response indicates
  // the proper action to perform.
  hiddenDiv.addEventListener('chromeVisExtension2PageEvent', function() {
       var eventElt = document.getElementById('chromeVisExtension2PageDiv');
       var eventData =
                document.getElementById('chromeVisExtension2PageDiv').innerHTML;

       if (eventData == 'show lens') {
         if (lensShown) {
           lensShown = false;
           myChromeVisReader.getLens().showLens(false);
         } else {
           lensShown = true;
           myChromeVisReader.getLens().showLens(true);
         }
       }

       if (eventData == 'forward sentence') {
         moveForward('sentence');
       }

       if (eventData == 'forward word') {
         moveForward('word');
       }

       if (eventData == 'forward character') {
         moveForward('character');
       }

       if (eventData == 'forward paragraph') {
         moveForward('paragraph');
       }

       if (eventData == 'backward sentence') {
         moveBackward('sentence');
       }

       if (eventData == 'backward word') {
         moveBackward('word');
       }

       if (eventData == 'backward character') {
         moveBackward('character');
       }

       if (eventData == 'backward paragraph') {
         moveBackward('paragraph');
       }

    }, true);
}

/**
 * Utility function to move the selection forward. If the selection has
 * reached the end of the page, signals a reset.
 * @param {String} granularity Specifies "sentence", "word", "character", or
 *     "paragraph" granularity.
 */
function moveForward(granularity) {
  var status = myChromeVisReader.getDomUtils().nextElement(granularity);

  if (status == null) {
    console.log('resetting selection!');
    myChromeVisReader.getDomUtils().reset();
  }

  myChromeVisReader.getLens().updateText();
}

/**
 * Utility function to move the selection backward. If the selection has
 * reached the beginning of the page, signals a reset.
 * @param {String} granularity Specifies "sentence", "word", "character", or
 *     "paragraph" granularity.
 */
function moveBackward(granularity) {
  var status = myChromeVisReader.getDomUtils().prevElement(granularity);

  if (status == null) {
    console.log('resetting selection!');
    myChromeVisReader.getDomUtils().reset();
  }

  myChromeVisReader.getLens().updateText();
}



window.setTimeout(startListening, 1000);

