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
 * description. Sends text of cue to background.js to speak, and
 * pauses video if already speaking. Also listens to video
 * to stop speaking cue if user pauses, seeks, or presses CTRL.
 * @author wangt@google.com (Thomas Wang)
 */

/**
 * Object constructor for VideoElement.
 * @param {Object} e A <video> element.
 * @param {number} num The id number for the <video> on the page.
 *     Currently implemented as the "n"th <video> on page.
 * @this VideoElement
 * @constructor
 */
function VideoElement(e, num) {
  this.elem = e;

  // videoId: id for each <video> element on page.
  // This is to identify different videos on a page (if there are multiple).
  // When a background page sends a message (ex., 'play'),
  // it needs to send it to a specific video, identified by videoId.
  this.videoId = num;

  this.altChar = false;
  this.audioDescOn = true;
  this.spokenDocumentation = false;

  this.pausedByExtension = false;
  this.elem.addEventListener('pause', this.pauseListener(this));
  this.elem.addEventListener('play', this.playListener(this));
  this.elem.addEventListener('seeking', this.seekingListener);
  this.elem.addEventListener('keydown', this.keyDownListener(this));
  this.elem.addEventListener('keyup', this.keyUpListener(this));
}

/**
 * Initializes the track. Sets up speaking on cue change.
 */
