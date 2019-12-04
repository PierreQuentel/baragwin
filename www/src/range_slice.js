// range
;(function($B){

var _b_ = $B.builtins,
    None = _b_.None,
    range = {
        __class__: _b_.type,
        __mro__: [_b_.object],
        $infos:{
            __module__: "builtins",
            __name__: "range"
        },
        $is_class: true,
        $native: true,
        $descriptors:{
            start: true,
            step: true,
            stop: true
        }
    }

range.__contains__ = function(self,other){
    if(range.__len__(self) == 0){return false}
    try{other = $B.int_or_bool(other)}
    catch(err){
        // If other is not an integer, test if it is equal to
        // one of the items in range
        try{range.index(self, other); return true}
        catch(err){return false}
    }

    var sub = $B.sub(other, self.start),
        fl = $B.floordiv(sub, self.step),
        res = $B.mul(self.step, fl)
    if($B.eq(res, sub)){
        if($B.gt(self.stop, self.start)){
            return $B.ge(other, self.start) && $B.gt(self.stop, other)
        }else{
            return $B.ge(self.start, other) && $B.gt(other, self.stop)
        }
    }else{
        return false
    }
}

range.__delattr__ = function(self, attr, value){
    throw _b_.AttributeError.$factory("readonly attribute")
}

range.__eq__ = function(self, other){
    if(_b_.isinstance(other, range)){
        var len = range.__len__(self)
        if(! $B.eq(len,range.__len__(other))){return false}
        if(len == 0){return true}
        if(! $B.eq(self.start,other.start)){return false}
        if(len == 1){return true}
        return $B.eq(self.step, other.step)
    }
    return false
}

function compute_item(r, i){
    var len = range.__len__(r)
    if(len == 0){return r.start}
    else if(i > len){return r.stop}
    return $B.add(r.start, $B.mul(r.step, i))
}

range.__getitem__ = function(self, rank){
    if(_b_.isinstance(rank, _b_.slice)){
        var norm = _b_.slice.$conv_for_seq(rank, range.__len__(self)),
            substep = $B.mul(self.step, norm.step),
            substart = compute_item(self, norm.start),
            substop = compute_item(self, norm.stop)
        return range.$factory(substart, substop, substep)
    }
    if(typeof rank != "number") {
      rank = $B.$GetInt(rank)
    }
    if($B.gt(0, rank)){rank = $B.add(rank, range.__len__(self))}
    var res = $B.add(self.start, $B.mul(rank, self.step))
    if(($B.gt(self.step, 0) &&
            ($B.ge(res, self.stop) || $B.gt(self.start, res))) ||
            ($B.gt(0, self.step) &&
                ($B.ge(self.stop, res) || $B.gt(res, self.start)))){
            throw _b_.IndexError.$factory("range object index out of range")
    }
    return res
}

range.__hash__ = function(self){
    var len = range.__len__(self)
    if(len == 0){return _b_.hash(_b_.tuple.$factory([0, None, None]))}
    if(len == 1){return _b_.hash(_b_.tuple.$factory([1, self.start, None]))}
    return _b_.hash(_b_.tuple.$factory([len, self.start, self.step]))
}

var RangeIterator = {
    __class__: _b_.type,
    __mro__: [_b_.object],

    __iter__: function(self){return self},

    __next__: function(self){return _b_.next(self.obj)},

    $infos:{
        __name__: "range_iterator",
        __module__: "builtins"
    }
}

RangeIterator.$factory = function(obj){
    return {__class__: RangeIterator, obj: obj}
}

$B.set_func_names(RangeIterator, "builtins")

range.__iter__ = function(self){
    var res = {
        __class__ : range,
        start: self.start,
        stop: self.stop,
        step: self.step
    }
    if(self.$safe){
        res.$counter = self.start - self.step
    }else{
        res.$counter = $B.sub(self.start, self.step)
    }
    return RangeIterator.$factory(res)
}

range.__len__ = function(self){
    var len
    if($B.gt(self.step, 0)){
        if($B.ge(self.start, self.stop)){return 0}
        // len is 1+(self.stop-self.start-1)/self.step
        var n = $B.sub(self.stop, $B.add(1, self.start)),
            q = $B.floordiv(n, self.step)
        len = $B.add(1, q)
    }else{
        if($B.ge(self.stop, self.start)){return 0}
        var n = $B.sub(self.start, $B.add(1, self.stop)),
            q = $B.floordiv(n, $B.mul(-1, self.step))
        len = $B.add(1, q)
    }
    if($B.maxsize === undefined){
        $B.maxsize = $B.long_int.__pow__($B.long_int.$factory(2), 63)
        $B.maxsize = $B.long_int.__sub__($B.maxsize, 1)
    }
    return len
}

range.__next__ = function(self){
    if(self.$safe){
        self.$counter += self.step
        if((self.step > 0 && self.$counter >= self.stop)
            || (self.step < 0 && self.$counter <= self.stop)){
                throw _b_.StopIteration.$factory("")
        }
    }else{
        self.$counter = $B.add(self.$counter, self.step)
        if(($B.gt(self.step, 0) && $B.ge(self.$counter, self.stop))
                || ($B.gt(0, self.step) && $B.ge(self.stop, self.$counter))){
            throw _b_.StopIteration.$factory("")
        }
    }
    return self.$counter
}

range.__reversed__ = function(self){
    var n = $B.sub(range.__len__(self), 1)
    return range.$factory($B.add(self.start, $B.mul(n, self.step)),
        $B.sub(self.start, self.step),
        $B.mul(-1, self.step))
}

range.__repr__ = range.__str__ = function(self){
    var res = "range(" + _b_.str.$(self.start) + ", " +
        _b_.str.$(self.stop)
    if(self.step != 1){res += ", " + _b_.str.$(self.step)}
    return res + ")"
}

range.__setattr__ = function(self, attr, value){
    throw _b_.AttributeError.$factory("readonly attribute")
}

// range descriptors
range.start = function(self){return self.start}
range.step = function(self){return self.step},
range.stop = function(self){return self.stop}

range.count = function(self, ob){
    if(_b_.isinstance(ob, [_b_.int, _b_.float, _b_.bool])){
        return _b_.int.$factory(range.__contains__(self, ob))
    }else{
        var comp = function(other){return $B.rich_comp("__eq__", ob, other)},
            it = range.__iter__(self),
            _next = RangeIterator.__next__,
            nb = 0
        while(true){
            try{
                if(comp(_next(it))){nb++}
            }catch(err){
                if(_b_.isinstance(err, _b_.StopIteration)){
                    return nb
                }
                throw err
            }
        }
    }
}

range.index = function(self, other){
    var $ = $B.args("index", 2, {self: null, other: null}, ["self", "other"],
        arguments, {}, null, null),
        self = $.self,
        other = $.other
    try{
        other = $B.int_or_bool(other)
    }catch(err){
        var comp = function(x){return $B.rich_comp("__eq__", other, x)},
            it = range.__iter__(self),
            _next = RangeIterator.__next__,
            nb = 0
        while(true){
            try{
                if(comp(_next(it))){return nb}
                nb++
            }catch(err){
                if(_b_.isinstance(err, _b_.StopIteration)){
                    throw _b_.ValueError.$factory(_b_.str.$(other) +
                        " not in range")
                }
                throw err
            }
        }
    }
    var sub = $B.sub(other, self.start),
        fl = $B.floordiv(sub, self.step),
        res = $B.mul(self.step, fl)
    if($B.eq(res, sub)){
        if(($B.gt(self.stop, self.start) && $B.ge(other, self.start)
                && $B.gt(self.stop, other)) ||
                ($B.ge(self.start, self.stop) && $B.ge(self.start, other)
                && $B.gt(other, self.stop))){
            return fl
        }else{throw _b_.ValueError.$factory(_b_.str.$(other) +
            ' not in range')}
    }else{
        throw _b_.ValueError.$factory(_b_.str.$(other) +
            " not in range")
    }
}

range.$factory = function(pos, kw){
    var $ = $B.args("range", pos, kw, ["start", "stop", "step"],
            {start: null, stop: null, step: null}),
        start = $.start,
        stop = $.stop,
        step = $.step,
        safe,
        value,
        counter = 0
    if(stop === null && step === null){
        if(start == null){
            throw _b_.TypeError.$factory("range expected 1 arguments, got 0")
        }
        stop = start
        value = 0
        step = 1
        safe = typeof stop === "number"
    }else{
        if(step === null){step = 1}
        start = $B.PyNumber_Index(start)
        stop = $B.PyNumber_Index(stop)
        step = $B.PyNumber_Index(step)
        if(step == 0){
            throw _b_.ValueError.$factory("range arg 3 must not be zero")
        }
        safe = (typeof start == "number" && typeof stop == "number" &&
            typeof step == "number")
        value = start
    }
    return {
        *[Symbol.iterator](){
            while(value < stop){
                yield value
                value += step
                counter++
            }
        }
    }
}

$B.set_func_names(range, "builtins")

var slice = function(pos, kw){
    var $ = $B.args("slice", pos, kw, ["start", "stop", "step"],
            {stop: _b_.None, step: _b_.None})
    return slice.$($.start, $.stop, $.step === _b_.None ? undefined : $.step)
}
slice.__class__ = _b_.type
slice.__name__ = "slice"

slice.$ = function*(start, stop, step){
    if(stop === _b_.None && step === undefined){
        start = 0
        stop = start
        step = 1
    }else{
        start = start === _b_.None ? 0 : start
        step = step === undefined ? 1 : step
    }
    var value = start

    if(step > 0 && stop >= start){
        while(value < stop){
            yield value
            value += step
        }
    }else if(step < 0 && stop <= start){
        while(value > stop){
            yield value
            value += step
        }
    }else{
        throw _b_.ValueError.$factory("wrong values for slice")
    }
}

slice.__eq__ = function(self, other){
    var conv1 = conv_slice(self),
        conv2 = conv_slice(other)
    return conv1[0] == conv2[0] &&
        conv1[1] == conv2[1] &&
        conv1[2] == conv2[2]
}

slice.__repr__ = slice.__str__ = function(self){
    return "slice(" + _b_.str.$(self.start) + ", " +
        _b_.str.$(self.stop) + ", " + _b_.str.$(self.step) + ")"
}

slice.__setattr__ = function(self, attr, value){
    throw _b_.AttributeError.$factory("readonly attribute")
}

function conv_slice(self){
    // Internal method, uses the integer len to set
    // start, stop, step to integers
    var attrs = ["start", "stop", "step"],
        res = []
    for(var i = 0; i < attrs.length; i++){
        var val = self[attrs[i]]
        if(val === _b_.None){
            res.push(val)
        }else{
            try{
                res.push($B.PyNumber_Index(val))
            }catch(err){
                throw _b_.TypeError.$factory("slice indices must be " +
                    "integers or None or have an __index__ method")
            }
        }
    }
    return res
}

slice.$conv_for_seq = function(self, len){
    // Internal method, uses the integer len to set
    // start, stop, step to integers
    var step = self.step === None ? 1 : $B.PyNumber_Index(self.step),
        step_is_neg = $B.gt(0, step),
        len_1 = $B.sub(len, 1)
    if(step == 0){
        throw _b_.ValueError.$factory('slice step cannot be zero')
    }
    var start
    if(self.start === None){
        start = step_is_neg ? len_1 : 0
    }else{
        start = $B.PyNumber_Index(self.start)
        if($B.gt(0, start)){start = $B.add(start, len)}
        if($B.gt(0, start)){start = step < 0 ? -1 : 0}
        if($B.ge(start, len)){start = step < 0 ? len_1 : len}
    }
    if(self.stop === None){
        stop = step_is_neg ? -1 : len
    }else{
        stop = $B.PyNumber_Index(self.stop)
        if($B.gt(0, stop)){stop += len}
        if($B.gt(0, stop)){stop = step < 0 ? -1 : 0}
        if($B.ge(stop, len)){stop = step_is_neg ? len_1 : len}
    }
    return {start: start, stop: stop, step: step}
}

slice.start = function(self){return self.start}
slice.step = function(self){return self.step}
slice.stop = function(self){return self.stop}

slice.indices = function(self, length){
    // This method takes a single integer argument length and computes
    // information about the slice that the slice object would describe if
    // applied to a sequence of length items. It returns a tuple of three
    // integers; respectively these are the start and stop indices and the
    // step or stride length of the slice. Missing or out-of-bounds indices
    // are handled in a manner consistent with regular slices.
    var $ = $B.args("indices", 2, {self: null, length: null},
            ["self", "length"], arguments, {}, null, null)
    var len = $B.$GetInt($.length)
    if(len < 0){_b_.ValueError.$factory("length should not be negative")}
    var _step = (self.step == _b_.None)? 1 : self.step
    if(_step < 0){
        var _start = self.start, _stop = self.stop
        _start = (_start == _b_.None)? len - 1 :
            (_start < 0)? _b_.max(-1, _start + len) : _b_.min(len - 1, self.start)
        _stop = (self.stop == _b_.None)? -1 :
            (_stop < 0)? _b_.max(-1, _stop + len) : _b_.min(len - 1, self.stop)
    }else{
        var _start = (self.start == _b_.None) ? 0 : _b_.min(len, self.start)
        var _stop = (self.stop == _b_.None)? len :_b_.min(len, self.stop)
        if(_start < 0){_start = _b_.max(0, _start + len)}
        if(_stop < 0){_stop=_b_.max(0, _stop + len)}
    }
    return _b_.tuple.$factory([_start, _stop, _step])
}


$B.set_func_names(slice, "builtins")

_b_.range = range
_b_.slice = slice

})(__BARAGWIN__)
