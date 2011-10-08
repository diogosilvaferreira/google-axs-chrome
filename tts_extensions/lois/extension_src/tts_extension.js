var callbackMap = {};
var utteranceId = 0;
var ttsObj = null;

function handleMessage(message_event) {
  var data = message_event.data;
  console.log('Got message: ' + data);
  if (data.substr(0, 4) == 'end:') {
    var id = data.substr(4);
    console.log('Got end event for utterance: ' + id);
    var callback = callbackMap[id];
    if (callback) {
      console.log('Calling callback');
      callback('end');
    }
  } else if (data == 'error') {
    console.log('error');
  }
}

var load = function() {
  console.log('Plug-in is ready, starting TTS service...');
  ttsObj = document.getElementById('pluginobj');
  ttsObj.addEventListener('message', handleMessage, false);
  ttsObj.postMessage('startService');
};

var unload = function() {
  ttsObj.postMessage('stopService');
};

var stopListener = function() {
  console.log('Handling stop');
  delete callbackMap[utteranceId];
  ttsObj.postMessage('stop');
};

var speakListener = function(utterance, options, callback) {
  try {
    console.log('Will speak: "' + utterance + '"');
    stopListener();

    utteranceId++;
    var escapedUtterance = utterance.replace(/:/g, '\\:');
    var rate = options.rate || 1.0;
    var pitch = options.pitch || 1.0;
    var volume = options.volume || 1.0;
    var tokens = ['speak', rate, pitch, volume, utteranceId, escapedUtterance];
    ttsObj.postMessage(tokens.join(':'));
    console.log('Plug-in args are ' + tokens.join(':'));
    callbackMap[utteranceId] = function(type) {
      console.log('Doing callback ' + type + ' for ' + utteranceId);
      var response = {type: type};
      response.charIndex = (type == 'end' ? utterance.length : 0);
      callback(response);
      if (type == 'end' || type == 'interrupted' ||
          type == 'cancelled' || type == 'error') {
        delete callbackMap[utteranceId];
      }
    };
    callback({type: 'start', charIndex: 0});
  } catch (err) {
    console.log('error: ' + err);
    callback({
      type: 'error',
      errorMessage: String(err)
    });
  }
};

chrome.ttsEngine.onSpeak.addListener(speakListener);
chrome.ttsEngine.onStop.addListener(stopListener);
