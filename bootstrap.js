const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/osfile.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

var sss;
var ios;
var fileName;
var cssfile;
var filtersfile;
var installPath;

function init(installPath) {
  let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
  let alias = Services.io.newFileURI(installPath);
  if (!installPath.isDirectory())
     alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
  resource.setSubstitution("bigtheme", alias);

  tempScope = {};
  Cu.import("resource://gre/modules/LightweightThemeManager.jsm", tempScope);
  lwt = tempScope.LightweightThemeManager;

  sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

  fileName = "fancyTheme.css";
  cssfile = new FileUtils.File(installPath.path); cssfile.append(fileName);
  filtersfile = new FileUtils.File(installPath.path); filtersfile.append("filters.svg");
}

function getDefaultHeight(toolbox) {
    var h = 0;

    var disablechrome = false;
    if (toolbox.ownerDocument.documentElement.hasAttribute("disablechrome")) {
        toolbox.ownerDocument.documentElement.removeAttribute("disablechrome");
        disablechrome = true;
    }

    var rect = toolbox.getBoundingClientRect();
    h = rect.height + rect.top;

    if (disablechrome) {
        toolbox.ownerDocument.documentElement.setAttribute("disablechrome", true);
    }

    return h;
}

function getDataUrl(win, imgUri, callback) {
  var img = new win.Image();
  img.onload = function() {
    var canvas = win.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    callback(canvas.toDataURL("image/png", ""));
  }

  if (imgUri.spec.startsWith("http://")) {
    callback(imgUri);
    return;
  }

  img.src = imgUri.spec;
}

function getCSS(window, data, callback) {
  window.console.log("get css");
  var lwtfile = FileUtils.getFile("ProfD", ['lightweighttheme-header']);
  var uri = ios.newFileURI(lwtfile);
  if (data) {
    uri = ios.newURI(data.headerURL, null, null);
  }

  var tempScope = {}
  var caUri = Services.io.newFileURI(installPath);
  console.log("Import", caUri.spec);
  Cu.import(caUri.spec, tempScope);
  var ca = new tempScope.ColorAnalyzer();
  ca.findRepresentativeColor(uri, {
    onComplete: function(success, aColor, width, height) {
        writeData(data, success, aColor, window, uri, callback)
    }
  });
}

