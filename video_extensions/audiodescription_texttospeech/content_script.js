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
  // Set the @tabindex=0 so that it can be the activeElement
  this.videoId = num;
  this.elem.setAttribute('tabindex', 0);

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
  this.trackList = this.elem.textTracks;
  var i, j;

  // If the track experiment is not enabled, announce and return
  if (!this.trackList) {
    chrome.extension.sendRequest(
        {'speak': announceTrackNotSupported}
    );
    return;
  }

  // Associative array for language that user wants
  // key = language, value = true
  var userLang = {};
  for (j = 0; j < languageList.length; j++) {
    userLang[languageList[j]] = true;
  }

  // Select appropriate track, in order of preference:
  // 1. @default
  // 2. match language
  // 3. just select the first one
  for (i = 0; i < this.trackList.length; i++) {
    if (this.trackList[i].kind == 'descriptions') {

      // 3. Select the first desc track if no other match
      if (!this.descTrack) {
        this.descTrack = this.trackList[i];
      }

      // 1. Select <track> if @default, and break
      if (this.trackList[i].defaultSelected) {
        this.descTrack = this.trackList[i];
          break;
      }

      // 2. Select <track> if language match, and break
      if (userLang[this.trackList[i].language]) {
        this.descTrack = this.trackList[i];
        break;
      }
    }
  }

  // Activate description track, if there is one
  if (this.descTrack) {
    this.descTrack.mode = TextTrack.HIDDEN;
    this.descTrack.oncuechange = this.cuechange(this);

    // Add documentation announcement on focus of video
    // that this video has audio descriptions
    this.elem.onfocus = this.onFocus(this);
  }
};

/**
 * Onfocus on of video element, speak documentation.
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
    } else if (evt.keyCode == 82 &&
               (vid.descTrack || !isTrackSupported())) {
      // keycode for 'r' is 82
      // repeat documentation announcement,
      // if audio description exists
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
  } else {
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
var announceAudioDescOn = 'Audio descriptions are on. ' +
    'To disable them, press alt b .';
var announceAudioDescOff = 'Audio descriptions are off. ' +
    'To enable them, press alt b .';
var announceRepeat = 'To repeat this message, press alt r .';
var announceKeyHelp = 'For text to speech shortcuts, press ' +
    'alt h. ' +
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
var announceTrackNotSupported = 'This video has audio descriptions but ' +
    'the HTML5 track element has not been enabled. ' +
    'For audio descriptions to work, please go to ' +
    'chrome colon slash slash flags to enable the track experiment.';
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
