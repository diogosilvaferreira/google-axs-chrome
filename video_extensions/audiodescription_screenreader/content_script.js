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

  /**
   * Whether we have spoken documentation
   * @type {boolean}
   * @private
   */
  this.spokenDocumentation_ = false;

  /**
   * The on cuechange function (for removing eventListener)
   * @type {function()}
   * @private
   */
  this.cueChangeFunction_ = null;

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

  // If the track experiment is not enabled, announce and return
  // This checks if textTracks is NULL (no support for track)
  // (When textTracks has length 0, that means that track is supported,
  // but there are no tracks)
  if (!this.elem_.textTracks) {
    a11y.Video.trackNotSupported();
    return;
  }

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
  if (retTrack) {
    if (retTrack.mode !== TextTrack.SHOWING) {
      retTrack.mode = TextTrack.HIDDEN;
    }

    // Add documentation announcement on focus of video
    // that this video has audio descriptions
    this.elem_.onfocus = this.onFocus(this);
  }

  return retTrack;
};

/**
 * Onfocus of video element, speak documentation.
 * @param {VideoElement} vid Which video received the focus event.
 * @return {function} Returns the function as described above.
 */
a11y.VideoElement.prototype.onFocus = function(vid) {
  return function() {
    console.log('focus on video');
    if (!vid.spokenDocumentation_) {
      a11y.Video.speakVideoAnnouncement(vid);
      vid.spokenDocumentation_ = true;
    }
  };
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
     this.cueChangeFunction_ = goog.bind(a11y.Video.createCueChangeFunction,
         this.descTrack_, this);
     this.descTrack_.addEventListener(
        'cuechange',
        this.cueChangeFunction_,
        false);
  }

  if (!a11y.Video.audioDescWithAnnouncementDiv) {
    var ariaLiveRegion = document.createElement('div');
    ariaLiveRegion.setAttribute('id', this.idString_);
    ariaLiveRegion.setAttribute('aria-live', 'polite');
    // Make the live region hidden off screen, set tabindex = -1
    ariaLiveRegion.style.cssText = a11y.Video.offScreenCSStext;
    ariaLiveRegion.setAttribute('tabindex', '-1');

    // From https://developer.mozilla.org/En/DOM/Node.insertBefore
    var parentDiv = this.elem_.parentNode;
    parentDiv.insertBefore(ariaLiveRegion, this.elem_.nextSibling);
  }
};

/**
 * Remove aria-live updating on cue change.
 * Remove aria-live region as child of <video>.
 */
a11y.VideoElement.prototype.deactivateTrack = function() {
  if (this.descTrack_) {
    this.descTrack_.removeEventListener(
        'cuechange',
        this.cueChangeFunction_,
        false);
  }

  if (document.getElementById(this.idString_)) {
    var parentDiv = this.elem_.parentNode;
    parentDiv.removeChild(document.getElementById(this.idString_));
  }
};


/**
 * Cue change function. Looks for active cue and updates aria-live region.
 * @param {!VideoElement} vid Which video's cue changed.
 * @this {TextTrack} Will be goog.bind to textTrack
 */
a11y.Video.createCueChangeFunction = function(vid) {
  // Here, "this" refers to a textTrack.
  // Only read the first active cue, ignoring all other active cues.
  // (It's possible to have overlapping cues; in this case, we will only
  // read the first one)
  if (this.activeCues.length > 0) {
    var cue = this.activeCues[0];

    if (a11y.Video.audioDescWithAnnouncementDiv ||
        document.getElementById(vid.idString_)) {
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
      // Blank the aria-live region so if the same text is announced twice,
      // the screenreader will read it twice (otherwise there will be no
      // update to the live region)
      if (a11y.Video.audioDescWithAnnouncementDiv) {
        a11y.Video.updateAnnouncement(cue.text);
      } else {
        document.getElementById(vid.idString_).innerText = '';
        document.getElementById(vid.idString_).innerText = cue.text;
      }
    }
  }
};

/**
 * Initialize all the <video> elements on page.
 */
