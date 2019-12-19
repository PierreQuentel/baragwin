// range
;(function($B){

var _b_ = $B.builtins

var range = function(pos, kw){
    var $ = $B.args("range", pos, kw, ["start", "stop", "step"],
            {stop: _b_.None, step: _b_.None})
    return range.$($.start, $.stop, $.step === _b_.None ? undefined : $.step)
}
range.__class__ = _b_.type
range.__name__ = "range"

range.$ = function(start, stop, step){
    var res = {
        __class__: range,
        start: start,
        stop: stop,
        step: step
    }
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
        res[Symbol.iterator] = function*(){
            while(value < stop){
                yield value
                value += step
            }
        }
    }else if(step < 0 && stop <= start){
        res[Symbol.iterator] = function*(){
            while(value > stop){
                yield value
                value += step
            }
        }
    }else{
        throw _b_.ValueError.$factory("wrong values for slice")
    }
    return res
}

range.str = function(pos, kw){
    var $ = $B.args("str", pos, kw, ["self"]),
        self = $.self
    return "range(" + _b_.str.$(self.start) + ", " +
        _b_.str.$(self.stop) + ", " + _b_.str.$(self.step) + ")"
}

_b_.range = range

var slice = function(pos, kw){
    var $ = $B.args("slice", pos, kw, ["start", "stop", "step"],
            {stop: _b_.None, step: _b_.None})
    return slice.$($.start, $.stop, $.step === _b_.None ? undefined : $.step)
}
slice.__class__ = _b_.type
slice.__name__ = "slice"

slice.$ = function(start, stop, step){
    var res = {
        __class__: slice
    }
    if(stop === _b_.None && step === undefined){
        res.start = 0
        res.stop = start
        res.step = 1
    }else{
        res.start = start === _b_.None ? 0 : start
        res.stop = stop
        res.step = step === undefined ? 1 : step
    }
    return res
}

slice.indices = function(self, t){
    // Return the list of indices in t defined by slice
    var start,
        stop,
        step
    if(self.stop === _b_.None && self.step === undefined){
        start = 0
        stop = t.length
        step = 1
    }else{
        start = self.start === _b_.None ? 0 : self.start
        stop = self.stop == _b_.None ? t.length : self.stop
        step = self.step === undefined ? 1 : self.step
    }
    start = start < 0 ? start + t.length : start
    stop = stop < 0 ? stop + t.length : stop

    var res = []
    if(stop >= start && step > 0){
        for(var i = start; i < stop; i += step){
            res.push(i)
        }
    }else if(stop <= start && step < 0){
        for(var i = start; i > stop; i += step){
            res.push(i)
        }
    }else{
        console.log(self, t, start, stop, step)
        throw _b_.ValueError.$factory("invalid values for slice " +
            _b_.slice.str([self]))
    }
    return res
}

slice.str = function(pos, kw){
    var $ = $B.args("str", pos, kw, ["self"]),
        self = $.self
    return "slice(" + _b_.str.$(self.start) + ", " +
        _b_.str.$(self.stop) + ", " + _b_.str.$(self.step) + ")"
}

_b_.slice = slice

})(__BARAGWIN__)
