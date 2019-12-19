;(function($B){

var _b_ = $B.builtins,
    _window = self,
    isWebWorker = ('undefined' !== typeof WorkerGlobalScope) &&
            ("function" === typeof importScripts) &&
            (navigator instanceof WorkerNavigator)

$B.args = function(fname, positionals, keywords, required, defaults,
        extra_pos, extra_kw){
    // builds a namespace from the arguments provided in $args
    // in a function defined as
    //     foo(x, y, z=1, *args, u, v, **kw)
    // the parameters are
    //     $fname = "f"
    //     argcount = 3 (for x, y , z)
    //     slots = {x:null, y:null, z:null, u:null, v:null}
    //     var_names = ['x', 'y', 'z', 'u', 'v']
    //     $dobj = {'z':1}
    //     extra_pos_args = 'args'
    //     extra_kw_args = 'kw'
    //     kwonlyargcount = 2
    var has_kw_args = false,
        filled = 0,
        extra_kw,
        $ = {$name: fname}

    if(required === undefined){
        required = []
        defaults = {}
    }else if(defaults === undefined){
        defaults = {}
    }
    if(extra_pos){
        $[extra_pos] = []
    }
    if(extra_kw){
        $[extra_kw] = {}
    }

    var i = 0
    if(positionals === undefined){
        console.log("no positionals for", fname)
    }
    for(const positional of positionals){
        if(required[i] !== undefined){
            $[required[i]] = positional
        }else if(extra_pos){
            $[extra_pos].push(positional)
        }else{
            throw _b_.TypeError.$factory(fname + " got too many arguments")
        }
        i++
    }

    for(key in keywords){
        if($[key] !== undefined){
            throw _b_.TypeError.$factory("double argument: " + key.substr(1))
        }
        if(required.indexOf(key) > -1){
            $[key] = keywords[key]
        }else if(extra_kw){
            $[extra_kw][key] = keywords[key]
        }else{
            console.log("required", required, "$", $)
            throw _b_.TypeError.$factory("unexpected keyword argument for " +
                fname + ": " + key)
        }
    }

    for(var i = 0, len = required.length; i < len; i++){
        var x = required[i]
        if($[x] === undefined){
            if(defaults[x] !== undefined){
                $[x] = defaults[x]
            }else{
                throw _b_.TypeError.$factory(fname + " got no value for " + x)
            }
        }
    }

    $.positionals = positionals
    $.keywords = keywords

    return $
}

$B.augmented = {
    add: function(x, y){
        return $B.operations.add(x, y)
    }
}

$B.compare = {
    eq: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return x.valueOf() == y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x == y
        }else if(Array.isArray(x)){
            return _b_.list.$eq(x, y)
        }else{
            try{
                var eq = $B.$getattr(x, "eq")
                return eq([y])
            }catch(err){
                console.log(err, err.__class__, err.args)
                throw _b_.TypeError.$factory("cannot compare types " +
                    $B.class_name(x) + " and " + $B.class_name(y))
            }
        }
    },
    ge: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return x.valueOf() >= y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x >= y
        }else if(x.__class__ && x.__class__.ge !== undefined){
            return x.__class__.ge([x, y])
        }else{
            throw _b_.TypeError.$factory("cannot compare types " +
                $B.class_name(x) + " and " + $B.class_name(y))
        }
    },
    gt: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return x.valueOf() > y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x > y
        }else if(x.__class__ && x.__class__.gt !== undefined){
            return x.__class__.gt([x, y])
        }else{
            throw _b_.$TypeError.$factory("cannot compare types " +
                $B.class_name(x) + " and " + $B.class_name(y))
        }
    },
    le: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return x.valueOf() <= y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x <= y
        }else{
            try{
                var le = $B.$getattr(x, "le")
                return le([y])
            }catch(err){
                console.log("err", err, err.__class__, err.args)
                throw _b_.TypeError.$factory("cannot compare types " +
                    $B.class_name(x) + " and " + $B.class_name(y))
            }
        }
    },
    lt: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return x.valueOf() < y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x < y
        }else if(x.__class__ && x.__class__.lt !== undefined){
            return x.__class__.lt([x, y])
        }else{
            throw _b_.$TypeError.$factory("cannot compare types " +
                $B.class_name(x) + " and " + $B.class_name(y))
        }
    }
}