function writeData(data, success, aColor, window, uri, callback) {
    data = data || lwt.currentTheme;
    if (!success) {
        if (data.accentcolor)
            aColor = parseInt(data.accentcolor.substring(1), 16);
    }

    let r = (aColor & 0xff0000) >> 16;
    let g = (aColor & 0x00ff00) >> 8;
    let b = (aColor & 0x0000ff);

    var toolbox = window.document.getElementById("navigator-toolbox");
    var height = getDefaultHeight(toolbox);
    var height2 = getDefaultHeight(window.document.getElementById("titlebar"));
    getDataUrl(window, uri, function(data) {
        window.console.log("Colors: " + JSON.stringify(lwt.currentTheme));

        var bg = 'linear-gradient(rgba(' + r + ',' + g + ',' + b + ',0), ' +
                               'rgba(' + r + ',' + g + ',' + b + ',1) ' + (175 - height) + 'px, ' +
                               'rgba(' + Math.round(r*0.75) + ',' + Math.round(g*0.75) + ',' + Math.round(b*0.75) + ',1)),\n' +
          '      url("' + data + '")';
        var bg2 = 'linear-gradient(rgba(' + r + ',' + g + ',' + b + ',0), ' +
                                'rgba(' + r + ',' + g + ',' + b + ',1) ' + (250 - height2) + 'px, ' +
                                'rgba(' + Math.round(r*0.75) + ',' + Math.round(g*0.75) + ',' + Math.round(b*0.75) + ',1)),\n' +
          '      url("' + data + '")';
        var css = '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n' +
          '@namespace html url(http://www.w3.org/1999/xhtml);\n' +

          '#tab-view-deck,\n' +
          '#browser-panel,\n' + 
          '#main-window[customization-lwtheme]:-moz-lwtheme {\n' +
          '  background-position: top right !important;\n' +
          '  background-repeat: repeat !important;\n' +
          '  background-image: ' + bg + ' !important;\n' +
          '  background-attachment: fixed !important;\n' +
          '}\n' +

          '@-moz-document regexp("^file.*\/$") {\n' +
          'html|html {\n' +
          '  background-image: ' + bg + ' !important;\n' +
          '  background-position: top right, right -' + height + 'px;\n' +
          '  background-repeat: no-repeat;\n' +
          '  background-attachment: fixed;\n' +
          '  min-height: 100%;\n' +
          '}\n' +
          'html|body {\n' +
          '  background-color: rgba(255,255,255,0.75) !important;\n' +
          '  box-shadow: 0px 3px 10px rgba(0,0,0,0.25) !important;\n' +
          '}\n' +
          '}\n' +

          '@-moz-document url("about:addons"), \n' +
          '               url("about:newtab"), \n' +
          '               url-prefix("about:debugging"), \n' +
          '               url-prefix("about:preferences"), \n' +
          '               url-prefix("about:profiles"), \n' +
          '               url-prefix("about:networking"), \n' +
          '               url("about:permissions"), \n' +
          '               url("about:home") {\n' +
          '#addons-page,\n' +
          'html|body,\n' +
          'page,\n' +
          'html|*#newtab-scrollbox {\n' +
          '  background-image: ' + bg + ' !important;\n' +
          '  background-position: top right, right -' + height + 'px;\n' +
          '  background-attachment: fixed !important;\n' +
          '  background-repeat: no-repeat;\n' +
          '  min-height: 100%;\n' +
          '  color: ' + lwt.currentTheme.textcolor + ';\n' +
          '}\n' +
          'html|div#newtab-search-logo {\n' +
          '  filter: url("resource://bigtheme/filters.svg#Matrix");\n' +
          '}\n' +
          'html|*.launchButton,\n' +
          'html|p,\n' +
          'html|*#newtab-search-submit,\n' +
          'htmllabel,\n' +
          'html|*.newtab-title {\n' +
          '  color: ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '}\n' +
          'html|html {\n' +
          '  min-height: 100%;\n' +
          '}\n' +
          '#header {\n' +
          '  -moz-margin-end: 0px !important;\n' +
          '}\n' +
          "#nav-header,\n" +
          '#categories {\n' +
          '  -moz-margin-end: 0px !important;\n' +
          '  background-color: transparent !important;\n' +
          '}\n' +
          '.main-content {\n' +
          '  -moz-border-start: none !important;\n' +
          '  background-color: rgba(255, 255, 255, 0.35) !important;\n' +
          '  background-image: none !important;\n' +
          '  color: ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '}\n' +
          '.category {\n' +
          '  color: ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '  border: none !important;\n' +
          '}\n' +
          '.category[selected] {\n' +
          '  background-color: rgba(0,0,0,0.25) !important;\n' +
          '}\n' +
          '}\n' +

          '@-moz-document url-prefix("about:neterror"), \n' +
          '               url-prefix("about:certerror"), \n' +
          '               url("about:support"), \n' +
          '               url("about:sessionrestore"), \n' +
          '               url("about:welcome-back"), \n' +
          '               url("about:privatebrowsing"), \n' +
          '               url-prefix("about:blocked") {\n' +
          'window,\n' +
          'html|html {\n' +
          '  background-image: ' + bg + ' !important;\n' +
          '  background-position: top right, right -' + height + 'px !important;\n' +
          '  background-attachment: fixed;\n' +
          '  background-repeat: no-repeat;\n' +
          '  height: 100%;\n' +
          '  overflow: hidden;\n' +
          '}\n' +
          'html|label,\n' +
          'html|body {\n' +
          '  overflow-y: auto;\n' +
          '  overflow-x: hidden;\n' +
          '  background-color: transparent !important;\n' +
          '  max-height: calc(100% - 11em);\n' +
          '  border-top: none;\n' +
          '  color: ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '}\n' +
          'html|h1 {' +
          '  color: ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '  padding: 0;\n' +
          '}\n' +
          'html|body {' +
          '     background-image: none !important;\n' +
          // linear-gradient(-45deg, rgba(238, 238, 238, 0.5), rgba(238, 238, 238, 0.5) 33%, rgba(251, 251, 251, 0.5) 33%, rgba(251, 251, 251, 0.5) 66%, rgba(238, 238, 238, 0.5) 66%, rgba(238, 238, 238, 0.5)) !important;\n' +
          '}\n' +
          'html|h1.title-text,\n' +
          'html|h1#errorTitleText {\n' +
          '  color: ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '  border-bottom: 1px solid ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '}\n' +
          'html|button {\n' +
          '  background-color: rgba(' + Math.round(r*0.5) + ',' + Math.round(g*0.5) + ',' + Math.round(b*0.5) + ',1) !important;\n' +
          '  border: 1px solid ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '  color: ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '}\n' +
          '#ignoreWarningButton {\n' +
          '  background-color: transparent !important;\n' +
          '  border: none !important;\n' +
          '  color: ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '}\n' +
          '}\n' +

          '@-moz-document url-prefix("about:certerror") {\n' +
          'html|div.title {\n' +
          '      background-image: url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent("<?xml version='1.0' encoding='utf-8'?><svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='45' height='45' viewBox='0 0 45 45'><style>.icon-default { fill: #999; }</style><defs><rect id='shape-lock-clasp-outer' x='8' y='2' width='28' height='40' rx='14' ry='14' /><rect id='shape-lock-clasp-inner' x='14' y='8' width='16' height='28' rx='8' ry='8' /><rect id='shape-lock-base' x='4' y='18' width='36' height='24' rx='3' ry='3' /><mask id='mask-clasp-cutout'><rect width='48' height='48' fill='#000' /><use xlink:href='#shape-lock-clasp-outer' fill='#fff' /><use xlink:href='#shape-lock-clasp-inner' fill='#000' /><line x1='4' y1='38' x2='41' y2='3' stroke='#000' stroke-width='5.5' /><line x1='4' y1='46' x2='41' y2='11' stroke='#000' stroke-width='5.5' /><rect x='4' y='18' width='36' height='26' rx='6' ry='6' /></mask><mask id='mask-base-cutout'><rect width='45' height='45' fill='#000' /><use xlink:href='#shape-lock-base' fill='#fff' /><line x1='2.5' y1='41.5' x2='41' y2='5' stroke='#000' stroke-width='8.5' /></mask></defs><use xlink:href='#shape-lock-clasp-outer' mask='url(#mask-clasp-cutout)' fill='" + lwt.currentTheme.textcolor + "' /><use xlink:href='#shape-lock-base' mask='url(#mask-base-cutout)' fill='" + lwt.currentTheme.textcolor + "' /><line x1='2.5' y1='41.5' x2='41' y2='5' stroke='#d92d21' stroke-width='5.5' /></svg>") + '") !important;\n' +
          '}\n' +
          '}\n' +

          '@-moz-document url-prefix("about:neterror") {\n' +
          'html|div.title {\n' +
          '      background-image: url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='" + lwt.currentTheme.textcolor + "'><circle cx='50' cy='50' r='44' stroke='" + lwt.currentTheme.textcolor + "' stroke-width='11' fill='none'/><circle cx='50' cy='24.6' r='6.4'/><rect x='45' y='39.9' width='10.1' height='41.8'/></svg>") + '") !important;\n' +
          '}\n' +
          '}\n' +


          '@-moz-document url-prefix("about:blocked") {\n' +
          'html|div.title {\n' +
          '      background-image: url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 45 45'><defs><circle id='stop-sign' cx='22.5' cy='22.5' r='20.5'/><mask id='stop-symbol'><rect width='45' height='45' fill='#ff0'/><line x1='10' y1='23' x2='35' y2='23' stroke='#000' stroke-width='6'/></mask></defs><use xlink:href='#stop-sign' mask='url(#stop-symbol)' fill='" + lwt.currentTheme.textcolor + "'/></svg>") + '") !important;\n' +
          '}\n' +
          '}\n' +


          '@-moz-document url("about:accounts"), \n' +
          '               url("about:about"), \n' +
          '               url("about:buildconfig"), \n' +
          '               url("about:cache"), \n' +
          '               url("about:crashes"), \n' +
          '               url("about:credits"), \n' +
          '               url("about:checkerboard"), \n' +
          '               url("about:config"), \n' +
          '               url("about:downloads"), \n' +
          '               url("about:healthreport"), \n' +
          '               url("about:license"), \n' +
          '               url("about:memory"), \n' +
          '               url("about:mozilla"), \n' +
          '               url("about:performance"), \n' +
          '               url("about:plugins"), \n' +
          '               url("about:rights"), \n' +
          '               url("about:robots"), \n' +
          '               url("about:serviceworkers"), \n' +
          '               url("about:sync-log"), \n' +
          '               url("about:sync-progress"), \n' +
          '               url("about:sync-tabs"), \n' +
          '               url("about:telemetry"), \n' +
          '               url("about:webrtc"), \n' +
          '               url("about:welcomeback"), \n' +
          '               url("about:sessionrestore") { \n' +
          'window,\n' +
          'html|html,\n' +
          '#bg,\n' +
          '#warningScreen {\n' +
          '  background-image: ' + bg + ' !important;\n' +
          '  background-position: top right, right -' + height + 'px !important;\n' +
          '  background-attachment: fixed;\n' +
          '  background-repeat: no-repeat;\n' +
          '  background-size: auto auto !important;\n' +
          '  min-height: 100%;\n' +
          '  overflow: hidden;\n' +
          '  color: ' + lwt.currentTheme.textcolor + ' !important;\n' +
          '}\n' +
          'html|div#errorPageContainer {\n' +
          '  overflow-y: auto;\n' +
          '  overflow-x: hidden;\n' +
          '  max-height: 100%;\n' +
          '  background-color: rgba(255,255,255,0.75) !important;\n' +
          '}\n' +
          '}\n' +

          '@-moz-document url-prefix("about:preferences") { \n' +
          '#categories {\n' +
          '  background-color: rgba(66, 79, 90, 0.5) !important;\n' +
          '}\n' +
          '.category[selected] {\n' +
          '  background-color: rgba(66, 79, 90, 0.7) !important;\n' +
          '  box-shadow: 4px 0px 0px 0px ' + lwt.currentTheme.textcolor + ' inset !important;\n' +
          '}\n' +
          '}\n' +

          '@-moz-document url("about:plugins") { \n' +
          'body {\n' +
          '  background-color: transparent;\n' +
          '}\n' +
          '}\n' +
          '@-moz-document url("chrome://browser/content/tabview.html") { \n' +
          '#bg {\n' +
          '  background-image: ' + bg2 + ' !important;\n' +
          '  background-position: top right, right -' + (height2) + 'px !important;\n' +
          '  background-attachment: fixed;\n' +
          '  background-repeat: no-repeat;\n' +
          '  background-size: auto auto !important;\n' +
          '}\n' +
          '}';

        var filters = '<svg height="0" xmlns="http://www.w3.org/2000/svg">\n' +
        '   <filter id="Matrix" filterUnits="objectBoundingBox" x="0%" y="0%" width="100%" height="100%">\n' +
        '       <feFlood flood-color="' + lwt.currentTheme.textcolor + '" result="output"/>\n' +
        '       <feComposite in="output" in2="SourceAlpha" operator="in"/>\n' +
        '   </filter>\n' +
        '</svg>';

        callback(css, filters);
    });
}

