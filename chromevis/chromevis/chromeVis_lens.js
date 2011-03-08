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
 * @fileoverview Creates a CSS lens for displaying magnified text.
 * @author rshearer@google.com (Rachel Shearer)
 */


/**
 * Constructor for CSS lens. Initializes the lens settings.
 * @constructor
 */
var ChromeVisLens = function() {
  this.initializeLens();
};

/**
 * The name of the special div that contains settings specified by the
 * background page
 */
ChromeVisLens.elID = 'chromeVisBackground2LensDiv';

/** The name of the attribute specifying whether the lens is centered */
ChromeVisLens.centerAttrb = 'data-isCentered';

/** The name of the attribute specifying the lens magnification */
ChromeVisLens.multAttrb = 'data-textMag';

/** The name of the attribute specifying the lens text color */
ChromeVisLens.txtColorAttrb = 'data-textColor';

/** The name of the attribute specifying the lens background color */
ChromeVisLens.bgColorAttrb = 'data-bgColor';

/** The name of the attribute specifying whether the lens is anchored */
ChromeVisLens.anchorAttrb = 'data-isAnchored';

/**
 * The current amount of padding (in pixels) between the text and the sides of
 * the lens
 */
ChromeVisLens.padding = 5;

/** The maximum width of the bubble lens (in pixels) */
ChromeVisLens.maxBubbleWidth = 700;

/** The minimum width of the bubble lens (in pixels) */
ChromeVisLens.minBubbleWidth = 25;

/** Whether or not the lens is currently displayed */
ChromeVisLens.isLensDisplayed = false;

/** Whether or not the lens is currently centered */
ChromeVisLens.isCentered = true;

/** The current magnification multiplier */
ChromeVisLens.multiplier = 1.5;

/** The active document */
ChromeVisLens.activeDoc = window.document;

/** The ChromeVis lens object */
ChromeVisLens.lens = ChromeVisLens.activeDoc.createElement('span');



/**
 * Initializes the ChromeVis lens with settings pulled from background page.
 */
ChromeVisLens.prototype.initializeLens = function() {

  this.initializeLensCSS();

  ChromeVisLens.lens.style.display = 'none';
  ChromeVisLens.activeDoc.body.appendChild(ChromeVisLens.lens);

  this.setupBackgroundToLensBridge();

  // Initialize lens settings
  var centerData =
      document.getElementById(ChromeVisLens.elID).
                              getAttribute(ChromeVisLens.centerAttrb);
  var multData =
      document.getElementById(ChromeVisLens.elID).
                              getAttribute(ChromeVisLens.multAttrb);
  var textColorData =
      document.getElementById(ChromeVisLens.elID).
                              getAttribute(ChromeVisLens.txtColorAttrb);
  var bgColorData =
      document.getElementById(ChromeVisLens.elID).
                              getAttribute(ChromeVisLens.bgColorAttrb);
  var anchorData =
      document.getElementById(ChromeVisLens.elID).
                              getAttribute(ChromeVisLens.anchorAttrb);

  if (centerData != null) {
    if (centerData == 'true') {
      ChromeVisLens.isCentered = true;
    } else if (centerData == 'false') {
      ChromeVisLens.isCentered = false;
    }
  } else {
    // no center data yet, do nothing
  }

  if (multData != null) {
    ChromeVisLens.multiplier = multData;
   } else {
    // no multiplier data yet, do nothing
  }

  if (textColorData != null) {
    ChromeVisLens.textColor = textColorData;
  } else {
    // no text color data yet, do nothing
  }

  if (bgColorData != null) {
    ChromeVisLens.bgColor = bgColorData;
  } else {
    // no background color data yet, do nothing
  }

  if (anchorData != null) {
    if (anchorData == 'true') {
      ChromeVisLens.isAnchored = true;
    } else if (anchorData == 'false') {
      ChromeVisLens.isAnchored = false;
     }
  }
    this.updateAnchorLens();

 };

/**
 * Listens for an event fired from the extension that indicates the background
 * page is requesting the lens to update. This event was dispatched to a known
 * div in the shared DOM (chromeVisBackground2LensDiv) and the div has
 * attributes known to the lens that contain lens setting information. The
 * lens reads information from the div and then updates appropriately.
 */