$B.operations = {
    add: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return x.valueOf() + y.valueOf()
        }else if(typeof x == "string"){
            if(typeof y == "string"){
                return x + y
            }else{
                return _b_.str.$add(x, y)
            }
        }else if(Array.isArray(x)){
            return _b_.list.$add(x, y)
        }else{
            try{
                var add = $B.$getattr(x, "add")
                return add([y])
            }catch(err){
                throw _b_.TypeError.$factory("+ not supported between types " +
                    $B.class_name(x) + " and " + $B.class_name(y))
            }
        }
    },
    div: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return x.valueOf() / y.valueOf()
        }else if(x.__class__ && x.__class__.div){
            return x.__class__.div([x, y])
        }else{
            throw _b_.TypeError.$factory("/ not supported between types " +
                $B.class_name(x) + " and " + $B.class_name(y))
        }
    },
    floordiv: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return Math.floor(x.valueOf() / y.valueOf())
        }else if(x.__class__ && x.__class__.floordiv){
            return x.__class__.floordiv([x, y])
        }else{
            throw _b_.TypeError.$factory("// not supported between types " +
                $B.class_name(x) + " and " + $B.class_name(y))
        }
    },
    mod: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return x.valueOf() % y.valueOf()
        }else{
            try{
                var mod = $B.$getattr(x, "mod")
                return mod([y])
            }catch(err){
                throw _b_.TypeError.$factory("% not supported between types " +
                    $B.class_name(x) + " and " + $B.class_name(y))
            }
        }
    },
    mul: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            if(x instanceof Number || y instanceof Number){
                return new Number(x * y)
            }else{
                return x.valueOf() * y.valueOf()
            }
        }else if(x.__class__ && x.__class__.mul !== undefined){
            return x.__class__.mul([x, y])
        }else{
            throw _b_.$TypeError.$factory("* not supported between types " +
                $B.class_name(x) + " and " + $B.class_name(y))
        }
    },
    sub: function(x, y){
        if(typeof x.valueOf() == "number" &&
                typeof y.valueOf() == "number"){
            return x.valueOf() - y.valueOf()
        }else if(x.__class__ && x.__class__.sub !== undefined){
            return x.__class__.sub([x, y])
        }else{
            throw _b_.TypeError.$factory("- not supported between types " +
                $B.class_name(x) + " and " + $B.class_name(y))
        }
    }
}

$B.call = function(callable){
    if(callable === undefined){
        throw Error("callable undef")
    }
    if(callable.__class__ === $B.method){
        return callable
    }
    else if(callable.$is_func || typeof callable == "function"){
        return callable
    }else if(callable.$factory){
        return callable.$factory
    }else if(callable.$is_class){
        // Use metaclass __call__, cache result in callable.$factory
        return callable.$factory = $B.$instance_creator(callable)
    }else if(callable.__class__ === $B.JSObject){
        if(typeof(callable.js) == "function"){
            return callable.js
        }else{
            throw _b_.TypeError.$factory("'" + $B.class_name(callable) +
                "' object is not callable")
        }
    }
    throw _b_.TypeError.$factory("'" + $B.class_name(callable) +
        "' object is not callable")
}

$B.get_class = function(obj){
    // generally we get the attribute __class__ of an object by obj.__class__
    // but Javascript builtins used by _Baragwin (functions, numbers, strings...)
    // don't have this attribute so we must return it

    if(obj === null){return $B.$NoneDict}
    var klass = obj.__class__
    if(klass === undefined){
        switch(typeof obj) {
            case "number":
                if(obj % 1 === 0){ // this is an int
                   return _b_.int
                }
                // this is a float
                return _b_.float
            case "string":
                return _b_.str
            case "boolean":
                return _b_.bool
            case "function":
                obj.__class__ = $B.Function
                return $B.Function
            case "object":
                if(obj instanceof Node){
                    obj.__class__ = $B.DOMNode
                    return $B.DOMNode
                }else if(Array.isArray(obj)){
                    return _b_.list
                }else if(obj instanceof Map){
                    return _b_.dict
                }else if(obj instanceof Number){
                    return _b_.float
                }
                break
        }
    }
    return klass
}

$B.class_name = function(obj){
    return $B.get_class(obj).__name__
}

$B.delitem = function(obj, item){
    if(Array.isArray(obj)){
        return _b_.list.$delitem(obj, item)
    }
    try{
        var del = $B.$getattr(obj, "delitem")
        return del([item])
    }catch(err){
        throw _b_.TypeError.$factory($B.class_name(obj) +
            " does not support del")
    }
}

