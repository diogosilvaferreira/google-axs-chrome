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
 * @fileoverview Content script that is injected in every page.
 * Searches for <video> element and <track> that is audio
 * description. Adds aria-live region to shadow DOM that updates
 * with the cue changes.
 * @author wangt@google.com (Thomas Wang)
 */

goog.provide('a11y.Video');
goog.provide('a11y.VideoElement');

/**
 * Object constructor for VideoElement.
 * Initializes the track.
 * @param {!Element} videoElement A <video> element.
 * @param {number} selectedVideoId The id number for the <video> on the page.
 *     Currently implemented as the "n"th <video> on page.
 * @this VideoElement
 * @constructor
 */
a11y.VideoElement = function(videoElement, selectedVideoId) {

  /**
   * @type {!Element}
   * @private
   */
  this.elem_ = videoElement;

  /**
   * The id for each <video> element on page.
   * This is to identify different videos on a page (if there are multiple).
   * When a background page sends a message (ex., 'play'),
   * it needs to send it to a specific video, identified by videoId.
   * @type {number}
   * @private
   */
  this.videoId_ = selectedVideoId;

  /**
   * The id for the <div> of the aria-live region for cues
   * @type {string}
   * @private
   */
  this.idString_ = this.getUniqueDivId(this);

  /**
   * The audio description track
   * @type {TextTrack}
   * @private
   */
  this.descTrack_ = null;

  /**
   * Whether the video is paused by this extension
   * @type {boolean}
   * @private
   */
  this.pausedByExtension_ = false;


  /**
   * The intervalID used to track polling by setInterval()
   * @type {number}
   * @private
   */
  this.intervalId_ = 0;

  if (a11y.Video.userTesting) {
   this.elem_.addEventListener(
      'keydown',
      function(evt) {
        if (evt.keyIdentifier == 'U+0020') { // Space bar
          console.log('space');
          if (this.paused) {
            this.play();
          } else {
            this.pause();
          }
        }
      });
  }
};

/**
 * Set the default audio description track.
 */
a11y.VideoElement.prototype.setInitDefaultTrack = function() {
  this.descTrack_ = this.initialDefaultTrack();
};

/**
 * Default audio description track.
 * @return {TextTrack} Returns the track.
 */
a11y.VideoElement.prototype.initialDefaultTrack = function() {
  var i;
  var retTrack;

  /**
   * Associative array for language that user wants.
   * @type {!Object.<string, boolean>}
   */
  var userLang = {};
  for (i = 0; i < a11y.Video.languageList.length; i++) {
    userLang[a11y.Video.languageList[i]] = true;
  }

  // Select appropriate track, in order of preference:
  // 1. mode=TextTrack.SHOWING
  // 2. @default
  // 3. match language
  // 4. just select the first one

  // Loop through all tracks, looking for kind='descriptions'
  // Select the first occurrence of SHOWING, @default, language match
  // Select the appropriate track (in the above order)

  var firstShowing, firstDefault, firstLangMatch, firstDesc;
  for (i = 0; i < this.elem_.textTracks.length; i++) {
    if (this.elem_.textTracks[i].kind === 'descriptions') {
      if (!firstShowing &&
          this.elem_.textTracks[i].mode === TextTrack.SHOWING) {
        firstShowing = this.elem_.textTracks[i];
        break;
      }

      if (!firstDefault && this.elem_.textTracks[i].defaultSelected) {
        firstDefault = this.elem_.textTracks[i];
      }

      if (!firstLangMatch && userLang[this.elem_.textTracks[i].language]) {
        firstLangMatch = this.elem_.textTracks[i];
      }

      if (!firstDesc) {
        firstDesc = this.elem_.textTracks[i];
      }
    }
  }

  if (firstShowing) {
    retTrack = firstShowing;
  } else if (firstDefault) {
    retTrack = firstDefault;
  } else if (firstLangMatch) {
    retTrack = firstLangMatch;
  } else {
    retTrack = firstDesc;
  }

  // Activate description track.
  if (retTrack && retTrack.mode !== TextTrack.SHOWING) {
    retTrack.mode = TextTrack.HIDDEN;
  }

  return retTrack;
};

/**
 * Get a unique id for the aria-live div
 * @param {!VideoElement} vid The video that will have an aria-live div.
 * @return {string} Returns the div id.
 */
