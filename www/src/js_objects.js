;(function($B){

var _b_ = $B.builtins,
    object = _b_.object

var _window = self;

$B.pyobj2structuredclone = function(obj){
    // If the Python object supports the structured clone algorithm, return
    // the result, else raise an exception
    if(typeof obj == "boolean" || typeof obj == "number" ||
            typeof obj == "string"){
        return obj
    }else if(obj instanceof Number){
        return obj.valueOf()
    }else if(Array.isArray(obj) || obj.__class__ === _b_.list ||
            obj.__class__ === _b_.tuple){
        var res = []
        for(var i = 0, len = obj.length; i < len; i++){
            res.push($B.pyobj2structuredclone(obj[i]))
        }
        return res
    }else if(obj.__class__ === _b_.dict){
        if(Object.keys(obj.$numeric_dict).length > 0 ||
                Object.keys(obj.$object_dict).length > 0){
            throw _b_.TypeError.$factory("a dictionary with non-string " +
                "keys cannot be sent to or from a Web Worker")
        }
        var res = {}
        for(var key in obj.$string_dict){
            res[key] = $B.pyobj2structuredclone(obj.$string_dict[key])
        }
        return res
    }else{
        console.log(obj, obj.__class__)
        return obj
    }
}
$B.structuredclone2pyobj = function(obj){
    if(obj === null){
        return _b_.None
    }else if(typeof obj == "boolean" || typeof obj == "number" ||
            typeof obj == "string"){
        return obj
    }else if(obj instanceof Number){
        return obj.valueOf()
    }else if(Array.isArray(obj) || obj.__class__ === _b_.list ||
            obj.__class__ === _b_.tuple){
        var res = _b_.list.$factory()
        for(var i = 0, len = obj.length; i < len; i++){
            res.push($B.structuredclone2pyobj(obj[i]))
        }
        return res
    }else if(typeof obj == "object"){
        var res = _b_.dict.$factory()
        for(var key in obj){
            res.$string_dict[key] = $B.structuredclone2pyobj(obj[key])
        }
        return res
    }else{
        console.log(obj, Array.isArray(obj),
            obj.__class__, _b_.list, obj.__class__ === _b_.list)
        throw _b_.TypeError.$factory(_b_.str.$(obj) +
            " does not support the structured clone algorithm")
    }

}

// Transforms a Javascript constructor into a Python function
// that returns instances of the constructor, converted to Python objects

var JSConstructor = {
    __class__: _b_.type,
    __mro__: [object],
    $infos: {
        __module__: "<javascript>",
        __name__: 'JSConstructor'
    },
    $is_class: true
}

JSConstructor.__call__ = function(self){
    // self.func is a constructor
    // It takes Javascript arguments so we must convert
    // those passed to the Python function
    return function(){
        var args = [null]
        for(var i = 0, len = arguments.length; i < len; i++){
            args.push(pyobj2jsobj(arguments[i]))
        }
        var factory = self.func.bind.apply(self.func, args)
        var res = new factory()
        // res is a Javascript object
        return $B.$JS2Py(res)
    }
}

JSConstructor.__getattribute__ = function(self, attr){
    // Attributes of a constructor are taken from the original JS object
    if(attr == "__call__"){
        return function(){
            var args = [null]
            for(var i = 0, len = arguments.length; i < len; i++){
                args.push(pyobj2jsobj(arguments[i]))
            }
            var factory = self.func.bind.apply(self.func, args)
            var res = new factory()
            // res is a Javascript object
            return $B.$JS2Py(res)
        }
    }
    return JSObject.__getattribute__(self, attr)
}

JSConstructor.$factory = function(obj){
    return {
        __class__: JSConstructor,
        js: obj,
        func: obj.js_func
    }
}

// Object used to convert Javascript undefined value
var UndefinedClass = $B.make_class("undefined",
    function(){return Undefined}
)
UndefinedClass.__bool__ = function(){return false}
UndefinedClass.__repr__ = function(){return "undefined"}
var Undefined = {
    __class__: UndefinedClass
}

$B.set_func_names(UndefinedClass, "<javascript>")

var jsobj2pyobj = $B.jsobj2pyobj = function(jsobj) {
    switch(jsobj){
      case true:
      case false:
        return jsobj
    }

    if(jsobj === undefined){return $B.Undefined}
    else if(jsobj === null){return _b_.None}

    if(Array.isArray(jsobj)){
        return _b_.list.$factory(jsobj.map(jsobj2pyobj))
    }

    if(typeof jsobj === 'number'){
       if(jsobj.toString().indexOf('.') == -1){
           return _b_.int.$(jsobj)
       }
       // for now, lets assume a float
       return new Number(jsobj)
    }

    if(jsobj.$nat === 'kw') {
        return jsobj
    }

    return JSObject.$factory(jsobj)
}

var pyobj2jsobj = $B.pyobj2jsobj = function(pyobj){
    // conversion of a Python object into a Javascript object
    if(pyobj === true || pyobj === false){return pyobj}
    if(pyobj === _b_.None){return null}
    if(pyobj === $B.Undefined){return undefined}

    var klass = $B.get_class(pyobj)
    if(klass === JSObject || klass === JSConstructor){
        // Instances of JSObject and JSConstructor are transformed into the
        // underlying Javascript object

        // If the object is a function, the JSObject has a js_func attribute,
        // which is the original Javascript function
        if(pyobj.js_func !== undefined){return pyobj.js_func}
        return pyobj.js

    }else if(_b_.isinstance(klass, $B.DOMNode)){

        // instances of DOMNode or its subclasses are transformed into the
        // underlying DOM element
        return pyobj.elt

    }else if([_b_.list, _b_.tuple].indexOf(klass) > -1){

        // Python list : transform its elements
        var res = []
        pyobj.forEach(function(item){
            res.push(pyobj2jsobj(item))
        })
        return res

    }else if(klass === _b_.dict){

        // Python dictionaries are transformed into a Javascript object
        // whose attributes are the dictionary keys
        var jsobj = {}
        var items = _b_.list.$factory(_b_.dict.items(pyobj))
        items.forEach(function(item){
            if(typeof item[1] == 'function'){
                // set "this" to jsobj
                item[1].bind(jsobj)
            }
            jsobj[item[0]] = pyobj2jsobj(item[1])
        })
        return jsobj

    }else if(klass === _b_.float){

        // Python floats are converted to the underlying value
        return pyobj.valueOf()

    }else if(typeof pyobj === "function"){
        // Transform arguments
        return function(){
            try{
                var args = []
                for(var i = 0; i < arguments.length; i++){
                    if(arguments[i] === undefined){args.push(_b_.None)}
                    else{args.push(jsobj2pyobj(arguments[i]))}
                }
                return pyobj2jsobj(pyobj.apply(this, [args]))
            }catch(err){
                console.log(err)
                console.log(_b_.getattr(err,'info'))
                console.log($B.class_name(err) + ':',
                    err.args.length > 0 ? err.args[0] : '' )
                throw err
            }
        }

    }else{
        // other types are left unchanged

        return pyobj

    }
}

// JSObject : wrapper around a native Javascript object

var JSObject = {
    __class__: _b_.type,
    __mro__: [object],
    $infos:{
        __module__: "builtins",
        __name__: 'JSObject'
    }
}

JSObject.attrs = function(pos, kw){
    var $ = $B.args("attrs", pos, kw, ["self"]),
        attrs = []
    for(var key in $.self.js){attrs.push(key)}
    return attrs
}

JSObject.__bool__ = function(self){
    return (new Boolean(self.js)).valueOf()
}

JSObject.__delattr__ = function(self, attr){
    _b_.getattr(self, attr) // raises AttributeError if necessary
    delete self.js[attr]
    return _b_.None
}

JSObject.__dir__ = function(self){
    return Object.keys(self.js)
}

JSObject.contains = function(pos, kw){
    var $ = $B.args("contains", pos, kw, ["self", "item"])
    if($.self.js[Symbol.iterator]){
        for(const item of $.self.js){
            if($B.compare.eq(item, $.item)){
                return true
            }
        }
        return false
    }
    throw _b_.TypeError.$factory("can't test membership in " +
        self.js)
}

JSObject.getattr = function(pos, kw){
    var $ = $B.args("getattr", pos, kw, ["obj", "attr"])
    return JSObject.$getattr($.obj, $.attr)
}

JSObject.$getattr = function(obj, attr){
    var test = false //"x"
    var res = obj.js[attr]
    if(test){
        console.log("attr", attr, "of", obj, res, JSObject[attr])
    }
    if(res !== undefined){
        if(typeof res == "function"){
            // obj.js[attr] is a Javascript function. It is transformed into
            // a function that take the parameters (pos, kw) and returns
            // res applied to the arguments in pos, kw transformed into the
            // matching JS objects
            // If one of the arguments passed is a function, it is a bg
            // function
            var f = function(pos, kw){
                var $ = $B.args(res.name, pos, kw, [], {}, "args"),
                    args = []
                $.args.forEach(function(arg){
                    args.push(pyobj2jsobj(arg))
                })
                return res.apply(obj.js, args)
            }
            var result = JSObject.$factory(f)
            result.js_func = res
            return result
        }else{
            return JSObject.$factory(res)
        }
    }else if(attr == "new" && typeof obj.js == "function"){
        // constructor
        var constr_wrapper = function(){
            var res = new (obj.js_func.bind(obj.js_func, arguments))
            return JSObject.$factory(res)
        }
        var result = JSObject.$factory(constr_wrapper)
        result.js_func = obj.js_func
        result.is_constructor = true
        return result
    }else if(attr == "hasattr"){
        return function(pos, kw){
            var $ = $B.args("hasattr", pos, kw, ["attr"])
            try{
                $B.$getattr(obj.js, $.attr)
                return true
            }catch(err){
                if(err.__class__ === _b_.AttributeError){
                    return false
                }
                throw err
            }
        }
    }else if(JSObject[attr] !== undefined){
        if(typeof JSObject[attr] == "function"){
            return function(pos, kw){
                var pos1 = pos.slice()
                pos1.splice(0, 0, obj)
                return JSObject[attr].call(null, pos1, kw)
            }
        }
        return JSObject[attr]
    }
}

JSObject.getitem = function(pos, kw){
    var $ = $B.args("getitem", pos, kw, ["self", "item"])
    if($.self.js.item){
        return JSObject.$factory($.self.js.item($.item))
    }else{
        throw _b_.TypeError.$factory(JSObject.str($.self) +
            " is not subscriptable")
    }
}

JSObject.__len__ = function(self){
    if(typeof self.js.length == 'number'){return self.js.length}
    try{return getattr(self.js, '__len__')()}
    catch(err){
        throw _b_.AttributeError.$factory(self.js + ' has no attribute __len__')
    }
}

JSObject.setattr = function(pos, kw){
    var $ = $B.args("setattr", pos, kw, ["self", "key", "value"])
    return JSObject.$setattr($.self, $.key, $.value)
}

JSObject.$setattr = function(self, key, value){
    self.js[key] = value
    return _b_.None
}

JSObject.str = function(pos, kw){
    var $ = $B.args("str", pos, kw, ["self"])
    if(typeof $.self.js == "function" && $.self.js_func){
        if($.self.is_constructor){
            return "<JS constructor " + $.self.js_func.name + ">"
        }else{
            return "<JS function " + $.self.js_func.name + ">"
        }
    }
    var proto = Object.getPrototypeOf($.self.js)
    if(proto){
        var name = proto.constructor.name
        if(name === undefined){ // IE
            var proto_str = proto.constructor.toString()
            name = proto_str.substring(8, proto_str.length - 1)
        }
        return "<" + name + " object>"
    }
    return $.self.js.toString()
}

JSObject.__setattr__ = function(self, attr, value){
    if(attr.substr && attr.substr(0,2) == '$$'){
        // aliased attribute names, eg "message"
        attr = attr.substr(2)
    }
    if(isinstance(value, JSObject)){self.js[attr] = value.js}
    else{
        self.js[attr] = value
        if(typeof value == 'function'){
            self.js[attr] = function(){
                var args = []
                for(var i = 0, len = arguments.length; i < len; i++){
                    args.push($B.$JS2Py(arguments[i]))
                }
                try{return value.apply(null, args)}
                catch(err){
                    err = $B.exception(err)
                    var info = _b_.getattr(err, 'info')
                    if(err.args.length > 0){
                        err.toString = function(){
                            return info + '\n' + $B.class_name(err) +
                            ': ' + _b_.repr(err.args[0])
                        }
                    }else{
                        err.toString = function(){
                            return info + '\n' + $B.class_name(err)
                        }
                    }
                    console.log(err + '')
                    throw err
                }
            }
        }
    }
}

JSObject.__setitem__ = JSObject.__setattr__

JSObject.__str__ = JSObject.__repr__

var no_dict = {'string': true, 'function': true, 'number': true,
    'boolean': true}

JSObject.bind = function(self, evt, func){
    var js_func = function(ev) {
        return func(jsobj2pyobj(ev))
    }
    self.js.addEventListener(evt, js_func)
    return _b_.None
}

JSObject.to_dict = function(self){
    // Returns a Python dictionary based on the underlying Javascript object
    return $B.obj_dict(self.js, true)
}

JSObject.$factory = function(obj){
    if(obj === null){return _b_.None}
    // If obj is a function, calling it with JSObject implies that it is
    // a function defined in Javascript. It must be wrapped in a JSObject
    // so that when called, the arguments are transformed into JS values
    if(typeof obj == 'function'){
        return {__class__: JSObject, js: obj, js_func: obj}
    }else if(obj instanceof Node){
        return $B.DOMNode.$factory(obj)
    }

    var klass = $B.get_class(obj)

    // If obj is a Python object, return it unchanged
    if(klass !== undefined){
        return obj
    }
    return {
        __class__: JSObject,
        js: obj
    }
}

$B.JSObject = JSObject
$B.JSConstructor = JSConstructor




})(__BARAGWIN__)