ChromeVisLens.prototype.setupBackgroundToLensBridge = function() {
  var hiddenDiv = document.getElementById('chromeVisBackground2LensDiv');

  if (! hiddenDiv) {
    hiddenDiv = document.createElement('div');
    hiddenDiv.id = ChromeVisLens.elID;
    hiddenDiv.style.display = 'none';
    document.body.appendChild(hiddenDiv);
  }

  hiddenDiv.addEventListener('chromeVisAnchorLensEvent', function() {
    var anchorData =
        document.getElementById(ChromeVisLens.elID).
                                getAttribute(ChromeVisLens.anchorAttrb);
    if (anchorData == 'true') {
      ChromeVisLens.prototype.setAnchoredLens(true);
    } else if (anchorData == 'false') {
      ChromeVisLens.prototype.setAnchoredLens(false);
    }
    ChromeVisLens.isAnchored ? ChromeVisLens.prototype.updateAnchorLens() :
                               ChromeVisLens.prototype.updateBubbleLens();
  }, false);

  hiddenDiv.addEventListener('chromeVisCenterLensEvent', function() {
    var centerData =
        document.getElementById(ChromeVisLens.elID).
                                getAttribute(ChromeVisLens.centerAttrb);
    if (centerData == 'true') {
      ChromeVisLens.isCentered = true;
    } else if (centerData == 'false') {
      ChromeVisLens.isCentered = false;
    }
    if (! ChromeVisLens.isAnchored) {
      ChromeVisLens.prototype.updateBubbleLens();
    }
  }, false);

  hiddenDiv.addEventListener('chromeVisMagEvent', function() {
    var multData =
        document.getElementById(ChromeVisLens.elID).
                                getAttribute(ChromeVisLens.multAttrb);
    if (multData != null) {
      ChromeVisLens.multiplier = multData;
      ChromeVisLens.prototype.setMagnification();
      // Must update position of lens after text size has changed
      ChromeVisLens.isAnchored ? ChromeVisLens.prototype.updateAnchorLens() :
                                 ChromeVisLens.prototype.updateBubbleLens();
    }
  }, false);

  hiddenDiv.addEventListener('chromeVisTextColorEvent', function() {
    var textColorData =
        document.getElementById(ChromeVisLens.elID).
                                getAttribute(ChromeVisLens.txtColorAttrb);
    if (textColorData != null) {
      ChromeVisLens.textColor = textColorData;
      ChromeVisLens.prototype.setTextColor();
    }
  }, false);

  hiddenDiv.addEventListener('chromeVisBgColorEvent', function() {
    var bgColorData =
        document.getElementById(ChromeVisLens.elID).
                                getAttribute(ChromeVisLens.bgColorAttrb);
    if (bgColorData != null) {
      ChromeVisLens.bgColor = bgColorData;
      ChromeVisLens.prototype.setBgColor();
    }
  }, false);
};

/**
 * Displays or hides the lens.
 * @param {boolean} show Whether or not the lens should be shown.
 */
ChromeVisLens.prototype.showLens = function(show) {
  show ? ChromeVisLens.lens.style.display = 'block' :
         ChromeVisLens.lens.style.display = 'none';

  ChromeVisLens.isLensDisplayed = show;

  ChromeVisLens.isLensDisplayed ? this.updateText():
                                  document.body.style.marginTop = 0;
};

/**
 * Returns the lens. The lens is a span node in the page DOM that contains
 * magnified text.
 * @return {Node} The lens node.
 */
ChromeVisLens.prototype.getTheLens = function() {
  return ChromeVisLens.lens;
};

/**
 * Initializes the lens CSS.
 */
ChromeVisLens.prototype.initializeLensCSS = function() {
  ChromeVisLens.lens.style.backgroundColor = ChromeVisLens.bgColor;

  // Style settings
  ChromeVisLens.lens.style.borderColor = '#000000';
  ChromeVisLens.lens.style.borderWidth = 'medium';
  ChromeVisLens.lens.style.borderStyle = 'groove';

  ChromeVisLens.lens.style.position = 'absolute';

  // Note: there is no specified maximum value for the zIndex.
  // Occasionally there will be a website that has an element with a zIndex
  // higher than this one.  The only fix is to manually go here and increase
  // the zIndex.
  ChromeVisLens.lens.style.zIndex = 100000000000;

  ChromeVisLens.lens.style.minHeight = 5 + 'px';

  ChromeVisLens.lens.style.webkitBorderRadius = '7px';
};


/**
 * Sets whether the lens is anchored to the top of the page or whether it floats
 * near the selected text.
 * @param {boolean} anchored Whether or not the lens is anchored.
 */
ChromeVisLens.prototype.setAnchoredLens = function(anchored) {
  ChromeVisLens.isAnchored = anchored;
  if ((ChromeVisLens.isLensDisplayed) && (! ChromeVisLens.isAnchored)) {
      document.body.style.marginTop = 0;
  }
};


