/**
 * @authors Charles L. Chen (clchen@google.com)
 * @fileoverview Helper functions for using the ChromeVox API to enhance the
 * accessibility of the slides.
 */

function cvoxApiExists() {
  return (typeof(cvox) != 'undefined') && cvox && cvox.Api;
}

function speak(text) {
  if (cvoxApiExists()) {
    cvox.Api.speak(text);
  }
}

function cvoxEventsHandler(evt) {
  var command = evt.detail.command;
  // There is only one heading per slide, so if the user tries to go to the
  // next/prev heading, automatically change slides and focus on the title.
  switch (command) {
    case 'nextHeading':
      window.slidedeck.nextSlide();
      speakCurrentSlide(false);
      break;
    case 'previousHeading':
      window.slidedeck.prevSlide();
      speakCurrentSlide(false);
      break;
  }
}

function speakCurrentSlide(speakEntireSlide) {
  var currentSlide = document.getElementsByClassName("current")[0];
  var currentHeading = currentSlide.getElementsByTagName("h1")[0] ||
      currentSlide.getElementsByTagName("h2")[0];
  if (cvoxApiExists()) {
    if (!speakEntireSlide) {
      cvox.Api.syncToNode(currentHeading, true);
    } else {
      var slideText = "";
      for (var i=0, node; node = currentSlide.childNodes[i]; i++) {
        if (!node.className || (node.className && (node.className != 'note'))) {
          var hasAlpha = /\w/.test(node.textContent);
          var nodeText = node.textContent.trim();
          slideText = slideText + nodeText + (hasAlpha ? '.\n' : '');
        }
      }
      cvox.Api.syncToNode(currentHeading, false);
      cvox.Api.speak(slideText);
    }
  }
}

function speakCurrentSlideNotes() {
  var currentSlide = document.getElementsByClassName("current")[0];
  if (cvoxApiExists()) {
    var note = currentSlide.getElementsByClassName('note')[0];
    if (note) {
      cvox.Api.syncToNode(note, false);
      cvox.Api.speak(note.innerText, 0, {'pitch' : 0.7});
    } else {
      cvox.Api.speak('No notes available.', 0, {'pitch' : 0.7});
    }
  }
}

document.addEventListener("cvoxUserEvent", cvoxEventsHandler, true);
