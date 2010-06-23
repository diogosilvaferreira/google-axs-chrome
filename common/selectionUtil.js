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
 * @fileoverview A collection of JavaScript utilities used to improve selection
 * at different granularities.
 * @author rshearer@google.com (Rachel Shearer)
 */


/**
 * Utilities for improving selection.
 * @constructor
 */
function SelectionUtil() {
}


/**
 * Checks if a given node is a descendant of another given node.
 *
 * @param {Node} nod The candidate descendant.
 * @param {Node} bound The candidate parent.
 * @return {boolean} True if nod is a descendant of bound.
 */
SelectionUtil.isWithinBound = function(nod, bound) {
  var parent = nod;
  while (parent != null) {
    if (parent.isSameNode(bound)) {
      return true;
    } else {
      parent = parent.parentNode;
    }
  }
  return false;
};

/**
 * Cleans up a paragraph selection acquired by extending forward.
 * In this context, a paragraph selection is 'clean' when the focus
 * node (the end of the selection) is not on a text node.
 * @param {Selection} sel The paragraph-length selection.
 * @return {boolean} True if the selection has been cleaned.
 * False if the selection cannot be cleaned without invalid extension.
 */
SelectionUtil.cleanUpParagraphForward = function(sel) {
  var expand = true;

  // nodeType:3 == TEXT_NODE
  while (sel.focusNode.nodeType == 3) {
    // Ending with a text node, which is incorrect. Keep extending forward.
    var fnode = sel.focusNode;
    var foffset = sel.focusOffset;

    sel.modify('extend', 'forward', 'sentence');
    if ((fnode == sel.focusNode) && (foffset == sel.focusOffset)) {
      // Nothing more to be done, cannot extend forward further.
      return false;
    }
  }

  return true;
};

/**
 * Cleans up a paragraph selection acquired by extending backward.
 * In this context, a paragraph selection is 'clean' when the focus
 * node (the end of the selection) is not on a text node.
 * @param {Selection} sel The paragraph-length selection.
 * @return {boolean} True if the selection has been cleaned.
 *     False if the selection cannot be cleaned without invalid extension.
 */
SelectionUtil.cleanUpParagraphBack = function(sel) {
  var expand = true;

  var fnode;
  var foffset;

  // nodeType:3 == TEXT_NODE
  while (sel.focusNode.nodeType == 3) {
    // Ending with a text node, which is incorrect. Keep extending backward.
    fnode = sel.focusNode;
    foffset = sel.focusOffset;

    sel.modify('extend', 'backward', 'sentence');

    if ((fnode == sel.focusNode) && (foffset == sel.focusOffset)) {
      // Nothing more to be done, cannot extend backward further.
      return true;
    }
  }

  return true;
};

/**
 * Cleans up a sentence selection by extending forward.
 * In this context, a sentence selection is 'clean' when the focus
 * node (the end of the selection) is either:
 * - not on a text node
 * - on a text node that ends with a period or a space
 * @param {Selection} sel The sentence-length selection.
 * @return {boolean} True if the selection has been cleaned.
 *     False if the selection cannot be cleaned without invalid extension.
 */
SelectionUtil.cleanUpSentence = function(sel) {
  var expand = true;
  var lastSelection;
  var lastSelectionOffset;

  while (expand) {

    // nodeType:3 == TEXT_NODE
    if (sel.focusNode.nodeType == 3) {
      // The focus node is of type text, check end for period

      var fnode = sel.focusNode;
      var foffset = sel.focusOffset;

      if (sel.getRangeAt(0).endOffset > 0) {
        if (fnode.substringData(sel.getRangeAt(0).endOffset - 1, 1) == '.') {
          // Text node ends with period.
          return true;
        } else if (fnode.substringData(sel.getRangeAt(0).endOffset - 1, 1) ==
                   ' ') {
          // Text node ends with space.
          return true;
        } else {
          // Text node does not end with period or space. Extend forward.
          sel.modify('extend', 'forward', 'sentence');

          if ((fnode == sel.focusNode) && (foffset == sel.focusOffset)) {
            // Nothing more to be done, cannot extend forward any further.
            return false;
          }
        }
      } else {
        return true;
      }
    } else {
      // Focus node is not text node, no further cleaning required.
      return true;
    }
  }

  return true;
};

/**
 * Finds the starting position (height from top and left width) of a
 * selection in a document.
 * @param {Selection} sel The selection.
 * @return {Array} The coordinates [top, left] of the selection.
 */
