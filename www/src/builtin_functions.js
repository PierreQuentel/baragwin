// built-in functions
;(function($B){

var _b_ = $B.builtins

// maps comparison operator to method names
$B.$comps = {'>':'gt','>=':'ge','<':'lt','<=':'le'}
$B.$inv_comps = {'>': 'lt', '>=': 'le', '<': 'gt', '<=': 'ge'}

function check_nb_args(name, expected, args){
    // Check the number of arguments
    var len = Object.keys(args).length
    if(len != expected){
        if(expected == 0){
            throw _b_.$TypeError.$factory(name + "() takes no argument" +
                " (" + len + " given)")
        }else{
            throw _b_.$TypeError.$factory(name + "() takes exactly " +
                expected + " argument" + (expected < 2 ? '' : 's') +
                " (" + len + " given)")
        }
    }
}

function check_no_kw(name, x, y){
    // Throw error if one of x, y is a keyword argument
    if(x === undefined){
        console.log("x undef", name, x, y)
    }
    var keys = Object.keys(x)
    for(var key in x){
        if(isNaN(parseInt(key))){
            return false
        }
    }
    return true
}

var NoneType = {
    $factory: function(){
        return None
    },
    $infos:{
        __name__: "NoneType",
        __module__: "builtins"
    },
    __bool__: function(self){return False},
    __class__: _b_.type,
    str: function(self){return 'None'},
    $is_class: true
}

NoneType.__setattr__ = function(self, attr){
    return no_set_attr(NoneType, attr)
}

var None = {
    __class__: NoneType
}

for(var $op in $B.$comps){ // None is not orderable with any type
    var key = $B.$comps[$op]
    switch(key){
      case 'ge':
      case 'gt':
      case 'le':
      case 'lt':
        NoneType['__' + key + '__'] = (function(op){
            return function(other){return _b_.NotImplemented}
        })($op)
    }
}
for(var $func in None){
    if(typeof None[$func] == 'function'){
        None[$func].__str__ = (function(f){
            return function(){return "<method-wrapper " + f +
                " of NoneType object>"
            }
        })($func)
    }
}

$B.set_func_names(NoneType, "builtins")

function abs(pos, kw){
    var $ = $B.args("abs", pos, kw, ["obj"]),
        obj = $.obj

    if(isinstance(obj, _b_.int)){
        if(obj.__class__ === $B.long_int){
            return {
                __class__: $B.long_int,
                value: obj.value,
                pos: true
            }
        }else{
            return _b_.int.$factory([Math.abs(obj)])
        }
    }
    if(isinstance(obj, _b_.float)){return _b_.float.$factory(Math.abs(obj))}
    var klass = obj.__class__ || $B.get_class(obj)
    try{
        var method = $B.$getattr(klass, "__abs__")
    }catch(err){
        if(err.__class__ === _b_.AttributeError){
            throw _b_.TypeError.$factory("Bad operand type for abs(): '" +
                $B.class_name(obj) + "'")
        }
        throw err
    }
    return $B.$call(method)(obj)
}

function all(obj){
    check_nb_args('all', 1, arguments)
    check_no_kw('all', obj)
    var iterable = iter(obj)
    while(1){
        try{
            var elt = next(iterable)
            if(!$B.$bool(elt)){return false}
        }catch(err){return true}
    }
}

function any(obj){
    check_nb_args('any', 1, arguments)
    check_no_kw('any', obj)
    var iterable = iter(obj)
    while(1){
        try{
            var elt = next(iterable)
            if($B.$bool(elt)){return true}
        }catch(err){return false}
    }
}

// used by bin, hex and oct functions
function $builtin_base_convert_helper(obj, base) {
  var prefix = "";
  switch(base){
     case 2:
       prefix = '0b'; break
     case 8:
       prefix = '0o'; break
     case 16:
       prefix = '0x'; break
     default:
         console.log('invalid base:' + base)
  }

  if(obj.__class__ === $B.long_int){
     if(obj.pos){return prefix + $B.long_int.to_base(obj, base)}
     return '-' + prefix + $B.long_int.to_base(-obj, base)
  }

  var value = $B.$GetInt(obj)

  if(value === undefined){
     // need to raise an error
     throw _b_.TypeError.$factory('Error, argument must be an integer or' +
         ' contains an __index__ function')
  }

  if(value >= 0){return prefix + value.toString(base)}
  return '-' + prefix + (-value).toString(base)
}

function bin_hex_oct(base, obj){
    // Used by built-in function bin, hex and oct
    // base is respectively 2, 16 and 8
    if(isinstance(obj, _b_.int)){
        return $builtin_base_convert_helper(obj, base)
    }else{
        try{
            var klass = obj.__class__ || $B.get_class(obj),
                method = $B.$getattr(klass, '__index__')
        }catch(err){
            if(err.__class__ === _b_.AttributeError){
                throw _b_.TypeError.$factory("'" + $B.class_name(obj) +
                    "' object cannot be interpreted as an integer")
            }
            throw err
        }
        var res = $B.$call(method)(obj)
        return $builtin_base_convert_helper(res, base)
    }
}

function callable(obj) {
    check_nb_args('callable', 1, arguments)
    check_no_kw('callable', obj)

    return hasattr(obj, '__call__')
}

function chr(i) {
    check_nb_args('chr', 1, arguments)
    check_no_kw('chr', i)

    if(i < 0 || i > 1114111){
        throw _b_.ValueError.$factory('Outside valid range')
    }
    return String.fromCodePoint(i)
}

var date_param2method = {
    year: "FullYear",
    month: "Month",
    day: "Day",
    hour: "Hours",
    minute: "Minutes",
    second: "Seconds"
},
date_params = Object.keys(date_param2method)

var Date = function(pos, kw){
    var X = {},
        $ = $B.args("Date", pos, kw, date_params,
            {year:X, month: X, day: X, hour: X, minute: X, second: X}),
        t = []
    date_params.forEach(function(param, rank){
        if($[param] === X){
            date_params.slice(rank + 1).forEach(function(rest){
                if($[rest] !== X){
                    throw _b_.ValueError.$factory(date_params[rank] +
                        " not set but " + rest + " set")
                }
            })
        }else{
            t.push($[param])
        }
    })
    var factory = window.Date.bind.apply(window.Date, t),
        res = new factory()
    res.__class__ = Date
    return res
}

Date.time = function(obj, kw){
    var $ = $B.args("time", obj, kw, ["self"])
    return $.self.getTime()
}

Date.$getattr = function(self, attr){
    if(date_params.indexOf(attr) > -1){
        var method = "get" + date_param2method[attr]
        return self[method]()
    }
    var res = Date[attr]
    if(res === undefined){
        throw _b_.AttributeError.$factory(attr)
    }else if(typeof res === "function"){
        return function(pos, kw){
            var pos1 = pos.slice()
            pos1.splice(0, 0, self)
            return res(pos1, kw)
        }
    }else{
        return res
    }
}

Date.getattr = function(obj, kw){
    var $ = $B.args("getattr", obj, kw, ["self", "attr"])
    return Date.$getattr(self, attr)
}

Date.$setattr = function(self, attr, value){
    if(date_params.indexOf(attr) > -1){
        var method = "set" + date_param2method[attr]
        return self[method](value)
    }
    return object.$setattr(self, attr, value)
}

Date.setattr = function(obj, kw){
    var $ = $B.args("getattr", obj, kw, ["self", "attr", "value"])
    return Date.$setattr($.self, $.attr, $.value)
}

function delattr(obj, attr) {
    // descriptor protocol : if obj has attribute attr and this attribute has
    // a method __delete__(), use it
    check_no_kw('delattr', obj, attr)
    check_nb_args('delattr', 2, arguments)
    if(typeof attr != 'string'){
        throw _b_.TypeError.$factory("attribute name must be string, not '" +
            $B.class_name(attr) + "'")
    }
    return $B.$getattr(obj, '__delattr__')(attr)
}

$B.$delete = function(name, is_global){
    // remove name from namespace
    function del(obj){
        // If obj is a generator object with a context manager whose method
        // __exit__ has not yet been called, call it
        if(obj.$is_generator_obj && obj.env){
            for(var attr in obj.env){
                if(attr.search(/^\$ctx_manager_exit\d+$/) > -1){
                    $B.$call(obj.env[attr])()
                    delete obj.env[attr]
                }
            }
        }
    }
    var found = false,
        frame = $B.last($B.frames_stack)
    if(! is_global){
        if(frame[1][name] !== undefined){
            found = true
            del(frame[1][name])
            delete frame[1][name]
        }
    }else{
        if(frame[2] != frame[0] && frame[3][name] !== undefined){
            found = true
            del(frame[3][name])
            delete frame[3][name]
        }
    }
    if(!found){
        throw _b_.NameError.$factory(name)
    }
}

function dir(obj){
    if(obj === undefined){
        // if dir is called without arguments, use globals
        var frame = $B.last($B.frames_stack),
            globals_obj = frame[3],
            res = _b_.list.$factory(),
            pos = 0
        for(var attr in globals_obj){
            if(attr.charAt(0) == '$' && attr.charAt(1) != '$') {
                // exclude internal attributes set by _Baragwin
                continue
            }
            res[pos++] = attr
        }
        _b_.list.sort(res)
        return res
    }

    check_nb_args('dir', 1, arguments)
    check_no_kw('dir', obj)

    var klass = obj.__class__ || $B.get_class(obj)

    if(obj.$is_class){
        // Use metaclass __dir__
        var dir_func = $B.$getattr(obj.__class__, "__dir__")
        return $B.$call(dir_func)(obj)
    }
    try{
        var res = $B.$call($B.$getattr(obj, '__dir__'))()

        res = _b_.list.$factory(res)
        res.sort()
        return res
    }catch (err){
        // ignore, default
        //console.log(err)
    }

    var res = [], pos = 0
    for(var attr in obj){
        if(attr.charAt(0) !== '$' && attr !== '__class__' &&
                obj[attr] !== undefined){
            res[pos++] = attr
        }
    }
    res.sort()
    return res
}

var enumerate = function*(pos, kw){
    var $ = $B.args("enumerate", pos, kw, ["iterable"]),
        iterable = $.iterable,
        i = 0
    for(const item of $B.test_iter(iterable)){
        yield [i, item]
        i++
    }
}

enumerate.__iter__ = function(self){
    self.counter = self.start - 1
    return self
}

enumerate.__next__ = function(self){
    self.counter++
    return $B.fast_tuple([self.counter, next(self.iter)])
}

$B.set_func_names(enumerate, "builtins")

$B.from_alias = function(attr){
    if(attr.substr(0, 2) == '$$' && $B.aliased_names[attr.substr(2)]){
        return attr.substr(2)
    }
    return attr
}
$B.to_alias = function(attr){
    if($B.aliased_names[attr]){return '$$' + attr}
    return attr
}

//eval() (built in function)
function $$eval(pos, kw){

    var $ = $B.args("eval", pos, kw, ["src", "is_exec"], {is_exec: false})
        src = $.src,
        is_exec = $.is_exec

    var frame = $B.last($B.frames_stack),
        stack_len = $B.frames_stack.length
    if(typeof src !== 'string'){
        throw _b_.TypeError.$factory("eval() arg 1 must be a string, bytes "+
            "or code object")
    }

    var root = $B.bg2js(src, frame.__name__, frame.__name__, frame),
        js, gns, lns

    try{
        // The result of bg2js ends with
        // try{
        //     (block code)
        //     $B.leave_frame($local_name)
        // }catch(err){
        //     $B.leave_frame($local_name)
        //     throw err
        // }
        var try_node = root.children[root.children.length - 2],
            instr = try_node.children[try_node.children.length - 2]
        // type of the last instruction in (block code)
        var type = instr.context.tree[0].type

        // If the Python function is eval(), not exec(), check that the source
        // is an expression

        switch(type){

            case 'expr':
            case 'list_or_tuple':
            case 'op':
            case 'ternary':
                // If the source is an expression, what we must execute is the
                // block inside the "try" clause : if we run root, since it's
                // wrapped in try / finally, the value produced by
                // eval(root.to_js()) will be None
                var children = try_node.children
                root.children.splice(root.children.length - 2, 2)
                for(var i = 0; i < children.length - 1; i++){
                    root.add(children[i])
                }
                break
            default:
                if(!is_exec){
                    throw _b_.SyntaxError.$factory(
                        "eval() argument must be an expression",
                        '<string>', 1, 1, src)
                }
        }

        js = root.to_js()
        eval("locals_" + frame.__name__ + " = frame")

        if(is_exec){
            var res = new Function(js)()
        }else{
            var res = eval(js)
        }

        if(res === undefined){return _b_.None}
        return res
    }catch(err){
        err.src = src
        if(err.$py_error === undefined){throw $B.exception(err)}
        throw err
    }finally{
        // "leave_frame" was removed so we must execute it here
        if($B.frames_stack.length == stack_len + 1){
            $B.frames_stack.pop()
        }
    }
}
$$eval.$is_func = true

function exec(pos, kw){
    var $ = $B.args("exec", pos, kw, ["src"])
    return $$eval([$.src, true]) || _b_.None
}

exec.$is_func = true

function exit(){
    throw _b_.SystemExit
}

exit.__repr__ = exit.__str__ = function(){
    return "Use exit() or Ctrl-Z plus Return to exit"
}

var filter = $B.make_class("filter",
    function(func, iterable){
        check_no_kw('filter', func, iterable)
        check_nb_args('filter', 2, arguments)

        iterable = iter(iterable)
        if(func === _b_.None){func = $B.$bool}

        return {
            __class__: filter,
            func: func,
            iterable: iterable
        }
    }
)

filter.__iter__ = function(self){return self}

filter.__next__ = function(self) {
    while(true){
        var _item = next(self.iterable)
        if(self.func(_item)){return _item}
    }
}

$B.set_func_names(filter, "builtins")

function format(value, format_spec) {
    var $ = $B.args("format", 2, {value: null, format_spec: null},
        ["value", "format_spec"], arguments, {format_spec: ''}, null, null)
    var klass = value.__class__ || $B.get_class(value)
    try{
        var method = $B.$getattr(klass, '__format__')
    }catch(err){
        if(err.__class__ === _b_.AttributeError){
            throw _b_.NotImplementedError("__format__ is not implemented " +
                "for object '" + _b_.$str.$factory(value) + "'")
        }
        throw err
    }
    return $B.$call(method)(value, $.format_spec)
}

function attr_error(attr, cname){
    var msg = "bad operand type for unary #: '" + cname + "'"
    switch(attr){
        case '__neg__':
            throw _b_.TypeError.$factory(msg.replace('#', '-'))
        case '__pos__':
            throw _b_.TypeError.$factory(msg.replace('#', '+'))
        case '__invert__':
            throw _b_.TypeError.$factory(msg.replace('#', '~'))
        case '__call__':
            throw _b_.TypeError.$factory("'" + cname + "'" +
                ' object is not callable')
        default:
            while(attr.charAt(0) == '$'){attr = attr.substr(1)}
            throw _b_.AttributeError.$factory("'" + cname +
                "' object has no attribute '" + attr + "'")
    }
}

function getattr(pos, kw){
    var missing = {}
    var $ = $B.args("getattr", pos, kw, ["obj", "attr"])
    return $B.$getattr($.obj, $.attr)
}

$B.$getattr = function(obj, attr){
    // Used internally to avoid having to parse the arguments
    var test = false // attr == "split"
    if(obj===undefined){
        console.log("obj undef, attr", attr)
    }
    var res,
        klass = obj.__class__ || $B.get_class(obj)

    if(test){
        console.log("get attr", attr, "of", obj, typeof obj, "klass", klass)
    }

    while(klass){
        if(test){
            console.log("search", attr, "in class", klass, "getattr",
                klass.getattr)
        }
        if(klass.getattr){
            if(klass.$getattr){
                // shortcut to avoid parsing arguments again
                res = klass.$getattr(obj, attr)
            }else{
                res = klass.getattr([obj, attr])
            }
            if(test){
                console.log("return klass getattr", res)
            }
            return res
        }else{
            res = klass[attr]
            if(res){
                if(test){
                    console.log(res, res + "", typeof res)
                }
                if(typeof res == "function"){
                    var method = function(pos, kw){
                        var pos1 = pos.slice()
                        pos1.splice(0, 0, obj)
                        return res(pos1, kw)
                    }
                    method.func = res
                    method.__class__ = $B.method
                    return method
                }else{
                    return res
                }
            }
        }
        klass = klass.__parent__
    }
    return object.$getattr(obj, attr)
}

//globals() (built in function)

function globals(){
    // The last item in __BARAGWIN__.frames_stack is
    // [locals_name, locals_obj, globals_name, globals_obj]
    check_nb_args('globals', 0, arguments)
    var res = $B.obj_dict($B.last($B.frames_stack)[3])
    res.$jsobj.__BARAGWIN__ = $B.JSObject.$factory($B) // issue 1181
    res.$is_namespace = true
    return res
}

function hasattr(obj,attr){
    check_no_kw('hasattr', obj, attr)
    check_nb_args('hasattr', 2, arguments)
    try{$B.$getattr(obj,attr); return true}
    catch(err){return false}
}

function _get_builtins_doc(){
    if($B.builtins_doc === undefined){
        // Load builtins docstrings from file builtins_doctring.js
        var url = $B.baragwin_path
        if(url.charAt(url.length - 1) == '/'){
            url = url.substr(0, url.length - 1)
        }
        url += '/builtins_docstrings.js'
        var f = _b_.open(url)
        eval(f.$content)
        $B.builtins_doc = docs
    }
}

function hex(obj){
    check_no_kw('hex', obj)
    check_nb_args('hex', 1, arguments)
    return bin_hex_oct(16, obj)
}

// The default __import__ function is a builtin
function __import__(mod_name, globals, locals, fromlist, level) {
    // TODO : Install $B.$__import__ in builtins module to avoid nested call
    var $ = $B.args('__import__', 5,
        {name: null, globals: null, locals: null, fromlist: null, level: null},
        ['name', 'globals', 'locals', 'fromlist', 'level'],
        arguments,
        {globals:None, locals:None, fromlist:_b_.tuple.$factory(), level:0},
        null, null)
    return $B.$__import__($.name, $.globals, $.locals, $.fromlist)
}

Info = {
    attrs: function(pos, kw){
        var $ = $B.args("attrs", pos, kw, ["obj"])
        try{
            return $B.$getattr($.obj, "attrs")([], {})
        }catch(err){
            console.log(err)
            return Object.keys($.obj)
        }
    },
    len: function(pos, kw){
        var $ = $B.args("len", pos, kw, ["obj"])
        return $B.$getattr($.obj, "len")([], {})
    }
}

// not a direct alias of prompt: input has no default value
function input(msg) {
    return prompt(msg || '') || ''
}

function isinstance(obj, cls){
    check_no_kw('isinstance', obj, cls)
    check_nb_args('isinstance', 2, arguments)

    if(obj === null){return cls === None}
    if(Array.isArray(cls)){
        for(var i = 0; i < cls.length; i++){
            if(isinstance(obj, cls[i])){return true}
        }
        return false
    }
    if(cls.__class__ !== _b_.type){
        throw _b_.TypeError.$factory("isinstance() arg 2 must be a type " +
            "or tuple of types")
    }

    if(cls === _b_.$int && (obj === True || obj === False)){return True}

    if(cls === _b_.$bool){
        switch(typeof obj){
            case "string":
                return false
            case "number":
                return false
            case "boolean":
                return true
        }
    }
    var klass = obj.__class__

    if(klass == undefined){
        if(typeof obj == 'string'){
            if(cls == _b_.str){return true}
            else if($B.builtin_classes.indexOf(cls) > -1){
                return false
            }
        }else if(obj.contructor === Number && Number.isFinite(obj)){
            if(cls == _b_.float){return true}
            else if($B.builtin_classes.indexOf(cls) > -1){
                return false
            }
        }else if(typeof obj == 'number' && Number.isFinite(obj)){
            if(Number.isFinite(obj) && cls == _b_.int){return true}
            else if($B.builtin_classes.indexOf(cls) > -1){
                return false
            }
        }
        klass = $B.get_class(obj)
    }

    if(klass === undefined){return false}

    // Return true if one of the parents of obj class is cls
    while(klass){
        if(klass === cls){
            return true
        }
        klass = klass.__parent__
    }
    return false
}

function issubclass(klass, classinfo){
    check_no_kw('issubclass', klass, classinfo)
    check_nb_args('issubclass', 2, arguments)

    if(!klass.__class__ ||
            !(klass.$factory !== undefined || klass.$is_class !== undefined)){
        throw _b_.TypeError.$factory("issubclass() arg 1 must be a class")
    }

    if(isinstance(classinfo, _b_.tuple)){
        for(var i = 0; i < classinfo.length; i++){
           if(issubclass(klass, classinfo[i])){return true}
        }
        return false
    }

    return klass.__mro__.indexOf(classinfo) > -1
}

function locals(){
    // The last item in __BARAGWIN__.frames_stack is
    // [locals_name, locals_obj, globals_name, globals_obj]
    check_nb_args('locals', 0, arguments)
    var res = $B.obj_dict($B.last($B.frames_stack)[1])
    res.$is_namespace = true
    delete res.$jsobj.__annotations__
    return res
}

function $extreme(args, op){ // used by min() and max()
    var $op_name = 'min'
    if(op === 'gt'){$op_name = "max"}

    if(args.length == 0){
        throw _b_.TypeError.$factory($op_name +
            " expected 1 arguments, got 0")
    }
    var last_arg = args[args.length - 1],
        nb_args = args.length,
        has_default = false
    if(nb_args == 0){
        throw _b_.TypeError.$factory($op_name + " expected 1 argument, got 0")
    }else if(nb_args == 1){
        // Only one positional argument : it must be an iterable
        var iter = $B.test_iter(args[0]),
            res = null
        for(const x of iter){
            if(res === null || $B.compare[op](x, res)){
                res = x
            }
        }
    }else{
        var res = null
        for(var i = 0; i < nb_args; i++){
            var x = args[i]
            if(res === null || $B.compare[op](x, res)){
                res = x
            }
        }
    }
    return res
}

function max(){
    var $ = $B.args("min", pos, kw, [], {}, "args")
    return $extreme($.args, 'gt')
}


function min(pos, kw){
    var $ = $B.args("min", pos, kw, [], {}, "args")
    return $extreme($.args, 'lt')
}

function next(obj){
    check_no_kw('next', obj)
    var missing = {},
        $ = $B.args("next", 2, {obj: null, def: null}, ['obj', 'def'],
            arguments, {def: missing}, null, null)
    var klass = obj.__class__ || $B.get_class(obj),
        ga = $B.$call($B.$getattr(klass, "__next__"))
    if(ga !== undefined){
        try{
            return $B.$call(ga)(obj)
        }catch(err){
            if(err.__class__ === _b_.StopIteration &&
                    $.def !== missing){
                return $.def
            }
            throw err
        }
    }
    throw _b_.TypeError.$factory("'" + $B.class_name(obj) +
        "' object is not an iterator")
}

function $not(obj){return !$B.$bool(obj)}

object = {
    getattr: function(pos, kw){
        var $ = $B.args("getattr", pos, kw, ["self", "attr"])
        return object.$getattr($.self, $.attr)
    },
    $getattr: function(self, attr){
        var res = self[attr]
        if(res === undefined){
            throw _b_.AttributeError.$factory(attr)
        }
        return res
    },
    setattr: function(pos, kw){
        var $ = $B.args("setattr", pos, kw, ["self", "attr", "value"])
        return object.$setattr($.self, $.attr, $.value)
    },
    $setattr: function(self, attr, value){
        self[attr] = value
        return _b_.None
    },
    str: function(pos, kw){
        var $ = $B.args("str", pos, kw, ["self"])
        return $.self.toString()
    }
}

function oct(obj){
    check_no_kw('oct', obj)
    check_nb_args('oct', 1, arguments)
    return bin_hex_oct(8, obj)
}

function ord(c) {
    check_no_kw('ord', c)
    check_nb_args('ord', 1, arguments)
    //return String.charCodeAt(c)  <= this returns an undefined function error
    // see http://msdn.microsoft.com/en-us/library/ie/hza4d04f(v=vs.94).aspx
    if(typeof c == 'string'){
        if(c.length == 1){return c.charCodeAt(0)} // <= strobj.charCodeAt(index)
        throw _b_.TypeError.$factory('ord() expected a character, but ' +
            'string of length ' + c.length + ' found')
    }
    switch($B.get_class(c)){
      case _b_.$str:
        if(c.length == 1){return c.charCodeAt(0)} // <= strobj.charCodeAt(index)
        throw _b_.TypeError.$factory('ord() expected a character, but ' +
            'string of length ' + c.length + ' found')
      case _b_.bytes:
      case _b_.bytearray:
        if(c.source.length == 1){return c.source[0]} // <= strobj.charCodeAt(index)
        throw _b_.TypeError.$factory('ord() expected a character, but ' +
            'string of length ' + c.source.length + ' found')
      default:
        throw _b_.TypeError.$factory('ord() expected a character, but ' +
            $B.class_name(c) + ' was found')
    }
}

function pow(x, y) {
    var $ = $B.args('pow', 3, {x: null, y: null, z: null},['x', 'y', 'z'],
        arguments, {z: null}, null, null),
        z = $.z
    var klass = x.__class__ || $B.get_class(x),
        res = $B.$call($B.$getattr(klass, '__pow__'))(x, y, z)
    if(z === null){return res}
    else{
        if(x != _b_.int.$factory(x) || y != _b_.int.$factory(y)){
            throw _b_.TypeError.$factory("pow() 3rd argument not allowed " +
                "unless all arguments are integers")
        }
        return $B.$getattr(res, '__mod__')(z)
    }
}

function $print(pos, kw){
    var $ = $B.args('print', pos, kw, [], {}, 'args', 'kw')
    var args = $.args,
        kw = $.kw,
        end = kw.end === undefined ? "\n" : kw.end,
        sep = kw.sep === undefined ? " " : kw.sep,
        file = kw.file === undefined ? $B.stdout : kw.file,
        items = []
    args.forEach(function(arg){
        items.push(_b_.str.$(arg))
    })
    // Special handling of \a and \b
    var res = items.join(sep) + end
    res = res.replace(new RegExp("\u0007", "g"), "").
              replace(new RegExp("(.)\b", "g"), "")
    console.log(res)
    return None
}
$print.__name__ = 'print'
$print.is_func = true

function repr(obj){
    check_no_kw('repr', obj)
    check_nb_args('repr', 1, arguments)

    var klass = obj.__class__ || $B.get_class(obj)
    return $B.call($B.$getattr(klass, "__repr__"))(obj)
}


function round(){
    var $ = $B.args('round', 2, {number: null, ndigits: null},
        ['number', 'ndigits'], arguments, {ndigits: None}, null, null),
        arg = $.number,
        n = $.ndigits === None ? 0 : $.ndigits

    if(!isinstance(arg,[_b_.int, _b_.float])){
        var klass = arg.__class__ || $B.get_class(arg)
        try{
            return $B.$call($B.$getattr(klass, "__round__")).apply(null, arguments)
        }catch(err){
            if(err.__class__ === _b_.AttributeError){
                throw _b_.TypeError.$factory("type " + $B.class_name(arg) +
                    " doesn't define __round__ method")
            }else{
                throw err
            }
        }
    }

    if(isinstance(arg, _b_.float) &&
            (arg.value === Infinity || arg.value === -Infinity)) {
        throw _b_.OverflowError.$factory("cannot convert float infinity to integer")
    }

    if(!isinstance(n, _b_.int)){throw _b_.TypeError.$factory(
        "'" + $B.class_name(n) + "' object cannot be interpreted as an integer")}

    var mult = Math.pow(10, n),
        x = arg * mult,
        floor = Math.floor(x),
        diff = Math.abs(x - floor),
        res
    if(diff == 0.5){
        if(floor % 2){floor += 1}
        res = _b_.int.__truediv__(floor, mult)
    }else{
        res = _b_.int.__truediv__(Math.round(x), mult)
    }
    if($.ndigits === None){
        // Always return an integer
        return res.valueOf()
    }else if(arg instanceof Number){
        return new Number(res)
    }else{
        return res.valueOf()
    }
}

function setattr(args){

    var $ = $B.args('setattr', args, ['$obj', '$attr', '$value']),
        obj = $.$obj,
        attr = $.$attr,
        value = $.$value
    if(!(typeof attr == 'string')){
        throw _b_.TypeError.$factory("setattr(): attribute name must be string")
    }
    return $B.$setattr(obj, attr, value)
}

$B.$setattr = function(obj, attr, value){

    // Used in the code generated by bg2js. Avoids having to parse the
    // since we know we will get the 3 values
    var $test = false // attr === "__name__"
    if(typeof obj == "number" ||
            typeof obj == "string" ||
            obj instanceof Number ||
            Array.isArray(obj) ||
            obj.__class__ === _b_.dict){
        throw _b_.TypeError.$factory("cannot set attribute to " +
            $B.class_name(obj))
    }
    var klass = obj.__class__ || $B.get_class(obj)
    while(klass){
        if(klass.setattr){
            return klass.setattr([obj, attr, value])
        }
        klass = klass.__parent__
    }
    return object.$setattr(obj, attr, value)
}

function sorted () {
    var $ = $B.args('sorted', 1, {iterable: null}, ['iterable'],
        arguments, {}, null, 'kw')
    var _list = _b_.list.$factory(iter($.iterable)),
        args = [_list]
    for(var i = 1; i < arguments.length; i++){args.push(arguments[i])}
    _b_.list.sort.apply(null, args)
    return _list
}

// str() defined in py_string.js

function sum(pos, kw){
    var $ = $B.args('sum', pos, kw, ['iterable']),
        res

    for(const item of $B.test_iter($.iterable)){
        if(res === undefined){
            res = item
        }else{
            res = $B.operations.add(res, item)
        }
    }
    if(res === undefined){
        throw _b_.ValueError.$factory("cannot sum empty iterable")
    }
    return res
}

var Test = {
    equal: function(pos, kw){
        var $ = $B.args("equal", pos, kw, ["x", "y"])
        if(! $B.compare.eq($.x, $.y)){
            throw _b_.AssertionError.$factory(_b_.str.$($.x) +
                " not equal to " +_b_.str.$($.y))
        }
    },
    false: function(pos, kw){
        var $ = $B.args("false", pos, kw, ["obj"])
        if($B.$bool($.obj)){
            throw _b_.AssertionError.$factory("not true")
        }
    },
    isinstance: function(pos, kw){
        var $ = $B.args("isinstance", pos, kw, ["obj"], {}, "classes")
        return Test.$isinstance($.obj, $.classes)
    },
    $isinstance: function(obj, classes){
        var klass = $B.get_class(obj)
        while(klass){
            if(classes.indexOf(klass) > -1){
                return true
            }
            klass = klass.__parent__
        }
        return false
    },
    issubclass: function(pos, kw){
        var $ = $B.args("isinstance", pos, kw, ["obj"], {}, "klass"),
                obj = $.obj,
                klass = $.klass
        if(obj.__class__ !== _b_.type){
            throw _b_.ValueError.$factory("first argument of issubclass" +
                " is not a class")
        }
        var cls = obj
        console.log("is subclass", cls, klass)
        while(cls){
            if(cls === klass){
                return true
            }
            cls = cls.__parent__
        }
        return false
    },
    raise: function(pos, kw){
        var $ = $B.args("raise", pos, kw,
                ["exception", "func"], {}, "pos", "kw")
        try{
            console.log("func", $.func, "pos", $.pos, "kw", $.kw)
            $.func($.pos, $.kw)
            throw _b_.AssertionError.$factory("exception not raised")
        }catch(err){
            if(err.__class__ !== $.exception){
                throw _b_.AssertionError.$factory("exception not raised")
            }
        }
    },
    true: function(pos, kw){
        var $ = $B.args("true", pos, kw, ["obj"])
        if(! $B.$bool($.obj)){
            throw _b_.AssertionError.$factory("not true")
        }
    }
}

var type = {
    __parent__: object
}

$B.Function = {
    __class__: type
}

function $url_open(){
    // first argument is file : can be a string, or an instance of a DOM File object
    var $ns = $B.args('open', 3, {file: null, mode: null, encoding: null},
        ['file', 'mode', 'encoding'], arguments,
        {mode: 'r', encoding: 'utf-8'}, 'args', 'kw'),
        $res
    for(var attr in $ns){eval('var ' + attr + '=$ns["' + attr + '"]')}
    if(args.length > 0){var mode = args[0]}
    if(args.length > 1){var encoding = args[1]}
    if(isinstance(file, $B.JSObject)){
        return $B.OpenFile.$factory(file.js, mode, encoding) // defined in py_dom.js
    }
    if(mode.search('w') > -1){
        throw _b_.IOError.$factory("Browsers cannot write on disk")
    }else if(['r', 'rb'].indexOf(mode) == -1){
        throw _b_.ValueError.$factory("Invalid mode '" + mode + "'")
    }
    if(isinstance(file, _b_.$str)){
        // read the file content and return an object with file object methods
        var is_binary = mode.search('b') > -1
        if($B.file_cache.hasOwnProperty($ns.file)){
            var str_content = $B.file_cache[$ns.file]
            if(is_binary){
                $res = _b_.$str.encode(str_content, "utf-8")
            }else{
                $res = str_content
            }
        }else if($B.files && $B.files.hasOwnProperty($ns.file)){
            // Virtual file system created by
            // python -m baragwin --make_file_system
            $res = atob($B.files[$ns.file].content)
            var source = []
            for(const char of $res){
                source.push(char.charCodeAt(0))
            }
            $res = _b_.bytes.$factory()
            $res.source = source
            if(! is_binary){
                // Decode bytes with specified encoding
                $res = _b_.bytes.decode($res, $ns.encoding)
            }
        }else if($B.protocol != "file"){
            // Try to load file by synchronous Ajax call
            if(is_binary){
                throw _b_.IOError.$factory(
                    "open() in binary mode is not supported")
            }
            var req = new XMLHttpRequest();
            req.onreadystatechange = function(){
                try{
                    var status = this.status
                    if(status == 404){
                        $res = _b_.FileNotFoundError(file)
                    }else if(status != 200){
                        $res = _b_.IOError.$factory('Could not open file ' +
                            file + ' : status ' + status)
                    }else{
                        $res = this.responseText
                    }
                }catch (err){
                    $res = _b_.IOError.$factory('Could not open file ' +
                        file + ' : error ' + err)
                }
            }
            // add fake query string to avoid caching
            var fake_qs = '?foo=' + (new Date().getTime())
            req.open('GET', file + fake_qs, false)
            req.overrideMimeType('text/plain; charset=utf-8')
            req.send()

            if($res.constructor === Error){throw $res}
        }

        if($res === undefined){
            throw _b_.FileNotFoundError.$factory($ns.file)
        }

        if(typeof $res == "string"){
            var lines = $res.split('\n')
            for(var i = 0; i < lines.length - 1; i++){lines[i] += '\n'}
        }else{
            var lines = _b_.bytes.split($res, _b_.bytes.$factory([10]))
        }
        // return the file-like object
        var res = {
            $content: $res,
            $counter: 0,
            $lines: lines,
            closed: False,
            encoding: encoding,
            mode: mode,
            name: file
        }
        res.__class__ = is_binary ? $BufferedReader : $TextIOWrapper

        return res
    }
}

var zip = function(pos, kw){
    var $ = $B.args("zip", pos, kw, [], {}, "iterables"),
        res = {
            __class__: zip
        }
    var iterators = []
    for(var it of $.iterables){
        iterators.push(it[Symbol.iterator]())
    }
    res[Symbol.iterator] = function*(){
        var row
        while(true){
            row = []
            for(var it of iterators){
                var item = it.next()
                if(item.done){
                    // Stop when first iterator is done
                    return
                }
                row.push(item.value)
            }
            yield row
        }
    }
    return res
}
zip.__class__ = _b_.type
zip.__name__ = "zip"

// built-in constants : True, False, None

function no_set_attr(klass, attr){
    if(klass[attr] !== undefined){
        throw _b_.AttributeError.$factory("'" + klass.$infos.__name__ +
            "' object attribute '" + attr + "' is read-only")
    }else{
        throw _b_.AttributeError.$factory("'" + klass.$infos.__name__ +
            "' object has no attribute '" + attr + "'")
    }
}

// True and False are the same as Javascript true and false

var True = true
var False = false

_b_.__BARAGWIN__ = __BARAGWIN__

$B.builtin_funcs = [
    "abs", "all", "any", "callable", "chr",
    "delattr", "dir", "eval", "exec", "exit", "format", "getattr",
    "globals", "hasattr", "hex", "input", "isinstance",
    "issubclass", "locals", "max", "min", "next", "oct",
    "open", "ord", "pow", "print", "repr", "round", "setattr",
    "sorted", "sum"
]

$B.builtin_classes = [
    "bool", "bytearray", "bytes", "complex", "dict", "enumerate",
    "filter", "float", "frozenset", "int", "list", "map",
    "object", "range", "set", "slice",
    "str", "type", "zip"
]

var other_builtins = [
    'False',  'None', 'True', '__import__',
    'copyright', 'credits', 'license',
    'Date', 'Info', 'Test'
]

var builtin_names = $B.builtin_funcs.
    concat($B.builtin_classes).
    concat(other_builtins)

for(var i = 0; i < builtin_names.length; i++){
    var name = builtin_names[i],
        orig_name = name,
        name1 = name
    if(name == 'open'){name1 = '$url_open'}
    if(name == 'eval'){name1 = '$$eval'}
    if(name == 'print'){name1 = '$print'}
    try{
        _b_[name] = eval(name1)
        if(name == '$$eval'){
            console.log("set eval", _b_[name] + '')
        }
        if($B.builtin_funcs.indexOf(orig_name) > -1){
            // used by inspect module
            _b_[name].$infos = {
                __module__: 'builtins',
                __name__: orig_name,
                __qualname__: orig_name
            }
        }

    }
    catch(err){
        // Error for the built-in names that are not defined in this script,
        // eg int, str, float, etc.
    }
}

_b_['open'] = $url_open
_b_['$print'] = $print

})(__BARAGWIN__)
