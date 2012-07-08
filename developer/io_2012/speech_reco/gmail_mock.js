var messages = [
{
  'date': 'Jun 26',
  'sender': 'Larry Page',
  'subject': 'Here\'s your bonus',
  'body': 'Text goes here',
},
{
  'date': 'Jun 25',
  'sender': 'Sergey Brin',
  'subject': 'Need your help with self-driving car research',
  'body': 'Text goes here',
},
{
  'date': 'Jun 22',
  'sender': 'Eric',
  'subject': 'Want to go for a ride in my plane?',
  'body': 'Text goes here',
}
];
var checked = [false, false, false];
var starred = [false, false, false];

function $(id) {
  return document.getElementById(id);
}

var cur = 0;

function toggleCheck(i) {
  console.log('TOGGLE CHECK ' + i);
  checked[i] = !checked[i];
  var img = $('threadlist').children[i].querySelector('img[name="check"]');
  if (checked[i]) {
    img.src = 'check_on.png';
  } else {
    img.src = 'check_off.png';
  }
}

function toggleStar(i) {
  console.log('TOGGLE STAR ' + i);
  starred[i] = !starred[i];
  var img = $('threadlist').children[i].querySelector('img[name="star"]');
  if (starred[i]) {
    img.src = 'star_on.png';
  } else {
    img.src = 'star_off.png';
  }  
}

function hookUpListBox(container,
                       leftContainer,
                       rightContainer,
                       autoSelect,
                       onSelect) {
  container.tabIndex = -1;
  container.addEventListener('focus', function() {
    for (var j = 0; j < container.children.length; j++) {
      if (container.children[j].tabIndex == 0)
        container.children[j].focus();
    }
  }, false);

  var len = container.children.length;
  var handlers = [];
  for (var i = 0; i < len; i++) {
    var item = container.children[i];
    if (i == 0) {
      item.tabIndex = 0;
      item.classList.add('active');
    } else {
      item.tabIndex = -1;
      item.classList.remove('active');
    }
    console.log('Item ' + i);
    (function(i) {
      var handler = function(evt) {
        if (evt.ctrlKey || evt.altKey)
          return false;
        console.log('LIST BOX HANDLER');
        console.log(document.activeElement);
        console.log(evt.keyCode);
        var handled = false;
        switch(evt.keyCode) {
        case 38: // up
        case 75: // k
          if (i > 0) {
            container.children[i - 1].tabIndex = 0;
            container.children[i - 1].focus();
            container.children[i].tabIndex = -1;
            if (autoSelect) {
              container.children[i - 1].classList.add('active');
              container.children[i].classList.remove('active');
            }
          } else {
            container.children[i].focus();
          }
          handled = true;
          break;
        case 40: // down
        case 74: // j
          if (i < len - 1) {
            container.children[i + 1].tabIndex = 0;
            container.children[i + 1].focus();
            container.children[i].tabIndex = -1;
            if (autoSelect) {
              container.children[i + 1].classList.add('active');
              container.children[i].classList.remove('active');
            }
          } else {
            container.children[i].focus();
          }
          handled = true;
          break;
        case 37: // left
          if (leftContainer) {
            for (var j = 0; j < leftContainer.children.length; j++) {
              if (leftContainer.children[j].tabIndex == 0)
                leftContainer.children[j].focus();
            }
          }
          handled = true;
          break;
        case 39: // right
          if (rightContainer) {
            for (var j = 0; j < rightContainer.children.length; j++) {
              if (rightContainer.children[j].tabIndex == 0)
                rightContainer.children[j].focus();
            }
          }
          handled = true;
          break;
        case 13: // enter
        case 32: // space
          for (var j = 0; j < len; j++)
            container.children[j].classList.remove('active');
          container.children[i].classList.add('active');
          onSelect(i);
          handled = true;
          break;
        case 83: // s
          toggleStar(i);
          handled = true;
          break;
        case 88: // x
          toggleCheck(i);
          handled = true;
          break;
        }
        if (handled) {
          evt.stopPropagation();
          evt.preventDefault();
          return true;
        }
        return false;
      };
      item.addEventListener('keydown', handler, false);
      function handleFocus() {
        for (var j = 0; j < len; j++) {
          container.children[j].classList.remove('active');
          container.children[j].tabIndex = -1;
        }
        container.children[i].classList.add('active');
        container.children[i].tabIndex = 0;        
      }
      item.addEventListener('click', function() {
        handleFocus();
        onSelect(i);
      }, false);
      item.addEventListener('focus', function() {
        handleFocus();
      }, false);
      handlers.push(handler);
    })(i);
  }
  function dispatch(evt) {
    console.log('dispatch');
    for (var i = 0; i < len; i++) {
      if (container.children[i].tabIndex == 0) {
        return handlers[i](evt);
      }
    }
    console.log('  none!');
    return false;
  }
  return dispatch;
}