SelectionUtil.findSelPosition = function(sel) {
  var range = sel.getRangeAt(0);
  var clonedRange = range.cloneRange();

  var startOffset = range.startOffset;
  var startContainer = range.startContainer;

  // Check if the beginning of the range has a position
  // attribute
  if (startContainer.offsetParent) {
    return SelectionUtil.findTopLeftPosition(startContainer);
  }

  // nodeType:3 == TEXT_NODE
  if (startContainer.nodeType == 3) {
    // Beginning of the range is a text node. Non-trivial problem, as
    // text nodes have no position attributes.
    // Solution: insert a span at the beginning of the range
    // Determine the position of the span, then delete.

    var wrappingSpan = window.document.createElement('span');
    wrappingSpan.id = 'insertedSpan';

    // We need to check to make sure that the span isn't inserted
    // at an invisible 'soft break' used by WebKit to figure out
    // where long un-formatted strings wrap. This will result in
    // an incorrect top position calculation.
    // Solution: insert another span at a range one character beyond
    // the original range. Compare the top positions - if the second
    // one is larger (farther down the page), use that one instead.

    var cleanupCheckSpan = false;
    if ((startOffset != 0) &&
      (startOffset < startContainer.textContent.length))
    {
      // Span not inserted at beginning or end of a string, must check
      // for soft break.
      var doubleCheckSpan = window.document.createElement('span');
      doubleCheckSpan.id = 'checkSpan';

      var checkRange = clonedRange.cloneRange();
      checkRange.setStart(startContainer, startOffset + 1);

      // Need to remember to clean up second inserted span later.
      cleanupCheckSpan = true;
    }

    // Inserts a node at the start of a range
    range.insertNode(wrappingSpan);

    if (cleanupCheckSpan)
      checkRange.insertNode(doubleCheckSpan);

    // Ask for the position of the node at the start of the range.
    var pos = SelectionUtil.findTopLeftPosition(wrappingSpan);

    if (cleanupCheckSpan) {
      // Asks for the position of the second inserted node at the
      // (start+1) of the range, as described above.
      var checkPos = SelectionUtil.findTopLeftPosition(doubleCheckSpan);

      if (pos[0] < checkPos[0])
        pos[0] = checkPos[0];
    }

    // Now we have a span inside the range, which we must delete.
    // This span may have split a text node as it was inserted. This split
    // text node must be merged back together.
    // We also have a clonedRange which we can use to ensure the selection
    // is the same.

    sel.removeAllRanges();

    if (startOffset == 0) {
      // no text node was split, no checkedSpan was added
      wrappingSpan.parentNode.removeChild(wrappingSpan);
      sel.addRange(clonedRange);
      return pos;
    } else if (cleanupCheckSpan) {
      // a checkedSpan was added
      var wrappedParent = wrappingSpan.parentNode;
      var checkedParent = doubleCheckSpan.parentNode;

      var wrappedPrevSib = wrappingSpan.previousSibling;
      var checkPrevSib = doubleCheckSpan.previousSibling;

      wrappedParent.removeChild(wrappingSpan);
      checkedParent.removeChild(doubleCheckSpan);

      wrappedParent.normalize();
      checkedParent.normalize();

      var newRange = document.createRange();
      newRange.setEnd(clonedRange.endContainer, clonedRange.endOffset);
      newRange.setStart(wrappedPrevSib, startOffset);
      sel.addRange(newRange);
      return pos;
    } else {
      // no checkedSpan was added but a text node was split
      var wrappedParent = wrappingSpan.parentNode;
      var wrappedPrevSib = wrappingSpan.previousSibling;

      wrappedParent.removeChild(wrappingSpan);

      wrappedParent.normalize();

      var newRange = document.createRange();
      newRange.setEnd(clonedRange.endContainer, clonedRange.endOffset);
      newRange.setStart(wrappedPrevSib, startOffset);
      sel.addRange(newRange);
      return pos;
    }
  }
  // Beginning of the range is not a text node but doesn't have position
  // information -- edge case?
  return null;
};

/**
 * Calculates the horizontal and vertical position of a node
 * @param {Node} targetNode The node.
 * @return {Array} The coordinates [top, left] of the node.
 */
SelectionUtil.findTopLeftPosition = function(targetNode) {
  var left = 0;
  var top = 0;
  var obj = targetNode;

  if (obj.offsetParent) {
    left = obj.offsetLeft;
    top = obj.offsetTop;
    obj = obj.offsetParent;

    while (obj !== null) {
      left += obj.offsetLeft;
      top += obj.offsetTop;
      obj = obj.offsetParent;
    }
  }

  return [top, left];
};


/**
 * Checks the contents of a selection for meaningful content.
 * @param {Selection} sel The selection.
 * @return {boolean} True if the selection is valid.  False if the selection
 *     contains only whitespace or is an empty string.
 */