/**
 * Refreshes the position of the anchor lens on the page. This is usually done
 * in response to scrolling or a window resize.
 */
ChromeVisLens.prototype.updateAnchorLens = function() {

  ChromeVisLens.lens.style.top = window.scrollY + 'px';
  ChromeVisLens.lens.style.minWidth = (window.innerWidth - 50) + 'px';
  ChromeVisLens.lens.style.maxWidth = (window.innerWidth - 50) + 'px';

  ChromeVisLens.lens.style.left = 10 + 'px';
  ChromeVisLens.lens.style.right = 100 + 'px';

  // Push rest of document down underneath anchor lens.
  // Does not work  with documents that have absolutely positioned
  // elements - because absolutely positioned element margins
  // never collapse with global  margins.

  var bod = document.body;
  // need to add 10 to the computed style to take into account the margin
  var str_ht = window.getComputedStyle(ChromeVisLens.lens, null).height;
  var ht = parseInt(str_ht.substr(0, str_ht.length - 2)) + 20;
  bod.style.marginTop = ht + 'px';
};


/**
 * Refreshes the position of the bubble lens on the page.  This is done in
 * response to the selection changing or the window resizing.
 */
ChromeVisLens.prototype.updateBubbleLens = function() {
  var sel = window.getSelection();
  var pos = SelectionUtil.findSelPosition(sel);

  var top;
  var left;
  if (pos == null) {
    top = 0;
    left = 0;
  }
  top = pos[0];
  left = pos[1];

  ChromeVisLens.lens.style.minWidth = 0;

  // Calculate maximum lens width
  var parent;
  var maxw;
  if (ChromeVisLens.isCentered) {
    // Want width with lens centered in the parent element
    // So maxwidth is width of parent
    parent = sel.getRangeAt(0).commonAncestorContainer;
    while (! parent.offsetWidth) {
      parent = parent.parentNode;
    }
    maxw = Math.min(ChromeVisLens.maxBubbleWidth, parent.offsetWidth);
  } else {
    // Align the left edge of the lens with the left edge of the selection
    // So find maxwidth with left edge aligned
    maxw = Math.min(ChromeVisLens.maxBubbleWidth,
                                   ((document.body.clientWidth - left) - 16));
  }

  ChromeVisLens.lens.style.maxWidth = maxw + 'px';
  // Now calculate lens left position
  // First check if actual width is larger than maxWidth
  if (ChromeVisLens.lens.firstChild.scrollWidth > maxw) {
    var shiftLeft = ChromeVisLens.lens.firstChild.scrollWidth - maxw;

    ChromeVisLens.lens.style.maxWidth = ChromeVisLens.lens.firstChild.
                                                           scrollWidth + 'px';
    ChromeVisLens.lens.style.left = (left - shiftLeft) + 'px';
  } else {
    if (ChromeVisLens.isCentered) {
      // Center the lens in the parent element
      var pleft = 0;
      var obj = parent;

      if (obj.offsetParent) {
        pleft = obj.offsetLeft;
        obj = obj.offsetParent;
        while (obj !== null) {
          pleft += obj.offsetLeft;
          obj = obj.offsetParent;
        }
      }

      ChromeVisLens.lens.style.left =
               Math.ceil((pleft + (parent.offsetWidth / 2)) -
                         (ChromeVisLens.lens.firstChild.scrollWidth / 2)) +
                         'px';
    } else {
      // Align the left edge of the lens with the left edge of the selection
      ChromeVisLens.lens.style.left = left + 'px';
    }
  }
  ChromeVisLens.lens.style.right = 'auto';

  // Calculate lens height and top position
  var str_ht = window.getComputedStyle(ChromeVisLens.lens, null).height;
  var ht = parseInt(str_ht.substr(0, str_ht.length - 2)) + 20;

  var actualTop = top - ht;
  if (actualTop < 0) {
    ChromeVisLens.lens.style.top = 5 + 'px';
  } else {
    ChromeVisLens.lens.style.top = actualTop + 'px';
  }

};

/**
 * Update the text displayed inside the lens.  This is done in response to the
 * selection changing.
 */
