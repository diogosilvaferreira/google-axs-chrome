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
 * @fileoverview A DOM traversal interface for moving a selection around a
 * webpage. Provides multiple granularities:
 * 1. Move by paragraph.
 * 2. Move by sentence.
 * 3. Move by word.
 * 4. Move by character.
 * @author rshearer@google.com (Rachel Shearer)
 */

/**
 * Moves a selection around a document or within a provided DOM object.
 *
 * @constructor
 * @param {Node} domObj a DOM node (optional).
 */
var TraverseContent = function(domObj){
  if (domObj != null){
    this.currentDomObj = domObj;
  } else {
    this.currentDomObj = document.body;
  }
};


/**
 * Moves selection forward.
 *
 * @param {string} grain specifies "sentence", "word", "character",
 *     or "paragraph" granularity.
 * @return {Selection} Either:
 *                1) The fixed-up selection.
 *                2) null if the end of the domObj has been reached.
 */
TraverseContent.prototype.moveNext = function(grain) {

  var selection = window.getSelection();
  var range;

  if (selection.rangeCount < 1) {
    // Before the user has clicked a freshly-loaded page

    range = document.createRange();
    range.setStart(this.currentDomObj, 0);
    range.setEnd(this.currentDomObj, 0);

    selection.removeAllRanges();
    selection.addRange(range);

  } else if (selection.rangeCount > 1) {
    //  Multiple ranges exist - remove all ranges but the last one
    for (var i = 0; i < (selection.rangeCount - 1); i++) {
      selection.removeRange(selection.getRangeAt(i));
    }
  }

  // Attempt to extend selection forward
  // Keep track of previous focusnode and offset
  var lastSelectionFocusNode = selection.focusNode;
  var lastSelectionFocusNodeOffset = selection.focusOffset;

  selection.collapseToEnd();
  if (grain === 'sentence') {
    selection.modify('extend', 'forward', 'sentence');
  } else if (grain === 'word') {
    selection.modify('extend', 'forward', 'word');
  } else if (grain === 'character') {
    selection.modify('extend', 'forward', 'character');
  } else if (grain === 'paragraph') {
    // Current webkit implementation of selection.modify for paragraph
    // granularity is broken, use sentence instead and modify after
    // extending to include entire paragraph.
    selection.modify('extend', 'forward', 'sentence');
  } else {
    // User has provided an invalid string.
    // Fall through to default: extend by sentence
    console.log('invalid selection granularity!');
    grain = 'sentence';
    selection.modify('extend', 'forward', 'sentence');
  }

  var success = this.forceForward(lastSelectionFocusNode,
                                  lastSelectionFocusNodeOffset, grain);
  if (! success) {
    console.log('return null');
    return null;
  }

  if (! (SelectionUtil.isWithinBound(selection.focusNode,
                                           this.currentDomObj))) {
    // Extended outside of specified domObj, nothing more to be done
    // Return NULL to indicate that we are wrapping to the beginning
    return null;
  }

  if (! SelectionUtil.isSelectionValid(selection)) {
    // Selection invalid, extending past it
    return this.moveNext(grain);
  }

  if (grain === 'sentence') {
    // Clean up the sentence selection by checking if we are ending
    // with a period

    if (! SelectionUtil.cleanUpSentence(selection)) {
      return null;
    }
  } else if (grain === 'paragraph') {
    // Clean up the paragraph selection by checking if we are
    // ending with a line break

    if (! SelectionUtil.cleanUpParagraphForward(selection)) {
      return null;
    }
  }

  return selection;
};


/**
 * Forces a selection range forward manually.
 * This is done when extending the selection through Webkit's build-in methods
 * fails.
 * @param {Node} lastSelectionFocusNode The last focus node before the
 *     selection was moved.
 * @param {number} lastSelectionFocusNodeOffset The last focus node offset
 *     before the selection was moved.
 * @param {string} grain specifies "sentence", "word", "character",
 *     or "paragraph" granularity.
 * @return {boolean} True if the selection has been forced forward.
 *     False if the selection cannot be forced forward i.e. we have reached the
 *     end of the document.
 */