function load() {
  $('archive').addEventListener('click', function() {
    alert('Archive');
  }, false);


  var threadlist = $('threadlist');
  for (var i = 0; i < messages.length; i++) {
    var tr = document.createElement('tr');
    tr.setAttribute('role', 'option');
    var title =
      (i + 1) + ', ' +
      (checked[i] ? 'checked ' : '') +
      (starred[i] ? 'starred ' : '') +
      messages[i].sender + ', ' +
      'subject ' + messages[i].subject + ', ' +
      'sent ' + messages[i].date + '. ' +
      'Press X to check, S to star, Enter to open';
    tr.setAttribute('aria-label', title);
    if (i == 0)
      tr.className = 'unread';
    threadlist.appendChild(tr);

    var td = document.createElement('td');
    td.setAttribute('width', '34px');
    td.innerHTML = '<img name="check" src="check_off.png" alt="">';
    tr.appendChild(td);
    (function(i) {
      td.addEventListener('click', function(evt) {
        toggleCheck(i);
        evt.stopPropagation();
        evt.preventDefault();
        return true;
      });
    })(i);

    td = document.createElement('td');
    td.setAttribute('width', '24px');
    td.innerHTML = '<img name="star" src="star_off.png" alt="">';
    tr.appendChild(td);
    (function(i) {
      td.addEventListener('click', function(evt) {
        toggleStar(i);
        evt.stopPropagation();
        evt.preventDefault();
        return true;
      });
    })(i);

    td = document.createElement('td');
    td.setAttribute('width', '24px');
    td.innerHTML = '<img src="important_off.png" alt="">';
    tr.appendChild(td);

    td = document.createElement('td');
    td.setAttribute('width', '180px');
    td.innerHTML = messages[i].sender;
    tr.appendChild(td);

    td = document.createElement('td');
    td.innerHTML = messages[i].subject;
    tr.appendChild(td);

    td = document.createElement('td');
    td.setAttribute('width', '68px');
    td.innerHTML = messages[i].date;
    tr.appendChild(td);
  }

  function onSelectMessage(i) {
    cur = i;
    $('threadlist_wrapper').style.display = 'none';
    $('thread_wrapper').style.display = 'block';
    $('sender').innerHTML = messages[i].sender;
    $('sender2').innerHTML = messages[i].sender;
    $('sender3').innerHTML = messages[i].sender;
    $('date').innerHTML = messages[i].date;
    $('body').innerHTML = messages[i].body;
    $('subject').innerHTML = messages[i].subject;
    $('subject').setAttribute(
        'aria-label',
        (cur + 1) + ' of 42, ' + messages[i].subject);

    $('description1').innerHTML = 'Message 1 from ' + messages[cur].sender;
    $('description2').innerHTML = 'Message 2 from me';

    document.activeElement.blur();
    window.setTimeout(function() {
      $('message1').focus();
    }, 1);
  }

  function onSelectMailbox() {
    $('thread_wrapper').style.display = 'none';
    $('threadlist_wrapper').style.display = 'block';
    for (var j = 0; j < threadlist.children.length; j++) {
      if (threadlist.children[j].tabIndex == 0)
        threadlist.children[j].focus();
    }
  }

  var mailboxes = $('mailboxes');
  var chatcontacts = $('chatcontacts');

  var dispatchToThreadList = hookUpListBox(
      threadlist, mailboxes, null, true, onSelectMessage);
  hookUpListBox(mailboxes, null, threadlist, false, onSelectMailbox);
  hookUpListBox(chatcontacts, null, threadlist, false);

  $('search_button').addEventListener('click', function(evt) {
    onSelectMailbox();
    evt.stopPropagation();
    evt.preventDefault();
    return true;
  }, false);

  $('search_button').addEventListener('keydown', function(evt) {
    if (evt.keyCode == 13) {
      onSelectMailbox();
      evt.stopPropagation();
      evt.preventDefault();
      return true;
    }
    return false;
  }, false);

  $('search_text').addEventListener('keydown', function(evt) {
    if (evt.keyCode == 13) {
      onSelectMailbox();
      evt.stopPropagation();
      evt.preventDefault();
      return true;
    }
    return false;
  }, false);

  document.addEventListener('keydown', function(evt) {
    if (evt.ctrlKey)
      return false;
    if (evt.target.constructor == HTMLInputElement)
      return false;

    var handled = false;
    switch(evt.keyCode) {
      case 85: // u
        onSelectMailbox();
        $('thread_wrapper').style.display = 'none';
        $('threadlist_wrapper').style.display = 'block';       
        handled = true;
        break;
      case 191: // '/' (forward-slash)
        $('search_text').focus();
        handled = true;
        break;
    }
    if (handled) {
      evt.stopPropagation();
      evt.preventDefault();
      return true;
    }

    if ($('threadlist_wrapper').style.display != 'none') {
      return dispatchToThreadList(evt);
    } else {
      handled = false;
      switch(evt.keyCode) {
        case 38: // up
        case 80: // p
          if (document.activeElement == $('message2')) {
            $('message1').focus();
          }
          handled = true;
          break;

        case 40: // down
        case 78: // n
          if (document.activeElement == $('message1')) {
            $('message2').focus();
          }
          handled = true;
          break;

        case 75: // k
          if (cur > 0) {
            onSelectMessage(cur - 1);
          }
          handled = true;
          break;
        case 74: // j
          if (cur < messages.length - 1) {
            onSelectMessage(cur + 1);
          }
          handled = true;
          break;

      }
      if (handled) {
        evt.stopPropagation();
        evt.preventDefault();
        return true;
      }
    }
    return false;
  });

  $('threadlist').focus();
}
