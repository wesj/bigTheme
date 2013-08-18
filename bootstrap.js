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

function init() {
  tempScope = {};
  Cu.import("resource://gre/modules/LightweightThemeManager.jsm", tempScope);
  lwt = tempScope.LightweightThemeManager;


  sss = Cc["@mozilla.org/content/style-sheet-service;1"]
                      .getService(Ci.nsIStyleSheetService);
  ios = Cc["@mozilla.org/network/io-service;1"]
                      .getService(Ci.nsIIOService);
  fileName = "fancyTheme.css";
  cssfile = FileUtils.getFile("ProfD", [fileName]);
}

function getDefaultHeight(toolbox) {
    //toolbox.ownerDocument.defaultView.console.log("get h");
    var h = 0;

    var disablechrome = false;
    if (toolbox.ownerDocument.documentElement.hasAttribute("disablechrome")) {
        toolbox.ownerDocument.documentElement.removeAttribute("disablechrome");
        disablechrome = true;
    }

    h = toolbox.getBoundingClientRect().height;

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

  win.console.log("Get data " + imgUri.spec);
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

  var CA = Cc["@mozilla.org/places/colorAnalyzer;1"].getService(Ci.mozIColorAnalyzer);
  CA.findRepresentativeColor(uri, function(success, aColor) {
    data = data || lwt.currentTheme;
    window.console.log("getCSS " + JSON.stringify(data));
    if (!success) {
        aColor = parseInt(data.accentcolor.substring(1), 16);
    }
    let r = (aColor & 0xff0000) >> 16;
    let g = (aColor & 0x00ff00) >> 8;
    let b = (aColor & 0x0000ff);

    var toolbox = window.document.getElementById("navigator-toolbox");
    window.console.log(window.location);
    var height = getDefaultHeight(toolbox);
    getDataUrl(window, uri, function(data) {
      window.console.log(data);
      var bg = 'linear-gradient(rgba(' + r + ',' + g + ',' + b + ',0), ' +
                                              'rgba(' + r + ',' + g + ',' + b + ',1) ' + (175 - height) + 'px, ' +
                                              'rgba(' + Math.round(r*0.75) + ',' + Math.round(g*0.75) + ',' + Math.round(b*0.75) + ',1)),\n' +
          '      url("' + data + '") !important;';
      var css = '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n' +
          '@namespace html url(http://www.w3.org/1999/xhtml);\n' +

          '@-moz-document url("about:addons"), \n' +
          '               url("about:newtab"), \n' +
          '               url("about:sessionrestore"), \n' +
          '               url("about:home") {\n' +
          '#addons-page,\n' +
          'html|body,\n' +
          'html|*#newtab-scrollbox {\n' +
          '  background-image: ' + bg + '\n' +
          '  background-position: top right, right -' + height + 'px;\n' +
          '  background-repeat: no-repeat;\n' +
          '  min-height: 100%;\n' +
          '}\n' +
          'html|html {\n' +
          '  min-height: 100%;\n' +
          '}\n' +
          '}\n' +

          '@-moz-document url-prefix("about:neterror"), \n' +
          '               url-prefix("about:certerror"), \n' +
          '               url-prefix("about:blocked") {\n' +
          'html|html {\n' +
          '  background-image: ' + bg + '\n' +
          '  background-position: top right, right -' + height + 'px !important;\n' +
          '  background-attachment: fixed;\n' +
          '  background-repeat: no-repeat;\n' +
          '  height: 100%;\n' +
          '  overflow: hidden;\n' +
          '}\n' +
          'html|body {\n' +
          '  overflow-y: auto;\n' +
          '  overflow-x: hidden;\n' +
          '  max-height: calc(100% - 11em);\n' +
          '}\n' +
          '}\n' +
          '@-moz-document url("about:sessionrestore") { \n' +
          'html|html {\n' +
          '  background-image: ' + bg + '\n' +
          '  background-position: top right, right -' + height + 'px;\n' +
          '  background-attachment: fixed;\n' +
          '  background-repeat: no-repeat;\n' +
          '  height: 100%;\n' +
          '  overflow: hidden;\n' +
          '}\n' +
          'html|body {\n' +
          '  overflow-y: auto;\n' +
          '  overflow-x: hidden;\n' +
          '  max-height: 100%;\n' +
          '}\n' +
          '}\n';

      // on australis, about:addons doesn't remove the navbar, everywhere else it does
      //if (Services.vc.compare(Services.appinfo.version, 24) <= 0) {
      if (Services.prefs.getCharPref("app.update.channel") != "nightly-ux") {
          var tabbar = window.document.getElementById("TabsToolbar").getBoundingClientRect();
          css += "#addons-page {\n" +
                 '    background-position: top right, right -' + tabbar.height + 'px;\n' +
                 '}\n';
      }
      callback(css);
    });
  });
}

function writeAndUseSheet(window, useIfWritten, data) {
    if (useIfWritten && cssfile.exists()) {
      loadSheet(window);
      return;
    }

    if (!data && lwt.currentTheme == null)
        return;

    getCSS(window, data, function(css) {
        let promise = OS.File.writeAtomic(cssfile.path, css, {tmpPath: cssfile.path+".tmp"});
        promise.then(function() {
          loadSheet(window);
        }, function(err) {
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
/*
var listener = {
    update: function() {
      let windows = Services.wm.getEnumerator("navigator:browser");
      while (windows.hasMoreElements()) {
        let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
        domWindow.setTimeout(function() {
          writeAndUseSheet(domWindow, true);
        }, 1000);
        return;
      }
    },
    onEnabling: function(addon, needsRestart) { },
    onEnabled: function(addon) {
      Services.console.logStringMessage("enabled " + addon.type);
        if (addon.type == "theme")
            this.update();
    },
    onDisabling: function(addon, needsRestart) { },
    onDisabled: function(addon) {
      Services.console.logStringMessage("disabled " + addon.type);
      if (addon.type == "theme")
          unloadAndDeleteSheet();
    },
    onInstalling: function(addon, needsRestart) { },
    onInstalled: function(addon) {
      Services.console.logStringMessage("installed " + addon.type);
        if (addon.type == "theme")
            this.update();
    },
    onUninstalling: function(addon, needsRestart) { },
    onUninstalled: function(addon) {
        Services.console.logStringMessage("uinstalled " + addon.type);
        if (addon.type == "theme")
          unloadAndDeleteSheet();
    },
    onOperationCancelled: function(addon) { },
    onPropertyChanged: function(addon, properties) { },
}
*/
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
  init();
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
  //AddonManager.removeAddonListener(listener);
  Services.obs.removeObserver(obs, "lightweight-theme-styling-update", false);
  Services.obs.removeObserver(obs, "lightweight-theme-apply", false);
}
