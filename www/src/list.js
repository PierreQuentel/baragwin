;(function($B){

var _b_ = $B.builtins,
    object = _b_.object,
    getattr = $B.$getattr,
    isinstance = _b_.isinstance,
    $N = _b_.None

function check_not_tuple(self, attr){
    if(self.__class__ === tuple){
        throw _b_.AttributeError.$factory(
            "'tuple' object has no attribute '" + attr +"'")
    }
}

function $list(){
    // used for list displays
    // different from list : $list(1) is valid (matches [1])
    // but list(1) is invalid (integer 1 is not iterable)
    return list.$factory.apply(null, arguments)
}

var list = {
    __class__: _b_.type,
    __mro__: [object],
    $infos: {
        __module__: "builtins",
        __name__: "list"
    },
    $is_class: true,
    $native: true,
    __dir__: object.__dir__
}

list.add = function(pos, kw){
    var $ = $B.args("add", pos, kw, ["self", "other"])
    return list.$add($.self, $.other)
}

list.$add = function(self, other){
    if(! Array.isArray(other)){
        throw _b_.TypeError.$factory("cannot add list and " +
            $B.class_name(other))
    }
    return self.slice().concat(other)
}

list.contains = function(pos, kw){
    var $ = $B.args("contains", pos, kw, ["self", "item"]),
        self = $.self,
        item = $.item
    for(const elt of self){
        if($B.compare.eq(elt, item)){
            return true
        }
    }
    return false
}

list.__delitem__ = function(self, arg){

    if(isinstance(arg, _b_.int)){
        var pos = arg
        if(arg < 0){pos = self.length + pos}
        if(pos >= 0 && pos < self.length){
            self.splice(pos, 1)
            return $N
        }
        throw _b_.IndexError.$factory("list index out of range")
    }
    if(isinstance(arg, _b_.slice)) {
        var step = arg.step
        if(step === $N){step = 1}
        var start = arg.start
        if(start === $N){start = step > 0 ? 0 : self.length}
        var stop = arg.stop
        if(stop === $N){stop = step > 0 ? self.length : 0}
        if(start < 0){start = self.length + start}
        if(stop < 0){stop = self.length + stop}
        var res = [],
            i = null,
            pos = 0
        if(step > 0){
            if(stop > start){
                for(var i = start; i < stop; i += step){
                    if(self[i] !== undefined){res[pos++] = i}
                }
            }
        }else{
            if(stop < start){
                for(var i = start; i > stop; i += step){
                    if(self[i] !== undefined){res[pos++] = i}
                }
                res.reverse() // must be in ascending order
            }
        }
        // delete items from left to right
        var i = res.length
        while(i--){
           self.splice(res[i], 1)
        }
        return $N
    }

    if(_b_.hasattr(arg, "__int__") || _b_.hasattr(arg, "__index__")){
       list.__delitem__(self, _b_.int.$factory(arg))
       return $N
    }

    throw _b_.TypeError.$factory("list indices must be integer, not " +
        _b_.str.$factory(arg.__class__))
}

list.del = function(pos, kw){
    var $ = $B.args("del", obj, kw, ["self", "item"])
    return list.$del($.self, $.item)
}

list.$del = function(self, item){
    if(! typeof item == "number"){
        throw _b_.ValueError.$factory("list index should be int, not " +
            $B.class_name(item))
    }
    if(item < 0){
        item += self.length
    }
    if(self[item] === undefined){
        console.log("no item at index", self, item)
        throw _b_.IndexError.$factory(item)
    }
    self.splice(item, 1)
    return _b_.None
}

list.eq = function(pos, kw){
    var $ = $B.args("eq", pos, kw, ["self", "other"])
    return list.$eq($.self, $.other)
}

list.$eq = function(self, other){

    if(! Array.isArray(other)){
        throw _b_.TypeError.$factory("cannot compare list and " +
            $B.get_class(other))
    }
    if(other.length == self.length){
        var i = self.length
        while(i--){
            if(! $B.compare.eq(self[i], other[i])){
                return false
            }
        }
        return true
   }
   return false
}

list.__ge__ = function(self, other){
    if(! isinstance(other, [list, _b_.tuple])){
        return _b_.NotImplemented
    }
    var i = 0
    while(i < self.length){
        if(i >= other.length){return true}
        if($B.rich_comp("__eq__", self[i], other[i])){i++}
        else{
            res = getattr(self[i], "__ge__")(other[i])
            if(res === _b_.NotImplemented){
                throw _b_.TypeError.$factory("unorderable types: " +
                    $B.class_name(self[i])  + "() >= " +
                    $B.class_name(other[i]) + "()")
            }else{return res}
        }
    }

    return other.length == self.length
}

list.__gt__ = function(self, other){
    if(! isinstance(other, [list, _b_.tuple])){
        return _b_.NotImplemented
    }
    var i = 0
    while(i < self.length){
        if(i >= other.length){return true}
        if($B.rich_comp("__eq__", self[i], other[i])){i++}
        else{
            res = getattr(self[i], "__gt__")(other[i])
            if(res === _b_.NotImplemented){
                throw _b_.TypeError.$factory("unorderable types: " +
                    $B.class_name(self[i]) + "() > " +
                    $B.class_name(other[i]) + "()")
            }else return res
        }
    }
    // other starts like self, but is as long or longer
    return false
}

list.__hash__ = $N

list.__iadd__ = function() {
    var $ = $B.args("__iadd__", 2, {self: null, x: null}, ["self", "x"],
        arguments, {}, null, null)
    var radd = getattr($.x, "__radd__", _b_.NotImplemented)
    if(radd !== _b_.NotImplemented){return radd($.self)}
    var x = list.$factory($B.$iter($.x))
    for(var i = 0; i < x.length; i++){
        $.self.push(x[i])
    }
    return $.self
}

list.__imul__ = function() {
    var $ = $B.args("__imul__", 2, {self: null, x: null}, ["self", "x"],
        arguments, {}, null, null),
        x = $B.$GetInt($.x),
        len = $.self.length,
        pos = len
    if(x == 0){list.clear($.self); return $.self}
    for(var i = 1; i < x; i++){
        for(j = 0; j < len; j++){
            $.self[pos++] = $.self[j]
        }
    }
    return $.self
}

list.__le__ = function(self, other){
    var res = list.__ge__(self, other)
    if(res === _b_.NotImplemented){return res}
    return ! res
}

list.len = function(args){
    return args[0].length
}

list.__lt__ = function(self, other){
    if(! isinstance(other, [list, _b_.tuple])){
        return _b_.NotImplemented
    }
    var i = 0
    while(i < self.length){
        if(i >= other.length){return true}
        if($B.rich_comp("__eq__", self[i], other[i])){
            i++
        }else{
            res = getattr(self[i], "__lt__")(other[i])
            if(res === _b_.NotImplemented){
                throw _b_.TypeError.$factory("unorderable types: " +
                    $B.class_name(self[i])  + "() >= " +
                    $B.class_name(other[i]) + "()")
            }else{return res}
        }
    }
    // If all items are equal, return True if other is longer
    // Cf. issue #941
    return other.length > self.length
}

list.__mul__ = function(self, other){
    if(isinstance(other, _b_.int)) {  //this should be faster..
       var res = [],
           $temp = self.slice(),
           len = $temp.length
       for(var i = 0; i < other; i++){
           for(var j = 0; j < len; j++){res.push($temp[j])}
       }
       res.__class__ = self.__class__
       return res
    }

    if(_b_.hasattr(other, "__int__") || _b_.hasattr(other, "__index__")){
       return list.__mul__(self, _b_.int.$factory(other))
    }

    var rmul = $B.$getattr(other, "__rmul__", _b_.NotImplemented)
    if(rmul !== _b_.NotImplemented){
        return rmul(self)
    }

    throw _b_.TypeError.$factory(
        "can't multiply sequence by non-int of type '" +
        $B.class_name(other) + "'")
}

list.str = function(pos, args){
    var $ = $B.args("str", pos, args, ["self"]),
        self = $.self

    var res = []
    for(var i = 0; i < self.length; i++){
        if(self[i] === self){
            res.push('[...]')
        }else{
            res.push(_b_.str.$factory(self[i]))
        }
    }

    return "[" + res.join(", ") + "]"
}

list.$setitem = function(self, arg, value){
    // Used internally to avoid using $B.args
    if(typeof arg == "number" || isinstance(arg, _b_.int)){
        var pos = arg
        if(arg < 0) {pos = self.length + pos}
        if(pos >= 0 && pos < self.length){self[pos] = value}
        else {throw _b_.IndexError.$factory("list index out of range")}
        return $N
    }
    if(isinstance(arg, _b_.slice)){
        var s = _b_.slice.$conv_for_seq(arg, self.length)
        if(arg.step === null){$B.set_list_slice(self, s.start, s.stop, value)}
        else{$B.set_list_slice_step(self, s.start, s.stop, s.step, value)}
        return $N
    }

    if(_b_.hasattr(arg, "__int__") || _b_.hasattr(arg, "__index__")){
       list.__setitem__(self, _b_.int.$factory(arg), value)
       return $N
    }

    throw _b_.TypeError.$factory("list indices must be integer, not " +
        $B.class_name(arg))
}

list.__str__ = list.__repr__

// add "reflected" methods
$B.make_rmethods(list)

var _ops = ["add", "sub"]

list.append = function(args){
    var $ = $B.args("append", args, ["self", "x"])
    console.log("append", $.x)
    $.self.push($.x)
    return $N
}

list.clear = function(args){
    var $ = $B.args("clear", args, ["self"])
    while($.self.length){$.self.pop()}
    return $N
}

list.copy = function(args){
    var $ = $B.args("copy", args, ["self"])
    return $.self.slice()
}

list.count = function(args){
    var $ = $B.args("count", args, ["self", "x"])
    var res = 0,
        _eq = function(other){return $B.rich_comp("__eq__", $.x, other)},
        i = $.self.length
    while(i--){if(_eq($.self[i])){res++}}
    return res
}

list.extend = function(args){
    var $ = $B.args("extend", args, ["self", "t"])
    var other = list.$factory($B.$iter($.t))
    for(var i = 0; i < other.length; i++){$.self.push(other[i])}
    return $N
}

list.index = function(){
    var missing = {},
        $ = $B.args("index", 4, {self: null, x: null, start: null, stop: null},
            ["self", "x", "start" ,"stop"], arguments,
            {start: 0, stop: missing}, null, null),
        self = $.self,
        start = $.start,
        stop = $.stop
    var _eq = function(other){return $B.rich_comp("__eq__", $.x, other)}
    if(start.__class__ === $B.long_int){
        start = parseInt(start.value) * (start.pos ? 1 : -1)
    }
    if(start < 0){start = Math.max(0, start + self.length)}
    if(stop === missing){stop = self.length}
    else{
        if(stop.__class__ === $B.long_int){
            stop = parseInt(stop.value) * (stop.pos ? 1 : -1)
        }
        if(stop < 0){stop = Math.min(self.length, stop + self.length)}
        stop = Math.min(stop, self.length)
    }
    for(var i = start; i < stop; i++){
        if(_eq(self[i])){return i}
    }
    throw _b_.ValueError.$factory(_b_.str.$factory($.x) + " is not in list")
}

list.insert = function(){
    var $ = $B.args("insert", 3, {self: null, i: null, item: null},
        ["self", "i", "item"], arguments, {}, null, null)
    $.self.splice($.i,0,$.item)
    return $N
}

list.pop = function(pos, kw){
    var missing = {}
    var $ = $B.args("pop", pos, kw, ["self", "pos"], {pos: missing}),
        self = $.self,
        pos = $.pos
    if(pos === missing){pos = self.length - 1}
    if(pos < 0){pos += self.length}
    var res = self[pos]
    if(res === undefined){
        throw _b_.IndexError.$factory("pop index out of range")
    }
    self.splice(pos, 1)
    return res
}

list.remove = function(args){
    var $ = $B.args("remove", args, ["self", "x"])
    for(var i = 0, len = $.self.length; i < len; i++){
        if($B.rich_comp("__eq__", $.self[i], $.x)){
            $.self.splice(i, 1)
            return $N
        }
    }
    throw _b_.ValueError.$factory(_b_.str.$factory($.x) + " is not in list")
}

list.reverse = function(args){
    var $ = $B.args("reverse", args, ["self"]),
        _len = $.self.length - 1,
        i = parseInt($.self.length / 2)
    while(i--){
        var buf = $.self[i]
        $.self[i] = $.self[_len - i]
        $.self[_len - i] = buf
    }
    return $N
}

// QuickSort implementation found at http://en.literateprograms.org/Quicksort_(JavaScript)
function $partition(arg, array, begin, end, pivot)
{
    var piv = array[pivot]
    array = swap(array, pivot, end - 1)
    var store = begin
    if(arg === null){
        if(array.$cl !== false){
            // Optimisation : if all elements have the same type, the
            // comparison function __le__ can be computed once
            var le_func = _b_.getattr(array.$cl, "__le__")
            for(var ix = begin; ix < end - 1; ++ix) {
                if(le_func(array[ix], piv)) {
                    array = swap(array, store, ix);
                    ++store
                }
            }
        }else{
            for(var ix = begin; ix < end - 1; ++ix) {
                if(getattr(array[ix], "__le__")(piv)){
                    array = swap(array, store, ix)
                    ++store
                }
            }
        }
    }else{
        var len = array.length
        for(var ix = begin; ix < end - 1; ++ix){
            var x = arg(array[ix])
            // If the comparison function changes the array size, raise
            // ValueError
            if(array.length !== len){
                throw _b_.ValueError.$factory("list modified during sort")
            }
            if(getattr(x, "__le__")(arg(piv))){
                array = swap(array, store, ix)
                ++store
            }
        }
    }
    array = swap(array, end - 1, store)
    return store
}

function swap(_array, a, b){
    var tmp = _array[a]
    _array[a] = _array[b]
    _array[b] = tmp
    return _array
}

function $qsort(arg, array, begin, end){
    if(end - 1 > begin) {
        var pivot = begin + Math.floor(Math.random() * (end - begin))

        pivot = $partition(arg, array, begin, end, pivot)
        $qsort(arg, array, begin, pivot)
        $qsort(arg, array, pivot + 1, end)
    }
}

function $elts_class(self){
    // If all elements are of the same class, return it
    if(self.length == 0){return null}
    var cl = $B.get_class(self[0]),
        i = self.length

    while(i--){
        if($B.get_class(self[i]) !== cl){return false}
    }
    return cl
}

list.sort = function(args){
    var $ = $B.args("sort", args, ["self"], {}, null, "kw")

    check_not_tuple(self, "sort")
    var func = $N,
        reverse = false,
        kw_args = $.kw,
        keys = Object.keys(kw_args)

    for(const key of keys){
        if(key == "key"){func = kw_args[key]}
        else if(key == "reverse"){reverse = kw_args[key]}
        else{throw _b_.$TypeError.$factory("'" + key +
            "' is an invalid keyword argument for this function")}
    }
    if(self.length == 0){return}

    if(func !== $N){
        func = $B.$call(func) // func can be an object with method __call__
    }

    self.$cl = $elts_class(self)
    var cmp = null;
    if(func === $N && self.$cl === _b_.str){
        if(reverse){
            cmp = function(b, a){return $B.$AlphabeticalCompare(a, b)}
        }else{
            cmp = function(a, b){return $B.$AlphabeticalCompare(a, b)}
        }
    }else if(func === $N && self.$cl === _b_.int){
        if(reverse){
            cmp = function(b, a){return a - b}
        }else{
            cmp = function(a, b){return a - b}
        }
    }else{
        if(func === $N){
            if(reverse){
                cmp = function(b, a) {
                    res = getattr(a, "__le__")(b)
                    if(res === _b_.NotImplemented){
                        throw _b_.TypeError.$factory("unorderable types: " +
                            $B.class_name(b) + "() <=" +
                            $B.class_name(a) + "()")
                    }
                    if(res){
                        if(a == b){return 0}
                        return -1
                    }
                    return 1
                }
            }else{
                cmp = function(a, b){
                    res = getattr(a, "__le__")(b)
                    if(res === _b_.NotImplemented){
                        throw _b_.TypeError.$factory("unorderable types: " +
                            $B.class_name(a) + "() <=" +
                            $B.class_name(b) + "()")
                    }
                    if(res){
                        if(a == b){return 0}
                        return -1
                    }
                    return 1
                }
            }
        }else{
            if(reverse){
                cmp = function(b, a) {
                    var _a = func(a),
                        _b = func(b)
                    res = getattr(_a, "__le__")(_b)
                    if(res === _b_.NotImplemented){
                        throw _b_.TypeError.$factory("unorderable types: " +
                            $B.class_name(b) + "() <=" +
                            $B.class_name(a) + "()")
                    }
                    if(res){
                        if(_a == _b){return 0}
                        return -1
                    }
                    return 1
                }
            }else{
                cmp = function(a, b){
                    var _a = func(a),
                        _b = func(b)
                    res = $B.$getattr(_a, "__lt__")(_b)
                    if(res === _b_.NotImplemented){
                        throw _b_.TypeError.$factory("unorderable types: " +
                            $B.class_name(a) + "() <=" +
                            $B.class_name(b) + "()")
                    }
                    if(res){
                        if(_a == _b){return 0}
                        return -1
                    }
                    return 1
                }
            }

        }
    }
    $B.$TimSort(self, cmp)

    // Javascript libraries might use the return value
    return (self.__baragwin__ ? $N : self)
}

// function used for list literals
$B.$list = function(t){
    t.__class__ = list
    return t
}

// constructor for built-in type 'list'
list.$factory = function(){
    if(arguments.length == 0){return []}
    var $ = $B.args("list", 1, {obj: null}, ["obj"],
        arguments, {}, null, null),
        obj = $.obj

    if(Array.isArray(obj)){ // most simple case
        obj = obj.slice() // list(t) is not t
        obj.__baragwin__ = true;
        if(obj.__class__ == tuple){
            var res = obj.slice()
            res.__class__ = list
            return res
        }
        return obj
    }
    var res = [],
        pos = 0,
        arg = $B.$iter(obj),
        next_func = $B.$call(getattr(arg, "__next__"))

    while(1){
        try{
            res[pos++] = next_func()
        }catch(err){
            if(!isinstance(err, _b_.StopIteration)){throw err}
            break
        }
    }
    res.__baragwin__ = true // false for Javascript arrays - used in sort()
    return res
}

$B.set_func_names(list, "builtins")

_b_.list = list


})(__BARAGWIN__)
