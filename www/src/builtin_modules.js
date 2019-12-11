 ;(function($B) {
     var _b_ = $B.builtins
    var update = function(mod, data) {
        for(attr in data) {
            mod[attr] = data[attr]
        }
    }
    var _window = self;
    var modules = {}
    var browser = {
        $package: true,
        $is_package: true,
        __initialized__: true,
        __package__: 'browser',
        __file__: $B.baragwin_path.replace(/\/*$/g,'') +
            '/Lib/browser/__init__.py',

        bind:function(){
            // bind(element, event) is a decorator for callback function
            var $ = $B.args("bind", 3, {elt: null, evt: null, options: null},
                    ["elt", "evt", "options"], arguments,
                    {options: _b_.None}, null, null)
            var options = $.options
            if(typeof options == "boolean"){}
            else if(options.__class__ === _b_.dict){
                options = options.$string_dict
            }else{
                options == false
            }
            return function(callback){
                if($.elt.__class__ &&
                        _b_.issubclass($.elt.__class__, $B.JSObject)){
                    // eg window, Web Worker
                    function f(ev){
                        try{
                            return callback($B.JSObject.$factory(ev))
                        }catch(err){
                            $B.handle_error(err)
                        }
                    }
                    $.elt.js.addEventListener($.evt, f, options)
                    return callback
                }else if(_b_.isinstance($.elt, $B.DOMNode)){
                    // DOM element
                    $B.DOMNode.bind($.elt, $.evt, callback, options)
                    return callback
                }else if(_b_.isinstance($.elt, _b_.str)){
                    // string interpreted as a CSS selector
                    var items = document.querySelectorAll($.elt)
                    for(var i = 0; i < items.length; i++){
                        $B.DOMNode.bind($B.DOMNode.$factory(items[i]),
                            $.evt, callback, options)
                    }
                    return callback
                }
                try{
                    var it = $B.$iter($.elt)
                    while(true){
                        try{
                            var elt = _b_.next(it)
                            $B.DOMNode.bind(elt, $.evt, callback)
                        }catch(err){
                            if(_b_.isinstance(err, _b_.StopIteration)){
                                break
                            }
                            throw err
                        }
                    }
                }catch(err){
                    if(_b_.isinstance(err, _b_.AttributeError)){
                        $B.DOMNode.bind($.elt, $.evt, callback)
                    }
                    throw err
                }
                return callback
            }
        },

        console: self.console && $B.JSObject.$factory(self.console),
        self: $B.win,
        win: $B.win,
        $$window: $B.win,
    }
    browser.__path__ = browser.__file__

    if ($B.isNode) {
        delete browser.$$window
        delete browser.win
    }else if($B.isWebWorker){
        browser.is_webworker = true
        // In a web worker, name "window" is not defined, but name "self" is
        delete browser.$$window
        delete browser.win
        // browser.send is an alias for postMessage
        browser.self.js.send = self.postMessage
    } else {
        browser.is_webworker = false
        update(browser, {
            $$alert:function(message){
                window.alert(_b_.str.$(message))
            },
            confirm: $B.JSObject.$factory(window.confirm),
            $$document:$B.DOMNode.$factory(document),
            doc: $B.DOMNode.$factory(document), // want to use document instead of doc
            DOMEvent:$B.DOMEvent,
            DOMNode:$B.DOMNode,
            load:function(script_url){
                // Load and eval() the Javascript file at script_url
                var file_obj = $B.builtins.open(script_url)
                var content = $B.builtins.getattr(file_obj, 'read')()
                eval(content)
            },
            mouseCoords: function(ev){return $B.JSObject.$factory($mouseCoords(ev))},
            prompt: function(message, default_value){
                return $B.JSObject.$factory(window.prompt(message, default_value||''))
            },
            reload: function(){
                // Javascripts in the page
                var scripts = document.getElementsByTagName('script'),
                    js_scripts = []
                scripts.forEach(function(script){
                    if(script.type === undefined ||
                            script.type == 'text/javascript'){
                        js_scripts.push(script)
                        if(script.src){
                            console.log(script.src)
                        }
                    }
                })
                console.log(js_scripts)
                // Check if imported scripts have been modified
                for(var mod in $B.imported){
                    if($B.imported[mod].$last_modified){
                        console.log('check', mod, $B.imported[mod].__file__,
                            $B.imported[mod].$last_modified)
                    }else{
                        console.log('no date for mod', mod)
                    }
                }
            },
            run_script: function(){
                var $ = $B.args("run_script", 2, {src: null, name: null},
                    ["src", "name"], arguments, {name: "script_" + $B.UUID()},
                    null, null)
                $B.run_script($.src, $.name, true)
            },
            URLParameter:function(name) {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                results = regex.exec(location.search);
            results = results === null ? "" :
                decodeURIComponent(results[1].replace(/\+/g, " "));
            return _b_.str.$(results);
            }
        })

        // creation of an HTML element
        _b_.Html = {}

        var _b_ = $B.builtins
        var TagSum = $B.TagSum

        // All HTML 4, 5.x extracted from
        // https://w3c.github.io/elements-of-html/
        // HTML4.01 tags
        var tags = ['A','ABBR','ACRONYM','ADDRESS','APPLET','AREA','B','BASE',
                    'BASEFONT','BDO','BIG','BLOCKQUOTE','BODY','BR','BUTTON',
                    'CAPTION','CENTER','CITE','CODE','COL','COLGROUP','DD',
                    'DEL','DFN','DIR','DIV','DL','DT','EM','FIELDSET','FONT',
                    'FORM','FRAME','FRAMESET','H1','H2','H3','H4','H5','H6',
                    'HEAD','HR','HTML','I','IFRAME','IMG','INPUT','INS',
                    'ISINDEX','KBD','LABEL','LEGEND','LI','LINK','MAP','MENU',
                    'META','NOFRAMES','NOSCRIPT','OBJECT','OL','OPTGROUP',
                    'OPTION','P','PARAM','PRE','Q','S','SAMP','SCRIPT','SELECT',
                    'SMALL','SPAN','STRIKE','STRONG','STYLE','SUB','SUP', 'SVG',
                    'TABLE','TBODY','TD','TEXTAREA','TFOOT','TH','THEAD',
                    'TITLE','TR','TT','U','UL','VAR',
                    // HTML5 tags
                    'ARTICLE','ASIDE','AUDIO','BDI','CANVAS','COMMAND','DATA',
                    'DATALIST','EMBED','FIGCAPTION','FIGURE','FOOTER','HEADER',
                    'KEYGEN','MAIN','MARK','MATH','METER','NAV','OUTPUT',
                    'PROGRESS','RB','RP','RT','RTC','RUBY','SECTION','SOURCE',
                    'TEMPLATE','TIME','TRACK','VIDEO','WBR',
                    // HTML5.1 tags
                    'DETAILS','DIALOG','MENUITEM','PICTURE','SUMMARY']

        var svg_tags = ['a', 'altGlyph', 'altGlyphDef', 'altGlyphItem',
            'animate', 'animateColor', 'animateMotion',
            'animateTransform', 'circle', 'clipPath', 'color-profile',
            'cursor', 'defs', 'desc', 'ellipse', 'feBlend',
            'foreignObject', 'g', 'image', 'line', 'linearGradient',
            'marker', 'mask', 'path', 'pattern', 'polygon', 'polyline',
            'radialGradient', 'rect', 'set', 'stop', 'svg', 'text',
            'tref', 'tspan', 'use'],
            svg_ns = "http://www.w3.org/2000/svg"

        function maketag(tagName, svg){
            return function(pos, kw){
                var $ = $B.args(tagName, pos, kw, ["first"],
                        {first: _b_.None}, null, 'kw'),
                    first = $.first,
                    kw = $.kw
                if(svg){
                    var elt = document.createElementNS(svg_ns, tagName)
                }else{
                    var elt = document.createElement(tagName)
                }
                var self = $B.DOMNode.$factory(elt)
                if(first !== _b_.None){
                    if(_b_.isinstance(first, [_b_.str, _b_.int, _b_.float])){
                        // set "first" as HTML content (not text)
                        elt.innerHTML = _b_.str.$(first)
                    }else if(first.__class__ === TagSum){
                        for(const child of first.children){
                            elt.appendChild(child)
                        }
                    }else{
                        if(_b_.isinstance(first, $B.DOMNode)){
                            elt.appendChild(first)
                        }else{
                            try{
                                // If the argument is an iterable other than
                                // str, add the items
                                var items = $B.test_iter(first)
                                for(const item of items){
                                    $B.DOMNode.le([self, item])
                                }
                            }catch(err){
                                $B.handle_error(err)
                            }
                        }
                    }
                }

                // attributes
                var items = $.kw
                for(var key in items){
                    // keyword arguments
                    var value = items[key]
                    if(key.toLowerCase() == "style"){
                        $B.DOMNode.set_style(self, value)
                    }else{
                        if(value !== false){
                            // option.selected = false sets it to true :-)
                            try{
                                self.setAttribute(key, value)
                            }catch(err){
                                throw _b_.ValueError.$factory(
                                    "can't set attribute " + key)
                            }
                        }
                    }
                }
                return self
            }
        }

        for(const tag of tags){
            _b_.Html[tag] = maketag(tag)
        }

        for(const tag of svg_tags){
            _b_.Html.SVG[tag] = maketag(tag, true)
        }

    }

    modules['browser'] = browser

    modules['javascript'] = {
        $$this: function(){
            // returns the content of Javascript "this"
            // $B.js_this is set to "this" at the beginning of each function
            if($B.js_this === undefined){return $B.builtins.None}
            return $B.JSObject.$factory($B.js_this)
        },
        $$Date: self.Date && $B.JSObject.$factory(self.Date),
        JSConstructor: {
            __get__: function(){
                console.warn('"javascript.JSConstructor" is deprecrated. ' +
                    'Use window.<js constructor name>.new() instead.')
                return $B.JSConstructor
            },
            __set__: function(){
                throw _b_.AttributeError.$factory("read only")
            }
        },
        JSObject: {
            __get__: function(){
                console.warn('"javascript.JSObject" is deprecrated. To use ' +
                    'a Javascript object, use window.<object name> instead.')
                return $B.JSObject
            },
            __set__: function(){
                throw _b_.AttributeError.$factory("read only")
            }
        },
        JSON: {
            __class__: $B.make_class("JSON"),
            parse: function(s){
                return $B.structuredclone2pyobj(JSON.parse(s))
            },
            stringify: function(obj){
                return JSON.stringify($B.pyobj2structuredclone(obj))
            }
        },
        jsobj2pyobj:function(obj){return $B.jsobj2pyobj(obj)},
        load:function(script_url){
            console.log('"javascript.load" is deprecrated. ' +
                'Use browser.load instead.')
            // Load and eval() the Javascript file at script_url
            // Set the names in array "names" in the Javacript global namespace
            var file_obj = $B.builtins.open(script_url)
            var content = $B.builtins.getattr(file_obj, 'read')()
            eval(content)
        },
        $$Math: self.Math && $B.JSObject.$factory(self.Math),
        NULL: null,
        $$Number: self.Number && $B.JSObject.$factory(self.Number),
        py2js: function(src, module_name){
            if(module_name === undefined){
                module_name = '__main__' + $B.UUID()
            }
            return $B.py2js(src, module_name, module_name,
                $B.builtins_scope).to_js()
        },
        pyobj2jsobj:function(obj){return $B.pyobj2jsobj(obj)},
        $$RegExp: self.RegExp && $B.JSObject.$factory(self.RegExp),
        $$String: self.String && $B.JSObject.$factory(self.String),
        UNDEFINED: undefined
    }

    var arraybuffers = ["Int8Array", "Uint8Array", "Uint8ClampedArray",
        "Int16Array", "Uint16Array", "Int32Array", "Uint32Array",
        "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array"]
    arraybuffers.forEach(function(ab){
        if(self[ab] !== undefined){
            modules['javascript'][ab] = $B.JSObject.$factory(self[ab])
        }
    })

    // _sys module is at the core of _Baragwin since it is paramount for
    // the import machinery.
    // see https://github.com/baragwin-dev/baragwin/issues/189
    // see https://docs.python.org/3/reference/toplevel_components.html#programs
    var _b_ = $B.builtins
    modules['_sys'] = {
        // Called "Getframe" because "_getframe" wouldn't be imported in
        // sys.py with "from _sys import *"
        Getframe : function(depth){
            return $B._frame.$factory($B.frames_stack,
                $B.frames_stack.length - depth - 1)
        },
        exc_info: function(){
            for(var i = $B.frames_stack.length - 1; i >=0; i--){
                var frame = $B.frames_stack[i],
                    exc = frame[1].$current_exception
                if(exc){
                    return _b_.tuple.$factory([exc.__class__, exc,
                        $B.$getattr(exc, "__traceback__")])
                }
            }
            return _b_.tuple.$factory([_b_.None, _b_.None, _b_.None])
        },
        excepthook: function(exc_class, exc_value, traceback){
            $B.handle_error(exc_value)
        },
        modules: {
            __get__: function(){
                return $B.obj_dict($B.imported)
            },
            __set__: function(self, obj, value){
                 throw _b_.TypeError.$factory("Read only property 'sys.modules'")
            }
        },
        path: {
            __get__: function(){return $B.path},
            __set__: function(self, obj, value){
                 $B.path = value;
            }
        },
        meta_path: {
            __get__: function(){return $B.meta_path},
            __set__: function(self, obj, value){ $B.meta_path = value }
        },
        path_hooks: {
            __get__: function(){return $B.path_hooks},
            __set__: function(self, obj, value){ $B.path_hooks = value }
        },
        path_importer_cache: {
            __get__: function(){
                return _b_.dict.$factory($B.JSObject.$factory($B.path_importer_cache))
            },
            __set__: function(self, obj, value){
                throw _b_.TypeError.$factory("Read only property" +
                    " 'sys.path_importer_cache'")
            }
        },
        stderr: {
            __get__: function(){return $B.stderr},
            __set__: function(self, obj, value){$B.stderr = value},
            write: function(data){_b_.getattr($B.stderr,"write")(data)}
        },
        stdout: {
            __get__: function(){return $B.stdout},
            __set__: function(self, obj, value){$B.stdout = value},
            write: function(data){_b_.getattr($B.stdout,"write")(data)}
        },
        stdin: {
            __get__: function(){return $B.stdin},
            __set__: function(){
                throw _b_.TypeError.$factory("sys.stdin is read-only")
            }
        },
        vfs: {
            __get__: function(){
                if($B.hasOwnProperty("VFS")){return $B.obj_dict($B.VFS)}
                else{return _b_.None}
            },
            __set__: function(){
                throw _b_.TypeError.$factory("Read only property 'sys.vfs'")
            }
        }
    }

    function load(name, module_obj){
        // add class and __str__
        module_obj.__class__ = $B.module
        //module_obj.__file__ = '<builtin>'
        module_obj.__name__ = name
        $B.imported[name] = module_obj
        // set attribute "name" of functions
        for(var attr in module_obj){
            if(typeof module_obj[attr] == 'function'){
                var attr1 = $B.from_alias(attr)
                module_obj[attr].$infos = {
                    __name__: attr1,
                    __qualname__: name + '.' + attr1
                }
            }
        }
    }

    for(var attr in modules){load(attr, modules[attr])}
    if(!($B.isWebWorker || $B.isNode)){
        modules['browser'].html = modules['browser.html']
    }

    var _b_ = $B.builtins

    _b_.Math = $B.JSObject.$factory(Math)


    for(var attr in _b_){
        $B.builtins_scope.binding[attr] = true
    }


    // Set type of methods of builtin classes
    for(var name in _b_){
        if(_b_[name].__class__ === _b_.type){
            $B.builtin_classes.push(_b_[name]) // defined in builtins.js
        }
    }
    // Attributes of __BARAGWIN__ are Python lists
    for(var attr in $B){
        if(Array.isArray($B[attr])){
            $B[attr].__class__ = _b_.list
        }
    }

})(__BARAGWIN__)