function writeAndUseSheet(window, useIfWritten, data) {
    if (useIfWritten && cssfile.exists()) {
      loadSheet(window);
      return;
    }

    if (!data && lwt.currentTheme == null) {
        return;
    }

    getCSS(window, data, function(css, filters) {
        Promise.all([
          OS.File.writeAtomic(cssfile.path, css, {tmpPath: cssfile.path + ".tmp"}),
          OS.File.writeAtomic(filtersfile.path, filters, {tmpPath: filtersfile.path + ".tmp"}),
        ]).then(() => {
          loadSheet(window);
        }).catch((err) => {
          Cu.reportError(err);
          loadSheet(window);
        });
    });
}

function loadSheet(window) {
    //window.console.log("load sheet");
    let imageCache = Cc["@mozilla.org/image/cache;1"].getService(Ci.imgICache);

    var lwtfile = FileUtils.getFile("ProfD", ['lightweighttheme-header']);
    var lwturi = ios.newFileURI(lwtfile)
    try { imageCache.removeEntry(lwturi);
    } catch(ex) { }

    var uri = ios.newFileURI(cssfile);
    try {
      if(sss.sheetRegistered(uri, sss.USER_SHEET))
          sss.unregisterSheet(uri, sss.USER_SHEET);
    } catch(ex) { }

    imageCache.clearCache(true);
    imageCache.clearCache(false);

    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
}