SelectionUtil.isSelectionValid = function(sel) {
  var regExpWhiteSpace = new RegExp(/^\s+$/);
  return (! ((regExpWhiteSpace.test(sel.toString())) ||
             (sel.toString() == '')));
};


/**
 * Scrolls the selection into view if it is out of view in the current window.
 * Inspired by workaround for already-on-screen elements @
 * http://
 * www.performantdesign.com/2009/08/2/scrollintoview-but-only-if-out-of-view/
 * @param {Selection} sel The selection to be scrolled into view.
 */
SelectionUtil.scrollToSelection = function(sel) {
  var pos = SelectionUtil.findSelPosition(sel);
  var top = pos[0];
  var left = pos[1];

  var scrolledVertically = window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop;
  var pageHeight = window.innerHeight ||
    document.documentElement.clientHeight || document.body.clientHeight;
  var pageWidth = window.innerWidth ||
    document.documentElement.innerWidth || document.body.clientWidth;

  if (left < pageWidth) {
    left = 0;
  }

  // window.scroll puts specified pixel in upper left of window
  if ((scrolledVertically + pageHeight) < top) {
    // Align with bottom of page
    var diff = top - pageHeight;
    window.scroll(left, diff + 100);

  } else if (top < scrolledVertically) {
    // Alignj with top of page
    window.scroll(left, top - 100);
  }

};

/**
 * This is from  https://developer.mozilla.org/en/Whitespace_in_the_DOM
 * Determine whether a node's text content is entirely whitespace.
 *
 * Throughout, whitespace is defined as one of the characters
 *  "\t" TAB \u0009
 *  "\n" LF  \u000A
 *  "\r" CR  \u000D
 *  " "  SPC \u0020
 *
 * This does not use Javascript's "\s" because that includes non-breaking
 * spaces (and also some other characters).
 *
 * @param {Node} node A node implementing the |CharacterData| interface (i.e.,
 *             a |Text|, |Comment|, or |CDATASection| node.
 * @return {boolean} True if all of the text content of |node| is whitespace,
 *             otherwise false.
 */
SelectionUtil.isAllWs = function(node) {
  // Use ECMA-262 Edition 3 String and RegExp features
  return !(/[^\t\n\r ]/.test(node.data));
};


/**
 * This is from  https://developer.mozilla.org/en/Whitespace_in_the_DOM
 * Determine if a node should be ignored by the iterator functions.
 *
 * @param {Node} node  An object implementing the DOM1 |Node| interface.
 * @return {boolean}  True if the node is:
 *                1) A |Text| node that is all whitespace
 *                2) A |Comment| node
 *             and otherwise false.
 */

SelectionUtil.isIgnorable = function(node) {
  return (node.nodeType == 8) || // A comment node
         ((node.nodeType == 3) &&
           SelectionUtil.isAllWs(node)); // a text node, all ws
};

/**
 * This is from  https://developer.mozilla.org/en/Whitespace_in_the_DOM
 * Version of |previousSibling| that skips nodes that are entirely
 * whitespace or comments.  (Normally |previousSibling| is a property
 * of all DOM nodes that gives the sibling node, the node that is
 * a child of the same parent, that occurs immediately before the
 * reference node.)
 *
 * @param {Node} sib  The reference node.
 * @return {Node} Either:
 *               1) The closest previous sibling to |sib| that is not
 *                  ignorable according to |isIgnorable|, or
 *               2) null if no such node exists.
 */
SelectionUtil.nodeBefore = function(sib) {
  while ((sib = sib.previousSibling)) {
    if (!SelectionUtil.isIgnorable(sib)) {
      return sib;
    }
  }
  return null;
};

/**
 * This is from  https://developer.mozilla.org/en/Whitespace_in_the_DOM
 * Version of |nextSibling| that skips nodes that are entirely
 * whitespace or comments.
 *
 * @param {Node} sib  The reference node.
 * @return {Node} Either:
 *               1) The closest next sibling to |sib| that is not
 *                  ignorable according to |isIgnorable|, or
 *               2) null if no such node exists.
 */
SelectionUtil.nodeAfter = function(sib) {
  while ((sib = sib.nextSibling)) {
    if (!SelectionUtil.isIgnorable(sib)) {
      return sib;
    }
  }
  return null;
};

/**
 * This is from  https://developer.mozilla.org/en/Whitespace_in_the_DOM
 * Version of |lastChild| that skips nodes that are entirely
 * whitespace or comments.  (Normally |lastChild| is a property
 * of all DOM nodes that gives the last of the nodes contained
 * directly in the reference node.)
 *
 * @param {Node} par  The reference node.
 * @return {Node} Either:
 *               1) The last child of |sib| that is not
 *                  ignorable according to |isIgnorable|, or
 *               2) null if no such node exists.
 */
