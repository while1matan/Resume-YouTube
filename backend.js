var new_script = document.createElement('script');
new_script.src = chrome.extension.getURL('frontend.js');
document.body.appendChild(new_script);