function unloadAndDeleteSheet() {
  try {
    unloadSheet();
    return deleteSheet();
  } catch(ex) {
    Services.console.logStringMessage("unload error " + ex);
  }
}

function deleteSheet() {
    Services.console.logStringMessage("Delete");
    return OS.File.remove(cssfile.path);
}

function unloadSheet() {
    var uri = ios.newFileURI(cssfile);
    try {
      if(sss.sheetRegistered(uri, sss.USER_SHEET))
          sss.unregisterSheet(uri, sss.USER_SHEET);
    } catch(ex) { }
}

var obs = {
  update: function(data) {
    let windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
      domWindow.setTimeout(function() {
        writeAndUseSheet(domWindow, false, data);
      }, 0);
      return;
    }
  },

  handleEvent: function(event) {
    switch (event.type) {
      case "InstallBrowserTheme":
      case "PreviewBrowserTheme":
        let node = event.target;
        let data = this._getThemeFromNode(node);
        event.target.ownerDocument.defaultView.console.log("Handle event " + JSON.stringify(data));
        this.update(data);
        break;
      case "ResetBrowserThemePreview":
        this.update();
        break;
    }
  },

  get _manager () {
    let temp = {};
    Cu.import("resource://gre/modules/LightweightThemeManager.jsm", temp);
    delete this._manager;
    return this._manager = temp.LightweightThemeManager;
  },

  _getThemeFromNode: function(node) {
    return this._manager.parseTheme(node.getAttribute("data-browsertheme"), node.baseURI);
  },

  observe: function(subject, topic, data) {
    if (topic == "lightweight-theme-styling-update")
      this.update(JSON.parse(data));
    else if (topic == "lightweight-theme-apply")
      this.update();
  }
}