a11y.VideoElement.prototype.getUniqueDivId = function(vid) {
  // set the @id for the <div> as "descriptions" + #
  // so each <video> has a unique <div> child
  var idString = 'HTML5audiodescriptionswithscreenreader' + vid.videoId_;

  if (document.getElementById(idString)) {
    // TODO(wangt): how to select an id if there is a collision
  }

  return idString;
};

/**
 * Cue change function. Looks for active cue and updates aria-live region.
 * @param {!VideoElement} vid Which video's cue changed.
 * @return {function} Returns the function as described above.
 */
a11y.VideoElement.prototype.cuechange = function(vid) {
  return function() {
    // Here, "this" refers to a textTrack.
    // Only read the first active cue, ignoring all other active cues.
    // (It's possible to have overlapping cues; in this case, we will only
    // read the first one)
    if (this.activeCues.length > 0) {
      var cue = this.activeCues[0];

        if (document.getElementById(vid.idString_)) {
          cue.onexit = function() {
             chrome.extension.sendRequest(
              {'isSpeaking': true},
              function(response) {
                if (response.isSpeaking) {
                  console.log('isSpeaking');
                  vid.elem_.pause();
                  vid.pausedByExtension_ = true;
                  vid.intervalId_ = window.setInterval(
                      a11y.VideoElement.isSpeakingPolling,
                      500,
                      vid);
                }
              }
            );
          };

          // Using innerText (compatible with Chrome)
          // but for future development, other browsers may not support
          // http://www.quirksmode.org/dom/w3c_html.html
          document.getElementById(vid.idString_).innerText = cue.text;
      }
    }
  };
};

/**
 * Function that is polled to check if the screenreader has stopped speaking.
 * @param {!VideoElement} vid The video that will restart playing
 *     when the screenreader stops speaking.
 */
a11y.VideoElement.isSpeakingPolling = function(vid) {
  chrome.extension.sendRequest(
      {'isSpeaking': true},
      function(response) {
        if (!response.isSpeaking) {
          console.log('not Speaking');
          vid.elem_.play();
          vid.pausedByExtension_ = false;
          window.clearInterval(vid.intervalId_);
        }
      }
  );
};

/**
 * Sets up aria-live updating on cue change.
 * Adds aria-live region as child of <video>.
 * @param {TextTrack} track The new <track>.
 */
a11y.VideoElement.prototype.activateTrack = function(track) {
  this.descTrack_ = track;

  if (this.descTrack_) {
     this.descTrack_.addEventListener(
        'cuechange',
        this.cuechange(this),
        false);
  }

  var ariaLiveRegion = document.createElement('div');
  ariaLiveRegion.setAttribute('id', this.idString_);
  ariaLiveRegion.setAttribute('aria-live', 'polite');
  // Make the live region hidden off screen, set tabindex = -1
  ariaLiveRegion.style.cssText = a11y.Video.offScreenCSStext;
  ariaLiveRegion.setAttribute('tabindex', '-1');

  // From https://developer.mozilla.org/En/DOM/Node.insertBefore
  var parentDiv = this.elem_.parentNode;
  parentDiv.insertBefore(ariaLiveRegion, this.elem_.nextSibling);
};

/**
 * Remove aria-live updating on cue change.
 * Remove aria-live region as child of <video>.
 */
a11y.VideoElement.prototype.deactivateTrack = function() {
  if (this.descTrack_) {
    this.descTrack_.removeEventListener(
        'cuechange',
        this.cuechange(this),
        false);
  }

  var parentDiv = this.elem_.parentNode;
  parentDiv.removeChild(document.getElementById(this.idString_));
};

/**
 * Initialize all the <video> elements on page.
 */