ChromeVisLens.prototype.updateText = function() {
  if (ChromeVisLens.isLensDisplayed) {

    // Need to replace current lens node due to Webkit caching some
    // display settings between lens changes.
    ChromeVisLens.activeDoc = window.document;
    ChromeVisLens.activeDoc.body.removeChild(ChromeVisLens.lens);
    ChromeVisLens.lens = ChromeVisLens.activeDoc.createElement('span');

    this.initializeLensCSS();

    ChromeVisLens.activeDoc.body.appendChild(ChromeVisLens.lens);

    var sel = window.getSelection();
    var selectedText = sel.toString();

    if ((sel.rangeCount != 0) && (selectedText != null)) {

      while (ChromeVisLens.lens.firstChild) {
        ChromeVisLens.lens.removeChild(ChromeVisLens.lens.firstChild);
      }

      var clonedNode = document.createElement('div');

      // To preserve new lines in selected text, need to create child div nodes
      // of the new element.
      // This also guards against selected text that includes HTML tags.
      var newSelectedText = '';
      var childNode = document.createElement('div');

      for (var i = 0; i < selectedText.length; i++) {
        if ((selectedText.charCodeAt(i) == 10)) {
          childNode.textContent = newSelectedText;
          clonedNode.appendChild(childNode);
          childNode = document.createElement('div');
          newSelectedText = '';
        } else
          newSelectedText = newSelectedText + selectedText.charAt(i);
      }
      childNode.textContent = newSelectedText;
      clonedNode.appendChild(childNode);

      // Style settings
      clonedNode.style.fontFamily = 'Verdana, Arial, Helvetica, sans-serif';
      clonedNode.style.fontWeight = 'normal';
      clonedNode.style.fontStyle = 'normal';
      clonedNode.style.color = ChromeVisLens.textColor;
      clonedNode.style.textDecoration = 'none';
      clonedNode.style.textAlign = 'left';
      clonedNode.style.lineHeight = 1.2;

      ChromeVisLens.lens.appendChild(clonedNode);

      this.magnifyText();
      this.padText();
      ChromeVisLens.isAnchored ? this.updateAnchorLens() :
                                 this.updateBubbleLens();
    }
  }
};

/**
 * Updates the lens in response to a window resize.
 */
ChromeVisLens.prototype.updateResized = function() {
  ChromeVisLens.isAnchored ? this.updateAnchorLens() :
                             this.updateBubbleLens();
};

/**
 * Updates the lens in response to the document being scrolled;
 */
ChromeVisLens.prototype.updateScrolled = function() {
  if (ChromeVisLens.isAnchored) {
    this.updateAnchorLens();

    if (ChromeVisLens.isLensDisplayed) {
      // Force redraw to counteract scroll acceleration problem
      // Workaround: hide lens, check offsetHeight, display lens
      // this forces a redraw
      // TODO: file Chrome bug, get rid of this
      ChromeVisLens.lens.style.display = 'none';
      var redrawFix = ChromeVisLens.lens.offsetHeight;
      ChromeVisLens.lens.style.display = 'block';
    }
  }

};

/**
 * Adjusts the text magnification.
 */
ChromeVisLens.prototype.magnifyText = function() {

  var adjustment = (ChromeVisLens.multiplier * 100) + '%';

  if (ChromeVisLens.lens.firstChild) {
    if (ChromeVisLens.lens.firstChild.hasChildNodes()) {
      var children = ChromeVisLens.lens.firstChild.childNodes;

      for (var i = 0; i < children.length; i++) {
        children[i].style.fontSize = adjustment;
      }
    }
  }

};

/**
 * Adjusts the padding around the text inside the lens.
 */
ChromeVisLens.prototype.padText = function() {
  if (ChromeVisLens.padding < 0){
    return;
  }
    ChromeVisLens.lens.style.padding = ChromeVisLens.padding + 'px';
};

/**
 * Sets the text magnification multiplier.
 */
ChromeVisLens.prototype.setMagnification = function() {
  this.magnifyText();
  this.padText();
};

/**
 * Returns the current text size multiplier for magnification.
 * @return {number} The current text size multiplier.
 */
ChromeVisLens.prototype.getMagnification = function() {
  return ChromeVisLens.multiplier;
};

/**
 * Returns the current background color.
 * @return {string} The lens background color.
 */
ChromeVisLens.prototype.getBgColor = function() {
  return ChromeVisLens.bgColor;
};

/**
 * Updates the lens background color.
 */
ChromeVisLens.prototype.setBgColor = function() {
  ChromeVisLens.lens.style.backgroundColor = ChromeVisLens.bgColor;
};

/**
 * Returns the current text color.
 * @return {string} The lens text color.
 */
ChromeVisLens.prototype.getTextColor = function() {
  return ChromeVisLens.textColor;
};

/**
 * Updates the lens text color.
 */
ChromeVisLens.prototype.setTextColor = function() {
  if (ChromeVisLens.lens.firstChild){
      ChromeVisLens.lens.firstChild.style.color = ChromeVisLens.textColor;
  }
};

