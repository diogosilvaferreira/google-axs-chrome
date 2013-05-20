window.setTimeout(function(){
var scriptTag = document.createElement("script");
scriptTag.src = 'mathjax/MathJax.js?config=TeX-AMS-MML_HTMLorMML';
document.getElementsByTagName('head')[0].appendChild(scriptTag);
initMathJax();
},100);

function initMathJax(){
  if (typeof(MathJax) != 'undefined') {
    MathJax.Hub.Config({
      tex2jax: {
        inlineMath: [['$','$'], ['\\(','\\)']],
        processEscapes: true
      }
    });
    MathJax.Hub.Config({
      asciimath2jax: {
      delimiters: [['`','`']]
      }
    });
  } else {
    window.setTimeout(initMathJax, 200);
  }
}

// Manually enable ChromeVox API since they were added in template.html rather
// than injected by ChromeVox itself.
//
// ChromeVox is unable to inject itself into Chrome Apps because of the
// content-security policy which prohibits extensions adding script tags.
//
// TODO (clchen): Come up with a cleaner way for authors to inject/start the
// ChromeVox APIs when they are creating a Chrome App.
//
function initCvoxApi(){
  if ((typeof(cvox) != 'undefined') && (typeof(cvox.Api) != 'undefined')) {
    cvox.Api.internalEnable();
  } else {
    window.setTimeout(initCvoxApi, 200);
  }
}

window.setTimeout(initCvoxApi, 5000);