TraverseContent.prototype.forceForward = function(lastSelectionFocusNode,
                                                  lastSelectionFocusNodeOffset,
                                                  grain) {
  var sel = window.getSelection();
  var range = sel.getRangeAt(0);

  var fnode = sel.focusNode;
  var fnodeNext = fnode;

  // If extending the selection has changed nothing, need to manually move
  // selection range forward.
  while ((lastSelectionFocusNode == sel.focusNode) &&
    (lastSelectionFocusNodeOffset == sel.focusOffset)) {

    // Try looking at first child of current focus node
    // If current focus node has no child, look at next sibling
    if (SelectionUtil.firstChildNode(fnodeNext) == null) {
      fnodeNext = SelectionUtil.nodeAfter(fnode);
    } else {
      while (SelectionUtil.firstChildNode(fnodeNext) != null) {
        fnodeNext = SelectionUtil.firstChildNode(fnodeNext);
      }
    }

    // If no children or next sibling, look at parent node
    while (fnodeNext == null) {
      fnode = fnode.parentNode;

      if (fnode != null) {
        fnodeNext = SelectionUtil.nodeAfter(fnode);
      } else {
        // Nothing more to be done, reset
        // Return false to indicate that we are wrapping to the beginning
        return false;
      }
    }

    range = document.createRange();
    range.setStart(fnodeNext, 0);
    range.setEnd(fnodeNext, 0);

    sel.removeAllRanges();
    sel.addRange(range);

    if (grain === 'sentence') {
      sel.modify('extend', 'forward', 'sentence');
    } else if (grain === 'word') {
      sel.modify('extend', 'forward', 'word');
    } else if (grain === 'character') {
      sel.modify('extend', 'forward', 'character');
    } else if (grain === 'paragraph') {
      // Current webkit implementation of selection.modify for paragraph
      // granularity is broken, use sentence instead and modify after
      // extending to include entire paragraph.
      sel.modify('extend', 'forward', 'sentence');
    }

    fnode = fnodeNext;
    fnodeNext = fnode;
  }
  return true;
};


/**
 * Moves selection backward.
 *
 * @param {string} grain specifies "sentence", "word", "character",
 *     or "paragraph" granularity.
 * @return {Selection} Either:
 *                1) The fixed-up selection.
 *                2) null if the beginning of the domObj has been reached.
 */
TraverseContent.prototype.movePrev = function(grain) {

  var selection = window.getSelection();
  var range;

  if (selection.rangeCount < 1) {
    // Before the user has clicked a freshly-loaded page

    // Want to create selection at the end of the current domObj
    var lastBodyNode = this.currentDomObj.lastChild;
    range = document.createRange();
    range.setStartAfter(lastBodyNode);
    range.setEndAfter(lastBodyNode);

    selection.removeAllRanges();
    selection.addRange(range);

  } else if (selection.rangeCount > 1) {
    // Multiple ranges exist - remove all ranges but the first one
    for (var i = 1; i < selection.rangeCount; i++) {
      selection.removeRange(selection.getRangeAt(i));
    }
  }

  // Attempt to extend selection backward
  // Keep track of previous focusnode and offset
  var lastSelectionFocusNode = selection.focusNode;
  var lastSelectionFocusNodeOffset = selection.focusOffset;

  selection.collapseToStart();
  if (grain === 'sentence') {
    selection.modify('extend', 'backward', 'sentence');
  } else if (grain === 'word') {
    selection.modify('extend', 'backward', 'word');
  } else if (grain === 'character') {
    selection.modify('extend', 'backward', 'character');
  } else if (grain === 'paragraph') {
    selection.modify('extend', 'backward', 'sentence');
  } else {
    // User has provided an invalid string.
    // Fall through to default: extend by sentence
    console.log('invalid selection granularity!');
    grain = 'sentence';
    selection.modify('extend', 'backward', 'sentence');
  }

  var success = this.forceBackward(lastSelectionFocusNode,
                                   lastSelectionFocusNodeOffset, grain);
  if (! success) {
    console.log('return null');
    return null;
  }

  if (! (SelectionUtil.isWithinBound(selection.focusNode,
                                           this.currentDomObj))) {
    // Extended outside of specified domObj, nothing more to be done
    // Return NULL to indicate that we are wrapping to the end
    return null;
  }

  var reWhiteSpace = new RegExp(/^\s+$/);
  if (reWhiteSpace.test(selection.toString()) || (selection.toString() == '')) {
    // Selection contains only whitespace or empty string, extend past it
    return this.movePrev(grain);
  }

  if (grain === 'paragraph') {
    // Clean up the paragraph selection by checking if we are ending
    // with a line break
    if (! SelectionUtil.cleanUpParagraphBack(selection)) {
      return null;
    }
  }

  return selection;
};

/**
 * Forces a selection range backward manually.
 * This is done when extending the selection through Webkit's build-in methods
 * fails.
 * @param {Node} lastSelectionFocusNode The last focus node before the
 *     selection was moved.
 * @param {number} lastSelectionFocusNodeOffset The last focus node offset
 *     before the selection was moved.
 * @param {string} grain specifies "sentence", "word", "character",
 *     or "paragraph" granularity.
 * @return {boolean} True if the selection has been forced backward.
 *     False if the selection cannot be forced backward i.e. we have reached
 *     the end of the document.
 */
