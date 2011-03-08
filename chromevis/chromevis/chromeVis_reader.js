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
 * @fileoverview Provides selection navigation and lens visitor functionality.
 * Additional navigation and lens APIs could be added/substituted here.
 * @author rshearer@google.com (Rachel Shearer)
 */


/**
 * Initializes the selection navigation (TraverseContent) and lens
 * (ChromeVisLens)
 * @constructor
 */
var ChromeVisReader = function(){
  this.domUtils = new TraverseContent();
  this.lens = new ChromeVisLens();
};


/**
 * Provides the selection navigation.
 * @return {TraverseContent} The selection navigation.
 */
ChromeVisReader.prototype.getDomUtils = function(){
  return this.domUtils;
};

/**
 * Provides the lens.
 * @return {ChromeVisLens} The lens.
 */
ChromeVisReader.prototype.getLens = function() {
  return this.lens;
};


