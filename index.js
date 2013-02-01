var http = require('http')
  , spawn = require('child_process').spawn
  , filed = require('filed')
  , oppressor = require('oppressor')
  , Path = require('path')
  , URL = require('url')
  , response_stream = require('response-stream')
  , fs = require('fs')
  , fake_index_html = fs.readFileSync(Path.join(__dirname, 'fake_index.html'), 'utf8')
  , process = require('process')
  , console = require('console')
  , optimist = require('optimist').argv
  , LiveReloadServer = require('live-reload')

var argv = process.argv.slice(/node/.test(process.argv[0]) ? 2 : 1)
  , browserify_path = which_browserify()
  , browserify_args
  , ENTRY_POINT
  , PORT

get_args()

http.createServer(function(req, resp) {
  var url = URL.parse(req.url).pathname.slice(1) || 'index.html'
    , path = Path.resolve(Path.join(process.cwd(), url))
    , stream
    , b

  if(path === ENTRY_POINT) {
    console.log('/'+url, browserify_path+' '+browserify_args.join(' '))
    stream = response_stream((b = spawn(browserify_path, browserify_args)).stdout)

    b.stderr.pipe(process.stdout)
  } else {
    console.log('/'+url)
    if(!fs.existsSync(path)) {
      return fake_index(resp)
    } else {
      stream = filed(path)
    }
  }

  stream.on('error', function() { console.log('whaaaat'); resp.end('500') })

  stream.pipe(resp)
}).listen(PORT)

if (optimist.liveReload) {
  var liveReloadPort = optimist.liveReload === true ? 9967 :
    optimist.liveReload

  LiveReloadServer({
    port: liveReloadPort
  })
}

function fake_index(resp) {
  resp.writeHead(200, {'content-type':'text/html'})
  var liveReloadText = optimist.liveReload ?
    "<script src='http://localhost:" + liveReloadPort + "'></script>" : ""

  var html = fake_index_html.
    replace('{{ PATH }}', ENTRY_POINT.replace(process.cwd(), '')).
    replace('{{ EXTRA }}', liveReloadText)
  resp.end(html)
}

function get_args() {
  for(var i = 0, len = argv.length; i < len; ++i) {
    if(argv[i] === '--') {
      break
    }
  }

  browserify_args = argv.splice(i+1, argv.length - i)

  ENTRY_POINT = Path.resolve(
    Path.join(process.cwd(), argv[0] || 'main.js')
  )

  PORT = +argv[1] || 9966
  console.log('listening on '+PORT)

  browserify_args.unshift(ENTRY_POINT)
}

function which_browserify() {
  if (optimist.browserify) {
    return optimist.browserify
  }

  var local = Path.join(process.cwd(), 'node_modules/.bin/browserify')
  if(fs.existsSync(local)) {
    console.log('using browserify@'+local.replace(process.cwd(), '.'))
    return local
  }
  console.log('using global browserify')
  return 'browserify'
}