SelectionUtil.lastChildNode = function(par) {
  var res = par.lastChild;
  while (res) {
    if (!SelectionUtil.isIgnorable(res)) {
      return res;
    }
    res = res.previousSibling;
  }
  return null;
};

/**
 * This is from  https://developer.mozilla.org/en/Whitespace_in_the_DOM
 * Version of |firstChild| that skips nodes that are entirely
 * whitespace and comments.
 *
 * @param {Node} par  The reference node.
 * @return {Node} Either:
 *               1) The first child of |sib| that is not
 *                  ignorable according to |isIgnorable|, or
 *               2) null if no such node exists.
 */
SelectionUtil.firstChildNode = function(par) {
  var res = par.firstChild;
  while (res) {
    if (!SelectionUtil.isIgnorable(res)) {
      return res;
    }
    res = res.nextSibling;
  }
  return null;
};

/**
 * This is from  https://developer.mozilla.org/en/Whitespace_in_the_DOM
 * Version of |data| that doesn't include whitespace at the beginning
 * and end and normalizes all whitespace to a single space.  (Normally
 * |data| is a property of text nodes that gives the text of the node.)
 *
 * @param {Node} txt  The text node whose data should be returned.
 * @return {string} A string giving the contents of the text node with
 *             whitespace collapsed.
 */
SelectionUtil.dataOf = function(txt) {
  var data = txt.data;
  // Use ECMA-262 Edition 3 String and RegExp features
  data = data.replace(/[\t\n\r ]+/g, ' ');
  if (data.charAt(0) == ' ') {
    data = data.substring(1, data.length);
  }
  if (data.charAt(data.length - 1) == ' ') {
    data = data.substring(0, data.length - 1);
  }
  return data;
};

/**
 * Returns true if the selection has content from at least one node
 * that has the specified tagName.
 *
 * @param {Selection} sel The selection.
 * @param {string} tagName  Tagname that the selection should be checked for.
 * @return {boolean} True if the selection has content from at least one node
 *                   with the specified tagName.
 */
SelectionUtil.hasContentWithTag = function(sel, tagName) {
  if (!sel || !sel.anchorNode || !sel.focusNode) {
    return false;
  }
  if (sel.anchorNode.tagName && (sel.anchorNode.tagName == tagName)) {
    return true;
  }
  if (sel.focusNode.tagName && (sel.focusNode.tagName == tagName)) {
    return true;
  }
  if (sel.anchorNode.parentNode.tagName &&
      (sel.anchorNode.parentNode.tagName == tagName)) {
    return true;
  }
  if (sel.focusNode.parentNode.tagName &&
      (sel.focusNode.parentNode.tagName == tagName)) {
    return true;
  }
  var docFrag = sel.getRangeAt(0).cloneContents();
  var span = document.createElement('span');
  span.appendChild(docFrag);
  return (span.getElementsByTagName(tagName).length > 0);
};

/**
 * Selects text within a text node.
 *
 * Note that the input node MUST be of type TEXT; otherwise, the offset
 * count would not mean # of characters - this is because of the way Range
 * works in JavaScript.
 *
 * @param {Node} textNode The text node to select text within.
 * @param {number} start  The start of the selection.
 * @param {number} end The end of the selection.
 */
SelectionUtil.selectText = function(textNode, start, end) {
  var newRange = document.createRange();
  newRange.setStart(textNode, start);
  newRange.setEnd(textNode, end);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(newRange);
};

/**
 * Selects all the text in a given node.
 *
 * @param {Node} node The target node.
 */
SelectionUtil.prototype.selectAllTextInNode = function(node) {
  var newRange = document.createRange();
  newRange.setStart(node, 0);
  newRange.setEndAfter(node);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(newRange);
};

/**
 * Retrieves all the text within a selection.
 *
 * Note that this can be different than simply using the string from
 * window.getSelection() as this will account for IMG nodes, etc.
 *
 * @return {string} The string of text contained in the current selection.
 */
SelectionUtil.getText = function() {
  var text = '';
  var sel = window.getSelection();
  if (ChromeVox.selectionUtil.hasContentWithTag(sel, 'IMG')) {
    var docFrag = sel.getRangeAt(0).cloneContents();
    var span = document.createElement('span');
    span.appendChild(docFrag);
    var leafNodes = XpathUtil.getLeafNodes(span);
    for (var i = 0, node; node = leafNodes[i]; i++) {
      text = text + ' ' + TextUtil.getText(node);
    }
  } else {
    text = text + sel;
  }
  return text;
};