$B.getitem = function(obj, item){
    var res
    if(obj instanceof Node){
        return $B.DOMNode.getitem([obj, item])
    }else if(obj instanceof Map){
        res = obj.get(item)
    }else if(typeof obj == "string"){
        if(typeof obj != "number"){
            throw _b_.TypeError.$factory("list indice must be int, not " +
                $B.get_class(obj))
        }
        res = obj.charAt(item)
    }else if(Array.isArray(obj)){
        res = _b_.list.$getitem(obj, item)
    }else{
        try{
            var getitem = $B.$getattr(obj, "getitem")
        }catch(err){
            throw _b_.TypeError.$factory("'" + $B.class_name(obj) +
                "' object is not subscriptable")
        }
        return getitem([item])
    }
    if(res === undefined){
        console.log("error", obj, item)
        throw _b_.KeyError.$factory(item)
    }
    return res
}

$B.is_member = function(item, container){
    // used for "item in container"
    if(typeof container == "string"){
        if(typeof item != "string"){
            throw _b_.TypeError.$factory("cannot test " +
                $B.class_name(item) + " in string")
        }
        return container.indexOf(item) >  -1
    }else if(container.__class__ && container.__class__.contains){
        return container.__class__.contains([container, item])
    }else if(container[Symbol.iterator]){
        for(const x of container){
            if($B.compare.eq(x, item)){
                return true
            }
        }
        return false
    }
    throw _b_.TypeError.$factory("cannot test membership of " +
        $B.class_name(item) + " in " + $B.class_name(container))
}


$B.setitem = function(obj, item, value){
    if(obj instanceof Node){
        return $B.DOMNode.__setitem__([obj, item])
    }else if(obj instanceof Map){
        obj.set(item, value)
    }else if(Array.isArray(obj)){
        if(typeof item != "number"){
            throw _b_.$TypeError.$factory("list indice must be int, not " +
                $B.get_class(obj))
        }
        obj[item] = value
    }else{
        throw _b_.TypeError.$factory("'" + $B.class_name(obj) +
            "' object is not subscriptable")
    }
}

$B.make_class = function(name, factory){
    // Builds a basic class object

    var A = {
        __class__: _b_.type,
        __parent__: _b_.object,
        __name__: name
    }

    A.$factory = factory

    return A
}

$B.method = {
    str: function(obj, kw){
        var $ = $B.args("str", obj, kw, ["self"])
        console.log("method str", $)
    }
}

var module = $B.module = {
    __class__ : _b_.type,
    __mro__: [_b_.object],
    $infos: {
        __module__: "builtins",
        __name__: "module"
    },
    $is_class: true
}

module.$factory = function(name, doc, $package){
    return {
        //__class__: module,
        $class: module,
        __name__: name,
        __doc__: doc || _b_.None,
        __package__: $package || _b_.None
    }
}


$B.to_list = function(obj, expected){
    // If obj is iterable, return the list made by iteration on it
    if(obj[Symbol.iterator] === undefined){
        throw _b_.TypeError.$factory("'" + $B.class_name(obj) +
            "' object is not iterable")
    }
    var list = []
    for(const item of obj){
        list.push(item)
    }
    if(list.length < expected){
        throw _b_.ValueError.$factory("need more than " + list.length +
            " value" + (list.length > 1 ? "s" : "") + " to unpack")
    }
    if(list.length > expected){
        throw _b_.ValueError.$factory("too many values to unpack " +
            "(expected " + expected + ")")
    }
    return list
}

$B.test_iter = function(candidate){
    if(candidate[Symbol.iterator] === undefined){
        console.log("not iterator", candidate)
        throw _b_.TypeError.$factory($B.class_name(candidate) +
            " object is not iterable")
    }
    return candidate
}

$B.list_comp = function(items){
    // Called for list comprehensions
    // items[0] is the Python code for the comprehension expression
    // items[1:] is the loops and conditions in the comprehension
    // For instance in [ x*2 for x in A if x>2 ],
    // items is ["x*2", "for x in A", "if x>2"]
    var ix = $B.UUID(),
        py = "x" + ix + "=[]\n",
        indent = 0
    for(var i = 1, len = items.length; i < len; i++){
        var item = items[i].replace(/\s+$/, "").replace(/\n/g, "")
        py += " ".repeat(indent) + item + "\n"
        indent += 4
    }
    py += " ".repeat(indent)
    py += "x" + ix + ".append(" + items[0] + ")\n"

    return [py, ix]
}