a11y.Video.initVideoElems = function() {
  var j;
  var videoElementList = document.getElementsByTagName('video');
  var videoWithAudioDesc = false;

  // If there are videos, init the track to specified language if possible
  if (videoElementList.length > 0) {
    chrome.extension.sendRequest(
        {'langList': true},
        function(response) {
          a11y.Video.languageList = response.langList;
          console.log('response ' + a11y.Video.languageList);
          for (j = 0; j < videoElementList.length; j++) {
            a11y.Video.videoElems[j] =
                new a11y.VideoElement(videoElementList[j], j);

            // Set the audio desc track using our default rules
            a11y.Video.videoElems[j].setInitDefaultTrack();

            // There is a video with audio description on page.
            // We will announce the presence of videos in the title.
            // We will announce on/off through an aria-live region.
            if (a11y.Video.videoElems[j].descTrack_ && !videoWithAudioDesc) {
              videoWithAudioDesc = true;
              console.log('found video with audio description');

              a11y.Video.announcementDiv = document.createElement('div');
              a11y.Video.announcementDiv.setAttribute('id',
                  a11y.Video.announcementDivId);
              a11y.Video.announcementDiv.setAttribute('aria-live', 'assertive');
              // Make the live region hidden off screen, set tabindex=-1
              a11y.Video.announcementDiv.style.cssText =
                  a11y.Video.offScreenCSStext;
              a11y.Video.announcementDiv.setAttribute('tabindex', '-1');

              document.body.appendChild(a11y.Video.announcementDiv);

              var originalTitle = document.title;
              document.title = originalTitle + '. has audio described video';
            }
          }
        }
    );
  }
};

/**
 * Initialize the keyboard listeners.
 */
a11y.Video.initKeyCommands = function() {
  // Keyboard listener to turn on/off audio desc
  // The shortcut right now is ALT+b
  // By default, audio desc is off
  // Referenced example at: https://developer.mozilla.org/en/DOM/KeyboardEvent
  /**
   * Are audio descriptions enabled.
   * @type {boolean}
   */
  a11y.Video.audioDescOn = false;
  /**
   * Is the alt key pressed.
   * @type {boolean}
   */
  a11y.Video.altChar = false;
  /**
   * The alt key keycode
   * @type {number}
   */
  a11y.Video.altKey = 18;

  document.addEventListener(
      'keydown',
      a11y.Video.keyDown,
      false);
  document.addEventListener(
      'keyup',
      a11y.Video.keyUp,
      false);
};

/**
 * Keydown event handler
 * @param {!KeyboardEvent} evt The keyboard event.
 */
a11y.Video.keyDown = function(evt) {
  var j;

  var key = evt.keyCode;
  if (key == a11y.Video.altKey) {
    a11y.Video.altChar = true;
  }
  // keycode for 'b' is 66
  if (key == 66) {
    if (a11y.Video.altChar) {
      if (a11y.Video.audioDescOn) {
        for (j = 0; j < a11y.Video.videoElems.length; j++) {
          a11y.Video.videoElems[j].deactivateTrack();
          a11y.Video.audioDescOn = false;
          a11y.Video.announcementDiv.innerText = 'Audio description off.';
        }
      } else {
        for (j = 0; j < a11y.Video.videoElems.length; j++) {
          a11y.Video.videoElems[j].activateTrack(
              a11y.Video.videoElems[j].descTrack_);
          a11y.Video.audioDescOn = true;
          a11y.Video.announcementDiv.innerText = 'Audio description on.';
        }
      }
      console.log('audioDescOn ' + a11y.Video.audioDescOn);
    }
  }
};

/**
 * Keyup event handler
 * @param {!KeyboardEvent} evt The keyboard event.
 */
a11y.Video.keyUp = function(evt) {
  if (evt.keyCode == a11y.Video.altKey) {
    a11y.Video.altChar = false;
  }
};

/**
 * The list of languages returned by background.js.
 * @type {Array.<string>}
 */
a11y.Video.languageList = [];
/**
 * Array of video elements.
 * @type {Array.<VideoElement>}
 */
a11y.Video.videoElems = [];
/**
 * The id for the aria-live region used for announcements.
 * @type {string}
 */
a11y.Video.announcementDivId = 'HTML5audiodescriptionwithscreenreader' +
    'announcement';
/**
 * The div for the aria-live region used for announcements.
 * @type {Element}
 */
a11y.Video.announcementDiv = null;
/**
 * The CSS to make text appear offscreen.
 * http://www.w3.org/TR/2012/NOTE-WCAG20-TECHS-20120103/C7.html
 * @type {string}
 */
a11y.Video.offScreenCSStext =
  'height: 1px; width: 1px; position: absolute; overflow: hidden; top: -10px;';
/**
 * Boolean for user testing.
 * Turns on extra code to make HTML5 video more accessible for now.
 * @type {boolean}
 */
a11y.Video.userTesting = true;

a11y.Video.initVideoElems();
a11y.Video.initKeyCommands();
