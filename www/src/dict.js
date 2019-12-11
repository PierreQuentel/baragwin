;(function($B){

var _b_ = $B.builtins

var dict = _b_.dict = {
    __class__: _b_.type,
    __name__: "dict"
}

dict.__bool__ = function () {
    var $ = $B.args("__bool__", 1, {self: null}, ["self"],
        arguments, {}, null, null)
    return dict.__len__($.self) > 0
}

dict.add = function(pos, kw){
    var $ = $B.args("update", pos, kw, ["self"], {}, "args", "kw"),
        self = $.self,
        args = $.args,
        kw = $.kw,
        res = new Map(),
        key,
        value
    for([key, value] of self){
        res.set(key, value)
    }
    args.forEach(function(arg){
        var key,
            value
        for([key, value] of arg){
            res.set(key, value)
        }
    })
    for(key in kw){
        res.set(key, kw[key])
    }
    return res
}

dict.delitem = function(pos, kw){
    var $ = $B.args("delitem", pos, kw, ["self", "key"]),
        self = $.self,
        key = $.key

    if(self.get(key) === undefined){
        throw _b_.KeyError.$factory(key)
    }
    self.delete(key)
    self.$version++
    return _b_.None
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

dict.str = function(pos, kw){
    var $ = $B.args("str", pos, kw, ["self"]),
        self = $.self
    var res = [],
        key,
        value
    for(const [key, value] of self){
        if((!value.$jsobj && value === self) ||
                (self.$jsobj && value === self.$jsobj)){
            res.push(_b_.str.$(key) + ": {...}")
        }else{
            res.push(_b_.str.$(key) + ": " + _b_.str.$(value))
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

dict.items = function(pos, kw){
    var $ = $B.args("items", pos, kw, ["self"])
    return $.self.entries()
}

dict.values = function(pos, kw){
    var $ = $B.args("values", pos, kw, ["self"])
    return $.self.values()
}

dict.$factory = function(pos, kw){
    var $ = $B.args("dict", pos, kw, [], {}, "args", "kw"),
        res = new Map()
    res.__class__ = dict
    var keys = new Set()
    $.args.forEach(function(arg){
        if(!Array.isArray(arg) || arg.length != 2){
            throw _b_.ValueError.$factory("dict argument must be a " +
                "2-element list, not " + $B.class_name(arg))
        }
        if(keys.has(arg[0])){
            throw _b_.ValueError.$factory("duplicate key: " + arg[0])
        }
        res.set(arg[0], arg[1])
        keys.add(arg[0])
    })
    for(var key in kw){
        if(keys.has(key)){
            throw _b_.ValueError.$factory("duplicate key: " + arg[0])
        }
        keys.add(key)
        res.set(key, kw[key])
    }
    return res
}

$B.set_func_names(dict, "builtins")

})(__BARAGWIN__)