$B.dict_comp = function(module_name, parent_scope, items, line_num){
    // Called for dict comprehensions
    // items[0] is the Python code for the comprehension expression
    // items[1:] is the loops and conditions in the comprehension
    // For instance in { x:x*2 for x in A if x>2 },
    // items is ["x:x*2", "for x in A", "if x>2"]

    var ix = $B.UUID(),
        res = "res" + ix,
        py = res + "={}\n", // Python code
        indent = 0
    for(var i = 1, len = items.length; i < len; i++){
        var item = items[i].replace(/\s+$/,"").replace(/\n/g, "")
        py += "    ".repeat(indent) + item + "\n"
        indent++
    }
    py += "    ".repeat(indent) + res + " += {" + items[0] + "}"

    var dictcomp_name = "dc" + ix,
        root = $B.bg2js({src:py, is_comp:true}, module_name, dictcomp_name,
            parent_scope, line_num),
        js = root.to_js()
    js += '\nreturn locals.' + res + '\n'

    js = "(function(locals_" + dictcomp_name + "){" + js + "})({})"
    
    return js
}

$B.gen_expr = function(module_name, parent_scope, items, line_num){
    // Called for generator expressions
    var $ix = $B.UUID(),
        py = "def __ge" + $ix + "()\n", // use a special name (cf $global_search)
        indent = 1
    for(var i = 1, len = items.length; i < len; i++){
        var item = items[i].replace(/\s+$/, "").replace(/\n/g, "")
        py += " ".repeat(indent) + item + "\n"
        indent += 4
    }
    py += " ".repeat(indent)
    py += "yield " + items[0]

    var genexpr_name = "__ge" + $ix,
        root = $B.bg2js({src: py, is_comp: true}, genexpr_name, genexpr_name,
            parent_scope, line_num),
        js = root.to_js(),
        lines = js.split("\n")

    js = lines.join("\n")
    js += "\nvar $res = locals." + genexpr_name +
        '([], {});\n$res.is_gen_expr = true;\nreturn $res\n'
    js = "(function(locals_" + genexpr_name +"){" + js + "})({})\n"

    return js
}

$B.global_search = function(name){
    // search name in all namespaces above current stack frame
    var ns = {}

    for(var i = 0; i < $B.frames_stack.length; i++){
        var frame = $B.frames_stack[i]
        if(frame.hasOwnProperty(name)){
            return frame[name]
        }
    }
    throw _b_.NameError.$factory("name '" + name +
        "' is not defined")
}

$B.check_def = function(name, value){
    // Check if value is not undefined
    if(value !== undefined){
        return value
    }else if(_b_[name] !== undefined){ // issue 1133
        return _b_[name]
    }
    throw _b_.NameError.$factory("name '" + $B.from_alias(name) +
        "' is not defined")
}

// transform native JS types into Baragwin types
$B.$JS2Py = function(src){
    if(typeof src === "number"){
        if(src % 1 === 0){return src}
        return _b_.float.$factory(src)
    }
    if(src === null || src === undefined){return _b_.None}
    if(Array.isArray(src)){
        var res = []
        for(const item of src){
            res.push($B.$JS2Py(item))
        }
        return res
    }
    var klass = $B.get_class(src)
    if(klass !== undefined){
        if(klass === $B.JSObject){
            src = src.js
        }else{
            return src
        }
    }
    if(typeof src == "object"){
        if(src instanceof Node){return $B.DOMNode.$factory(src)}
        if(src instanceof Event){return $B.$DOMEvent(src)}
        //if($B.$isNodeList(src)){return $B.DOMNode.$factory(src)}
    }
    return $B.JSObject.$factory(src)
}


$B.$setitem = function(obj, item, value){
    if(Array.isArray(obj) && obj.__class__ === undefined &&
            typeof item == "number" &&
            !_b_.isinstance(obj, _b_.tuple)){
        if(item < 0){item += obj.length}
        if(obj[item] === undefined){
            throw _b_.IndexError.$factory("list assignment index out of range")
        }
        obj[item] = value
        return
    }else if(obj.__class__ === _b_.dict){
        _b_.dict.$setitem(obj, item, value)
        return
    }else if(obj.__class__ === $B.JSObject){
        $B.JSObject.__setattr__(obj, item, value)
        return
    }else if(obj.__class__ === _b_.list){
        return _b_.list.$setitem(obj, item, value)
    }
    $B.$getattr(obj, "__setitem__")(item, value)
}

