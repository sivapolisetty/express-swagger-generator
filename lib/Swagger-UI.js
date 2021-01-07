'use strict'

var express = require('express')
var swaggerUi = require('swagger-ui-dist')
var favIconHtml = '<link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32" />' +
  '<link rel="icon" type="image/png" href="./favicon-16x16.png" sizes="16x16" />'
var swaggerInit = ''

var htmlTplString = `
<!-- HTML for static distribution bundle build -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title><% title %></title>
  <link rel="stylesheet" type="text/css" href="./swagger-ui.css" >
  <% favIconString %>
  <% customJs %>
  <style>
    html
    {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *,
    *:before,
    *:after
    {
      box-sizing: inherit;
    }

    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>

<body>



<div id="swagger-ui"></div>

<script src="./swagger-ui-bundle.js"> </script>
<script src="./swagger-ui-standalone-preset.js"> </script>
<script src="./swagger-ui-init.js"> </script>
<% customCssUrl %>
<style>
  <% customCss %>
</style>
</body>

</html>
`

var jsTplString = `
window.onload = function() {
  // Build a system
  var url = window.location.search.match(/url=([^&]+)/);
  if (url && url.length > 1) {
    url = decodeURIComponent(url[1]);
  } else {
    url = window.location.origin;
  }
  <% swaggerOptions %>
  url = options.swaggerUrl || url
  var urls = options.swaggerUrls
  var customOptions = options.customOptions
  var spec1 = options.swaggerDoc
  var swaggerOptions = {
    spec: spec1,
    url: url,
    urls: urls,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  }
  for (var attrname in customOptions) {
    swaggerOptions[attrname] = customOptions[attrname];
  }
  var ui = SwaggerUIBundle(swaggerOptions)

  if (customOptions.oauth) {
    ui.initOAuth(customOptions.oauth)
  }

  if (customOptions.authAction) {
    ui.authActions.authorize(customOptions.authAction)
  }

  window.ui = ui
}
`

var generateHTML = function (swaggerDoc, opts, options, customCss, customfavIcon, swaggerUrl, customSiteTitle, _htmlTplString, _jsTplString) {
  var isExplorer
  var customJs
  var swaggerUrls
  var customCssUrl
  if (opts && typeof opts === 'object') {
    options = opts.swaggerOptions
    customCss = opts.customCss
    customJs = opts.customJs
    customfavIcon = opts.customfavIcon
    swaggerUrl = opts.swaggerUrl
    swaggerUrls = opts.swaggerUrls
    isExplorer = opts.explorer || !!swaggerUrls
    customSiteTitle = opts.customSiteTitle
    customCssUrl = opts.customCssUrl
  } else {
    //support legacy params based function
    isExplorer = opts
  }
  options = options || {}
  var explorerString = isExplorer ? '' : '.swagger-ui .topbar .download-url-wrapper { display: none }'
  customCss = explorerString + ' ' + customCss || explorerString
  customfavIcon = customfavIcon || false
  customSiteTitle = customSiteTitle || 'Swagger UI'
  _htmlTplString = _htmlTplString || htmlTplString
  _jsTplString = _jsTplString || jsTplString

  var favIconString = customfavIcon ? '<link rel="icon" href="' + customfavIcon + '" />' : favIconHtml
  var htmlWithCustomCss = _htmlTplString.toString().replace('<% customCss %>', customCss)
  var htmlWithFavIcon = htmlWithCustomCss.replace('<% favIconString %>', favIconString)
  var htmlWithCustomJs = htmlWithFavIcon.replace('<% customJs %>', customJs ? `<script src="${customJs}"></script>` : '')
  var htmlWithCustomCssUrl = htmlWithCustomJs.replace('<% customCssUrl %>', customCssUrl ? `<link href="${customCssUrl}" rel="stylesheet">` : '')

  var initOptions = {
    swaggerDoc: swaggerDoc || undefined,
    customOptions: options,
    swaggerUrl: swaggerUrl || undefined,
    swaggerUrls: swaggerUrls || undefined
  }

  swaggerInit = _jsTplString.toString().replace('<% swaggerOptions %>', stringify(initOptions))
  return htmlWithCustomCssUrl.replace('<% title %>', customSiteTitle)
}

var setup = function (swaggerDoc, opts, options, customCss, customfavIcon, swaggerUrl, customSiteTitle) {
  var html = generateHTML(swaggerDoc, opts, options, customCss, customfavIcon, swaggerUrl, customSiteTitle, htmlTplString, jsTplString)
  return function (req, res) {
    if (req.swaggerDoc) {
      var reqHtml = generateHTML(req.swaggerDoc, opts, options, customCss, customfavIcon, swaggerUrl, customSiteTitle, htmlTplString, jsTplString)
      res.send(reqHtml)
    } else {
      res.send(html)
    }
  }
}

function swaggerInitFn(req, res, next) {
  if (req.url === '/package.json') {
    res.sendStatus(404)
  } else if (req.url === '/swagger-ui-init.js') {
    res.set('Content-Type', 'application/javascript')
    res.send(swaggerInit)
  } else {
    next()
  }
}

var swaggerInitFunction = function (swaggerDoc, opts) {
  var swaggerInitFile = jsTplString.toString().replace('<% swaggerOptions %>', stringify(opts))
  return function (req, res, next) {
    if (req.url === '/package.json') {
      res.sendStatus(404)
    } else if (req.url === '/swagger-ui-init.js') {
      res.set('Content-Type', 'application/javascript')
      res.send(swaggerInitFile)
    } else {
      next()
    }
  }
}

var swaggerAssetMiddleware = options => {
  var opts = options || {}
  opts.index = false
  return express.static(swaggerUi.getAbsoluteFSPath(), opts)
}

var serveFiles = function (swaggerDoc, opts) {
  opts = opts || {}
  var initOptions = {
    swaggerDoc: swaggerDoc || undefined,
    customOptions: opts.swaggerOptions || {},
    swaggerUrl: opts.swaggerUrl || {},
    swaggerUrls: opts.swaggerUrls || undefined
  }
  var swaggerInitWithOpts = swaggerInitFunction(swaggerDoc, initOptions)
  return [swaggerInitWithOpts, swaggerAssetMiddleware()]
}

var serve = [swaggerInitFn, swaggerAssetMiddleware()]
var serveWithOptions = options => [swaggerInitFn, swaggerAssetMiddleware(options)]

var stringify = function (obj, prop) {
  var placeholder = '____FUNCTIONPLACEHOLDER____'
  var fns = []
  var json = JSON.stringify(obj, function (key, value) {
    if (typeof value === 'function') {
      fns.push(value)
      return placeholder
    }
    return value
  }, 2)
  json = json.replace(new RegExp('"' + placeholder + '"', 'g'), function (_) {
    return fns.shift()
  })
  return 'var options = ' + json + ';'
}

module.exports = {
  setup: setup,
  serve: serve,
  serveWithOptions: serveWithOptions,
  generateHTML: generateHTML,
  serveFiles: serveFiles
}
