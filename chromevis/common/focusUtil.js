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
 * @fileoverview A collection of JavaScript utilities used to manage focus
 * within a document.
 * @author rshearer@google.com (Rachel Shearer)
 */


/**
 * Utilities for managing focus.
 * @constructor
 */
var FocusUtil = function() {
 };

/**
 * Checks if the currently focused element is a field that accepts text input
 * (This can include text fields and selectors)
 *
 * @return {boolean} True if the currently focused element accepts text input.
 */
FocusUtil.isFocusInTextInputField = function() {
    if ((document.activeElement.tagName === 'INPUT') ||
    (document.activeElement.tagName === 'TEXTAREA') ||
    (document.activeElement.tagName === 'SELECT')) {

    if (! document.activeElement.hasAttribute('type')) {
      return true;
    }
    else if ((document.activeElement.getAttribute('type').toLowerCase() ==
              'text') ||
             (document.activeElement.getAttribute('type').toLowerCase() ==
              'password') ||
             (document.activeElement.getAttribute('type').toLowerCase() ==
              'search') ||
             (document.activeElement.getAttribute('type').toLowerCase() ==
              'input')) {
      return true;
    }
  }
  return false;
};