a11y.Video.initVideoElems = function() {
  var j;
  var videoElementList = document.getElementsByTagName('video');

  a11y.Video.announcementDiv = document.createElement('div');
  a11y.Video.announcementDiv.setAttribute('id',
      a11y.Video.announcementDivId);
  a11y.Video.announcementDiv.setAttribute('role', 'alert');
  a11y.Video.announcementDiv.setAttribute('aria-live', 'assertive');
  // Make the live region hidden off screen, set tabindex=-1
  a11y.Video.announcementDiv.style.cssText =
      a11y.Video.offScreenCSStext;
  a11y.Video.announcementDiv.setAttribute('tabindex', '-1');
  document.body.appendChild(a11y.Video.announcementDiv);

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

            // Turn on audio desc track by default
            a11y.Video.videoElems[j].activateTrack(
                a11y.Video.videoElems[j].descTrack_);

            // There is a video with audio description on page.
            // We will announce the presence of videos in the title.
            // We will announce on/off through an aria-live region.
            if (a11y.Video.videoElems[j].descTrack_ &&
                !a11y.Video.videoWithAudioDesc) {
              a11y.Video.videoWithAudioDesc = true;
              console.log('found video with audio description');

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
  a11y.Video.audioDescOn = true;
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
          a11y.Video.updateAnnouncement('Audio description off.');
        }
      } else {
        for (j = 0; j < a11y.Video.videoElems.length; j++) {
          a11y.Video.videoElems[j].activateTrack(
              a11y.Video.videoElems[j].descTrack_);
          a11y.Video.audioDescOn = true;
          a11y.Video.updateAnnouncement('Audio description on.');
        }
      }
      console.log('audioDescOn ' + a11y.Video.audioDescOn);
    }
  } else if (key == 82) {
    // keycode for 'r' is 82
    // repeat documentation announcement
    if (a11y.Video.altChar) {
      a11y.Video.speakVideoAnnouncement();
    }
  } else if (key == 191) {
    // keycode for '?' is 191
    if (a11y.Video.altChar) {
      a11y.Video.updateAnnouncement(a11y.Video.announceShortcuts);
    }
  } else if (key == 81) {
    // keycode for 'q' is 81
    if (a11y.Video.altChar) {
      if (a11y.Video.audioDescWithAnnouncementDiv) {
        a11y.Video.audioDescWithAnnouncementDiv = false;
        if (a11y.Video.audioDescOn) {
          for (j = 0; j < a11y.Video.videoElems.length; j++) {
            if (!document.getElementById(
                    a11y.Video.videoElems[j].idString_)) {
              a11y.Video.videoElems[j].activateTrack(
                  a11y.Video.videoElems[j].descTrack_);
            }
          }
        }
      } else {
        a11y.Video.audioDescWithAnnouncementDiv = true;
      }
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
 * Check if the <track> element is supported.
 * http://modernizr.com/docs/
 * @return {boolean} Returns if track is supported.
 */
a11y.Video.isTrackSupported = function() {
  var video = document.createElement('video');
  return typeof video.addTextTrack === 'function';
};

/**
 * Update announcement aria-live region to announce that
 * the <track> element is not supported
 */
a11y.Video.trackNotSupported = function() {
  a11y.Video.updateAnnouncement(a11y.Video.announceTrackNotSupported);
};

/**
 * Speak documentation depending on audio description on/off.
 */
a11y.Video.speakVideoAnnouncement = function() {
  var text = '';
  if (!a11y.Video.isTrackSupported()) {
    text += a11y.Video.announceTrackNotSupported;
  } else if (a11y.Video.videoWithAudioDesc) {
    text += 'This video has audio descriptions. ';

    if (a11y.Video.audioDescOn) {
      text += 'Audio description on. ';
      text += 'To disable them, press alt b . ';
    } else {
      text += 'Audio description off. ';
      text += 'To enable them, press alt b . ';
    }

    text += 'To repeat this message, press alt r .';
  } else {
    text += 'This video does not have audio descriptions. ';
  }
  text += 'For keyboard shorcuts, press alt question mark .';
  a11y.Video.updateAnnouncement(text);
};

/**
 * Update the announcement aria-live region.
 * @param {string} text The new text.
 */
a11y.Video.updateAnnouncement = function(text) {
  // Blank the aria-live region so if the same text is announced twice,
  // the screenreader will read it twice (otherwise there will be no update
  // to the live region)
  // For example, if the user hits alt-r twice in a row, we want that
  // announcement to be spoken twice.
  a11y.Video.announcementDiv.innerText = '';
  a11y.Video.announcementDiv.innerText = text;
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
/**
 * Announcement string that track is not supported.
 * @type {string}
 */
a11y.Video.announceTrackNotSupported = 'This video may have audio ' +
    'descriptions but the HTML5 track element has not been enabled. ' +
    'For audio descriptions to work, please go to ' +
    'chrome colon slash slash flags, find the track experiment, ' +
    'enable it, and restart the browser.';
/**
 * Announcement of shorcuts.
 * @type {string}
 */
a11y.Video.announceShortcuts = 'List of keyboard commands. ' +
    'To repeat this list of commands, press alt question mark. ' +
    'To detect if audio descriptions are on or off, press alt r . ' +
    'To turn audio descriptions on or off, press alt b .';
/**
 * Boolean whether there is an audio described video.
 * @type {boolean}
 */
a11y.Video.videoWithAudioDesc = false;
/**
 * Boolean: if true, use the a11y.Video.announcementDiv for audio descriptions,
 * else create a new ariaLiveRegion for each <video>.
 * Note: it looks like there is a bug on Mac:
 * the ariaLiveRegion is not spoken by VoiceOver.
 * The quick fix is to use the a11y.Video.announcementDiv instead.
 * This is not desired implementation, but it fixes the bug.
 * @type {boolean}
 */
a11y.Video.audioDescWithAnnouncementDiv = true;

a11y.Video.initVideoElems();
a11y.Video.initKeyCommands();
