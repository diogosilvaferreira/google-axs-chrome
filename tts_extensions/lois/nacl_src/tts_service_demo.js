var tts_obj = null;
var statusText = 'Loading page...';
var text = document.getElementById('srctext');
var tts_status = document.getElementById('tts_status');
var tts_status_box = document.getElementById('tts_status_box');
var id = 0;

function obj_load() {
  tts_obj = document.getElementById("pluginobj");
  tts_obj.addEventListener('message', handleMessage, false);
  updateStatus('Plugin Loaded.');

  console.log('Post: startService');
  tts_obj.postMessage('startService');
}

function handleMessage(message_event) {
  var data = message_event.data;
  console.log(data);
  if (data == 'error') {
    updateStatus('Error');
    updateStatusColour('#fcc');
  } else if (data == 'busy') {
    updateStatus('Busy');
    updateStatusColour('#fcc');
  } else if (data == 'idle') {
    updateStatus('Idle');
    updateStatusColour('#fff');
  } else if (data.substr(0, 3) == 'end') {
    updateStatus('Idle');
    updateStatusColour('#fff');
  }
}

function updateStatus(message) {
  if(message) {
    statusText = message;
  }
  tts_status.innerHTML = statusText;
}

function updateStatusColour(color) {
  tts_status_box.style.background = color;
}

function load() {
  if (tts_obj == null) {
    updateStatus("Loading plugin...");
  } else {
    updateStatus();
  }
}

function unload() {
  if (tts_obj == null) {
    return;
  }

  console.log('Post: stopService');
  tts_obj.postMessage("stopService");
}

function speak_user_text() {
  speak(text.value);
}

function speak(str) {
  if (tts_obj == null) {
    alert('TTS not initialized');
    return;
  }
  console.log('Post: speak');
  id++;
  tts_obj.postMessage('speak:1:1:1:' + id + ':' + str.replace(/:/g, '\\:'));
}

function stop() {
  if (tts_obj == null) {
    alert('TTS not initialized');
    return;
  }
  console.log('Post: stop');
  tts_obj.postMessage('stop');
}

