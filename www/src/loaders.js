// Script with function to load scripts and modules, including indexedDB cache

(function($B){

var _b_ = $B.builtins

var loop = $B.loop = function(){
    if($B.tasks.length == 0){
        // No more task to process.
        if($B.idb_cx){
            $B.idb_cx.result.close()
            $B.idb_cx.$closed = true
        }
        return
    }
    var task = $B.tasks.shift(),
        func = task[0],
        args = task.slice(1)

    if(func == "execute"){
        try{
            var script = task[1],
                script_id = script.$name.replace(/\./g, "_"),
                module = $B.module.$factory(script.__name__)

            module.$src = script.$src
            module.$file = script.$file
            $B.imported[script_id] = module

            new Function("locals_" + script_id, script.js)(module)

        }catch(err){
            // If the error was not caught by the Python runtime, build an
            // instance of a Python exception
            if(err.$py_error === undefined){
                if($B.is_recursion_error(err)){
                    err = _b_.RecursionError.$factory("too much recursion")
                }else{
                    $B.print_stack()
                    err.__class__ = _b_.RuntimeError
                    err.args = [err.message]
                }
            }
            if($B.debug > 1){
                console.log("handle error", err.__class__, err.args,
                    err.frames)
            }
            $B.handle_error(err)
        }
        loop()
    }else{
        // Run function with arguments
        func.apply(null, args)
    }
}

$B.tasks = []

$B.handle_error = function(err){
    // Print the error traceback on the standard error stream
    if(err.__class__ !== undefined){
        var name = $B.class_name(err),
            trace = $B.$getattr(err, 'info')([], {})
        if(name == 'SyntaxError' || name == 'IndentationError'){
            var offset = err.args[3]
            trace += '\n    ' + ' '.repeat(offset) + '^' +
                '\n' + name + ': '+err.args[0]
        }else{
            trace += '\n' + name + ': ' + err.args
        }
    }else{
        trace = err + ""
    }
    try{
        _b_.getattr($B.stderr, 'write')(trace)
    }catch(print_exc_err){
        console.log(trace)
    }
    // Throw the error to stop execution
    throw err
}

})(__BARAGWIN__)