VideoElement.prototype.initTrack = function() {
  var i;

  // If the track experiment is not enabled, announce and return
  if (!this.elem.textTracks) {
    chrome.extension.sendRequest(
        {'speak': announceTrackNotSupported}
    );
    return;
  }

  // Associative array for language that user wants
  // key = language, value = true
  var userLang = {};
  for (i = 0; i < languageList.length; i++) {
    userLang[languageList[i]] = true;
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
  for (i = 0; i < this.elem.textTracks.length; i++) {
    if (this.elem.textTracks[i].kind === 'descriptions') {
      if (!firstShowing &&
          this.elem.textTracks[i].mode === TextTrack.SHOWING) {
        firstShowing = this.elem.textTracks[i];
        break;
      }

      if (!firstDefault && this.elem.textTracks[i].defaultSelected) {
        firstDefault = this.elem.textTracks[i];
      }

      if (!firstLangMatch && userLang[this.elem.textTracks[i].language]) {
        firstLangMatch = this.elem.textTracks[i];
      }

      if (!firstDesc) {
        firstDesc = this.elem.textTracks[i];
      }
    }
  }

  if (firstShowing) {
    this.descTrack = firstShowing;
  } else if (firstDefault) {
    this.descTrack = firstDefault;
  } else if (firstLangMatch) {
    this.descTrack = firstLangMatch;
  } else {
    this.descTrack = firstDesc;
  }

  // Activate description track, if there is one
  if (this.descTrack) {
    if (this.descTrack.mode !== TextTrack.SHOWING) {
      this.descTrack.mode = TextTrack.HIDDEN;
    }

    this.descTrack.oncuechange = this.cuechange(this);

    // Add documentation announcement on focus of video
    // that this video has audio descriptions
    this.elem.onfocus = this.onFocus(this);
  }
};

/**
 * Onfocus of video element, speak documentation.
 * @param {VideoElement} vid Which video received the focus event.
 * @return {function} Returns the function as described above.
 */
VideoElement.prototype.onFocus = function(vid) {
  return function() {
    console.log('focus on video');
    if (!vid.spokenDocumentation) {
      vid.speakVideoAnnouncement(vid);
      vid.spokenDocumentation = true;
    }
  };
};

/**
 * All keyboard commands.
 * @param {VideoElement} vid Which video received the keydown event.
 * @return {function} Returns the function as described above.
 */
VideoElement.prototype.keyDownListener = function(vid) {
  return function(evt) {
    if (evt.keyIdentifier == 'U+0020') { // Space bar
      console.log('space');
      if (vid.elem.paused) {
        vid.elem.play();
      } else {
        vid.elem.pause();
      }
    } else if (evt.keyIdentifier == 'Left') {
      console.log('left');
      // Back by 10 seconds (mirroring Youtube functionality)
      var seekToTime = vid.elem.currentTime - 10;
      if (seekToTime >= 0 && seekToTime <= vid.elem.duration) {
        vid.elem.currentTime = seekToTime;
      } else if (seekToTime < 0) {
        vid.elem.currentTime = 0;
      } else if (seekToTime > vid.elem.duration) {
        vid.elem.currentTime = vid.elem.duration;
      }
    } else if (evt.keyIdentifier == 'Right') {
      console.log('right');
      // Forward by 10 seconds (mirroring Youtube functionality)
      var seekToTime = vid.elem.currentTime + 10;
      if (seekToTime >= 0 && seekToTime <= vid.elem.duration) {
        vid.elem.currentTime = seekToTime;
      } else if (seekToTime < 0) {
        vid.elem.currentTime = 0;
      } else if (seekToTime > vid.elem.duration) {
        vid.elem.currentTime = vid.elem.duration;
      }
    } else if (evt.keyIdentifier == 'Down') {
      console.log('down');
      // Volume is between 0.0 and 1.0
      var newVolume = vid.elem.volume - .1;
      if (newVolume >= 0 && newVolume <= 1.0) {
        vid.elem.volume = newVolume;
      }
    } else if (evt.keyIdentifier == 'Up') {
      console.log('up');
      // Volume is between 0.0 and 1.0
      var newVolume = vid.elem.volume + .1;
      if (newVolume >= 0 && newVolume <= 1.0) {
        vid.elem.volume = newVolume;
      }
    } else if (evt.keyCode == 18) {
      // keycode for ALT is 18
        vid.altChar = true;
    } else if (evt.keyCode == 191) {
      // keycode for '?' is 191
      if (vid.altChar) {
        chrome.extension.sendRequest(
            {'speak': announceKeyCommands}
        );
      }
    } else if (evt.keyCode == 66) {
      // keycode for 'b' is 66
      if (vid.altChar) {
        if (!isTrackSupported()) {
          chrome.extension.sendRequest(
              {'speak': announceTrackNotSupported}
          );
        } else if (vid.descTrack) {
          if (vid.audioDescOn) {
            vid.audioDescOn = false;
            vid.descTrack.oncuechange = null;
            chrome.extension.sendRequest(
                {'speak': 'Audio description off.'}
            );
          } else {
            vid.audioDescOn = true;
            vid.descTrack.oncuechange = vid.cuechange(vid);
            chrome.extension.sendRequest(
                {'speak': 'Audio description on.'}
            );
          }
          console.log('audioDescOn ' + vid.audioDescOn);
        }
      }
    } else if (evt.keyCode == 82) {
      // keycode for 'r' is 82
      // repeat documentation announcement
      if (vid.altChar) {
        vid.speakVideoAnnouncement(vid);
      }
    }
  };
};

/**
 * Detect alt keyup event.
 * @param {VideoElement} vid Which video received the keyup event.
 * @return {function} Returns the function as described above.
 */
VideoElement.prototype.keyUpListener = function(vid) {
  return function(evt) {
    if (evt.keyCode == 18) {
      // keycode for ALT is 18
      vid.altChar = false;
    }
  };
};

/**
 * Speak documentation depending on audio description on/off.
 * @param {VideoElement} vid Which video to speak.
 */
VideoElement.prototype.speakVideoAnnouncement = function(vid) {
  if (!isTrackSupported()) {
    chrome.extension.sendRequest(
      {'speak': announceTrackNotSupported}
    );
  } else if (vid.descTrack) {
    chrome.extension.sendRequest(
        {'speak': announceWithAudioDesc}
    );

    if (vid.audioDescOn) {
      chrome.extension.sendRequest(
          {'speak': announceAudioDescOn}
      );
    } else {
      chrome.extension.sendRequest(
          {'speak': announceAudioDescOff}
      );
    }

    chrome.extension.sendRequest(
        {'speak': announceRepeat}
    );
  } else {
    chrome.extension.sendRequest(
        {'speak': announceWithoutAudioDesc}
    );
  }
  chrome.extension.sendRequest(
      {'speak': announceKeyHelp}
  );
};

/**
 * If the user presses pause, send request to background.js
 *     to stop speaking.
 * @param {VideoElement} vid Which video was paused.
 * @return {function} Returns the function as described above.
 */
VideoElement.prototype.pauseListener = function(vid) {
  return function() {
    if (!vid.pausedByExtension) {
      console.log('pause');
      chrome.extension.sendRequest({'stop': true});
    }
  };
};

/**
 * If the user presses play when paused by this extension,
 *     send request to background.js to stop speaking.
 * @param {VideoElement} vid Which video was played.
 * @return {function} Returns the function as described above.
 */
VideoElement.prototype.playListener = function(vid) {
  return function() {
    if (vid.pausedByExtension) {
      console.log('play');
      chrome.extension.sendRequest({'stop': true});
      vid.pausedByExtension = false;
    }
  };
};

/**
 * Listener for seeking to send request to background.js to stop speaking.
 */
VideoElement.prototype.seekingListener = function() {
  console.log('seeking');
  chrome.extension.sendRequest({'stop': true});
};

/**
 * Listens for requests from background.js to 'play' or to alert the user
 *     that there is 'novoice'.
 * @param {VideoElement} vid Which video.
 * @return {function} Returns the function as described above.
 */
VideoElement.prototype.onRequestListener = function(vid) {
  return function(request, sender, sendResponse) {
    if (request['play'] && request['videoId'] == vid.videoId &&
        vid.pausedByExtension) {
      vid.elem.play();
      vid.pausedByExtension = false;
    } else if (request['novoice']) {
      console.log('novoice');
      if (!alertNoVoice) {
        alertNoVoice = true;
        alert('No voice available. ' +
              'Install a text-to-speech voice extension.');
      }
    }
  };
};

/**
 * Cue change function. Looks for active cue and sends request to background.js
 *     to speak the test.
 * @param {VideoElement} vid Which video's cue changed.
 * @return {function} Returns the function as described above.
 */
VideoElement.prototype.cuechange = function(vid) {
  return function() {
    // Here, "this" refers to a textTrack.
    // Only read the first active cue, ignoring all other active cues.
    // (It's possible to have overlapping cues; in this case, we will only
    // read the first one)
    if (this.activeCues.length > 0) {
      var cue = this.activeCues[0];

      cue.onexit = function() {
        chrome.extension.sendRequest(
            {'isSpeaking': true},
            function(response) {
              if (response.isSpeaking) {
                vid.elem.pause();
                vid.pausedByExtension = true;
              }
            }
        );
      };

      chrome.extension.sendRequest(
          {'speak': cue.text, 'videoId': vid.videoId}
      );
    }
  };
};

/**
 * Check if the <track> element is supported.
 * http://modernizr.com/docs/
 * @return {boolean} Returns if track is supported.
 */
var isTrackSupported = function() {
  var video = document.createElement('video');
  return typeof video.addTextTrack === 'function';
};

/**
 * All keyboard commands on window.
 * @param {KeyboardEvent} evt The keydown event.
 */
var documentKeyDown = function(evt) {
  if (evt.keyCode == 18) {
    // keycode for ALT is 18
    documentAltChar = true;
  } else if (evt.keyCode == 17) {
    // keycode for CTRL is 17
    console.log('ctrl');
    chrome.extension.sendRequest({'stop': true});
  }

  if (documentAltChar) {
    if (evt.keyIdentifier == 'Down') {
      chrome.extension.sendRequest(
          {'decreasevolume': true}
      );
    } else if (evt.keyIdentifier == 'Up') {
      chrome.extension.sendRequest(
          {'increasevolume': true}
      );
    } else if (evt.keyCode == 90) {
        // keycode for 'z' is 90
        chrome.extension.sendRequest(
            {'decreaserate': true}
        );
    } else if (evt.keyCode == 67) {
        // keycode for 'c' is 67
        chrome.extension.sendRequest(
            {'increaserate': true}
        );
    } else if (evt.keyCode == 88) {
        // keycode for 'x' is 88
        chrome.extension.sendRequest(
            {'decreasepitch': true}
        );
    } else if (evt.keyCode == 83) {
        // keycode for 's' is 83
        chrome.extension.sendRequest(
            {'increasepitch': true}
        );
    } else if (evt.keyCode == 65) {
        // keycode for 'a' is 65
        chrome.extension.sendRequest(
            {'defaulttts': true}
        );
    } else if (evt.keyCode == 72) {
        // keycode for 'h' is 72
        chrome.extension.sendRequest(
            {'speak': announceTTSCommands}
        );
    }
  }
};

/**
 * Detect alt keyup event.
 * @param {KeyboardEvent} evt The keydown event.
 */
var documentKeyUp = function(evt) {
  if (evt.keyCode == 18) {
    // keycode for ALT is 18
    documentAltChar = false;
  }
};

var videoElementList = document.getElementsByTagName('video');
var videoElems = [];
var j;

// Have we already alerted the user that there is no voice extension?
var alertNoVoice = false;

var languageList;
var announceWithAudioDesc = 'This video has audio descriptions.';
var announceWithoutAudioDesc = 'This video does not have audio descriptions.';
var announceAudioDescOn = 'Audio descriptions are on. ' +
    'To disable them, press alt b .';
var announceAudioDescOff = 'Audio descriptions are off. ' +
    'To enable them, press alt b .';
var announceRepeat = 'To repeat this message, press alt r .';
var announceKeyHelp = 'For text to speech shortcuts, press ' +
    'alt h . ' +
    'For per video keyboard shortcuts, ' +
    'press alt question mark while focused on video.';
var announceKeyCommands = 'List of keyboard commands. ' +
    'These commands are available when the video has focus. ' +
    'For other keyboard help, move focus off video. ' +
    'To repeat this list of commands, press alt question mark. ' +
    'To detect if audio descriptions are on or off, press alt r . ' +
    'To turn audio descriptions on or off, press alt b . ' +
    'To play or pause the video, press space. ' +
    'To fast forward, press the right arrow. ' +
    'To rewind, press the left arrow. ' +
    'To increase volume of video, press the up arrow. ' +
    'To decrease volume of video, press the down arrow.';
var announceTrackNotSupported = 'This video may have audio descriptions but ' +
    'the HTML5 track element has not been enabled. ' +
    'For audio descriptions to work, please go to ' +
    'chrome colon slash slash flags, find the track experiment, ' +
    'enable it, and restart the browser.';
var announceTTSCommands = 'List of text to speech commands. ' +
    'To repeat this list of commands, press alt h . ' +
    'To stop speaking, press control. ' +
    'To set speech defaults, press alt a . ' +
    'To increase speech volume, press alt up arrow. ' +
    'To decrease speech volume, press alt down arrow. ' +
    'To increase speech rate, press alt c . ' +
    'To decrease speech rate, press alt z . ' +
    'To increase speech pitch, press alt s . ' +
    'To decrease speech pitch, press alt x .';
var documentAltChar = false;

for (j = 0; j < videoElementList.length; j++) {
  videoElems[j] = new VideoElement(videoElementList[j], j);
  chrome.extension.onRequest.addListener(
      videoElems[j].onRequestListener(videoElems[j]));
}

// If there are videos, init the track to specified language if possible
if (videoElems.length > 0) {
  chrome.extension.sendRequest(
      {'langList': true},
      function(response) {
        languageList = response.langList;
        console.log('response ' + languageList);
        for (j = 0; j < videoElems.length; j++) {
          videoElems[j].initTrack();
        }
      }
  );
}

document.addEventListener('keydown', documentKeyDown);
document.addEventListener('keyup', documentKeyUp);
