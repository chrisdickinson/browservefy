var http = require('http')
  , spawn = require('child_process').spawn
  , filed = require('filed')
  , oppressor = require('oppressor')
  , path = require('path')
  , URL = require('url')
  , response_stream = require('response-stream')
  , fs = require('fs')
  , fake_index_html = fs.readFileSync(path.join(__dirname, 'fake_index.html'), 'utf8')
  , process = require('process')
  , console = require('console')
  , optimist = require('optimist').argv
  , LiveReloadServer = require('live-reload')
  , help = require('./help')

var argv = process.argv.slice(/node/.test(process.argv[0]) ? 2 : 1)
  , browserify_path = which_browserify()
  , browserify_args
  , ENTRY_POINT
  , LIVE_PORT
  , PORT

if(!get_args()) {
  process.exit(1)
}

console.log('using '+browserify_path.replace(process.cwd(), '.'))

http.createServer(function(req, resp) {
  var url = URL.parse(req.url).pathname.slice(1) || 'index.html'
    , filepath = path.resolve(path.join(process.cwd(), url))
    , stream
    , b
    , uri = URL.parse(req.url, true)

  if(filepath === ENTRY_POINT || uri.query.browserify === "true") {
    console.log('/'+url, browserify_path+' '+browserify_args.join(' '))
    var args = browserify_args.slice()
    args[0] = filepath
    stream = response_stream((b = spawn(browserify_path, args)).stdout)

    resp.setHeader("content-type", "application/javascript")

    b.stderr.pipe(process.stdout)
  } else {
    console.log('/'+url)
    if(!fs.existsSync(filepath)) {
      return fake_index(req, resp)
    } else {
      stream = filed(filepath)
    }
  }

  stream.on('error', function(err) {
    console.log('500 - '+url.pathname)
    if(err && err.stack) {
      console.log('\t'+err.stack.split('\n').join('\n\t'))
    }
    resp.end('500')
  })

  stream.pipe(resp)
}).listen(PORT)

if(optimist.live) {
  LIVE_PORT = optimist.live === true ? 9967 : optimist.live

  LiveReloadServer({
    port: LIVE_PORT
  })
}

function fake_index(req, resp) {
  var live_text
    , html

  resp.writeHead(200, {'content-type':'text/html'})

  var uri = URL.parse(req.url, true)

  var index_path = uri.query.p || ENTRY_POINT.replace(process.cwd(), "")

  if (uri.query.p) {
    index_path += "?browserify=true"
  }

  live_text = '<script src="http://localhost:' + LIVE_PORT + '"></script>'
  html = fake_index_html.
    replace('{{ PATH }}', index_path).
    replace('{{ EXTRA }}', LIVE_PORT ? live_text : '')

  resp.end(html)
}

function get_args() {
  if(!argv.length || optimist.h || optimist.help) {
    return help()
  }

  for(var i = 0, len = argv.length; i < len; ++i) {
    if(argv[i] === '--') {
      break
    }
  }

  browserify_args = argv.splice(i+1, argv.length - i)

  ENTRY_POINT = path.resolve(
    path.join(process.cwd(), argv[0] || 'main.js')
  )

  PORT = +argv[1] || 9966
  console.log('listening on '+PORT)

  browserify_args.unshift(ENTRY_POINT)

  return true
}

function which_browserify() {
  if(optimist.browserify) {
    return optimist.browserify
  }

  var local = path.join(process.cwd(), 'node_modules/.bin/browserify')
  if(fs.existsSync(local)) {
    return local
  }
  return 'browserify'
}