// Default standard output and error
// Can be reset by sys.stdout or sys.stderr
var $io = $B.make_class("io", function(){
    return {__class__: $io}
    }
)
$io.$getattr = function(self, attr){
    return self[attr]
}

$io.flush = function(){
    // do nothing
}

$io.write = function(args){
    // Defaults to printing to browser console
    console.log(args)
    return _b_.None
}

$B.stderr = $io.$factory()
$B.stdout = $io.$factory()

$B.stdin = {
    __class__: $io,
    __original__: true,
    closed: false,
    len: 1,
    pos: 0,
    read: function (){
        return ""
    },
    readline: function(){
        return ""
    }
}


// UUID is a function to produce a unique id.
// the variable $B.py_UUID is defined in bg2js.js (in the baragwin function)
$B.UUID = function(){return $B.$py_UUID++}

$B.$GetInt = function(value) {
  // convert value to an integer
  if(typeof value == "number" || value.constructor === Number){return value}
  else if(typeof value === "boolean"){return value ? 1 : 0}
  else if(_b_.isinstance(value, _b_.int)){return value}
  else if(_b_.isinstance(value, _b_.float)){return value.valueOf()}
  if(! value.$is_class){
      try{var v = $B.$getattr(value, "__int__")(); return v}catch(e){}
      try{var v = $B.$getattr(value, "__index__")(); return v}catch(e){}
  }
  throw _b_.TypeError.$factory("'" + $B.class_name(value) +
      "' object cannot be interpreted as an integer")
}

$B.to_num = function(obj, methods){
    // If object's class defines one of the methods, return the result
    // of method(obj), else return null
    var expected_class = {
        "__complex__": _b_.complex,
        "__float__": _b_.float,
        "__index__": _b_.int,
        "__int__": _b_.int
    }
    var klass = obj.__class__ || $B.get_class(obj)
    for(var i = 0; i < methods.length; i++) {
        var missing = {},
            method = $B.$getattr(klass, methods[i], missing)
        if(method !== missing){
            var res = method(obj)
            if(!_b_.isinstance(res, expected_class[methods[i]])){
                console.log(res, methods[i], expected_class[methods[i]])
                throw _b_.TypeError.$factory(methods[i] + "returned non-" +
                    expected_class[methods[i]].$infos.__name__ +
                    "(type " + $B.get_class(res) +")")
            }
            return res
        }
    }
    return null
}


$B.PyNumber_Index = function(item){
    switch(typeof item){
        case "boolean":
            return item ? 1 : 0
        case "number":
            return item
        case "object":
            if(item.__class__ === $B.long_int){return item}
            var method = $B.$getattr(item, "__index__", _b_.None)
            if(method !== _b_.None){
                method = typeof method == "function" ?
                            method : $B.$getattr(method, "__call__")
                return $B.int_or_bool(method)
            }
        default:
            throw _b_.TypeError.$factory("'" + $B.class_name(item) +
                "' object cannot be interpreted as an integer")
    }
}

$B.int_or_bool = function(v){
    switch(typeof v){
        case "boolean":
            return v ? 1 : 0
        case "number":
            return v
        case "object":
            if(v.__class__ === $B.long_int){return v}
            else{
                throw _b_.TypeError.$factory("'" + $B.class_name(v) +
                "' object cannot be interpreted as an integer")
            }
        default:
            throw _b_.TypeError.$factory("'" + $B.class_name(v) +
                "' object cannot be interpreted as an integer")
    }
}

$B.enter_frame = function(frame){
    // Enter execution frame : save on top of frames stack
    $B.frames_stack.push(frame)
}

$B.leave_frame = function(arg){
    // Leave execution frame
    if($B.frames_stack.length == 0){console.log("empty stack"); return}
    $B.del_exc()
    $B.frames_stack.pop()
}

var min_int = Math.pow(-2, 53), 
    max_int = Math.pow(2, 53) - 1

$B.is_safe_int = function(){
    for(var i = 0; i < arguments.length; i++){
        var arg = arguments[i]
        if(arg < min_int || arg > max_int){return false}
    }
    return true
}

$B.is_none = function(o){
    return o === undefined || o === null || o == _b_.None
}

})(__BARAGWIN__)
