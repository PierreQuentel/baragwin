;(function($B){

var bltns = $B.InjectBuiltins()
eval(bltns)

var object = _b_.object,
    str_hash = _b_.str.__hash__,
    $N = _b_.None

var set_ops = ["eq", "add", "sub", "and", "or", "xor", "le", "lt", "ge", "gt"]

$B.make_view = function(name, set_like){
    var klass = $B.make_class(name, function(items){
        return {
            __class__: klass,
            __dict__: _b_.dict.$factory(),
            counter: -1,
            items: items,
            len: items.length
        }
    })

    if(set_like){
        for(var i = 0, len = set_ops.length; i < len; i++){
            var op = "__" + set_ops[i] + "__"
            klass[op] = (function(op){
                return function(self, other){
                    // compare set of items to other
                    return _b_.set[op](_b_.set.$factory(self),
                        _b_.set.$factory(other))
                }
            })(op)
        }
    }
    klass.__iter__ = function(self){
        var it = klass.$iterator.$factory(self.items)
        it.len_func = self.len_func
        return it
    }
    klass.__repr__ = function(self){
        return klass.$infos.__name__ + '(' + _b_.repr(self.items) + ')'
    }

    $B.set_func_names(klass, "builtins")
    return klass
}

// Special version of __next__ for iterators on dict keys / values / items.
// Checks that the dictionary size didn't change during iteration.
function dict_iterator_next(self){
    if(self.len_func() != self.len){
        throw RuntimeError.$factory("dictionary changed size during iteration")
    }
    self.counter++
    if(self.counter < self.items.length){
        return self.items[self.counter]
    }
    throw _b_.StopIteration.$factory("StopIteration")
}

var dict = {
    __class__: _b_.type,
    __mro__: [object],
    $infos: {
        __module__: "builtins",
        __name__: "dict"
    },
    $is_class: true,
    $native: true
}

function to_list(d, ix){
    var items = [],
        item

    if(d.$jsobj){
        items = []
        for(var attr in d.$jsobj){
            if(attr.charAt(0) != "$"){
                var val = d.$jsobj[attr]
                if(val === undefined){val = _b_.NotImplemented}
                else if(val === null){val = $N}
                items.push([attr, val])
            }
        }
    }else{
        for(var k in d.$numeric_dict){
            items.push([parseFloat(k), d.$numeric_dict[k]])
        }

        for(var k in d.$string_dict){items.push([k, d.$string_dict[k]])}

        for(var k in d.$object_dict){
            d.$object_dict[k].forEach(function(item){
                items.push(item)
            })
        }
    }

    if(ix !== undefined){
        return items.map(function(item){return item[ix]})
    }else{
        items.__class__ = _b_.tuple
        return items.map(function(item){
            item.__class__ = _b_.tuple; return item}
        )
    }
}

$B.dict_to_list = to_list // used in py_types.js

// Special version of __next__ for iterators on dict keys / values / items.
// Checks that the dictionary size didn't change during iteration.
function dict_iterator_next(self){
    if(self.len_func() != self.len){
        throw RuntimeError.$factory("dictionary changed size during iteration")
    }
    self.counter++
    if(self.counter < self.items.length){
        return self.items[self.counter]
    }
    throw _b_.StopIteration.$factory("StopIteration")
}


var $copy_dict = function(left, right){
    var _l = to_list(right),
        si = dict.$setitem
    right.$version = right.$version || 0
    var right_version = right.$version || 0
    for(var i = 0, len = _l.length; i < len; i++){
        si(left, _l[i][0], _l[i][1])
        if(right.$version != right_version){
            throw _b_.RuntimeError.$factory("dict mutated during update")
        }
    }
}

function rank(self, hash, key){
    // Search if object key, with hash = hash(key), is in
    // self.$object_dict
    var pairs = self.$object_dict[hash]
    if(pairs !== undefined){
        for(var i = 0, len = pairs.length; i < len; i++){
            if($B.rich_comp("__eq__", key, pairs[i][0])){
                return i
            }
        }
    }
    return -1
}

dict.__bool__ = function () {
    var $ = $B.args("__bool__", 1, {self: null}, ["self"],
        arguments, {}, null, null)
    return dict.__len__($.self) > 0
}

dict.__contains__ = function(){

    var $ = $B.args("__contains__", 2, {self: null, key: null},
        ["self", "key"], arguments, {}, null, null),
        self = $.self,
        key = $.key

    if(self.$is_namespace){key = $B.to_alias(key)} // issue 1244

    if(self.$jsobj){
        return self.$jsobj[key] !== undefined
    }

    switch(typeof key) {
        case "string":
            return self.$string_dict[key] !== undefined
        case "number":
            return self.$numeric_dict[key] !== undefined
    }

    var hash = _b_.hash(key)
    if(self.$str_hash[hash] !== undefined &&
        $B.rich_comp("__eq__", key, self.$str_hash[hash])){return true}
    if(self.$numeric_dict[hash] !== undefined &&
        $B.rich_comp("__eq__", key, hash)){return true}
    return rank(self, hash, key) > -1
}

dict.__delitem__ = function(){

    var $ = $B.args("__eq__", 2, {self: null, arg: null},
        ["self", "arg"], arguments, {}, null, null),
        self = $.self,
        arg = $.arg

    if(self.$jsobj){
        if(self.$jsobj[arg] === undefined){throw KeyError.$factory(arg)}
        delete self.$jsobj[arg]
        return $N
    }
    switch(typeof arg){
        case "string":
            if(self.$string_dict[arg] === undefined){
                throw KeyError.$factory(_b_.$str.$factory(arg))
            }
            delete self.$string_dict[arg]
            delete self.$str_hash[str_hash(arg)]
            self.$version++
            return $N
        case "number":
            if(self.$numeric_dict[arg] === undefined){
                throw KeyError.$factory(_b_.$str.$factory(arg))
            }
            delete self.$numeric_dict[arg]
            self.$version++
            return $N
    }
    // go with defaults

    var hash = _b_.hash(arg),
        ix

    if((ix = rank(self, hash, arg)) > -1){
        self.$object_dict[hash].splice(ix, 1)
    }else{
        throw KeyError.$factory(_b_.$str.$factory(arg))
    }

    self.$version++
    return $N
}

dict.eq = function(pos, kw){
    var $ = $B.args("eq", pos, kw, ["self", "other"]),
        self = $.self,
        other = $.other

    if(! other instanceof Map){
        throw _b_.TypeError.$factory("cannot compare dict and " +
            $B.class_name(other))
    }
    if(other.size != self.size){
        return false
    }
    for(const key of self.keys()){
        if((! other.has(key)) ||
            ! $B.compare.eq(self.get(key), other.get(key))){
            return false
        }
    }
    return true
}

dict.__hash__ = _b_.None

function init_from_list(self, args){
    var i = -1,
        stop = args.length - 1,
        si = dict.__setitem__
    while(i++ < stop){
        var item = args[i]
        switch(typeof item[0]) {
            case 'string':
                self.$string_dict[item[0]] = item[1]
                self.$str_hash[str_hash(item[0])] = item[0]
                break
            case 'number':
                self.$numeric_dict[item[0]] = item[1]
                break
            default:
                si(self, item[0], item[1])
                break
        }
    }
}


dict.len = function(pos, kw){
    var $ = $B.args("len", pos, kw, ["self"]),
        self = $.self,
        _count = 0

    if(self.$jsobj){
        for(var attr in self.$jsobj){if(attr.charAt(0) != "$"){_count++}}
        return _count
    }
    return self.size
}

dict.__ne__ = function(self, other){return ! dict.__eq__(self, other)}

dict.str = function(pos, kw){
    var $ = $B.args("str", pos, kw, ["self"]),
        self = $.self

    if(self.$jsobj){ // wrapper around Javascript object
        return dict.__repr__(jsobj2dict(self.$jsobj))
    }
    var res = [],
        key,
        value
    for(const [key, value] of self){
        if((!value.$jsobj && value === self) ||
                (self.$jsobj && value === self.$jsobj)){
            res.push(_b_.$repr(key) + ": {...}")
        }else{
            res.push(_b_.$repr(key) + ": " + _b_.$repr(value))
        }
    }
    return "{" + res.join(", ") + "}"
}

dict.clear = function(pos, kw){
    // Return a shallow copy of the dictionary
    var $ = $B.args("clear", pos, kw, ["self"])
    $.self.clear()
    return _b_.$None
}

dict.contains = function(pos, kw){
    var $ = $B.args("contains", pos, kw, ["self", "item"]),
        self = $.self,
        item = $.item
    return self.has(item)
}

dict.copy = function(pos, kw){
    // Return a shallow copy of the dictionary
    var $ = $B.args("copy", pos, kw, ["self"]),
        self = $.self,
        res = dict.$factory(),
        key,
        value
    for(const [key, value] of self.entries()){
        res.set(key, value)
    }
    return res
}

dict.get = function(pos, kw){
    var $ = $B.args("get", pos, kw, ["self", "key", "default"],
            {default: _b_.None})
    var res = $.self.get($.key)
    return res === undefined ? $.default : res
}

dict.update = function(self){

    var $ = $B.args("update", 1, {"self": null}, ["self"], arguments,
            {}, "args", "kw"),
        self = $.self,
        args = $.args,
        kw = $.kw
    if(args.length > 0){
        var o = args[0]
        if(isinstance(o, dict)){
            if(o.$jsobj){
                o = jsobj2dict(o.$jsobj)
            }
            $copy_dict(self, o)
        }else if(hasattr(o, "keys")){
            var _keys = _b_.list.$factory($B.$call($B.$getattr(o, "keys"))())
            for(var i = 0, len = _keys.length; i < len; i++){
                var _value = getattr(o, "__getitem__")(_keys[i])
                dict.$setitem(self, _keys[i], _value)
            }
        }else{
            var it = _b_.iter(o),
                i = 0
            while(true){
                try{
                    var item = _b_.next(it)
                }catch(err){
                    if(err.__class__ === _b_.StopIteration){break}
                    throw err
                }
                try{
                    key_value = _b_.list.$factory(item)
                }catch(err){
                    throw _b_.TypeError.$factory("cannot convert dictionary" +
                        " update sequence element #" + i + " to a sequence")
                }
                if(key_value.length !== 2){
                    throw _b_.ValueError.$factory("dictionary update " +
                        "sequence element #" + i + " has length " +
                        key_value.length + "; 2 is required")
                }
                dict.$setitem(self, key_value[0], key_value[1])
                i++
            }
        }
    }
    $copy_dict(self, kw)
    self.$version++
    return $N
}

dict.$factory = function(){
    var res = new Map(arguments)
    res.__class__ = dict
    return res
}

_b_.dict = dict

$B.set_func_names(dict, "builtins")

function jsobj2dict(x){
    var d = dict.$factory()
    for(var attr in x){
        if(attr.charAt(0) != "$" && attr !== "__class__"){
            if(x[attr] === undefined){
                continue
            }else if(x[attr].$jsobj === x){
                d.$string_dict[attr] = d
            }else{
                d.$string_dict[attr] = x[attr]
            }
        }
    }
    return d
}

$B.obj_dict = function(obj, from_js){
    var klass = obj.__class__ || $B.get_class(obj)
    if(klass !== undefined && klass.$native){
        throw _b_.AttributeError.$factory(klass.__name__ +
            " has no attribute '__dict__'")}
    var res = dict.$factory()
    res.$jsobj = obj
    res.$from_js = from_js // set to true if created by JSObject.to_dict()
    return res
}

})(__BARAGWIN__)