function loadIntoWindow(window) {
  if (!window || !window.gBrowser)
    return;

  writeAndUseSheet(window, true);
  window.console.log("Add listener");
  window.gBrowser.mPanelContainer.addEventListener("InstallBrowserTheme", obs, false, true);
  window.gBrowser.mPanelContainer.addEventListener("PreviewBrowserTheme", obs, false, true);
  window.gBrowser.mPanelContainer.addEventListener("ResetBrowserThemePreview", obs, false, true);
}

function unloadFromWindow(window) {
  if (!window || !window.gBrowser)
    return;
  unloadSheet();
  window.console.log("Remove listener");
  window.gBrowser.mPanelContainer.removeEventListener("InstallBrowserTheme", obs, false, true);
  window.gBrowser.mPanelContainer.removeEventListener("PreviewBrowserTheme", obs, false, true);
  window.gBrowser.mPanelContainer.removeEventListener("ResetBrowserThemePreview", obs, false, true);
}

var windowListener = {
  onOpenWindow: function(aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function() {
      domWindow.removeEventListener("load", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },
  
  onCloseWindow: function(aWindow) {
  },
  
  onWindowTitleChange: function(aWindow, aTitle) {
  }
};

function startup(aData, aReason) {
  init(aData.installPath);

  installPath = aData.installPath
  installPath.append("ColorAnalyzer.js")

  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    //domWindow.console.log("startup");
    loadIntoWindow(domWindow);
  }
  Services.wm.addListener(windowListener);
  //AddonManager.addAddonListener(listener);
  Services.obs.addObserver(obs, "lightweight-theme-styling-update", false);
  Services.obs.addObserver(obs, "lightweight-theme-apply", false);
}

function shutdown(aData, aReason) {
  if (aReason == APP_SHUTDOWN)
    return;

  try {
    Services.wm.removeListener(windowListener);
  } catch(ex) { }

  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }

  let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
  resource.setSubstitution("bigtheme", null);
}

function install(aData, aReason) {
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }
}

function uninstall(aData, aReason) {
  Services.console.logStringMessage("uninstall");
  unloadAndDeleteSheet();
  Services.obs.removeObserver(obs, "lightweight-theme-styling-update", false);
  Services.obs.removeObserver(obs, "lightweight-theme-apply", false);
}
