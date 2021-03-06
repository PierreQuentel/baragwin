var __BARAGWIN__ = __BARAGWIN__ || {}  // global object with baragwin built-ins

;(function($B) {

// Detect whether we are in a Web Worker
$B.isWebWorker = ('undefined' !== typeof WorkerGlobalScope) &&
                  ("function" === typeof importScripts) &&
                  (navigator instanceof WorkerNavigator)
$B.isNode = (typeof process !=='undefined') && (process.release.name==='node')

var _window
if($B.isNode){
    _window = {
        location: {
            href:'',
            origin: '',
            pathname: ''
        },
        navigator: {
            userLanguage: ''
        }
    }
} else {
    _window = self
}

var href = _window.location.href
$B.protocol = href.split(':')[0]

var $path

if($B.baragwin_path === undefined){
    // Get url of this script baragwin_builtins.js
    var this_url;
    if($B.isWebWorker){
        this_url = _window.location.href;
        if(this_url.startsWith("blob:")){
            this_url = this_url.substr(5)
        }
    }else{
        var scripts = document.getElementsByTagName('script')
        this_url = scripts[scripts.length - 1].src
    }


    var elts = this_url.split('/')
    elts.pop()
    // baragwin_path is the url of the directory holding baragwin core scripts
    // It is used to import modules of the standard library
    $path = $B.baragwin_path = elts.join('/') + '/'
}else{
    if(! $B.baragwin_path.endsWith("/")){
        $B.baragwin_path += "/"
    }
    $path = $B.baragwin_path
}


// Get the URL of the directory where the script stands
var path = _window.location.origin + _window.location.pathname,
    path_elts = path.split("/")
path_elts.pop()
var $script_dir = $B.script_dir = path_elts.join("/")

// Populated in bg2js.baragwin(), used for sys.argv
$B.__ARGV = []

// For all the scripts defined in the page as webworkers, mapping between
// script name and its source code
$B.webworkers = {}

// Mapping between a module name and its path (url)
$B.$py_module_path = {}

// File cache
$B.file_cache = {}

// Mapping between a Python module name and its source code
$B.$py_src = {}

// __BARAGWIN__.path is the list of paths where Python modules are searched
$B.path = [$path + 'Lib', $path + 'libs', $script_dir,
    $path + 'Lib/site-packages']

// for the time being, a flag will be used to know if we should
// enable async functionality.
$B.async_enabled = false
if($B.async_enabled){$B.block = {}}

// Maps the name of imported modules to the module object
$B.imported = {}

// Maps the name of modules to the matching Javascript code
$B.precompiled = {}

// Frames stack
$B.frames_stack = []

// Python __builtins__
$B.builtins = {}

$B.builtins_scope = {id:'__builtins__', module:'__builtins__', binding: {}}

// Builtin functions : used in bg2js to simplify the code produced by a call
$B.builtin_funcs = {}

// Builtin classes
$B.builtin_classes = []

$B.__getattr__ = function(attr){return this[attr]}
$B.__setattr__ = function(attr, value){
    // limited to some attributes
    if(['debug', 'stdout', 'stderr'].indexOf(attr) > -1){$B[attr] = value}
    else{
        throw $B.builtins.AttributeError.$factory(
            '__BARAGWIN__ object has no attribute ' + attr)
    }
}

// system language ( _not_ the one set in browser settings)
// cf http://stackoverflow.com/questions/1043339/javascript-for-detecting-browser-language-preference
$B.language = _window.navigator.userLanguage || _window.navigator.language

$B.locale = "C" // can be reset by locale.setlocale

if($B.isWebWorker){
    $B.charset = "utf-8"
}else{
    // document charset ; defaults to "utf-8"
    $B.charset = document.characterSet || document.inputEncoding || "utf-8"
}

// minimum and maximum safe integers
$B.max_int = Math.pow(2, 53) - 1
$B.min_int = -$B.max_int

// Used to compute the hash value of some objects (see
// py_builtin_functions.js)
$B.$py_next_hash = Math.pow(2, 53) - 1

// $py_UUID guarantees a unique id.  Do not use this variable
// directly, use the $B.UUID function defined in py_utils.js
$B.$py_UUID = 0

// Magic name used in lambdas
$B.lambda_magic = Math.random().toString(36).substr(2, 8)

// Set __name__ attribute of klass methods
$B.set_func_names = function(klass, module){
    klass.__module__ = module
    for(var attr in klass){
        if(typeof klass[attr] == 'function'){
            klass[attr].$infos = {
                __doc__: klass[attr].__doc__ || "",
                __module__: module,
                __qualname__ : name + '.' + attr,
                __name__: attr
            }
        }
    }
}

$B.scripts = {} // for Python scripts embedded in a JS file

$B.$options = {}

$B.modules = {}

$B.script_path = window.location.href

window.bg = function(src){
    var root = $B.bg2js(String.raw(src), "script", "script")
    new Function("locals_script", root.to_js())({})
}
})(__BARAGWIN__)