TraverseContent.prototype.forceBackward = function(lastSelectionFocusNode,
                                                  lastSelectionFocusNodeOffset,
                                                  grain) {
  var sel = window.getSelection();
  var range = sel.getRangeAt(0);

  var fnode = sel.focusNode;
  var fnodePrev = SelectionUtil.nodeBefore(fnode);

  // If extending the selection has changed nothing, need to manually move
  // selection range forward.
  while ((lastSelectionFocusNode == sel.focusNode) &&
    (lastSelectionFocusNodeOffset == sel.focusOffset)) {

    // Try looking at the node before the current focus node
    while ((fnodePrev == null) || (fnodePrev.innerHTML == '')) {

      // If current focus node has no previous sibling, look at parent
      if (fnodePrev == null) {
        fnode = fnode.parentNode;

        // Check to see if we have extended out of the specified domObj
        if (fnode != null) {
          if (fnode.nodeName == this.currentDomObj.nodeName) {
            // Cannot force backward anymore.
            return false;
          }

          fnodePrev = SelectionUtil.nodeBefore(fnode);
        } else {
          // Nothing more to be done, reset
          // Return false to indicate that we are wrapping to the beginning
          return false;
        }
      } else if (fnodePrev.innerHTML == '') {
        // If previous sibling has no content, look at next previous
        // sibling.
        fnodePrev = SelectionUtil.nodeBefore(fnodePrev);

        if (fnodePrev != null) {
          while (SelectionUtil.lastChildNode(fnodePrev) != null) {
            fnodePrev = SelectionUtil.lastChildNode(fnodePrev);
          }
        }
      }
    }

    // fnodePrev is not null now, and has non-blank text content
    // Try looking at last child of fnodePrev
    while (SelectionUtil.lastChildNode(fnodePrev) != null) {
      fnodePrev = SelectionUtil.lastChildNode(fnodePrev);
    }

    range = document.createRange();
    range.setStartAfter(fnodePrev);
    range.setEndAfter(fnodePrev);

    sel.removeAllRanges();
    sel.addRange(range);

    if (grain === 'sentence') {
      sel.modify('extend', 'backward', 'sentence');
    } else if (grain === 'word') {
      sel.modify('extend', 'backward', 'word');
    } else if (grain === 'character') {
      sel.modify('extend', 'backward', 'character');
    } else if (grain === 'paragraph') {
      sel.modify('extend', 'backward', 'sentence');
    }

    fnode = fnodePrev;
    fnodePrev = SelectionUtil.nodeBefore(fnode);

  }
  return true;
};

/**
 * Selects the next element of the document or within the provided DOM object.
 * Scrolls the window as appropriate.
 *
 * @param {string} grain specifies "sentence", "word", "character",
 *     or "paragraph" granularity.
 * @param {Node} domObj a DOM node (optional).
 * @return {Selection} Either:
 *               1) The current selection.
 *               2) null if the end of the domObj has been reached.
 */
TraverseContent.prototype.nextElement = function(grain, domObj) {

  if (domObj != null){
    this.currentDomObj = domObj;
  }

  if (! ((grain === 'sentence') || (grain === 'word') ||
      (grain === 'character') || (grain === 'paragraph'))) {
    // User has provided an invalid string.
    // Fall through to default: extend by sentence
    console.log('invalid selection granularity!');
    grain = 'sentence';
  }

  var status = this.moveNext(grain);
  if (status != null) {
    // Force window to scroll to current selection
    var selection = window.getSelection();
    var nodeInFocus = selection.focusNode;
    var nodeInAnchor = selection.anchorNode;

    SelectionUtil.scrollToSelection(selection);
  }

  return status;
};


/**
 * Selects the previous element of the document or within the provided DOM
 * object. Scrolls the window as appropriate.
 *
 * @param {string} grain specifies "sentence", "word", "character",
 *     or "paragraph" granularity.
 * @param {Node} domObj a DOM node (optional).
 * @return {Selection} Either:
 *               1) The current selection.
 *               2) null if the beginning of the domObj has been reached.
 */
TraverseContent.prototype.prevElement = function(grain, domObj) {

  if (domObj != null) {
    this.currentDomObj = domObj;
  }

  if (! ((grain === 'sentence') || (grain === 'word') ||
      (grain === 'character') || (grain === 'paragraph'))) {
    // User has provided an invalid string.
    // Fall through to default: extend by sentence
    console.log('invalid selection granularity!');
    grain = 'sentence';
  }

  var status = this.movePrev(grain);
  if (status != null) {

    // Force window scroll to current selection
    var selection = window.getSelection();
    var nodeInFocus = selection.focusNode;
    var nodeInAnchor = selection.anchorNode;

    SelectionUtil.scrollToSelection(selection);
  }

  return status;
};


/**
 * Resets the selection.
 *
 * @param {Node} domObj a DOM node.  Optional.
 *
 */
TraverseContent.prototype.reset = function(domObj) {
  window.getSelection().removeAllRanges();
};
