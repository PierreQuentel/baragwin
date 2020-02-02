// Python to Javascript translation engine

;(function($B){

Number.isInteger = Number.isInteger || function(value) {
  return typeof value === 'number' &&
    isFinite(value) &&
    Math.floor(value) === value
};

Number.isSafeInteger = Number.isSafeInteger || function (value) {
   return Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
};

var js,$pos,res,$op
var _b_ = $B.builtins
var _window
if ($B.isNode){
    _window={ location: {
        href:'',
        origin: '',
        pathname: ''} }
} else {
    _window=self
}

/*
Utility functions
=================
*/

// Return a clone of an object
var clone = $B.clone = function(obj){
    var res = {}
    for(var attr in obj){res[attr] = obj[attr]}
    return res
}

// Last element in a list
$B.last = function(table){return table[table.length - 1]}

// Convert a list to an object indexed with list values
$B.list2obj = function(list, value){
    var res = {},
        i = list.length
    if(value === undefined){value = true}
    while(i-- > 0){res[list[i]] = value}
    return res
}

/*
Internal variables
==================
*/

// Mapping between operators and special Python method names
$B.op2method = {
    operations: {
        "**": "pow", "//": "floordiv", "<<": "lshift", ">>": "rshift",
        "+": "add", "-": "sub", "*": "mul", "/": "truediv", "%": "mod"
    },
    augmented_assigns: {
        "//=": "ifloordiv", ">>=": "irshift", "<<=": "ilshift", "**=": "ipow",
        "+=": "iadd","-=": "isub", "*=": "imul", "/=": "itruediv",
        "%=": "imod", "&=": "iand","|=": "ior","^=": "ixor"
    },
    binary: {
        "&": "and", "|": "or", "~": "invert", "^": "xor"
    },
    comparisons: {
        "<": "lt", ">": "gt", "<=": "le", ">=": "ge", "==": "eq", "!=": "ne"
    },
    boolean: {
        "or": "or", "and": "and", "in": "in", "not": "not", "is": "is",
        "not_in": "not_in", "is_not": "is_not" // fake
    },
    subset: function(){
        var res = {},
            keys = []
        if(arguments[0] == "all"){
            keys = Object.keys($B.op2method)
            keys.splice(keys.indexOf("subset"), 1)
        }else{
            for(var i = 0, len=arguments.length; i < len; i++){
                keys.push(arguments[i])
            }
        }
        for(var i = 0, len = keys.length; i < len; i++){
            var key = keys[i],
                ops = $B.op2method[key]
            if(ops === undefined){throw Error(key)}
            for(var attr in ops){
                res[attr] = ops[attr]
            }
        }
        return res
    }
}

var $operators = $B.op2method.subset("all")

// Mapping between augmented assignment operators and method names
var $augmented_assigns = $B.augmented_assigns = $B.op2method.augmented_assigns

// Names that can't be assigned to
var noassign = $B.list2obj(['True', 'False', 'None', '__debug__'])

// Operators weight for precedence
var $op_order = [['or'], ['and'], ['not'],
    ['in','not_in'],
    ['<', '<=', '>', '>=', '!=', '==', 'is', 'is_not'],
    ['|'],
    ['^'],
    ['&'],
    ['>>', '<<'],
    ['+'],
    ['-'],
    ['*', '/', '//', '%'],
    ['unary_neg', 'unary_inv', 'unary_pos'],
    ['**']
]

var $op_weight = {},
    $weight = 1
$op_order.forEach(function(_tmp){
    _tmp.forEach(function(item){
        $op_weight[item] = $weight
    })
    $weight++
})

// Variable used to generate random names used in loops
var $loop_num = 0

var create_temp_name = function(prefix) {
    var _prefix = prefix || '$temp'
    return _prefix + $loop_num ++;
}


// Variable used for chained comparison
var chained_comp_num = 0

/*
Function called in case of SyntaxError
======================================
*/

var $_SyntaxError = function (context, msg, indent){
    //console.log("syntax error", context, "msg", msg, "indent", indent)
    var ctx_node = context
    while(ctx_node.type !== 'node'){ctx_node = ctx_node.parent}
    var tree_node = ctx_node.node,
        root = tree_node
    while(root.parent !== undefined){root = root.parent}
    var module = tree_node.module,
        src = root.src,
        line_num = tree_node.line_num
    if(src){
        line_num = src.substr(0, $pos).split("\n").length
    }
    if(root.line_info){
        line_num = root.line_info
    }
    if(indent !== undefined){line_num++}
    if(indent === undefined){
        if(Array.isArray(msg)){
            $B.$SyntaxError(module, msg[0], src, $pos, line_num)
        }
        if(msg === "Triple string end not found"){
            // add an extra argument : used in interactive mode to
            // prompt for the rest of the triple-quoted string
            $B.$SyntaxError(module,
                'invalid syntax : triple string end not found',
                src, $pos, line_num, root)
        }
        $B.$SyntaxError(module, msg, src, $pos, line_num, root)
    }else{throw $B.$IndentationError(module, msg, src, $pos, line_num, root)}
}

/*
Class for Python abstract syntax tree
=====================================

An instance is created for the whole Python program as the root of the tree.

For each instruction in the Python source code, an instance is created
as a child of the block where it stands : the root for instructions at
module level, or a function definition, a loop, a condition, etc.
*/

/*
Function that checks that a context is not inside another incompatible
context. Used for (augmented) assignements */
function check_assignment(context){
    var ctx = context,
        forbidden = ['assert', 'del', 'raise', 'return']
    while(ctx){
        if(forbidden.indexOf(ctx.type) > -1){
            $_SyntaxError(context, 'invalid syntax - assign')
        }
        ctx = ctx.parent
    }
}

var $Node = function(type){
    this.type = type
    this.children = []
    this.yield_atoms = []

    this.add = function(child){
        // Insert as the last child
        this.children[this.children.length] = child
        child.parent = this
        child.module = this.module
    }

    this.insert = function(pos, child){
        // Insert child at position pos
        this.children.splice(pos, 0, child)
        child.parent = this
        child.module = this.module
    }

    this.toString = function(){return "<object 'Node'>"}

    this.show = function(indent){
        // For debugging purposes
        var res = ''
        if(this.type === 'module'){
            this.children.forEach(function(child){
                res += child.show(indent)
            })
            return res
        }

        indent = indent || 0
        res += ' '.repeat(indent)
        res += this.context
        if(this.children.length > 0){res += '{'}
        res +='\n'
        this.children.forEach(function(child){
           res += '[' + i + '] ' + child.show(indent + 4)
        })
        if(this.children.length > 0){
          res += ' '.repeat(indent)
          res += '}\n'
        }
        return res
    }

    this.to_js = function(indent){
        // Convert the node into a string with the translation in Javascript

        if(this.js !== undefined){return this.js}

        this.res = []
        this.unbound = []
        if(this.type === 'module'){
            this.children.forEach(function(child){
                this.res.push(child.to_js())
            }, this)
            this.js = this.res.join('')
            return this.js
        }
        indent = indent || 0
        var ctx_js = this.context.to_js()
        if(ctx_js){ // empty for "global x"
          this.res.push(' '.repeat(indent))
          this.res.push(ctx_js)
          if(this.children.length > 0){this.res.push('{')}
          this.res.push('\n')
          this.children.forEach(function(child){
              this.res.push(child.to_js(indent + 4))
          }, this)
          if(this.children.length > 0){
             this.res.push(' '.repeat(indent))
             this.res.push('}\n')
          }
        }
        this.js = this.res.join('')

        return this.js
    }

    this.transform = function(rank){
        // Apply transformations to each node recursively
        // Returns an offset : in case children were inserted by transform(),
        // we must jump to the next original node, skipping those that have
        // just been inserted

        if(this.type === 'module'){
            // module doc string
            this.$doc = $get_docstring(this)
            var i = 0
            while(i < this.children.length){
                var offset = this.children[i].transform(i)
                if(offset === undefined){offset = 1}
                i += offset
            }
        }else{
            var elt = this.context.tree[0], ctx_offset
            if(elt === undefined){
                console.log(this)
            }
            if(elt.transform !== undefined){
                ctx_offset = elt.transform(this, rank)
            }
            var i = 0
            while(i < this.children.length){
                var offset = this.children[i].transform(i)
                if(offset === undefined){offset = 1}
                i += offset
            }
            if(ctx_offset === undefined){ctx_offset = 1}

            return ctx_offset
        }
    }

    this.clone = function(){
        var res = new $Node(this.type)
        for(var attr in this){res[attr] = this[attr]}
        return res
    }

}

/*
Context classes
===============

In the parser, for each token found in the source code, a
new context is created by a call like :

    new_context = $transition(current_context, token_type, token_value)

For each new instruction, an instance of $Node is created ; it receives an
attribute "context" which is an initial, empty context.

For instance, if the first token is the keyword "assert", the new_context
is an instance of class AssertCtx, in a state where it expects an
expression.

Most contexts have an attribute "tree", a list of the elements associated
with the keyword or the syntax element (eg the arguments in a function
definition).

For contexts that need transforming the Baragwin instruction into several
Javascript instructions, a method transform(node, rank) is defined. It is
called by the method transform() on the root node (the top level instance of
$Node).

Most contexts have a method to_js() that return the Javascript code for
this context. It is called by the method to_js() of the root node.
*/

var AbstractExprCtx = function(context, with_commas){
    this.type = 'abstract_expr'
    // allow expression with comma-separated values, or a single value ?
    this.with_commas = with_commas
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){
        return '(abstract_expr ' + with_commas + ') ' + this.tree
    }

    this.to_js = function(){
        this.js_processed = true
        if(this.type === 'list') return '[' + $to_js(this.tree) + ']'
        return $to_js(this.tree)
    }
}

var AliasCtx = function(context){
    // Class for context manager alias
    this.type = 'ctx_manager_alias'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length - 1].alias = this
}

var AssignCtx = function(context, expression){
    /*
    Class for the assignment operator "="
    context is the left operand of assignment
    This check is done when the AssignCtx object is created, but must be
    disabled if a new AssignCtx object is created afterwards by method
    transform()
    */
    check_assignment(context)
    if(context.type == "expr" && context.tree[0].type == "lambda"){
        $_SyntaxError(context, ["cannot assign to lambda"])
    }

    this.type = 'assign'
    if(expression == 'expression'){
        this.expression = true
        console.log("parent of assign expr", context.parent)
    }
    // replace parent by "this" in parent tree
    context.parent.tree.pop()
    context.parent.tree[context.parent.tree.length] = this

    this.parent = context.parent
    this.tree = [context]

    var scope = $get_scope(this)
    if(context.type == 'expr' && context.tree[0].type == 'call'){
          $_SyntaxError(context, ["can't assign to function call "])
    }else if(context.type == 'list_or_tuple' ||
            (context.type == 'expr' && context.tree[0].type == 'list_or_tuple')){
        if(context.type == 'expr'){context = context.tree[0]}
        // Bind all the ids in the list or tuple
        context.bind_ids(scope)
    }else{
        var assigned = context.tree[0]
        if(assigned && assigned.type == 'id'){
            if(noassign[assigned.value] === true){
                $_SyntaxError(context,["can't assign to keyword"])
            }
            // Attribute bound of an id indicates if it is being
            // bound, as it is the case in the left part of an assignment
            assigned.bound = true
            // A value is going to be assigned to a name
            // After assignment the name will be bound to the current
            // scope
            // We must keep track of the list of bound names before
            // this assignment, because in code like
            //
            //    range = range
            //
            // the right part of the assignement must be evaluated
            // first, and it is the builtin "range"
            var node = $get_node(this)
            node.bound_before = Object.keys(scope.binding)
            $bind(assigned.value, scope, this)
        }else if(["str", "int", "float", "complex"].indexOf(assigned.type) > -1){
            $_SyntaxError(context, ["can't assign to literal"])
        }else if(assigned.type == "unary"){
            $_SyntaxError(context, ["can't assign to operator"])
        }
    }

    this.guess_type = function(){
        return
    }

    this.toString = function(){
        return '(assign) ' + this.tree[0] + '=' + this.tree[1]
    }

    this.transform = function(node, rank){
        // rank is the rank of this line in node
        var scope = $get_scope(this)

        var left = this.tree[0],
            right = this.tree[1],
            assigned = []

        var left_items = null
        switch(left.type){
            case 'expr':
                if(left.tree.length > 1){
                    left_items = left.tree
                }else if(left.tree[0].type == 'list_or_tuple' ||
                        left.tree[0].type == 'target_list'){
                    left_items = left.tree[0].tree
                }else if(left.tree[0].type == 'id'){
                    // simple assign : set attribute "bound" for name resolution
                    var name = left.tree[0].value
                    left.tree[0].bound = true
                }
                break
            case 'target_list':
            case 'list_or_tuple':
                left_items = left.tree
        }

        var right = this.tree[1]
        if(left_items === null){
            if(left.tree[0].bound){
                if(right.type == "expr" && right.name == "int"){
                    node.bindings = node.bindings || {}
                    node.bindings[left.tree[0].value] = "int"
                }
            }
            return
        }

        var right_items = null
        if(right.type == 'list_or_tuple'||
                (right.type == 'expr' && right.tree.length > 1)){
            right_items = right.tree
        }

        if(right_items !== null){ // form x, y = a, b
            node.parent.children.splice(rank,1) // remove original line
            if(right_items.length > left_items.length){
                node.parent.insert(rank,
                    NodeJS("throw _b_.ValueError.$factory(" +
                        '"too many values to unpack (expected ' +
                        left_items.length + ')")'))
                return
            }else if(right_items.length < left_items.length){
                node.parent.insert(rank,
                    NodeJS("throw _b_.ValueError.$factory(" +
                        '"need more than ' + right_items.length +
                        ' to unpack")'))
                return
            }
            var new_nodes = [],
                pos = 0
            new_nodes.push(NodeJS("var right" + $loop_num +
                " = []"))
            var loop_node = NodeJS("for(const item" + $loop_num + " of " +
                right.to_js()+ ")")
            loop_node.add(NodeJS("right" + $loop_num + ".push(item" +
                $loop_num + ")"))
            new_nodes.push(loop_node)
            left_items.forEach(function(item, rank){
                if(item.type == "expr" && item.tree[0].type == "id"){
                    $bind(item.tree[0].value, scope, this.tree[0])
                }
                if(item.type == "expr" && item.tree[0].type == "attribute"){
                    var attr = item.tree[0]
                    new_nodes.push(NodeJS("$B.$setattr(" +
                        attr.value.to_js() + ', "' + attr.name + '", right' +
                        $loop_num + "[" + rank + "])"))
                }else{
                    new_nodes.push(NodeJS(item.to_js() + " = right" + $loop_num +
                        "[" + rank + "]"))
                }
            }, this)
            for(var i = new_nodes.length - 1; i >= 0; i--){
                node.parent.insert(rank, new_nodes[i])
            }
            $loop_num++
        }else{ // form x, y = a

            node.parent.children.splice(rank, 1) // remove original line

            // evaluate right argument (it might be a function call)
            var rname = create_temp_name('right'),
                rlname = create_temp_name('rlist'),
                rjs = right.to_js()

            var new_node = NodeJS('var ' + rlname + ' = $B.to_list(' +
                rjs + ", " + left_items.length +")")
            new_node.line_num = node.line_num // set attribute line_num for debugging
            node.parent.insert(rank++, new_node)

            // If there is a packed tuple in the list of left items, store
            // its rank in the list
            var packed = null
            var min_length = left_items.length
            for(var i = 0; i < left_items.length; i++){
                var expr = left_items[i]
                if(expr.type == 'packed' ||
                        (expr.type == 'expr' && expr.tree[0].type == 'packed')){
                    packed = i
                    min_length--
                    break
                }
            }

            left_items.forEach(function(left_item, i){

                var new_node = new $Node()
                new_node.id = scope.id
                new_node.line_num = node.line_num
                node.parent.insert(rank++, new_node)
                var context = new NodeCtx(new_node) // create ordinary node
                left_item.parent = context
                // assignment to left operand
                var assign = new AssignCtx(left_item, false)
                var js = rlname
                if(packed == null || i < packed){
                    js += '[' + i + ']'
                }else if(i == packed){
                    js += '.slice(' + i + ',' + rlname + '.length-' +
                          (left_items.length - i - 1) + ')'
                }else{
                    js += '[' + rlname + '.length-' + (left_items.length - i) + ']'
                }
                assign.tree[1] = new $JSCode(js) // right part of the assignment
            })

            $loop_num++
        }
    }
    this.to_js = function(){
        this.js_processed = true
        if(this.parent.type == 'call'){ // like in foo(x=0)
            return '{$nat:"kw",name:' + this.tree[0].to_js() +
                ',value:' + this.tree[1].to_js() + '}'
        }

        // assignment
        var left = this.tree[0]
        while(left.type == 'expr'){left = left.tree[0]}

        var right = this.tree[1]
        if(left.type == 'attribute' || left.type == 'sub'){
            // In case of an assignment to an attribute or a subscript, we
            // use setattr() and setitem
            // If the right part is a call to exec or eval, it must be
            // evaluated and stored in a temporary variable, before
            // setting the attribute to this variable
            // This is because the code generated for exec() or eval()
            // can't be inserted as the third parameter of a function

            var right_js = right.to_js()

            var res = '', rvar = '', $var = '$temp' + $loop_num
            if(right.type == 'expr' && right.tree[0] !== undefined &&
                    right.tree[0].type == 'call' &&
                    ('eval' == right.tree[0].func.value ||
                    'exec' == right.tree[0].func.value)) {
                res += 'var ' + $var + ' = ' + right_js + ';\n'
                rvar = $var
            }else if(right.type == 'expr' && right.tree[0] !== undefined &&
                    right.tree[0].type == 'sub'){
                res += 'var ' + $var + ' = ' + right_js + ';\n'
                rvar = $var
            }else{
                rvar = right_js
            }

            if(left.type == 'attribute'){ // assign to attribute
              $loop_num++
              left.func = 'setattr'
              var left_to_js = left.to_js()
              left.func = 'getattr'
              if(left.assign_self){
                return res + left_to_js[0] + rvar + left_to_js[1] + rvar + ')'
              }
              res += left_to_js
              res = res.substr(0, res.length - 1) // remove trailing )
              return res + ',' + rvar + ');'
            }
            if(left.type == 'sub'){ // assign to item

              return '$B.setitem(' + left.value.to_js() +
                      ',' + left.tree[0].to_js() + ',' + right_js + ')'
            }
        }
        return left.to_js() + ' = ' + right.to_js()
    }
}

var AsyncCtx = function(context){
    // Class for async : def, while, for
    this.type = 'async'
    this.parent = context
    context.async = true
    this.toString = function(){return '(async)'}
}

var AttrCtx = function(context){
    // Class for object attributes (eg x in obj.x)
    this.type = 'attribute'
    this.value = context.tree[0]
    this.parent = context
    context.tree.pop()
    context.tree[context.tree.length] = this
    this.tree = []
    this.func = 'getattr' // becomes setattr for an assignment

    this.toString = function(){return '(attr) ' + this.value + '.' + this.name}

    this.to_js = function(){
        this.js_processed = true
        var js = this.value.to_js()

        if(this.func == 'setattr'){
            // For setattr, use $B.$setattr which doesn't use $B.args to parse
            // the arguments
            return '$B.$setattr(' + js + ',"' + this.name + '")'
        }else{
            return '$B.$getattr(' + js + ',"' + this.name + '")'
        }
    }
}

var augmop2method = {
    "+=": "add",
    "-=": "sub",
    "*=": "mul",
    "/=": "div"
}

var AugmentedAssignCtx = function(context, op){
    // Class for augmented assignments such as "+="

    check_assignment(context)

    this.type = 'augm_assign'
    this.parent = context.parent
    context.parent.tree.pop()
    context.parent.tree[context.parent.tree.length] = this
    context.parent = this
    this.op = op
    this.tree = [context]

    var scope = this.scope = $get_scope(this)

    if(context.type == 'expr'){
        var assigned = context.tree[0]
        if(assigned.type == 'id'){
            assigned.augm_assign = true
            var name = assigned.value
            if(noassign[name] === true){
                $_SyntaxError(context, ["can't assign to keyword"])
            }else if(scope.ntype == 'def' &&
                    scope.binding[name] === undefined){
                // Augmented assign to a variable not yet defined in
                // local scope : set attribute "unbound" to the id. If not
                // defined in the rest of the block this will raise an
                // UnboundLocalError
                assigned.unbound = true
            }
        }else if(['str', 'int', 'float', 'complex'].indexOf(assigned.type) > -1){
            $_SyntaxError(context, ["can't assign to literal"])
        }
    }

    // Store the names already bound
    $get_node(this).bound_before = Object.keys(scope.binding)

    this.module = scope.module

    this.toString = function(){return '(augm assign) ' + this.tree}

    this.transform = function(node, rank){
        return
    }

    this.to_js = function(){
        var left = this.tree[0],
            js = left.to_js()
        if(left.type == "expr" && left.tree[0].type == "sub"){
            var sub = left.tree[0].value.to_js(),
                ix = $to_js(left.tree[0].tree),
                right = this.tree[1].to_js()
            return "$B.setitem(" + sub + ", " + ix + ", $B.operations." +
                augmop2method[this.op] + "($B.getitem(" + sub + ", " +
                ix + "), " + right + "))"
        }else if(left.type == "expr" && left.tree[0].type == "attribute"){
            var sub = left.tree[0].value.to_js(),
                name = left.tree[0].name,
                right = this.tree[1].to_js()
            return '$B.$setattr(' + sub + ', "' + name + '", $B.operations.' +
                augmop2method[this.op] + '($B.$getattr(' + sub + ', "' +
                name + '"), ' + right + '))'
        }

        return js + " = $B.operations." + augmop2method[this.op] +
            "(" + js + ", " + this.tree[1].to_js() + ")"
    }
}

var AwaitCtx = function(context){
    // Class for "await"
    this.type = 'await'
    this.parent = context
    this.tree = []
    context.tree.push(this)

    this.to_js = function(){
        return 'await $B.promise(' + $to_js(this.tree) + ')'
    }
}

var set_loop_context = function(context, kw){
    // For keywords "continue" and "break"
    // "this" is the instance of BreakCtx or ContinueCtx
    // We search the loop to "break" or "continue"
    // The attribute loop_ctx of "this" is set to the loop context
    // The attribute "has_break" or "has_continue" is set on the loop context
    var ctx_node = context
    while(ctx_node.type !== 'node'){ctx_node = ctx_node.parent}
    var tree_node = ctx_node.node
    var loop_node = tree_node.parent
    var break_flag = false
    while(1){
        if(loop_node.type == 'module'){
            // "break" is not inside a loop
            $_SyntaxError(context, kw + ' outside of a loop')
        }else{
            var ctx = loop_node.context.tree[0]

            if(ctx.type == 'condition' && ctx.token == 'while'){
                this.loop_ctx = ctx
                ctx['has_' + kw] = true
                break
            }

            switch(ctx.type){
                case 'for':
                    this.loop_ctx = ctx
                    ctx['has_' + kw] = true
                    break_flag = true
                    break
                case 'def':
                    // "break" must not be inside a def or class, even if they
                    // are enclosed in a loop
                    $_SyntaxError(context, kw + ' outside of a loop')
                default:
                    loop_node = loop_node.parent
            }
            if(break_flag){break}
        }
    }
}

var BreakCtx = function(context){
    // Used for the keyword "break"
    // A flag is associated to the enclosing "for" or "while" loop
    // If the loop exits with a break, this flag is set to true
    // so that the "else" clause of the loop, if present, is executed

    this.type = 'break'

    this.parent = context
    context.tree[context.tree.length] = this
    // set information related to the associated loop
    set_loop_context.apply(this, [context, 'break'])

    this.toString = function(){return 'break '}

    this.to_js = function(){
        return "break;"
    }
}

var CallArgCtx = function(context){
    // Base class for arguments in a function call
    this.type = 'call_arg'
    this.parent = context
    this.start = $pos
    this.tree = []
    context.tree.push(this)
    this.expect = 'id'

    this.toString = function(){return 'call_arg ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var CallCtx = function(context){
    // Context of a call on a callable, ie what is inside the parenthesis
    // in "callable(...)"
    this.type = 'call'
    this.func = context.tree[0]
    if(this.func !== undefined){ // undefined for lambda
        this.func.parent = this
    }
    this.parent = context

    context.tree.pop()
    context.tree[context.tree.length] = this

    this.expect = 'id'
    this.tree = []
    this.start = $pos

    this.toString = function(){
        return '(call) ' + this.func + '(' + this.tree + ')'
    }

    this.to_js = function(){
        var positional = [],
            star = [],
            dstar = [],
            keywords = []
        for(var i = 0, len = this.tree.length; i < len; i++){
            var arg = this.tree[i]
            if(arg.type == "call_arg"){

                switch(arg.tree[0].type){
                    case "expr":
                    case "ternary":
                        positional.push(arg.tree[0].to_js())
                        break
                    case "star_arg":
                        star.push(arg.tree[0].to_js())
                        break
                    case "kwarg":
                        var kw = arg.tree[0].tree
                        keywords.push(kw[0].value + ':' + kw[1].to_js())
                        break
                    default:
                        positional.push(arg.tree[0].to_js())
                        break
                }
            }else if(arg.type == "double_star_arg"){
                dstar.push(arg.tree[0].to_js())
            }
        }
        var js = '$B.call(' + this.func.to_js() + ")([" +
            positional.join(", ") + "]"
        if(star.length > 0){
            js += ".concat(" + star.join("), concat(") + ")"
        }
        js += ", "
        if(dstar.length == 0){
            js += "{" + keywords.join(", ") + "})"
        }else{
            js += "$B.extend({" + keywords.join(", ") + "}," +
                dstar.join(", ") + "))"
        }
        return js
    }
}

var CompIfCtx = function(context){
    // Class for keyword "if" inside a comprehension
    this.type = 'comp_if'
    context.parent.intervals.push($pos)
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return '(comp if) ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var ComprehensionCtx = function(context){
    // Class for comprehensions
    this.type = 'comprehension'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return '(comprehension) ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        var intervals = []
        this.tree.forEach(function(elt){
            intervals.push(elt.start)
        })
        return intervals
    }
}

var CompForCtx = function(context){
    // Class for keyword "for" in a comprehension
    this.type = 'comp_for'
    context.parent.intervals.push($pos)
    this.parent = context
    this.tree = []
    this.expect = 'in'
    context.tree[context.tree.length] = this

    this.toString = function(){return '(comp for) ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var CompIterableCtx = function(context){
    // Class for keyword "in" in a comprehension
    this.type = 'comp_iterable'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return '(comp iter) ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var ConditionCtx = function(context,token){
    // Class for keywords "if", "elif", "while"
    this.type = 'condition'
    this.token = token
    this.parent = context
    this.tree = []
    if(token == 'while'){this.loop_num = $loop_num++}
    context.tree[context.tree.length] = this

    this.toString = function(){return this.token + ' ' + this.tree}

    this.transform = function(node, rank){
        var scope = $get_scope(this)
        if(this.token == "while"){
            node.parent.insert(rank,
                NodeJS('locals["$no_break' + this.loop_num + '"] = true'))
            // because a node was inserted, return 2 to avoid infinite loop
            return 2
        }
    }
    this.to_js = function(){
        this.js_processed = true
        var tok = this.token
        if(tok == 'elif'){
            tok = 'else if'
        }
        // In a "while" loop, the flag "$no_break" is initially set to false.
        // If the loop exits with a "break" this flag will be set to "true",
        // so that an optional "else" clause will not be run.
        var res = [tok + '($B.$bool(']
        if(tok == 'else if'){
            var line_info = $get_node(this).line_num + ',' +
                $get_scope(this).id
            res.push('(locals.$line_info = "' + line_info + '") && ')
        }
        if(this.tree.length == 1){
            res.push($to_js(this.tree) + '))')
        }else{ // syntax "if cond : do_something" in the same line
            res.push(this.tree[0].to_js() + '))')
            if(this.tree[1].tree.length > 0){
                res.push('{' + this.tree[1].to_js() + '}')
            }
        }
        return res.join('')
    }
}

var ContinueCtx = function(context){
    // Class for keyword "continue"
    this.type = 'continue'
    this.parent = context
    $get_node(this).is_continue = true
    context.tree[context.tree.length] = this

    // set information related to the associated loop
    set_loop_context.apply(this, [context, 'continue'])

    this.toString = function(){return '(continue)'}

    this.to_js = function(){
        this.js_processed = true
        return 'continue'
    }
}

var DefCtx = function(context){
    this.type = 'def'
    this.name = null
    this.parent = context
    this.tree = []
    this.async = context.async

    this.locals = []
    context.tree[context.tree.length] = this

    // store id of enclosing functions
    this.enclosing = []
    var scope = this.scope = $get_scope(this)
    if(scope.context && scope.context.tree[0].type == "class"){
        this.class_name = scope.context.tree[0].name
    }
    // initialize object for names bound in the function
    context.node.binding = {}

    var parent_block = scope
    this.parent.node.parent_block = parent_block

    this.module = scope.module
    this.root = $get_module(this)

    // num used if several functions have the same name
    this.num = $loop_num
    $loop_num++

    // Arrays for arguments
    this.positional_list = []
    this.default_list = []
    this.other_args = null
    this.other_kw = null
    this.after_star = []

    this.set_name = function(name){
        if(name.type && name.type == "expr"){
            if(name.tree[0].type == "id"){
                name = name.tree[0].value
            }else{
                this.assign_expr = name
                if(name.tree[0].type == "sub"){
                    name.tree[0].func = "setitem"
                    this.key = name.tree[0].tree[0].tree[0].to_js()
                }
                name = "$func" + $loop_num
                $loop_num++
            }
        }
        this.name = name
        this.id = this.scope.id + '_' + name
        this.id = this.id.replace(/\./g, '_') // for modules inside packages
        this.parent.node.id = this.id
        this.parent.node.module = this.module

        this.binding = {}

        $bind(this.name, this.scope, this)

        // If function is defined inside another function, add the name
        // to local names
        //id_ctx.bound = true
        if(scope.is_function){
            if(scope.context.tree[0].locals.indexOf(name) == -1){
                scope.context.tree[0].locals.push(name)
            }
        }
    }

    this.toString = function(){
        return 'def ' + this.name + '(' + this.tree + ')'
    }

    this.transform = function(node, rank){
        // already transformed ?
        if(this.transformed !== undefined){return}

        var scope = this.scope

        // search doc string
        this.doc_string = $get_docstring(node)
        this.rank = rank

        // block indentation
        var indent = node.indent + 12

        var pnode = this.parent.node
        while(pnode.parent && pnode.parent.is_def_func){
            this.enclosing.push(pnode.parent.parent)
            pnode = pnode.parent.parent
        }

        var defaults = [],
            defs1 = [],
            has_end_pos = false
        this.argcount = 0
        this.kwonlyargcount = 0 // number of args after a star arg
        this.kwonlyargsdefaults = []
        this.otherdefaults = []
        this.varnames = {}
        this.args = []
        this.__defaults__ = []
        this.slots = []
        var slot_list = [],
            slot_init = []

        if(! this.assigned){
            this.func_name = this.tree[0].to_js()
            var func_name1 = this.func_name
        }else{
            this.func_name = ""
        }

        var func_args = this.tree[0].tree

        func_args.forEach(function(arg){
            if(arg.type == 'end_positional'){
                this.args.push("/")
                slot_list.push('"/"')
                has_end_pos = true
            }else{
                this.args.push(arg.name)
                this.varnames[arg.name] = true
            }
            if(arg.type == 'func_arg_id'){
                if(this.star_arg){
                    this.kwonlyargcount++
                    if(arg.has_default){
                        this.kwonlyargsdefaults.push(arg.name)
                    }
                }
                else{
                    this.argcount++
                    if(arg.has_default){
                        this.otherdefaults.push(arg.name)
                    }
                }
                this.slots.push(arg.name + ':null')
                slot_list.push('"' + arg.name + '"')
                slot_init.push(arg.name + ':' + arg.name)
                if(arg.tree.length > 0){
                    defaults.push('"' + arg.name + '"')
                    defs1.push(arg.name + ':' + $to_js(arg.tree))
                    this.__defaults__.push($to_js(arg.tree))
                }
            }else if(arg.type == 'func_star_arg'){
                if(arg.op == '*'){this.star_arg = arg.name}
                else if(arg.op == '**'){this.kw_arg = arg.name}
            }
        }, this)

        slot_init = '{' + slot_init.join(", ") + '}'

        var nodes = [], js

        // Get id of global scope
        var global_scope = scope
        while(global_scope.parent_block &&
                global_scope.parent_block.id !== '__builtins__'){
            global_scope = global_scope.parent_block
        }
        var global_ns = 'locals_' + global_scope.id.replace(/\./g, '_')

        var name = this.name

        // Add lines of code to node children

        // Push id in frames stack
        var enter_frame_nodes = [
            NodeJS('$B.frames_stack.push(locals);'),
        ]

        enter_frame_nodes.forEach(function(node){
            node.enter_frame = true
        })

        this.env = []

        // Code in the worst case, uses $B.args in py_utils.js
        var js = 'var locals = locals_' + this.id + ' = $B.args("' +
            this.name + '", pos, kw, ' + '[' + slot_list.join(', ') + '], {' +
            defs1.join(', ') + '}, ' + this.other_args + ', ' +
            this.other_kw + ')'

        nodes.push(NodeJS(js))
        nodes.push(NodeJS('locals.__file__ = "' + this.root.__file__ + '"'))

        var only_positional = false
        nodes = nodes.concat(enter_frame_nodes)

        // Handle name __class__ in methods (PEP 3135 and issue #1068)
        var is_method = scope.ntype == "class"
        if(is_method){
            var class_name = scope.context.tree[0].name,
                class_block = scope.parent_block,
                class_ref = "locals_" + class_block.id.replace(/\./g, '_') +
                    '["' + class_name + '"]'
            // bind name __class__ in method
            this.parent.node.binding["__class__"] = true
            // set its value to the class where the method is defined
            nodes.push(NodeJS("locals.__class__ = " + class_ref))
        }

        // remove children of original node
        for(var i = nodes.length - 1; i >= 0; i--){
            node.children.splice(0, 0, nodes[i])
        }

        // Node that replaces the original "def" line
        var def_func_node = new $Node()
        this.params = ''
        if(only_positional){
            this.params = Object.keys(this.varnames).join(', ')
        }
        new NodeJSCtx(def_func_node, '')
        def_func_node.is_def_func = true
        def_func_node.module = this.module

        // If the last instruction in the function is not a return,
        // add an explicit line "return None".
        var last_instr = node.children[node.children.length - 1].context.tree[0]
        if(last_instr.type != 'return'){
            // as always, leave frame before returning
            var js = '$B.leave_frame'
            node.add(NodeJS(js + '();return _b_.$None'))
        }

        // Add the new function definition
        node.add(def_func_node)

        var offset = 1,
            indent = node.indent

        // Close anonymous function with defaults as argument
        this.default_str = '{' + defs1.join(', ') + '}'

        // wrap everything in a try/catch to be sure to exit from frame
        if(this.type == 'def'){
            var parent = node
            for(var pos = 0; pos < parent.children.length &&
                parent.children[pos] !== $B.last(enter_frame_nodes); pos++){}
            var try_node = NodeJS('try'),
                children = parent.children.slice(pos + 1)
            parent.insert(pos + 1, try_node)
            children.forEach(function(child){
                if(child.is_def_func){
                    child.children.forEach(function(grand_child){
                        try_node.add(grand_child)
                    })
                }else{
                    try_node.add(child)
                }
            })
            parent.children.splice(pos + 2, parent.children.length)

            var except_node = NodeJS('catch(err)')
            if(this.async){
                except_node.add(NodeJS('err.$stack = $stack'))
            }
            except_node.add(NodeJS('err.frames = err.frames || $B.frames_stack.slice()'))
            except_node.add(NodeJS('$B.leave_frame();throw err'))

            parent.add(except_node)
        }
        if(this.assigned &&
                ["attribute", "sub"].indexOf(this.assign_expr.tree[0].type) > -1){
            node.parent.insert(rank + 1, NodeJS(")"))
        }

        this.transformed = true

        return offset
    }

    this.to_js = function(func_name){
        var is_gen = $get_node(this).is_generator
        this.js_processed = true

        var js = 'locals.' + this.name
        if(this.assign_expr){
            var expr = this.assign_expr
            if(expr.tree[0].type == "attribute"){
                js = '$B.$setattr(' + expr.tree[0].value.to_js() +
                    ', "' + expr.tree[0].name + '", function(pos, kw)'
                return js
            }else if(expr.tree[0].type == "sub"){
                js = '$B.setitem(' + expr.tree[0].value.to_js() +
                    ', ' + this.key + ', function(pos, kw)'
                return js
            }
        }

        js += ' = function'
        if(is_gen){js += '*'}
        return js + '(pos, kw)'
    }
}

var DelCtx = function(context){
    // Class for keyword "del"
    this.type = 'del'
    this.parent = context
    context.tree[context.tree.length] = this
    this.tree = []

    this.toString = function(){return 'del ' + this.tree}

    this.to_js = function(){
        this.js_processed = true

        if(this.tree[0].type == 'list_or_tuple'){
            // Syntax "del a, b, c"
            var res = []
            this.tree[0].tree.forEach(function(elt){
                var subdel = new DelCtx(context) // this adds an element to context.tree
                subdel.tree = [elt]
                res.push(subdel.to_js())
                context.tree.pop() // remove the element from context.tree
            })
            this.tree = []
            return res.join(';')
        }else if(this.tree[0].type == 'expr' &&
                this.tree[0].tree[0].type == 'list_or_tuple'){
            // del(x[0]) is the same as del x[0], cf.issue #923
            this.tree[0] = this.tree[0].tree[0]
            return this.to_js()
        }else{
            var expr = this.tree[0].tree[0]

            switch(expr.type) {
                case 'id':
                    // cf issue #923
                    var scope = $get_scope(this),
                        is_global = false
                    var res = '$B.$delete("' + expr.value + '");'
                    // Delete from scope to force the use of $search or
                    // $global_search in name resolution, even if del is never
                    // called.
                    delete scope.binding[expr.value]
                    return res
                case 'list_or_tuple':
                    var res = []
                    expr.tree.forEach(function(elt){
                      res.push('delete ' + elt.to_js())
                    })
                    return res.join(';')
                case 'sub':
                    // Delete an item in a list : "del a[x]"
                    return '$B.delitem(' + expr.value.to_js() + ', ' +
                        $to_js(expr.tree) + ')'
                case 'op':
                      $_SyntaxError(this, ["can't delete operator"])
                case 'call':
                    $_SyntaxError(this, ["can't delete function call"])
                case 'attribute':
                    return 'delattr(' + expr.value.to_js() + ',"' +
                        expr.name + '")'
                default:
                    $_SyntaxError(this, ["can't delete " + expr.type])
            }
        }
    }
}

var DictOrSetCtx = function(context){
    // Context for literal dictionaries or sets
    // The real type (dist or set) is set inside $transition
    // as the attribute 'real'
    this.type = 'dict_or_set'
    this.real = 'dict_or_set'
    this.expect = 'id'
    this.closed = false
    this.start = $pos

    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){
        switch(this.real) {
            case 'dict':
                return '(dict) {' + this.items + '}'
            case 'set':
                return '(set) {' + this.tree + '}'
        }
        return '(dict_or_set) {' + this.tree + '}'
    }

    this.nb_dict_items = function(){
        var nb = 0
        this.tree.forEach(function(item){
            if(item.packed){nb += 2}
            else{nb++}
        })
        return nb
    }

    this.packed_indices = function(){
        var ixs = []
        this.items.forEach(function(t, i){
            if(t.type == "expr" && t.packed){
                ixs.push(i)
            }
        })
        return ixs
    }

    this.unpack_set = function(packed){
        var js = "", res
        this.items.forEach(function(t, i){
            if(packed.indexOf(i) > -1){
                res = "_b_.list.$factory(" + t.to_js() +")"
            }else{
                res = "[" + t.to_js() + "]"
            }
            if(i > 0){res = ".concat(" + res + ")"}
            js += res
        })
        return js
    }


    this.to_js = function(){

        this.js_processed = true

        switch(this.real){
            case 'dict':
                var res = []
                for(var i = 0; i < this.items.length; i += 2){
                    res.push('[' + this.items[i].to_js() + ',' +
                      this.items[i + 1].to_js() + ']')
                }
                return 'new Map([' + res.join(',') + '])' +
                    $to_js(this.tree)
            case 'set_comp':
                return 'new Set(' + $to_js(this.items) + ')' +
                    $to_js(this.tree)
            case 'dict_comp':
                return $to_js(this.items)
        }
        var packed = this.packed_indices()
        if(packed.length > 0){
            return 'new Set(' + this.unpack_set(packed) + ')'
        }
        return 'new Set([' + $to_js(this.items) + '])' + $to_js(this.tree)
    }
}

var DoubleStarArgCtx = function(context){
    // Class for syntax "**kw" in a call
    this.type = 'double_star_arg'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return '**' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return '{$nat:"pdict",arg:' + $to_js(this.tree) + '}'
    }
}


var EndOfPositionalCtx = function(context){
    // Indicates the end of positional arguments in a function definition
    // PEP 570
    this.type = "end_positional"
    this.parent = context
    context.has_end_positional = true
    context.parent.pos_only = context.tree.length
    context.tree.push(this)

    this.to_js = function(){
        return "/"
    }
}

var ExceptCtx = function(context){
    // Class for keyword "except"
    this.type = 'except'
    this.parent = context
    context.tree[context.tree.length] = this
    this.tree = []
    this.expect = 'id'
    this.scope = $get_scope(this)

    this.toString = function(){return '(except) '}

    this.set_alias = function(alias){
        alias = alias
        this.tree[0].alias = alias
        $bind(alias, this.scope, this)
    }

    this.transform = function(node, rank){
        // Add instruction to delete current exception, except if the last
        // instruction in the except block is a return (to avoid the
        // message "unreachable code after return statement")
        var last_child = $B.last(node.children)
        if(last_child.context.tree && last_child.context.tree[0] &&
                last_child.context.tree[0].type == "return"){}
        else{
            node.add(NodeJS("$B.del_exc()"))
        }
    }

    this.to_js = function(){

        this.js_processed = true

        switch(this.tree.length) {
            case 0:
                return 'else'
            case 1:
                if(this.tree[0].name == 'Exception'){return 'else if(1)'}
        }

        var res = []
        this.tree.forEach(function(elt){
            res.push(elt.to_js())
        })
        var lnum = ''
        if($B.debug > 0){
            var module = $get_module(this)
            lnum = '(locals.$line_info = "' + $get_node(this).line_num +
                ',' + module.id + '") && '
        }
        return 'else if(' + lnum + '$B.is_exc(' + this.error_name +
            ',[' + res.join(',') + ']))'
    }
}

var ExprCtx = function(context, name, with_commas){
    // Base class for expressions
    this.type = 'expr'
    this.name = name
    // allow expression with comma-separted values, or a single value ?
    this.with_commas = with_commas
    this.expect = ',' // can be 'expr' or ','
    this.parent = context
    if(context.packed){
        this.packed = context.packed
    }
    if(context.is_await){
        this.is_await = context.is_await
    }
    if(context.assign){
        // assignment expression
        this.assign = context.assign
    }
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){
        return '(expr ' + with_commas + ') ' + this.tree
    }

    this.to_js = function(arg){
        var res
        this.js_processed = true
        if(this.type == 'list'){res = '[' + $to_js(this.tree) + ']'}
        else if(this.tree.length == 1){res = this.tree[0].to_js(arg)}
        else{res = '_b_.tuple.$factory([' + $to_js(this.tree) + '])'}
        if(this.is_await){
            res = "await $B.promise(" + res + ")"
        }
        return res
    }
}

var ExprNot = function(context){
    // Class used temporarily for 'x not', only accepts 'in' as next token
    // Never remains in the final tree, so there is no need to define to_js()
    this.type = 'expr_not'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return '(expr_not)'}

}

var FloatCtx = function(context,value){
    // Class for literal floats
    this.type = 'float'
    this.value = value
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return 'float ' + this.value}

    this.to_js = function(){
        this.js_processed = true
        // number literal
        if(/^\d+$/.exec(this.value) ||
            /^\d+\.\d*$/.exec(this.value)){
                return '(new Number(' + this.value + '))'
        }

        return 'float.$factory(' + this.value + ')'
    }
}

var ForExpr = function(context){
    // Class for keyword "for" outside of comprehensions
    this.type = 'for'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this
    this.loop_num = $loop_num
    this.module = $get_scope(this).module
    $loop_num++

    this.toString = function(){return '(for) ' + this.tree}

    this.transform = function(node,rank){
        var scope = $get_scope(this)

        var target = this.tree[0],
            target_is_1_tuple = target.tree.length == 1 && target.expect == 'id',
            iterable = this.tree[1],
            num = this.loop_num,
            local_ns = 'locals_' + scope.id.replace(/\./g, '_'),
            h = '\n' + ' '.repeat(node.indent + 4)

        for(var i = 0, len = target.tree.length; i < len; i++){
            var tg = target.tree[i]
            if(tg.type == "expr" && tg.tree[0].type == "id"){
                $bind(tg.tree[0].value, scope, this.parent)
            }
        }

        // nodes that will be inserted at the position of the original "for" loop
        var new_nodes = [], pos = 0

        // save original children (loop body)
        var children = node.children,
            offset = 1,
            it_js = iterable.to_js(),
            it_name = "iter" + $loop_num

        var for_node = NodeJS("for(const x" + $loop_num + " of $B.test_iter(" +
            it_js + "))")

        for_node.context.loop_num = num // used for "else" clauses
        for_node.context.type = 'for' // used in $add_line_num
        for_node.line_num = node.line_num

        new_nodes.push(for_node)

        node.parent.children.splice(rank, 1)
        if(this.test_range){
            for(var i = new_nodes.length - 1; i >= 0; i--){
                else_node.insert(0, new_nodes[i])
            }
        }else{
            for(var i = new_nodes.length - 1; i >= 0; i--){
                node.parent.insert(rank, new_nodes[i])
                offset += new_nodes.length
            }
        }

        var iter_node = new $Node()
        iter_node.id = this.module
        var context = new NodeCtx(iter_node) // create ordinary node
        var target_expr = new ExprCtx(context, 'left', true)
        if(target_is_1_tuple){
            // assign to a one-element tuple for "for x, in ..."
            var t = new ListOrTupleCtx(target_expr)
            t.real = 'tuple'
            t.tree = target.tree
        }else{
            target_expr.tree = target.tree
        }
        var assign = new AssignCtx(target_expr) // assignment to left operand
        assign.tree[1] = new $JSCode('x' + $loop_num)
        for_node.add(iter_node)

        // set new loop children
        children.forEach(function(child){
            for_node.add(child)
        })

        node.children = []
        return 0
    }

}

var FuncArgsCtx = function(context){
    // Class for arguments in a function definition
    this.type = 'func_args'
    this.parent = context
    this.tree = []
    this.names = []
    context.tree[context.tree.length] = this

    this.expect = 'id'
    this.has_default = false
    this.has_star_arg = false
    this.has_kw_arg = false

    this.toString = function(){return 'func args ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var FuncArgIdCtx = function(context,name){
    // id in function arguments
    // may be followed by = for default value
    this.type = 'func_arg_id'
    this.name = name
    this.parent = context

    if(context.has_star_arg){
        context.parent.after_star.push(name)
    }else{
        context.parent.positional_list.push(name)
    }
    // bind name to function scope
    var node = $get_node(this)
    if(node.binding[this.name]){
        $_SyntaxError(context,
            ["duplicate argument '" + name + "' in function definition"])
    }
    $bind(this.name, node, this)

    this.tree = []
    context.tree[context.tree.length] = this
    // add to locals of function
    var ctx = context
    while(ctx.parent !== undefined){
        if(ctx.type == 'def'){
            ctx.locals.push(name)
            break
        }
        ctx = ctx.parent
    }

    this.expect = '='

    this.toString = function(){
        return 'func arg id ' + this.name + '=' + this.tree
    }

    this.to_js = function(){
        this.js_processed = true
        return this.name + $to_js(this.tree)
    }
}

var FuncStarArgCtx = function(context,op){
    // Class for "star argument" in a function definition : f(*args)
    this.type = 'func_star_arg'
    this.op = op
    this.parent = context
    this.node = $get_node(this)

    context.has_star_arg = op == '*'
    context.has_kw_arg = op == '**'
    context.tree[context.tree.length] = this

    this.toString = function(){
        return '(func star arg ' + this.op + ') ' + this.name
    }

    this.set_name = function(name){
        this.name = name

        // bind name to function scope
        if(this.node.binding[name]){
            $_SyntaxError(context,
                ["duplicate argument '" + name + "' in function definition"])
        }
        $bind(this.name, this.node, this)

        // add to locals of function
        var ctx = context
        while(ctx.parent !== undefined){
            if(ctx.type == 'def'){
                ctx.locals.push(name)
                break
            }
            ctx = ctx.parent
        }
        if(op == '*'){ctx.other_args = '"' + this.name + '"'}
        else{ctx.other_kw = '"' + this.name + '"'}
    }

    this.to_js = function(){
    }

}

var IdCtx = function(context, value){
    // Class for identifiers (variable names)

    this.type = 'id'
    this.value = value
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    var scope = this.scope = $get_scope(this)
    this.blurred_scope = this.scope.blurred
    this.env = clone(this.scope.binding)

    // Store variables referenced in scope
    if(scope.ntype == "def"){
        scope.referenced = scope.referenced || {}
        if(! $B.builtins[this.value]){
            scope.referenced[this.value] = true
        }
    }
    if(context.parent.type == 'call_arg') {
        this.call_arg = true
    }

    var ctx = context
    while(ctx.parent !== undefined){
        switch(ctx.type) {
          case 'list_or_tuple':
          case 'dict_or_set':
          case 'call_arg':
          case 'def':
          case 'lambda':
            if(ctx.vars === undefined){ctx.vars = [value]}
            else if(ctx.vars.indexOf(value) == -1){ctx.vars.push(value)}
            if(this.call_arg&&ctx.type == 'lambda'){
                if(ctx.locals === undefined){ctx.locals = [value]}
                else{ctx.locals.push(value)}
            }
        }
        ctx = ctx.parent
    }

    if(context.type == 'target_list' ||
            (context.type == 'expr' && context.parent.type == 'target_list')){
        // An id defined as a target in a "for" loop is bound in the scope,
        // but *not* in the node bindings, because if the iterable is empty
        // the name has no value (cf. issue 1233)
        this.no_bindings = true
        $bind(value, scope, this)
        this.bound = true
    }

    if(scope.ntype == 'def'){
        // if variable is declared inside a comprehension,
        // don't add it to function namespace
        var _ctx = this.parent
        while(_ctx){
            if(_ctx.type == 'list_or_tuple' && _ctx.is_comp()){
                this.in_comp = true
                return
            }
            _ctx = _ctx.parent
        }
        if(context.type == 'expr' && context.parent.type == 'comp_if'){
            // form {x for x in foo if x>5} : don't put x in referenced names
            return
        }
    }

    this.toString = function(){
        return '(id) ' + this.value + ':' + (this.tree || '')
    }

    this.firstBindingScopeId = function(){
        // Returns the id of the first scope where this.name is bound
        var scope = this.scope,
            found = [],
            nb = 0
        while(scope && nb++ < 20){
            if(scope.binding && scope.binding[this.value]){
                return scope.id
            }
            scope = scope.parent
        }
    }

    this.boundBefore = function(scope){
        // Returns true if we are sure that the id is bound in the scope,
        // because there is at least one binding when going up the code tree.
        // This is used to avoid checking that the name exists at run time.
        // Example:
        //
        // def f():
        //     if some_condition():
        //         x = 9
        //     print(x)
        //
        // For the second "x", this.boundBefore() will return false because
        // the binding "x = 9" is not in the lines found when going up the
        // code tree. It will be translated to $local_search("x"), which will
        // check at run time if the name "x" exists and if not, raise an
        // UnboundLocalError.
        var node = $get_node(this),
            found = false
        var $test = this.value == "bx"

        while(!found && node.parent){
            var pnode = node.parent
            if(pnode.bindings && pnode.bindings[this.value]){
                if($test){console.log("bound in", pnode)}
                return pnode.bindings[this.value]
            }
            for(var i = 0; i < pnode.children.length; i++){
                var child = pnode.children[i]
                if(child === node){break}
                if(child.bindings && child.bindings[this.value]){
                    if($test){console.log("bound in child", child)}
                    return child.bindings[this.value]
                }
            }
            if(pnode === scope){
                break
            }
            node = pnode
        }

        return found
    }

    this.bindingType = function(scope){
        // If a binding explicitely sets the type of a variable (eg "x = 1")
        // the next references can use this type if there is no block
        // inbetween.
        // For code like:
        //
        //     x = 1
        //     x += 2
        //
        // for the id "x" in the second line, this.bindingType will return
        // "int".
        //
        // A block might reset the type, like in
        //
        //     x = 1
        //     if True:
        //         x = "a"
        //     x += 2
        //
        // For the id "x" in the last line, this.bindingType will just return
        // "true"
        var nb = 0,
            node = $get_node(this),
            found = false,
            unknown,
            ix

        while(!found && node.parent && nb++ < 100){
            var pnode = node.parent
            if(pnode.bindings && pnode.bindings[this.value]){
                return pnode.bindings[this.value]
            }
            for(var i = 0; i < pnode.children.length; i++){
                var child = pnode.children[i]
                if(child === node){break}
                if(child.bindings && child.bindings[this.value]){
                    found = child.bindings[this.value]
                    ix = i
                }
            }
            if(found){
                for(var j = ix + 1; j < pnode.children.length; j++){
                    child = pnode.children[j]
                    if(child.children.length > 0){
                        unknown = true
                        break
                    }else if(child === node){
                        break
                    }
                }
                return unknown || found
            }
            if(pnode === scope){
                break
            }
            node = pnode
        }

        return found
    }

    this.to_js = function(arg){
        var value = this.value,
            scope = this.scope
        var test = false // value == "pos"
        if(test){
            console.log("to js", this)
        }
        while(scope){
            if(test){
                console.log("search", value, "in", scope.id, scope.binding)
            }
            if(scope.binding.hasOwnProperty(value)){
                var is_defined = this.bound || this.boundBefore(scope)
                var js
                if(test){
                    console.log(value, "defined ?", is_defined)
                }
                if(scope.id === this.scope.id){
                    js = "locals." + value
                }else if(scope.id == "__builtins__"){
                    return "_b_." + value
                }else{
                    js = "locals_" + scope.id + "." + value
                }
                if(is_defined){
                    return js
                }else if(this.augm_assign){
                    return js
                }else{
                    // If name is not bound in the instruction, or if it has
                    // not been bound in the previous instructions, check
                    // that the value is not undefined, otherwise raise a
                    // NameError
                    return '$B.check_def("' + value + '", ' + js + ")"
                }
            }
            scope = scope.parent_block
        }
        return "$B.global_search('" + value + "')"
    }
}

var IntCtx = function(context,value){
    // Class for literal integers
    // value is a 2-elt tuple [base, value_as_string] where
    // base is one of 16 (hex literal), 8 (octal), 2 (binary) or 10 (int)
    this.type = 'int'
    this.value = value
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return 'int ' + this.value}

    this.to_js = function(){
        this.js_processed = true
        var v = parseInt(value[1], value[0])
        if(v > $B.min_int && v < $B.max_int){return v}
        else{
            return '$B.long_int.$factory("' + value[1] + '", ' + value[0] + ')'
        }
    }
}

var $JSCode = function(js){
    this.js = js

    this.toString = function(){return this.js}

    this.to_js = function(){
        this.js_processed = true
        return this.js
    }
}

var KwArgCtx = function(context){
    // Class for keyword argument in a call
    this.type = 'kwarg'
    this.parent = context.parent
    this.tree = [context.tree[0]]
    // operation replaces left operand
    context.parent.tree.pop()
    context.parent.tree.push(this)

    // set attribute "has_kw" of CallCtx instance to true
    context.parent.parent.has_kw = true

    // put id in list of kwargs
    // used to avoid passing the id as argument of a list comprehension
    var value = this.tree[0].value
    var ctx = context.parent.parent // type 'call'
    if(ctx.kwargs === undefined){ctx.kwargs = [value]}
    else if(ctx.kwargs.indexOf(value) == -1){ctx.kwargs.push(value)}
    else{$_SyntaxError(context, ['keyword argument repeated'])}

    this.toString = function(){
        return 'kwarg ' + this.tree[0] + '=' + this.tree[1]
    }

    this.to_js = function(){
        this.js_processed = true
        var key = this.tree[0].value
        if(key.substr(0,2) == '$$'){key = key.substr(2)}
        var res = '{$nat:"kw",name:"' + key + '",'
        return res + 'value:' +
            $to_js(this.tree.slice(1, this.tree.length)) + '}'
    }
}

var LambdaCtx = function(context){
    // Class for keyword "lambda"
    this.type = 'lambda'
    this.parent = context
    context.tree[context.tree.length] = this
    this.tree = []
    this.args_start = $pos + 6
    this.vars = []
    this.locals = []

    this.toString = function(){
        return '(lambda) ' + this.args_start + ' ' + this.body_start
    }

    this.to_js = function(){

        this.js_processed = true

        var node = $get_node(this),
            module = $get_module(this),
            src = $get_src(context),
            args = src.substring(this.args_start, this.body_start),
            body = src.substring(this.body_start + 1, this.body_end)
            body = body.replace(/\\\n/g, ' ') // cf issue 582

        body = body.replace(/\n/g, ' ')

        var scope = $get_scope(this)

        var rand = $B.UUID(),
            func_name = 'lambda_' + $B.lambda_magic + '_' + rand,
            py = 'def ' + func_name + '(' + args + ')\n'
        py += '    return ' + body

        var lambda_name = 'lambda' + rand,
            module_name = module.id.replace(/\./g, '_')

        var root = $B.bg2js(py, module_name, lambda_name, scope, node.line_num)
        var js = root.to_js()
        js = '(function(locals_' + lambda_name + '){\n' + js +
            '\nreturn locals.' + func_name + '\n})({})'

        return js
    }

}

var ListOrTupleCtx = function(context,real){
    // Class for literal lists or tuples
    // The real type (list or tuple) is set inside $transition
    // as attribute 'real'
    this.type = 'list_or_tuple'
    this.start = $pos
    this.real = real
    this.expect = 'id'
    this.closed = false
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){
        switch(this.real) {
          case 'list':
            return '(list) [' + this.tree + ']'
          case 'list_comp':
          case 'gen_expr':
            return '(' + this.real + ') [' + this.intervals + '-' +
                this.tree + ']'
          default:
            return '(tuple) (' + this.tree + ')'
        }
    }

    this.is_comp = function(){
        switch(this.real) {
            case 'list_comp':
            case 'gen_expr':
            case 'dict_or_set_comp':
                return true
        }
        return false
    }

    this.get_src = function(){
        // Return the Python source code
        var src = $get_module(this).src
        // replace comments by whitespace, cf. issue #658
        var scope = $get_scope(this)
        if(scope.comments === undefined){return src}
        scope.comments.forEach(function(comment){
            var start = comment[0],
                len = comment[1]
            src = src.substr(0, start) + ' '.repeat(len + 1) +
                src.substr(start + len + 1)
        })
        return src
    }

    this.bind_ids = function(scope){
        // Used by AssignCtx for assignments to a list or tuple
        // Binds all the "simple" ids (not the calls, subscriptions, etc.)
        this.tree.forEach(function(item){
            if(item.type == 'id'){
                $bind(item.value, scope, this)
                item.bound = true
            }else if(item.type == 'expr' && item.tree[0].type == "id"){
                $bind(item.tree[0].value, scope, this)
                item.tree[0].bound = true
            }else if(item.type == 'expr' && item.tree[0].type == "packed"){
                if(item.tree[0].tree[0].type == 'id'){
                    $bind(item.tree[0].tree[0].value, scope, this)
                    item.tree[0].tree[0].bound = true
                }
            }else if(item.type == 'list_or_tuple' ||
                    (item.type == "expr" &&
                        item.tree[0].type == 'list_or_tuple')){
                if(item.type == "expr"){item = item.tree[0]}
                item.bind_ids(scope)
            }
        }, this)
    }

    this.packed_indices = function(){
        var ixs = []
        for(var i = 0; i < this.tree.length; i++){
            var t = this.tree[i]
            if(t.type == "expr"){
                t = t.tree[0]
                if(t.type == "packed" ||
                        (t.type == "call" && t.func.type == "packed")){
                    ixs.push(i)
                }
            }
        }
        return ixs
    }

    this.unpack = function(packed){
        var js = "", res
        for(var i = 0; i < this.tree.length; i++){
            if(packed.indexOf(i) > -1){
                res = "_b_.list.$factory(" + this.tree[i].to_js() +")"
            }else{
                res = "[" + this.tree[i].to_js() + "]"
            }
            if(i > 0){res = ".concat(" + res + ")"}
            js += res
        }
        return js
    }

    this.to_js = function(){
        this.js_processed = true
        var scope = $get_scope(this),
            sc = scope,
            scope_id = scope.id.replace(/\//g, '_'),
            pos = 0
        var root = $get_module(this),
            module_name = root.module

        switch(this.real) {
            case 'list':
                var packed = this.packed_indices()
                if(packed.length > 0){
                    return this.unpack(packed)
                }
                return '[' + $to_js(this.tree) + ']'
            case 'list_comp':
            case 'gen_expr':
            case 'dict_or_set_comp':
                var src = this.get_src()
                var res1 = [], items = []

                var qesc = new RegExp('"', "g") // to escape double quotes in arguments

                var comments = root.comments
                for(var i = 1; i < this.intervals.length; i++){
                    var start = this.intervals[i - 1],
                        end = this.intervals[i],
                        txt = src.substring(start, end)

                    comments.forEach(function(comment){
                        if(comment[0] > start && comment[0] < end){
                            // If there is a comment inside the interval,
                            // replace it by spaces. Cf issue #776
                            var pos = comment[0] - start
                            txt = txt.substr(0, pos) +
                                ' '.repeat(comment[1]) +
                                txt.substr(pos + comment[1] + 1)
                        }
                    })

                    items.push(txt)
                    var lines = txt.split('\n')
                    var res2 = []
                    lines.forEach(function(txt){
                        // ignore empty lines
                        if(txt.replace(/ /g, '').length != 0){
                            txt = txt.replace(/\n/g, ' ')
                            txt = txt.replace(/\\/g, '\\\\')
                            txt = txt.replace(qesc, '\\"')
                            res2.push('"' + txt + '"')
                        }
                    })
                    res1.push('[' + res2.join(',') + ']')
                }

                var line_num = $get_node(this).line_num

                switch(this.real) {
                    case 'list_comp':
                        var lc = $B.list_comp(items), // defined in py_utils.js
                            py = lc[0],
                            ix = lc[1],
                            listcomp_name = 'lc' + ix,
                            save_pos = $pos
                        var root = $B.bg2js({src:py, is_comp:true},
                            module_name, listcomp_name, scope, 1)

                        $pos = save_pos

                        var js = root.to_js()
                        js += 'return locals_lc' + ix + '.x' + ix + ''
                        js = '(function(locals_' + listcomp_name + '){' +
                            js + '})({})'
                        return js

                    case 'dict_or_set_comp':
                        if(this.expression.length == 1){
                            return $B.gen_expr(module_name, scope, items, line_num)
                        }

                        return $B.dict_comp(module_name, scope, items, line_num)

                }

                // Generator expression
                // Pass the module name and the current scope object
                // $B.gen_expr is in py_utils.js
                return $B.gen_expr(module_name, scope, items, line_num)

            case 'tuple':
                var packed = this.packed_indices()
                if(packed.length > 0){
                    return this.unpack(packed)
                }
                if(this.tree.length == 1 && this.has_comma === undefined){
                    return this.tree[0].to_js()
                }
                return '[' + $to_js(this.tree) + ']'
        }
    }
}

function ModuleCtx(context){
    this.type = "module"
    this.parent = context
    this.tree = []
    this.expect = "id"

    context.tree = [this]

    this.to_js = function(){
        var module = $get_module(this)
        console.log("module", module)
        module.module = this.name
        return "$B.modules.$" + this.name + " = locals"
    }
}

var NodeCtx = function(node){
    // Base class for the context in a node
    this.node = node
    node.context = this
    this.tree = []
    this.type = 'node'

    var scope = null
    var tree_node = node
    while(tree_node.parent && tree_node.parent.type != 'module'){
        var ntype = tree_node.parent.context.tree[0].type,
            _break_flag = false
        switch(ntype){
            case 'def':
                scope = tree_node.parent
                _break_flag = true
        }
        if(_break_flag){break}

        tree_node = tree_node.parent
    }
    if(scope === null){
        scope = tree_node.parent || tree_node // module
    }

    // When a new node is created, a copy of the names currently
    // bound in the scope is created. It is used in IdCtx to detect
    // names that are referenced but not yet bound in the scope
    this.node.locals = clone(scope.binding)
    this.scope = scope

    this.toString = function(){return 'node ' + this.tree}

    this.to_js = function(){
        if(this.js !== undefined){return this.js}
        this.js_processed = true
        if(this.tree.length > 1){
            var new_node = new $Node()
            var ctx = new NodeCtx(new_node)
            ctx.tree = [this.tree[1]]
            new_node.indent = node.indent + 4
            this.tree.pop()
            node.add(new_node)
        }
        this.js = ""

        if(node.children.length == 0){
            this.js += $to_js(this.tree) + ';'
        }else{
            this.js += $to_js(this.tree)
        }
        return this.js
    }
}

var NodeJS = function(js){
    var node = new $Node()
    new NodeJSCtx(node, js)
    return node
}

var NodeJSCtx = function(node,js){
    // Class used for raw JS code
    this.node = node
    node.context = this
    this.type = 'node_js'
    this.tree = [js]

    this.toString = function(){return 'js ' + js}

    this.to_js = function(){
        this.js_processed = true
        return js
    }
}


var NotCtx = function(context){
    // Class for keyword "not"
    this.type = 'not'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return 'not (' + this.tree + ')'}

    this.to_js = function(){
        this.js_processed = true
        return '!$B.$bool(' + $to_js(this.tree) + ')'
    }
}

var OpCtx = function(context,op){
    // Class for operators ; context is the left operand
    this.type = 'op'
    this.op = op
    this.parent = context.parent
    this.tree = [context]
    this.scope = $get_scope(this)

    // Get type of left operand
    if(context.type == "expr"){
        if(['int', 'float', 'str'].indexOf(context.tree[0].type) > -1){
            this.left_type = context.tree[0].type
        }else if(context.tree[0].type == "id"){
            var binding = this.scope.binding[context.tree[0].value]
            if(binding){this.left_type = binding.type}
        }
    }

    // operation replaces left operand
    context.parent.tree.pop()
    context.parent.tree.push(this)

    this.toString = function(){
        return '(op ' + this.op + ') [' + this.tree + ']'
    }

    this.to_js = function(){
        this.js_processed = true
        var comps = {'==': 'eq','!=': 'ne','>=': 'ge','<=': 'le',
            '<': 'lt','>': 'gt'},
            left = this.tree[0].to_js(),
            right = this.tree[1].to_js(),
            args = left + ', ' + right
        switch(this.op){
            case 'and':
                return left + ' && ' + right
            case 'is':
                return left + ' === ' + right
            case 'is_not':
                return left + ' !== ' + right
            case 'or':
                return left + ' || ' + right
            case '==':
            case '>=':
            case '>':
            case '<':
            case '<=':
                return '$B.compare.' + comps[this.op] + '(' + args + ')'
            case '!=':
                return '! $B.compare.eq(' + args + ')'
            case '+':
                return '$B.operations.add(' + args + ')'
            case '-':
                return '$B.operations.sub(' + args + ')'
            case '%':
                return '$B.operations.mod(' + args + ')'
            case '*':
                return '$B.operations.mul(' + args + ')'
            case '/':
                return '$B.operations.div(' + args + ')'
            case '//':
                return '$B.operations.floordiv(' + args + ')'
            case 'in':
                return '$B.is_member(' + args + ')'
            case 'not_in':
                return '! $B.is_member(' + args + ')'
            case 'unary_neg':
                return '-' + right
            case 'unary_pos':
                return right
            default:
                console.log("unhandled", this.op)
        }
    }
}

var PackedCtx = function(context){
    // used for packed tuples in expressions, eg
    //     a, *b, c = [1, 2, 3, 4]
    this.type = 'packed'
    if(context.parent.type == 'list_or_tuple' &&
            context.parent.parent.type == "node"){
        // SyntaxError for a, *b, *c = ...
        for(var i = 0; i < context.parent.tree.length; i++){
            var child = context.parent.tree[i]
            if(child.type == 'expr' && child.tree.length > 0
                    && child.tree[0].type == 'packed'){
                $_SyntaxError(context,
                    ["two starred expressions in assignment"])
            }
        }
    }
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return '(packed) ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var RaiseCtx = function(context){
    // Class for keyword "raise"
    this.type = 'raise'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return ' (raise) ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        var res = ''
        if(this.tree.length == 0){return '$B.$raise()'}
        var exc_js = this.tree[0].to_js()
        return '$B.$raise(' + exc_js + ')'
    }
}

var RawJSCtx = function(context, js){
    this.type = "raw_js"
    context.tree[context.tree.length] = this
    this.parent = context

    this.toString = function(){return '(js) ' + js}

    this.to_js = function(){
        this.js_processed = true
        return js
    }
}

var ReturnCtx = function(context){
    // Class for keyword "return"
    this.type = 'return'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    // Check if inside a function
    this.scope = $get_scope(this)
    if(this.scope.ntype != "def"){
        $_SyntaxError(context, ["'return' outside function"])
    }

    // Check if return is inside a "for" loop
    // In this case, the loop will not be included inside a function
    // for optimisation
    var node = $get_node(this)
    while(node.parent){
        if(node.parent.context){
            var elt = node.parent.context.tree[0]
            if(elt.type == 'for'){
                elt.has_return = true
                break
            }else if(elt.type == 'try'){
                elt.has_return = true
            }else if(elt.type == 'single_kw' && elt.token == 'finally'){
                elt.has_return = true
            }
        }
        node = node.parent
    }

    this.toString = function(){return 'return ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        if(this.tree.length == 1 && this.tree[0].type == 'abstract_expr'){
            // "return" must be transformed into "return None"
            this.tree.pop()
            new IdCtx(new ExprCtx(this, 'rvalue', false), 'None')
        }
        var scope = this.scope
        // Returning from a function means leaving the execution frame
        // If the return is in a try block with a finally block, the frames
        // will be restored when entering "finally"
        var js = 'var res = ' + $to_js(this.tree) + ';' + '$B.leave_frame'
        if(scope.id.substr(0, 6) == '$exec_'){js += '_exec'}
        return js + '();return res'
    }
}

var SingleKwCtx = function(context,token){
    // Class for keywords "finally", "else"
    this.type = 'single_kw'
    this.token = token
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    // If token is "else" inside a "for" loop, set the flag "has_break"
    // on the loop, to force the creation of a boolean "$no_break"
    if(token == "else"){
        var node = context.node
        var pnode = node.parent
        for(var rank = 0; rank < pnode.children.length; rank++){
            if(pnode.children[rank] === node){break}
        }
        var pctx = pnode.children[rank - 1].context
        if(pctx.tree.length > 0){
            var elt = pctx.tree[0]
            if(elt.type == 'for' ||
                    elt.type == 'asyncfor' ||
                    (elt.type == 'condition' && elt.token == 'while')){
                elt.has_break = true
                elt.else_node = $get_node(this)
                this.loop_num = elt.loop_num
            }
        }
    }

    this.toString = function(){return this.token}

    this.transform = function(node, rank){
        // If node is "finally" there might have been a "return" or a
        // "raise" in the matching "try". In this case the frames stack has
        // been popped from. We must add code to restore it, and to re-pop
        // when exiting the "finally" block
        if(this.token == 'finally'){
            var scope = $get_scope(this)
            node.insert(0,
                NodeJS('var $exit;'+
                'if($B.frames_stack.length<$stack_length){' +
                    '$exit = true;'+
                    '$B.frames_stack.push($top_frame)'+
                '}')
            )

            var scope_id = scope.id.replace(/\./g, '_')
            var last_child = node.children[node.children.length - 1]

            // If the finally block ends with "return", don't add the
            // final line
            if(last_child.context.tree[0].type != "return"){
                node.add(NodeJS('if($exit){$B.leave_frame()}'))
            }
        }
    }

    this.to_js = function(){
        this.js_processed = true
        if(this.token == 'finally'){return this.token}

        // For "else" we must check if the previous block was a loop
        // If so, check if the loop exited with a "break" to decide
        // if the block below "else" should be run
        if(this.loop_num !== undefined){
            var scope = $get_scope(this)
            var res = 'if(locals_' + scope.id.replace(/\./g, '_')
            return res + '["$no_break' + this.loop_num + '"])'
        }
        return this.token
    }
}

var SliceCtx = function(context){
    // Class for slices inside a subscription : t[1:2]
    this.type = 'slice'
    this.parent = context
    if(context.type === "list_or_tuple"){
        // replace context by this
        context.parent.tree.pop()
        context.parent.tree.push(this)
    }
    this.tree = context.tree.length > 0 ? [context.tree.pop()] : []
    context.tree.push(this)

    this.to_js = function(){
        for(var i = 0; i < this.tree.length; i++){
            if(this.tree[i].type == "abstract_expr"){
                this.tree[i].to_js = function(){return "undefined"}
            }
        }
        if(this.parent.type == "sub"){
            return "_b_.slice.$(" + $to_js(this.tree) + ")"
        }else{
            return "_b_.range.$(" + $to_js(this.tree) + ")"
        }
    }
}

var StarArgCtx = function(context){
    // Class for star args in calls, eg f(*args)
    this.type = 'star_arg'
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.toString = function(){return '(star arg) ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var StringCtx = function(context,value){
    // Class for literal strings
    this.type = 'str'
    this.parent = context
    this.tree = [value] // may be extended if consecutive strings eg 'a' 'b'
    context.tree[context.tree.length] = this
    this.raw = false

    this.toString = function(){return 'string ' + (this.tree || '')}

    this.to_js = function(){
        var res = '',
            type = null,
            scope = $get_scope(this)

        function fstring(parsed_fstring){
            // generate code for a f-string
            // parsed_fstring is an array, the result of $B.parse_fstring()
            // in py_string.js
            var elts = []
            for(var i = 0; i < parsed_fstring.length; i++){
                if(parsed_fstring[i].type == 'expression'){
                    var expr = parsed_fstring[i].expression
                    // search specifier
                    var pos = 0,
                        br_stack = [],
                        parts = [expr]

                    while(pos < expr.length){
                        var car = expr.charAt(pos)
                        if(car == ":" && br_stack.length == 0){
                            parts = [expr.substr(0, pos),
                                expr.substr(pos + 1)]
                            break
                        }else if("{[(".indexOf(car) > -1){
                            br_stack.push(car)
                        }else if(")]}".indexOf(car) > -1){
                            br_stack.pop()
                        }
                        pos++
                    }
                    expr = parts[0]
                    // We transform the source code of the expression using bg2js.
                    // This gives us a node whose structure is always the same.
                    // The Javascript code matching the expression is the first
                    // child of the first "try" block in the node's children.
                    var save_pos = $pos
                    var expr_node = $B.bg2js(expr, scope.module, scope.id, scope)
                    $pos = save_pos
                    for(var j = 0; j < expr_node.children.length; j++){
                        var node = expr_node.children[j]
                        if(node.context.tree && node.context.tree.length == 1 &&
                                node.context.tree[0] == "try"){
                            // node is the first "try" node
                            for(var k = 0; k < node.children.length; k++){
                                // Ignore line num children if any
                                if(node.children[k].is_line_num){continue}
                                // This is the node with the translation of the
                                // f-string expression.
                                var expr1 = node.children[k].to_js()
                                // Remove trailing newline and ;
                                while("\n;".indexOf(expr1.charAt(expr1.length - 1)) > -1){
                                    expr1 = expr1.substr(0, expr1.length - 1)
                                }
                                break
                            }
                            break
                        }
                    }
                    switch(parsed_fstring[i].conversion){
                        case "a":
                            expr1 = '_b_.ascii(' + expr1 + ')'
                            break
                        case "r":
                            expr1 = '_b_.repr(' + expr1 + ')'
                            break
                        case "s":
                            expr1 = '_b_.str.$(' + expr1 + ')'
                            break
                    }

                    var fmt = parts[1]
                    if(fmt !== undefined){
                        // Format specifier can also contain expressions
                        var parsed_fmt = $B.parse_fstring(fmt)
                        if(parsed_fmt.length > 1){
                            fmt = fstring(parsed_fmt)
                        }else{
                            fmt = "'" + fmt + "'"
                        }
                        var res1 = "_b_.str.$format('{0:' + " +
                            fmt + " + '}', [" + expr1 + "])"
                        elts.push(res1)
                    }else{
                        if(parsed_fstring[i].conversion === null){
                            expr1 = '_b_.str.$(' + expr1 + ')'
                        }
                        elts.push(expr1)
                    }
                }else{
                    var re = new RegExp("'", "g")
                    var elt = parsed_fstring[i].replace(re, "\\'")
                                               .replace(/\n/g, "\\n")
                    elts.push("'" + elt + "'")
                }
            }
            return elts.join(' + ')
        }

        for(var i = 0; i < this.tree.length; i++){
            if(this.tree[i].type == "call"){
                // syntax like "hello"(*args, **kw) raises TypeError
                // cf issue 335
                var js = '(function(){throw TypeError.$factory("' + "'str'" +
                    ' object is not callable")}())'
                return js
            }else{
                var value = this.tree[i],
                    is_fstring = Array.isArray(value),
                    is_bytes = false

                if(!is_fstring){
                    is_bytes = value.charAt(0) == 'b'
                }

                if(type == null){
                    type = is_bytes
                    if(is_bytes){res += 'bytes.$factory('}
                }else if(type != is_bytes){
                    return '$B.$TypeError("can\'t concat bytes to str")'
                }
                if(!is_bytes){
                    if(is_fstring){
                        res += fstring(value)
                    }else{
                        res += value.replace(/\n/g,'\\n\\\n')
                    }
                }else{
                    res += value.substr(1).replace(/\n/g,'\\n\\\n')
                }
                if(i < this.tree.length - 1){res += '+'}
            }
        }
        if(is_bytes){res += ',"ISO-8859-1")'}
        if(res.length == 0){res = '""'}
        this.js_processed = res
        return res
    }
}

function StructCtx(context){
    this.type = "struct"
    var node = context.parent
    this.parent = context.parent
    this.name = context
    this.tree = []
    this.params = []
    this.expect = "id"

    this.id = context.tree[0]
    if(context.tree[0].type == "id"){
        this.id.bound = true
    }
    context.parent.tree = [this]

    var scope = $get_scope(context)
    $bind(context.tree[0].value, scope, context)

    this.to_js = function(){
        var type = this.name.tree[0].type
        var js = '_b_.struct("' + this.id.value + '", ['
        var names = []
        for(const param of this.params){
            if(Array.isArray(param)){
                names.push('{' + param[0] + ': ' +
                    this.tree[param[1]].to_js() + '}')
            }else{
                names.push('"' + param + '"')
            }
        }
        js += names.join(', ') + '])'
        var target = this.name.tree[0]
        switch(this.name.tree[0].type){
            case 'id':
                return this.name.to_js() + ' = ' + js
            case 'sub':
                return '$B.setitem(' + target.value.to_js() +
                    ', ' + target.tree[0].tree[0].to_js() + ', ' + js + ')'
            case 'attribute':
                return '$B.$setattr(' + target.value.to_js() +
                    ', "' + target.name + '", ' + js + ')'
        }
    }

}
var SubCtx = function(context){
    // Class for subscription or slicing, eg x in t[x]
    context.name = "sub"
    this.type = 'sub'
    this.func = 'getitem' // set to 'setitem' if assignment
    this.value = context.tree[0]
    context.tree.pop()
    context.tree.push(this)
    this.parent = context
    this.tree = []

    this.toString = function(){
        return '(sub) (value) ' + this.value + ' (tree) ' + this.tree
    }

    this.to_js = function(){
        // setitem if sub is at the left side of an assignment
        var p = this.parent
        while(p.parent){
            if(["assign", "augm_assign"].indexOf(p.parent.type) > -1 &&
                    p === p.parent.tree[0]){
                return ""
            }
            p = p.parent
        }

        return '$B.getitem(' + this.value.to_js() + ', ' + $to_js(this.tree) + ')'
    }
}

var TargetListCtx = function(context){
    // Class for target of "for" in loops or comprehensions,
    // eg x in "for x in A"
    this.type = 'target_list'
    this.parent = context
    this.tree = []
    this.expect = 'id'
    context.tree[context.tree.length] = this

    this.toString = function(){return '(target list) ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var TernaryCtx = function(context){
    // Class for the ternary operator : "x if C else y"
    this.type = 'ternary'
    this.parent = context.parent
    context.parent.tree.pop()
    context.parent.tree.push(this)
    context.parent = this
    this.tree = [context]

    this.toString = function(){return '(ternary) ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        var res = '$B.$bool(' + this.tree[1].to_js() + ') ? ' // condition
        res += this.tree[0].to_js() + ' : '    // result if true
        return res + this.tree[2].to_js()      // result if false
    }
}

var TryCtx = function(context){
    // Class for the keyword "try"
    this.type = 'try'
    this.parent = context
    context.tree[context.tree.length] = this

    this.toString = function(){return '(try) '}

    this.transform = function(node, rank){
        if(node.parent.children.length == rank + 1){
            $_SyntaxError(context, "missing clause after 'try'")
        }else{
            var next_ctx = node.parent.children[rank + 1].context.tree[0]
            switch(next_ctx.type) {
                case 'except':
                case 'finally':
                case 'single_kw':
                    break
                default:
                    $_SyntaxError(context, "missing clause after 'try'")
            }
        }
        var scope = $get_scope(this)

        var error_name = create_temp_name('$err')

        // Add a boolean $failed, used to run the 'else' clause.
        var failed_name = "locals." + create_temp_name('$failed')

        // Transform node into Javascript 'try' (necessary if
        // "try" inside a "for" loop)

        var js = failed_name + ' = false;\n' +
            ' '.repeat(node.indent + 4) + 'try'
        new NodeJSCtx(node, js)
        node.is_try = true // used in generators
        node.has_return = this.has_return

        // Insert new 'catch' clause
        var catch_node = NodeJS('catch('+ error_name + ')')
        catch_node.is_catch = true
        node.parent.insert(rank + 1, catch_node)

        // Store current exception
        catch_node.add(NodeJS("$B.set_exc(" + error_name + ")"))

        // Set the boolean $failed to true
        // Set attribute "pmframe" (post mortem frame) to $B in case an error
        // happens in a callback function ; in this case the frame would be
        // lost at the time the exception is handled by $B.exception
        catch_node.add(
            NodeJS(failed_name + ' = true;' +
            '$B.pmframe = $B.last($B.frames_stack);'+
            // Fake line to start the 'else if' clauses
            'if(0){}')
        )

        var pos = rank + 2,
            has_default = false, // is there an "except:" ?
            has_else = false, // is there an "else" clause ?
            has_finally = false
        while(1){
            if(pos == node.parent.children.length){break}
            var ctx = node.parent.children[pos].context.tree[0]
            if(ctx === undefined){
                break
            }
            if(ctx.type == 'except'){
                // move the except clauses below catch_node
                if(has_else){
                    $_SyntaxError(context,"'except' or 'finally' after 'else'")
                }
                if(has_finally){
                    $_SyntaxError(context,"'except' after 'finally'")
                }
                ctx.error_name = error_name
                if(ctx.tree.length > 0 && ctx.tree[0].alias !== null
                        && ctx.tree[0].alias !== undefined){
                    // syntax "except ErrorName as Alias"
                    var alias = ctx.tree[0].alias
                    node.parent.children[pos].insert(0,
                        NodeJS('locals["' + alias + '"] = $B.exception(' +
                            error_name + ')')
                    )
                }
                catch_node.insert(catch_node.children.length,
                    node.parent.children[pos])
                if(ctx.tree.length == 0){
                    if(has_default){
                        $_SyntaxError(context,'more than one except: line')
                    }
                    has_default = true
                }
                node.parent.children.splice(pos, 1)
            }else if(ctx.type == 'single_kw' && ctx.token == 'finally'){
                has_finally = true
                var finally_node = node.parent.children[pos]
                pos++
            }else if(ctx.type == 'single_kw' && ctx.token == 'else'){
                if(has_else){
                    $_SyntaxError(context,"more than one 'else'")
                }
                if(has_finally){
                    $_SyntaxError(context,"'else' after 'finally'")
                }
                has_else = true
                var else_body = node.parent.children[pos]
                node.parent.children.splice(pos, 1)
            }else{break}
        }
        if(!has_default){
            // If no default except clause, add a line to throw the
            // exception if it was not caught
            var new_node = new $Node(),
                ctx = new NodeCtx(new_node)
            catch_node.insert(catch_node.children.length, new_node)
            new SingleKwCtx(ctx, 'else')
            new_node.add(NodeJS('throw '+ error_name))
        }
        if(has_else){
            var else_node = new $Node()
            else_node.module = scope.module
            new NodeJSCtx(else_node, 'if(!'+failed_name+ ')')
            else_body.children.forEach(function(elt){
                else_node.add(elt)
            })
            // If the try block has a "finally" node, the "else" node must
            // be put in it, because the "else" block must be executed
            // before finally - cf issue #500
            if(has_finally){
                finally_node.insert(0, else_node)
            }else{
                node.parent.insert(pos, else_node)
            }
            pos++
        }

        $loop_num++
    }

    this.to_js = function(){
        this.js_processed = true
        return 'try'
    }

}

var UnaryCtx = function(context,op){
    // Class for unary operators : - and ~
    this.type = 'unary'
    this.op = op
    this.parent = context
    context.tree[context.tree.length] = this

    this.toString = function(){return '(unary) ' + this.op}

    this.to_js = function(){
        this.js_processed = true
        return this.op
    }
}

function WhenCtx(context){
    this.type = "when"
    this.parent = context
    this.tree = []
    this.expect = "id"
    this.event_names = []
    this.var_name = ""
    this.node = $get_node(this)
    this.scope = $get_scope(this)

    this.node.id = "$when" + $B.UUID()
    this.node.binding = {}
    this.node.parent_block = this.scope
    this.locals = []

    context.tree = [this]

    this.set_var_name = function(name){
        this.var_name = name
        this.node.id = this.scope.id + "_" + name
        $bind(name, this.node, this)
    }

    this.transform = function(node, rank){
        node.insert(0, NodeJS('var locals = locals_' + this.node.id +
            ' = $B.args("<callback>", pos, kw, ["' + this.var_name + '"])'))
        node.insert(1, NodeJS('$B.frames_stack.push(locals)'))
        node.parent.insert(rank + 1, NodeJS("])"))
    }

    this.to_js = function(){
        var js = "$B.DOMNode.bind([" + this.tree[0].to_js() + ', '
        if(this.event_names.length == 1){
            js += '"' + this.event_names[0] + '"'
        }else{
            var names = []
            for(const name of this.event_names){
                names.push('"' + name + '"')
            }
            js += '[' + names.join(', ') + ']'
        }
        js += ', function(pos, kw)'
        return js
    }
}

function YieldCtx(context){
    this.type = "yield"
    this.parent = context
    this.tree = []
    this.expect = "id"

    this.scope = $get_scope(this)
    this.scope.is_generator = true

    context.tree = [this]

    this.to_js = function(){
        return "yield " + this.tree[0].to_js()
    }
}

var $add_line_num = function(node,rank){
    if(node.type == 'module'){
        var i = 0
        while(i < node.children.length){
            i += $add_line_num(node.children[i], i)
        }
    }else if(node.type !== 'marker'){
        var elt = node.context.tree[0],
            offset = 1,
            flag = true,
            pnode = node
        while(pnode.parent !== undefined){pnode = pnode.parent}
        var mod_id = pnode.id
        // ignore lines added in transform()
        var line_num = node.line_num || node.forced_line_num
        if(line_num === undefined){flag = false}
        // Don't add line num before try,finally,else,elif
        // because it would throw a syntax error in Javascript
        if(elt.type == 'condition' && elt.token == 'elif'){flag = false}
        else if(elt.type == 'except'){flag = false}
        else if(elt.type == 'single_kw'){flag = false}
        if(flag){
            // add a trailing None for interactive mode
            var js = 'locals.$line_info = "' + line_num + ',' +
                mod_id + '";'

            var new_node = new $Node()
            new_node.is_line_num = true // used in generators
            new NodeJSCtx(new_node, js)
            node.parent.insert(rank, new_node)
            offset = 2
        }
        var i = 0
        while(i < node.children.length){
            i += $add_line_num(node.children[i], i)
        }
        // At the end of a "while" or "for" loop body, add a line to reset
        // line number to that of the "while" or "for" loop (cf issue #281)
        if((elt.type == 'condition' && elt.token == "while")
                || node.context.type == 'for'){
            if($B.last(node.children).context.tree[0].type != "return"){
                node.add(NodeJS('locals.$line_info = "' + line_num +
                    ',' + mod_id + '";'))
            }
        }

        return offset
    }else{
        return 1
    }
}

$B.$add_line_num = $add_line_num

var $bind = function(name, scope, context){
    // Bind a name in scope:
    // - add the name in the attribute "binding" of the scope
    // - add it to the attribute "bindings" of the node, except if no_bindings
    //   is set, which is the case for "for x in A" : if A is empty the name
    //   has no value (issue #1233)

    if(! context.no_bindings){
        var node = $get_node(context)
        // Add name to attribute "bindings" of node. Used in IdCtx.boundBefore()
        node.bindings = node.bindings || {}
        node.bindings[name] = true
    }

    scope.binding = scope.binding || {}
    if(scope.binding[name] === undefined){
        scope.binding[name] = true
    }else{
        // This is not the first binding in scope
        context.already_bound = true
    }
}

var $previous = function(context){
    var previous = context.node.parent.children[
            context.node.parent.children.length - 2]
    if(!previous || !previous.context){
        $_SyntaxError(context, 'keyword not following correct keyword')
    }
    return previous.context.tree[0]
}

var $get_docstring = function(node){
    var doc_string = ''
    if(node.children.length > 0){
        var firstchild = node.children[0]
        if(firstchild.context.tree && firstchild.context.tree.length > 0 &&
                firstchild.context.tree[0].type == 'expr'){
            var expr = firstchild.context.tree[0].tree[0]
            // Set as docstring if first child is a string, but not a f-string
            if(expr.type == 'str' && !Array.isArray(expr.tree[0])){
                doc_string = firstchild.context.tree[0].tree[0].to_js()
            }
        }
    }
    return doc_string
}

var $get_scope = function(context, flag){
    // Return the instance of $Node indicating the scope of context
    // Return null for the root node
    var ctx_node = context.parent
    while(ctx_node.type !== 'node'){ctx_node = ctx_node.parent}
    var tree_node = ctx_node.node,
        scope = null
    while(tree_node.parent && tree_node.parent.type !== 'module'){
        var ntype = tree_node.parent.context.tree[0].type

        switch (ntype) {
            case 'def':
            case 'when':
                var scope = tree_node.parent
                scope.ntype = 'def'
                scope.is_function = true
                return scope
        }
        tree_node = tree_node.parent
    }
    var scope = tree_node.parent || tree_node // module
    scope.ntype = "module"
    return scope
}

var $get_module = function(context){
    // Return the instance of $Node for the module where context
    // is defined
    var ctx_node = context.parent
    while(ctx_node.type !== 'node'){ctx_node = ctx_node.parent}
    var tree_node = ctx_node.node
    if(tree_node.ntype == "module"){return tree_node}
    var scope = null
    while(tree_node.parent.type != 'module'){
        tree_node = tree_node.parent
    }
    var scope = tree_node.parent // module
    scope.ntype = "module"
    return scope
}

var $get_src = function(context){
    // Get the source code of context module
    var node = $get_node(context)
    while(node.parent !== undefined){node = node.parent}
    return node.src
}

var $get_node = function(context){
    var ctx = context
    while(ctx.parent){
        ctx = ctx.parent
    }
    return ctx.node
}

var $to_js_map = function(tree_element) {
    if(tree_element.to_js !== undefined){return tree_element.to_js()}
    throw Error('no to_js() for ' + tree_element)
}

var $to_js = function(tree,sep){
    if(sep === undefined){sep = ','}

    return tree.map($to_js_map).join(sep)
}

// Function called in function $tokenize for each token found in the
// Python source code

var $transition = function(context, token, value){
    //console.log("context", context, "token", token, value)
    switch(context.type){
        case 'abstract_expr':
          var packed = context.packed,
              is_await = context.is_await,
              assign = context.parent.type == "assign"
          switch(token) {
              case 'id':
              case 'int':
              case 'float':
              case 'str':
              case 'bytes':
              case '[':
              case '(':
              case '{':
              case '.':
              case 'not':
              case 'lambda':
                  context.parent.tree.pop() // remove abstract expression
                  var commas = context.with_commas
                  context = context.parent
                  context.packed = packed
                  context.is_await = is_await
                  if(assign){
                      context.assign = assign
                  }
          }

          switch(token) {
              case 'await':
                  return new AwaitCtx(context)
              case 'id':
                  return new IdCtx(new ExprCtx(context, 'id', commas),
                      value)
              case 'str':
                  return new StringCtx(new ExprCtx(context, 'str', commas),
                      value)
              case 'bytes':
                  return new StringCtx(new ExprCtx(context, 'bytes', commas),
                      value)
              case 'int':
                  return new IntCtx(new ExprCtx(context, 'int', commas),
                      value)
              case 'float':
                  return new FloatCtx(new ExprCtx(context, 'float', commas),
                      value)
              case '(':
                  return new ListOrTupleCtx(
                      new ExprCtx(context, 'tuple', commas), 'tuple')
              case '[':
                  return new ListOrTupleCtx(
                      new ExprCtx(context, 'list', commas), 'list')
              case '{':
                  return new DictOrSetCtx(
                      new ExprCtx(context, 'dict_or_set', commas))
              case 'not':
                  if(context.type == 'op' && context.op == 'is'){ // "is not"
                      context.op = 'is_not'
                      return context
                  }
                  return new NotCtx(new ExprCtx(context, 'not', commas))
              case 'lambda':
                  return new LambdaCtx(new ExprCtx(context, 'lambda', commas))
              case 'op':
                  var tg = value
                  switch(tg) {
                      case '*':
                          context.parent.tree.pop() // remove abstract expression
                          var commas = context.with_commas
                          context = context.parent
                          return new PackedCtx(
                              new ExprCtx(context, 'expr', commas))
                      case '-':
                      case '~':
                      case '+':
                          // create a left argument for operator "unary"
                          context.parent.tree.pop()
                          var left = new UnaryCtx(context.parent, tg)
                          // create the operator "unary"
                          if(tg == '-'){
                              var op_expr = new OpCtx(left,'unary_neg')
                          }else if(tg == '+'){
                              var op_expr = new OpCtx(left, 'unary_pos')
                          }else{
                              var op_expr = new OpCtx(left,'unary_inv')
                          }
                          return new AbstractExprCtx(op_expr, false)
                      case 'not':
                          context.parent.tree.pop() // remove abstract expression
                          var commas = context.with_commas
                          context = context.parent
                          return new NotCtx(
                              new ExprCtx(context, 'not', commas))
                  }
                  $_SyntaxError(context, 'token ' + token + ' after ' +
                      context)
              case '=':
                  $_SyntaxError(context, token)
              case ':':
                  if(context.parent.type == "sub" ||
                          (context.parent.type == "list_or_tuple" &&
                          context.parent.parent.type == "sub")){
                      return new AbstractExprCtx(new SliceCtx(context.parent), false)
                  }
                  return $transition(context.parent, token, value)
              case ')':
              case ',':
                  switch(context.parent.type) {
                      case 'slice':
                      case 'list_or_tuple':
                      case 'call_arg':
                      case 'op':
                          break
                      default:
                          $_SyntaxError(context, token)
                  }
              case 'def':
                  if(assign){
                      // form "f = def(x, y)"
                      var left = context.parent.tree[0]
                      var node = context.parent.parent
                      node.tree = []
                      var defctx = new DefCtx(context.parent.parent)
                      defctx.set_name(left)
                      defctx.assigned = true
                      return defctx
                  }
          }
          return $transition(context.parent, token, value)

        case 'assert':
            if(token == 'eol'){return $transition(context.parent, token)}
            $_SyntaxError(context, token)

        case 'assign':
            if(token == 'eol'){
                if(context.tree[1].type == 'abstract_expr'){
                    $_SyntaxError(context, 'token ' + token + ' after ' +
                        context)
                }
                // If left is an id, update binding to the type of right operand
                context.guess_type()
                return $transition(context.parent, 'eol')
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'async':
            if(token == "def"){
                return $transition(context.parent, token, value)
            }else if(token == "for"){
                var ntype = $get_scope(context).ntype
                if(ntype !== "def"){
                    $_SyntaxError(context, ["'async " + token +
                        "' outside async function"])
                }
                var ctx = $transition(context.parent, token, value)
                ctx.parent.async = true // set attr "async" of for context
                return ctx
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'attribute':
            if(token === 'id'){
                var name = value
                if(noassign[name] === true){$_SyntaxError(context,
                    ["cannot assign to " + name])}
                context.name = name
                return context.parent
            }else if(kwdict.indexOf(token) > -1){
                context.name = token
                return context.parent
            }
            $_SyntaxError(context,token)

        case 'augm_assign':
            if(token == 'eol'){
                if(context.tree[1].type == 'abstract_expr'){
                    $_SyntaxError(context, 'token ' + token + ' after ' +
                        context)
                }
                return $transition(context.parent, 'eol')
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'await':
            context.parent.is_await = true
            return $transition(context.parent, token, value)

        case 'break':
            if(token == 'eol'){return $transition(context.parent, 'eol')}
            $_SyntaxError(context, token)

        case 'call':
            switch(token) {
                case ',':
                    if(context.expect == 'id'){$_SyntaxError(context, token)}
                    context.expect = 'id'
                    return context
                case 'await':
                case 'id':
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case '.':
                case 'not':
                case 'lambda':
                    context.expect = ','
                    return $transition(new CallArgCtx(context), token,
                        value)
                case ')':
                    context.end = $pos
                    return context.parent
                case 'op':
                    context.expect = ','
                    switch(value) {
                        case '-':
                        case '~':
                        case '+':
                            context.expect = ','
                            return $transition(new CallArgCtx(context), token,
                                value)
                        case '*':
                            context.has_star = true
                            return new StarArgCtx(context)
                        case '**':
                            context.has_dstar = true
                            return new DoubleStarArgCtx(context)
                    }
                    $_SyntaxError(context, token)
            }

            return $transition(context.parent, token, value)

        case 'call_arg':
            switch(token) {
                case 'await':
                case 'id':
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case '.':
                case 'not':
                case 'lambda':
                    if(context.expect == 'id'){
                         context.expect = ','
                         var expr = new AbstractExprCtx(context, false)
                         return $transition(expr, token, value)
                    }
                    break
                case '=':
                    if(context.expect == ','){
                        return new ExprCtx(new KwArgCtx(context), 'kw_value',
                            false)
                    }
                    break
                case 'for':
                    // comprehension
                    var lst = new ListOrTupleCtx(context, 'gen_expr')
                    lst.vars = context.vars // copy variables
                    lst.locals = context.locals
                    lst.intervals = [context.start]
                    context.tree.pop()
                    lst.expression = context.tree
                    context.tree = [lst]
                    lst.tree = []
                    var comp = new ComprehensionCtx(lst)
                    return new TargetListCtx(new CompForCtx(comp))
                case 'op':
                    if(context.expect == 'id'){
                       var op = value
                       context.expect = ','
                       switch(op) {
                           case '+':
                           case '-':
                           case '~':
                               return $transition(new AbstractExprCtx(context,false),token,op)
                           case '*':
                               return new StarArgCtx(context)
                           case '**':
                               return new DoubleStarArgCtx(context)
                       }
                    }
                    $_SyntaxError(context, 'token ' + token + ' after ' + context)
                case ')':
                    if(context.parent.kwargs &&
                            $B.last(context.parent.tree).tree[0] && // if call ends with ,)
                            ['kwarg', 'star_arg', 'double_star_arg'].
                                indexOf($B.last(context.parent.tree).tree[0].type) == -1){
                        $_SyntaxError(context,
                            ['non-keyword arg after keyword arg'])
                    }
                    if(context.tree.length > 0){
                        var son = context.tree[context.tree.length - 1]
                        if(son.type == 'list_or_tuple' &&
                                son.real == 'gen_expr'){
                            son.intervals.push($pos)
                        }
                    }
                    return $transition(context.parent,token)
                case ':':
                    if(context.expect == ',' &&
                            context.parent.parent.type == 'lambda') {
                        return $transition(context.parent.parent, token)
                    }
                    break
                case ',':
                    if(context.expect == ','){
                        if(context.parent.kwargs &&
                                ['kwarg','star_arg', 'double_star_arg'].
                                    indexOf($B.last(context.parent.tree).tree[0].type) == -1){
                            $_SyntaxError(context,
                                ['non-keyword arg after keyword arg'])
                        }
                        return $transition(context.parent, token, value)
                    }
                case 'eol':
                    if(context.parent.parent.type == "struct"){
                        return $transition(context.parent.parent, token, value)
                    }

            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'comp_if':
            return $transition(context.parent, token, value)

        case 'comp_for':
            if(token == 'in' && context.expect == 'in'){
                context.expect = null
                return new AbstractExprCtx(new CompIterableCtx(context), true)
            }
            if(context.expect === null){
                // ids in context.tree[0] are local to the comprehension
                return $transition(context.parent, token, value)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'comp_iterable':
            return $transition(context.parent, token, value)

        case 'comprehension':
            switch(token) {
                case 'if':
                    return new AbstractExprCtx(new CompIfCtx(context), false)
                case 'for':
                    return new TargetListCtx(new CompForCtx(context))
            }
            return $transition(context.parent,token,value)

        case 'condition':
            if(token == 'eol'){
                if(context.tree[0].type == "abstract_expr" &&
                        context.tree[0].tree.length == 0){ // issue #965
                    $_SyntaxError(context, 'token ' + token + ' after ' + context)
                }
                return context.parent
            }
            $_SyntaxError(context, 'unexpected token ' + token)

        case 'continue':
            if(token == 'eol'){return context.parent}
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'ctx_manager_alias':
            switch(token){
                case ',':
                case ':':
                    //if(context.tree[0].type == "expr" &&
                    //        context.tree[0].tree[0].type == "id"){
                        context.parent.set_alias(context.tree[0].tree[0])
                    //}
                    return $transition(context.parent, token, value)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'def':
            switch(token){
                case 'id':
                    if(context.assigned) {
                        $_SyntaxError(context, 'function name already set')
                    }
                    context.set_name(value)
                    return context
                case '(':
                    if(! context.assigned && context.name == null){
                        $_SyntaxError(context, 'token ' + token +
                            ' after ' + context)
                    }
                    context.has_args = true;
                    return new FuncArgsCtx(context)
                case 'eol':
                    if(context.has_args){
                        return context.parent
                    }
            }
            $_SyntaxError(context, 'unexpected token ' + token)

        case 'del':
            if(token == 'eol'){return $transition(context.parent, token)}
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'dict_or_set':
            if(context.closed){
                switch(token) {
                  case '[':
                    return new AbstractExprCtx(new SubCtx(context.parent),false)
                  case '(':
                    return new CallArgCtx(new CallCtx(context.parent))
                }
                return $transition(context.parent,token,value)
            }else{
                if(context.expect == ','){
                    switch(token) {
                        case '}':
                            switch(context.real) {
                                case 'dict_or_set':
                                     if(context.tree.length != 1){break}
                                     context.real = 'set'   // is this needed?
                                case 'set':
                                case 'set_comp':
                                case 'dict_comp':
                                     context.items = context.tree
                                     context.tree = []
                                     context.closed = true
                                     return context
                                case 'dict':
                                    if(context.nb_dict_items() % 2 == 0){
                                        context.items = context.tree
                                        context.tree = []
                                        context.closed = true
                                        return context
                                    }
                              }
                              $_SyntaxError(context, 'token ' + token +
                                  ' after ' + context)
                        case ',':
                            if(context.real == 'dict_or_set'){context.real = 'set'}
                            if(context.real == 'dict' &&
                                    context.nb_dict_items() % 2){
                                $_SyntaxError(context, 'token ' + token +
                                    ' after ' + context)
                            }
                            context.expect = 'id'
                            return context
                        case ':':
                          if(context.real == 'dict_or_set'){context.real = 'dict'}
                          if(context.real == 'dict'){
                              context.expect = ','
                              return new AbstractExprCtx(context,false)
                          }else{$_SyntaxError(context, 'token ' + token +
                              ' after ' + context)}
                        case 'for':

                            // comprehension
                            if(context.real == 'dict_or_set'){context.real = 'set_comp'}
                            else{context.real = 'dict_comp'}
                            var lst = new ListOrTupleCtx(context, 'dict_or_set_comp')
                            lst.intervals = [context.start + 1]
                            lst.vars = context.vars
                            context.tree.pop()
                            lst.expression = context.tree
                            context.tree = [lst]
                            lst.tree = []
                            var comp = new ComprehensionCtx(lst)
                            return new TargetListCtx(new CompForCtx(comp))
                    }
                    $_SyntaxError(context, 'token ' + token + ' after ' + context)
                }else if(context.expect == 'id'){
                    switch(token) {
                        case '}':
                            if(context.tree.length == 0){ // empty dict
                                context.items = []
                                context.real = 'dict'
                            }else{ // trailing comma, eg {'a':1,'b':2,}
                                context.items = context.tree
                            }
                            context.tree = []
                            context.closed = true
                            return context
                        case 'id':
                        case 'int':
                        case 'float':
                        case 'str':
                        case 'bytes':
                        case '[':
                        case '(':
                        case '{':
                        case '.':
                        case 'not':
                        case 'lambda':
                            context.expect = ','
                            var expr = new AbstractExprCtx(context, false)
                            return $transition(expr, token, value)
                        case 'op':
                            switch(value) {
                                case '*':
                                case '**':
                                    context.expect = ","
                                    var expr = new AbstractExprCtx(context, false)
                                    expr.packed = value.length // 1 for x, 2 for **
                                    if(context.real == "dict_or_set"){
                                        context.real = value == "*" ? "set" :
                                            "dict"
                                    }else if(
                                            (context.real == "set" && value == "**") ||
                                            (context.real == "dict" && value == "*")){
                                        $_SyntaxError(context, 'token ' + token +
                                            ' after ' + context)
                                    }
                                    return expr
                                case '+':
                                    // ignore unary +
                                    return context
                                case '-':
                                case '~':
                                    // create a left argument for operator "unary"
                                    context.expect = ','
                                    var left = new UnaryCtx(context, value)
                                    // create the operator "unary"
                                    if(value == '-'){
                                        var op_expr = new OpCtx(left, 'unary_neg')
                                    }else if(value == '+'){
                                        var op_expr = new OpCtx(left, 'unary_pos')
                                    }else{
                                        var op_expr = new OpCtx(left, 'unary_inv')
                                    }
                                    return new AbstractExprCtx(op_expr,false)
                            }
                            $_SyntaxError(context, 'token ' + token +
                                ' after ' + context)
                    }
                    $_SyntaxError(context, 'token ' + token + ' after ' + context)
                }
                return $transition(context.parent, token, value)
            }

        case 'double_star_arg':
            switch(token){
                case 'id':
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case '.':
                case 'not':
                case 'lambda':
                    return $transition(new AbstractExprCtx(context, false),
                        token, value)
                case ',':
                case ')':
                    return $transition(context.parent, token)
                case ':':
                    if(context.parent.parent.type == 'lambda'){
                      return $transition(context.parent.parent, token)
                    }
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'end_positional':
            if(token == "," || token == ")"){
                return $transition(context.parent, token, value)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'except':
            switch(token) {
                case 'id':
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case 'not':
                case 'lambda':
                    if(context.expect == 'id'){
                       context.expect = 'as'
                       return $transition(new AbstractExprCtx(context, false),
                           token, value)
                    }
                case 'as':
                    // only one alias allowed
                    if(context.expect == 'as' &&
                            context.has_alias === undefined){
                        context.expect = 'alias'
                        context.has_alias = true
                        return context
                    }
                case 'id':
                    if(context.expect == 'alias'){
                        context.expect = 'eol'
                        context.set_alias(value)
                        return context
                    }
                    break
                case 'eol':
                    var _ce = context.expect
                    if(_ce == 'id' || _ce == 'as' || _ce == 'eol'){
                        return context.parent
                    }
                    break
                case '(':
                    if(context.expect == 'id' && context.tree.length == 0){
                        context.parenth = true
                        return context
                    }
                    break
                case ')':
                    if(context.expect == ',' || context.expect == 'as'){
                        context.expect = 'as'
                        return context
                    }
                case ',':
                    if(context.parenth !== undefined &&
                            context.has_alias === undefined &&
                            (context.expect == 'as' || context.expect == ',')){
                        context.expect = 'id'
                        return context
                    }
          }
          $_SyntaxError(context, 'unexpected token ' + token)

        case 'expr':
          switch(token) {
              case 'bytes':
              case 'float':
              case 'id':
              case 'int':
              case 'lambda':
              case 'str':
              case '{':
                  $_SyntaxError(context, 'token ' + token + ' after ' +
                      context)
                  break
              case '[':
              case '(':
              case '.':
              case 'not':
                  if(context.expect == 'expr'){
                      context.expect = ','
                      return $transition(new AbstractExprCtx(context, false),
                          token, value)
                  }
          }
          switch(token) {
              case 'not':
                  if(context.expect == ','){return new ExprNot(context)}
                  break
              case 'in':
                  if(context.parent.type == 'target_list'){
                      // expr used for target list
                      return $transition(context.parent, token)
                  }
                  if(context.expect == ','){
                      return $transition(context, 'op', 'in')
                  }
                  break
              case ',':
                  if(context.expect == ','){
                      if(context.with_commas){
                           // implicit tuple
                           context.parent.tree.pop()
                           var tuple = new ListOrTupleCtx(context.parent,
                               'tuple')
                           tuple.implicit = true
                           tuple.has_comma = true
                           tuple.tree = [context]
                           context.parent = tuple
                           return tuple
                       }
                  }
                  return $transition(context.parent, token)
              case '.':
                  return new AttrCtx(context)
            case '[':
                return new AbstractExprCtx(new SubCtx(context), true)
            case '(':
                return new CallCtx(context)
            case 'op':
                // handle operator precedence ; fasten seat belt ;-)
                var op_parent = context.parent,
                    op = value

                // conditional expressions have the lowest priority
                if(op_parent.type == 'ternary' && op_parent.in_else){
                    var new_op = new OpCtx(context, op)
                    return new AbstractExprCtx(new_op, false)
                }

                var op1 = context.parent,
                    repl = null
                while(1){
                    if(op1.type == 'expr'){op1 = op1.parent}
                    else if(op1.type == 'op' &&
                            $op_weight[op1.op] >= $op_weight[op] &&
                            !(op1.op == '**' && op == '**')){ // cf. issue #250
                        repl = op1
                        op1 = op1.parent
                    }else if(op1.type == "not" &&
                            $op_weight['not'] > $op_weight[op]){
                        repl = op1
                        op1 = op1.parent
                    }else{break}
                }
                if(repl === null){
                    while(1){
                        if(context.parent !== op1){
                            context = context.parent
                            op_parent = context.parent
                        }else{
                            break
                        }
                    }
                    context.parent.tree.pop()
                    var expr = new ExprCtx(op_parent, 'operand',
                        context.with_commas)
                    expr.expect = ','
                    context.parent = expr
                    var new_op = new OpCtx(context, op)
                    return new AbstractExprCtx(new_op, false)
                }else{
                    // issue #371
                    if(op === 'and' || op === 'or'){
                        while(repl.parent.type == 'not'||
                                (repl.parent.type == 'expr' &&
                                repl.parent.parent.type == 'not')){
                            // 'and' and 'or' have higher precedence than 'not'
                            repl = repl.parent
                            op_parent = repl.parent
                        }
                    }
                }
                if(repl.type == 'op'){
                    var _flag = false
                    switch(repl.op){
                        case '<':
                        case '<=':
                        case '==':
                        case '!=':
                        case 'is':
                        case '>=':
                        case '>':
                           _flag = true
                    }
                    if(_flag) {
                        switch(op) {
                            case '<':
                            case '<=':
                            case '==':
                            case '!=':
                            case 'is':
                            case '>=':
                            case '>':
                             // chained comparisons such as c1 <= c2 < c3
                             // replace by (c1 op1 c2) and (c2 op c3)

                             // save c2
                             var c2 = repl.tree[1], // right operand of op1
                                 c2js = c2.to_js()

                             // clone c2
                             var c2_clone = new Object()
                             for(var attr in c2){c2_clone[attr] = c2[attr]}

                             // The variable c2 must be evaluated only once ;
                             // we generate a temporary variable name to
                             // replace c2.to_js() and c2_clone.to_js()
                             var vname = "$c" + chained_comp_num
                             c2.to_js = function(){return vname}
                             c2_clone.to_js = function(){return vname}
                             chained_comp_num++

                             // If there are consecutive chained comparisons
                             // we must go up to the uppermost 'and' operator
                             while(repl.parent && repl.parent.type == 'op'){
                                 if($op_weight[repl.parent.op] <
                                         $op_weight[repl.op]){
                                     repl = repl.parent
                                 }else{break}
                             }
                             repl.parent.tree.pop()

                             // Create a new 'and' operator, with the left
                             // operand equal to c1 <= c2
                             var and_expr = new OpCtx(repl, 'and')
                             // Set an attribute "wrap" to the OpCtx instance.
                             // It will be used in an anomymous function where
                             // the temporary variable called vname will be
                             // set to the value of c2
                             and_expr.wrap = {'name': vname, 'js': c2js}

                             c2_clone.parent = and_expr
                             // For compatibility with the interface of OpCtx,
                             // add a fake element to and_expr : it will be
                             // removed when new_op is created at the next
                             // line
                             and_expr.tree.push('xxx')
                             var new_op = new OpCtx(c2_clone, op)
                             return new AbstractExprCtx(new_op, false)
                       }
                    }
                }
                repl.parent.tree.pop()
                var expr = new ExprCtx(repl.parent,'operand',false)
                expr.tree = [op1]
                repl.parent = expr
                var new_op = new OpCtx(repl,op) // replace old operation
                return new AbstractExprCtx(new_op,false)
            case 'augm_assign':
                var parent = context.parent
                while(parent){
                    if(parent.type == "assign" || parent.type == "augm_assign"){
                        $_SyntaxError(context, "augmented assign inside assign")
                    }else if(parent.type == "op"){
                        $_SyntaxError(context, ["can't assign to operator"])
                    }
                    parent = parent.parent
                }
                if(context.expect == ','){
                     return new AbstractExprCtx(
                         new AugmentedAssignCtx(context, value), true)
                }
                return $transition(context.parent, token, value)
            case ":":
                // slice only if expr parent is a subscription, or a tuple
                // inside a subscription, or a slice
                if(context.parent.type == "sub" ||
                        (context.parent.type == "list_or_tuple" &&
                        context.parent.parent.type == "sub")){
                    return new AbstractExprCtx(new SliceCtx(context.parent), false)
                }else if(context.parent.type == "slice"){
                    return $transition(context.parent, token, value)
                }else if(context.parent.type == "node"){
                    // syntax "Position: x, y"
                    return new StructCtx(context)
                }
                break
            case '=':
                function has_parent(ctx, type){
                    // Tests if one of ctx parents is of specified type
                    while(ctx.parent){
                        if(ctx.parent.type == type){return ctx.parent}
                        ctx = ctx.parent
                    }
                    return false
                }
                if(context.expect == ','){
                   if(context.parent.type == "call_arg"){
                       // issue 708
                       if(context.tree[0].type != "id"){
                           $_SyntaxError(context,
                               ["keyword can't be an expression"])
                       }
                       return new AbstractExprCtx(new KwArgCtx(context), true)
                   }else if(context.parent.type == "op"){
                        // issue 811
                        $_SyntaxError(context, ["can't assign to operator"])
                   }else if(context.parent.type == "list_or_tuple"){
                       // issue 973
                       for(var i = 0; i < context.parent.tree.length; i++){
                           var item = context.parent.tree[i]
                           if(item.type == "expr" && item.name == "operand"){
                               $_SyntaxError(context, ["can't assign to operator"])
                           }
                       }
                   }
                   while(context.parent !== undefined){
                       context = context.parent
                       if(context.type == "condition"){
                           $_SyntaxError(context, 'token ' + token + ' after '
                               + context)
                       }else if(context.type == "augm_assign"){
                           $_SyntaxError(context, "assign inside augmented assign")
                       }
                   }
                   context = context.tree[0]
                   if(context.type == "assign"){
                       $_SyntaxError(context, "consecutive assignements")
                   }
                   return new AbstractExprCtx(new AssignCtx(context), true)
                }
                break
            case ':=':
                // PEP 572 : assignment expression
                var ptype = context.parent.type
                if(["node", "assign", "kwarg"].indexOf(ptype) > -1){
                    $_SyntaxError(context, ':= invalid, parent ' + ptype)
                }else if(ptype == "func_arg_id" &&
                        context.parent.tree.length > 0){
                    // def foo(answer = p := 42):
                    $_SyntaxError(context, ':= invalid, parent ' + ptype)
                }else if(ptype == "call_arg" &&
                        context.parent.parent.type == "call" &&
                        context.parent.parent.parent.type == "lambda"){
                    // lambda x := 1
                    $_SyntaxError(context, ':= invalid, parent ' + ptype)
                }
                if(context.tree.length == 1 &&
                        context.tree[0].type == "id"){
                    var scope = $get_scope(context),
                        name = context.tree[0].value
                    while(scope.is_comp){
                        scope = scope.parent_block
                    }
                    $bind(name, scope, context)
                    var parent = context.parent
                    parent.tree.pop()
                    var assign_expr = new AbstractExprCtx(parent, false)
                    assign_expr.assign = context.tree[0]
                    return assign_expr
                }
                $_SyntaxError(context, 'token ' + token + ' after ' + context)
            case 'if':
                var in_comp = false,
                    ctx = context.parent
                while(true){
                    if(ctx.type == "list_or_tuple"){
                        // In parenthised expression, eg the second "if" in
                        // flds=[f for f in fields if (x if y is None else z)]
                        break
                    }else if(ctx.type == 'comp_for' || ctx.type == "comp_if"){
                        in_comp = true
                        break
                    }
                    if(ctx.parent !== undefined){ctx = ctx.parent}
                    else{break}
                }
                if(in_comp){break}
                // Ternary operator : "expr1 if cond else expr2"
                // If the part before "if" is an operation, apply operator
                // precedence
                // Example : print(1+n if n else 0)
                var ctx = context
                while(ctx.parent && ctx.parent.type == 'op'){
                    ctx = ctx.parent
                    if(ctx.type == 'expr' &&
                            ctx.parent && ctx.parent.type == 'op'){
                        ctx = ctx.parent
                    }
                }
                return new AbstractExprCtx(new TernaryCtx(ctx), false)
            case 'eol':
                if(["dict_or_set", "list_or_tuple"].indexOf(context.parent.type) == -1){
                    var t = context.tree[0]
                    if(t.type == "packed" ||
                            (t.type == "call" && t.func.type == "packed")){
                        $_SyntaxError(context, ["can't use starred expression here"])
                    }
                }
          }
          return $transition(context.parent,token)

        case 'expr_not':
            if(token == 'in'){ // expr not in : operator
                context.parent.tree.pop()
                return new AbstractExprCtx(
                    new OpCtx(context.parent, 'not_in'), false)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'for':
            switch(token) {
                case 'in':
                    return new AbstractExprCtx(
                        new ExprCtx(context,'target list', true), false)
                case 'eol':
                    if(context.tree.length < 2 // issue 638
                            || context.tree[1].tree[0].type == "abstract_expr"){
                        $_SyntaxError(context, 'token ' + token)
                    }
                    return context.parent
            }
            $_SyntaxError(context, 'token ' + token)

        case 'func_arg_id':
            switch(token) {
                case '=':
                    if(context.expect == '='){
                       context.has_default = true
                       var def_ctx = context.parent.parent
                       if(context.parent.has_star_arg){
                           def_ctx.default_list.push(def_ctx.after_star.pop())
                       }else{
                           def_ctx.default_list.push(def_ctx.positional_list.pop())
                       }
                       return new AbstractExprCtx(context, false)
                    }
                    break
                case ',':
                case ')':
                    if(context.parent.has_default && context.tree.length == 0 &&
                            context.parent.has_star_arg === undefined){
                        $pos -= context.name.length
                        $_SyntaxError(context,
                            ['non-default argument follows default argument'])
                    }else{
                        return $transition(context.parent, token)
                    }
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'func_args':
            switch (token) {
                case 'id':
                    if(context.has_kw_arg){
                        $_SyntaxError(context,'duplicate kw arg')
                    }
                    if(context.expect == 'id'){
                        context.expect = ','
                        if(context.names.indexOf(value) > -1){
                          $_SyntaxError(context,
                              ['duplicate argument ' + value +
                                  ' in function definition'])
                        }
                    }
                    return new FuncArgIdCtx(context, value)
                case ',':
                    if(context.expect == ','){
                        context.expect = 'id'
                        return context
                    }
                    $_SyntaxError(context, 'token ' + token + ' after ' +
                        context)
                case ')':
                    return context.parent
                case 'op':
                    if(context.has_kw_arg){
                        $_SyntaxError(context, 'duplicate kw arg')
                    }
                    var op = value
                    context.expect = ','
                    if(op == '*'){
                        if(context.has_star_arg){
                            $_SyntaxError(context,'duplicate star arg')
                        }
                        return new FuncStarArgCtx(context, '*')
                    }else if(op == '**'){
                        return new FuncStarArgCtx(context, '**')
                    }else if(op == '/'){ // PEP 570
                        if(context.has_end_positional){
                            $_SyntaxError(context,
                                ['duplicate / in function parameters'])
                        }else if(context.has_star_arg){
                            $_SyntaxError(context,
                                ['/ after * in function parameters'])
                        }
                        return new EndOfPositionalCtx(context)
                    }
                    $_SyntaxError(context, 'token ' + op + ' after ' + context)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'func_star_arg':
            switch(token) {
                case 'id':
                    if(context.name === undefined){
                       if(context.parent.names.indexOf(value) > -1){
                         $_SyntaxError(context,
                             ['duplicate argument ' + value +
                                 ' in function definition'])
                       }
                    }
                    context.set_name(value)
                    context.parent.names.push(value)
                    return context
                case ',':
                case ')':
                    if(context.name === undefined){
                       // anonymous star arg - found in configparser
                       context.set_name('*')
                       context.parent.names.push('*')
                    }
                    return $transition(context.parent, token)
            }// switch
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'id':
            switch(token) {
                case '=':
                    if(context.parent.type == 'expr' &&
                            context.parent.parent !== undefined &&
                            context.parent.parent.type == 'call_arg'){
                        return new AbstractExprCtx(
                            new KwArgCtx(context.parent), false)
                    }
                    return $transition(context.parent, token, value)
                case 'op':
                    return $transition(context.parent, token, value)
                case 'id':
                case 'str':
                case 'int':
                case 'float':
                    if(context.value == "print"){
                        $_SyntaxError(context,
                            ["missing parenthesis in call to 'print'"])
                    }
                    $_SyntaxError(context, 'token ' + token + ' after ' +
                        context)
            }
            if(context.value == "async"){
                // Until Python 3.7 async is not a keyword
                if(token == 'def'){
                    context.parent.parent.tree = []
                    var ctx = $transition(context.parent.parent,
                        token, value)
                    ctx.async = true
                    return ctx
                }
            }

            return $transition(context.parent, token, value)

        case 'int':
        case 'float':
            switch(token) {
                case 'id':
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case 'not':
                case 'lambda':
                    $_SyntaxError(context, 'token ' + token + ' after ' +
                        context)
            }
            return $transition(context.parent, token, value)

        case 'kwarg':
            if(token == ','){return new CallArgCtx(context.parent.parent)}
            return $transition(context.parent, token)

        case 'lambda':
            if(token == ':' && context.args === undefined){
                context.args = context.tree
                context.tree = []
                context.body_start = $pos
                return new AbstractExprCtx(context, false)
            }if(context.args !== undefined){ // returning from expression
                context.body_end = $pos
                return $transition(context.parent, token)
            }
            if(context.args === undefined && token != "("){
                return $transition(new CallCtx(context), token, value)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'list_or_tuple':
            if(context.closed){
                if(token == '['){
                    return new AbstractExprCtx(
                        new SubCtx(context.parent),false)
                }
                if(token == '('){return new CallCtx(context.parent)}
                return $transition(context.parent, token, value)
            }else{
                if(context.expect == ','){
                    switch(context.real){
                        case 'tuple':
                        case 'gen_expr':
                            if(token == ')'){
                                if(context.parent.type == "expr" &&
                                        context.parent.parent.type == "node" &&
                                        context.tree.length == 1){
                                    // Not a tuple, just an expression inside
                                    // parenthesis at node level : replace by
                                    // the expression.
                                    // Required for code like
                                    //     (pars): bool = True
                                    var node = context.parent.parent,
                                        ix = node.tree.indexOf(context.parent),
                                        expr = context.tree[0]
                                    expr.parent = node
                                    expr.$in_parens = true // keep information
                                    node.tree.splice(ix, 1, expr)
                                }
                                context.closed = true
                                if(context.real == 'gen_expr'){
                                    context.intervals.push($pos)
                                }
                                if(context.parent.type == "packed"){
                                    return context.parent.parent
                                }
                                return context.parent
                            }
                            break
                        case 'list':
                        case 'list_comp':
                            if(token == ']'){
                                 context.closed = true
                                 if(context.real == 'list_comp'){
                                     context.intervals.push($pos)
                                 }
                                 if(context.parent.type == "packed"){
                                     if(context.parent.tree.length > 0){
                                         return context.parent.tree[0]
                                     }else{
                                         return context.parent.parent
                                     }
                                 }
                                 return context.parent
                            }else if(token == ":"){
                                // slice, eg [0:4]
                                // replace list
                                return new AbstractExprCtx(
                                    new SliceCtx(context), "slice", false)
                            }
                            break
                        case 'dict_or_set_comp':
                            if(token == '}'){
                                 context.intervals.push($pos)
                                 return $transition(context.parent, token)
                            }
                            break
                    }

                    switch(token) {
                        case ',':
                            if(context.real == 'tuple'){
                                context.has_comma = true
                            }
                            context.expect = 'id'
                            return context
                        case 'for':
                            // comprehension
                            if(context.real == 'list'){
                                context.real = 'list_comp'
                            }
                            else{context.real = 'gen_expr'}
                            // remove names already referenced in list from
                            // the function references
                            context.intervals = [context.start + 1]
                            context.expression = context.tree
                            context.tree = [] // reset tree
                            var comp = new ComprehensionCtx(context)
                            return new TargetListCtx(new CompForCtx(comp))
                    }
                    return $transition(context.parent,token,value)
                }else if(context.expect == 'id'){
                    switch(context.real) {
                        case 'tuple':
                            if(token == ')'){
                              context.closed = true
                              return context.parent
                            }
                            if(token == 'eol' && context.implicit === true){
                              context.closed = true
                              return $transition(context.parent, token)
                            }
                            break
                        case 'gen_expr':
                            if(token == ')'){
                              context.closed = true
                              return $transition(context.parent, token)
                            }
                            break
                        case 'list':
                            if(token == ']'){
                              context.closed = true
                              return context
                            }
                            break
                    }

                    switch(token) {
                        case '=':
                            if(context.real == 'tuple' &&
                                    context.implicit === true){
                                context.closed = true
                                context.parent.tree.pop()
                                var expr = new ExprCtx(context.parent,
                                    'tuple', false)
                                expr.tree = [context]
                                context.parent = expr
                                return $transition(context.parent, token)
                            }
                            break
                        case ')':
                            break
                        case ']':
                            if(context.real == 'tuple' &&
                                    context.implicit === true){
                                // Syntax like d[1,] = 2
                                return $transition(context.parent, token,
                                    value)
                            }else{
                                break
                            }
                        case ',':
                            $_SyntaxError(context,
                                'unexpected comma inside list')
                        default:
                            context.expect = ','
                            var expr = new AbstractExprCtx(context, false)
                            return $transition(expr,token, value)
                    }

                }else{
                    return $transition(context.parent, token, value)
                }
            }

        case 'list_comp':
            switch(token){
                case ']':
                    return context.parent
                case 'in':
                    return new ExprCtx(context, 'iterable', true)
                case 'if':
                    return new ExprCtx(context, 'condition', true)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)

        case 'module':
            switch(token){
                case "id":
                    if(context.expect == "id"){
                        context.expect = "eol"
                        context.name = value
                        return context
                    }
                    throw SyntaxError("unexpected token: " + token)
                case "eol":
                    if(context.expect == "eol"){
                        return context.parent
                    }
                    throw SyntaxError("unexpected token: " + token)
                default:
                    throw SyntaxError("unexpected token: " + token)
            }

        case 'node':
            switch(token) {
                case 'id':
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case 'not':
                case 'lambda':
                case '.':
                    var expr = new AbstractExprCtx(context,true)
                    return $transition(expr,token,value)
                case 'op':
                    switch(value) {
                        case '*':
                        case '+':
                        case '-':
                        case '~':
                            var expr = new AbstractExprCtx(context, true)
                            return $transition(expr, token, value)
                    }
                    break
                case 'async':
                    return new AsyncCtx(context)
                case 'await':
                    return new AbstractExprCtx(new AwaitCtx(context), true)
                case 'continue':
                    return new ContinueCtx(context)
                case 'break':
                    return new BreakCtx(context)
                case 'def':
                    return new DefCtx(context)
                case 'del':
                    return new AbstractExprCtx(new DelCtx(context),true)
                case 'for':
                    return new TargetListCtx(new ForExpr(context))
                case 'if':
                case 'while':
                    return new AbstractExprCtx(
                        new ConditionCtx(context, token), false)
                case 'elif':
                    var previous = $previous(context)
                    if(['condition'].indexOf(previous.type) == -1 ||
                            previous.token == 'while'){
                        $_SyntaxError(context, 'elif after ' + previous.type)
                    }
                    return new AbstractExprCtx(
                        new ConditionCtx(context, token), false)
                case 'else':
                    var previous = $previous(context)
                    if(['condition', 'except', 'for'].
                            indexOf(previous.type) == -1){
                        $_SyntaxError(context, 'else after ' + previous.type)
                    }
                    return new SingleKwCtx(context,token)
                case 'when':
                    return new WhenCtx(context)
                case 'finally':
                    var previous = $previous(context)
                    if(['try', 'except'].indexOf(previous.type) == -1 &&
                            (previous.type != 'single_kw' ||
                                previous.token != 'else')){
                        $_SyntaxError(context, 'finally after ' + previous.type)
                    }
                    return new SingleKwCtx(context,token)
                case 'except':
                    var previous = $previous(context)
                    if(['try', 'except'].indexOf(previous.type) == -1){
                        $_SyntaxError(context, 'except after ' + previous.type)
                    }
                    return new ExceptCtx(context)
                case 'lambda':
                    return new LambdaCtx(context)
                case "module":
                    return new ModuleCtx(context)
                case 'raise':
                    return new AbstractExprCtx(new RaiseCtx(context), true)
                case 'return':
                    return new AbstractExprCtx(new ReturnCtx(context),true)
                case 'try':
                    return new TryCtx(context)
                case 'yield':
                    return new YieldCtx(context)
                case 'eol':
                    if(context.tree.length == 0){ // might be the case after a :
                        context.node.parent.children.pop()
                        return context.node.parent.context
                    }
                    return context
            }
            console.log('syntax error', 'token', token, 'after', context)
            $_SyntaxError(context, 'token ' + token + ' after ' + context)
        case 'not':
            switch(token) {
                case 'in':
                    // not is always in an expression : remove it
                    context.parent.parent.tree.pop() // remove 'not'
                    return new ExprCtx(new OpCtx(context.parent, 'not_in'),
                        'op', false)
                case 'id':
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case '.':
                case 'not':
                case 'lambda':
                    var expr = new AbstractExprCtx(context, false)
                    return $transition(expr, token, value)
                case 'op':
                  var a = value
                  if('+' == a || '-' == a || '~' == a){
                    var expr = new AbstractExprCtx(context, false)
                    return $transition(expr, token, value)
                  }
            }
            return $transition(context.parent, token)
        case 'op':
            if(context.op === undefined){
                $_SyntaxError(context,['context op undefined ' + context])
            }
            if(context.op.substr(0,5) == 'unary' && token != 'eol'){
                if(context.parent.type == 'assign' ||
                        context.parent.type == 'return'){
                    // create and return a tuple whose first element is context
                    context.parent.tree.pop()
                    var t = new ListOrTupleCtx(context.parent, 'tuple')
                    t.tree.push(context)
                    context.parent = t
                    return t
                }
            }

            switch(token) {
                case 'id':
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case '.':
                case 'not':
                case 'lambda':
                    return $transition(new AbstractExprCtx(context, false),
                        token, value)
                case 'op':
                    switch(value){
                        case '+':
                        case '-':
                        case '~':
                            return new UnaryCtx(context, value)
                    }
                default:
                    if(context.tree[context.tree.length - 1].type ==
                            'abstract_expr'){
                        $_SyntaxError(context, 'token ' + token + ' after ' +
                            context)
                    }
            }
            return $transition(context.parent, token)
        case 'packed':
            if(context.tree.length > 0 && token == "["){
                // Apply subscription to packed element (issue #1139)
                console.log("apply to packed element", context.tree[0])
                return $transition(context.tree[0], token, value)
            }
            if(token == 'id'){
                new IdCtx(context, value)
                context.parent.expect = ','
                return context.parent
            }else if(token == "["){
                context.parent.expect = ','
                return new ListOrTupleCtx(context, "list")
            }else if(token == "("){
                context.parent.expect = ','
                return new ListOrTupleCtx(context, "tuple")
            }else if(token == "]"){
                return $transition(context.parent, token, value)
            }
            console.log("syntax error", context, token)
            $_SyntaxError(context, 'token ' + token + ' after ' + context)
        case 'raise':
            switch(token) {
                case 'id':
                    if(context.tree.length == 0){
                       return new IdCtx(new ExprCtx(context, 'exc', false),
                           value)
                    }
                    break
                case 'eol':
                    return $transition(context.parent, token)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)
        case 'return':
            return $transition(context.parent,token)
        case 'single_kw':
            if(token == 'eol'){return context.parent}
            $_SyntaxError(context, 'invalid token ' + token)
        case 'slice':
            if(token == ":"){
                return new AbstractExprCtx(context, false)
            }
            return $transition(context.parent, token, value)
        case 'star_arg':
            switch(token) {
                case 'id':
                    if(context.parent.type == "target_list"){
                        context.tree.push(value)
                        context.parent.expect = ','
                        return context.parent
                    }
                    return $transition(new AbstractExprCtx(context, false),
                        token, value)
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case 'not':
                case 'lambda':
                    return $transition(new AbstractExprCtx(context, false),
                        token, value)
                case ',':
                    return $transition(context.parent, token)
                case ')':
                    return $transition(context.parent, token)
                case ':':
                    if(context.parent.parent.type == 'lambda'){
                      return $transition(context.parent.parent, token)
                    }
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)
        case 'str':
            switch(token) {
                case '[':
                    return new AbstractExprCtx(new SubCtx(context.parent),
                        false)
                case '(':
                    // Strings are not callable. We replace the string by a call
                    // to an object that will raise the correct exception
                    context.parent.tree[0] = context
                    return new CallCtx(context.parent)
                case 'str':
                    context.tree.push(value)
                    return context
            }
            return $transition(context.parent, token, value)

        case 'struct':
            switch(token){
                case 'id':
                    if(context.expect == 'id'){
                        context.params.push(value)
                        context.expect = ","
                        return context
                    }
                    $_SyntaxError(context, ["struct expects an identifier"])
                case '=':
                    if(context.expect == ','){
                        // default value : replace last parameter name by a
                        // list [param name, rank of default value in context.tree]
                        var param = context.params.pop()
                        context.params.push([param, context.tree.length])
                        return new AbstractExprCtx(context, false)
                    }
                    $_SyntaxError(context, ["unexpected = in struct definition"])
                case ',':
                    if(context.expect == ','){
                        context.expect = 'id'
                        return context
                    }
                    $_SyntaxError(context, ["unexpected , in struct definition"])
                case 'eol':
                    if(context.expect == ','){
                        return context.parent
                    }
                    $_SyntaxError(context, ["struct expects an identifier"])
                default:
                    $_SyntaxError(context, 'token ' + token)
            }

        case 'sub':
            // subscription x[a] or slicing x[a:b:c]
            switch(token) {
                case 'id':
                case 'int':
                case 'float':
                case 'str':
                case 'bytes':
                case '[':
                case '(':
                case '{':
                case '.':
                case 'not':
                case 'lambda':
                    var expr = new AbstractExprCtx(context,false)
                    return $transition(expr, token, value)
                case ']':
                    if(context.parent.packed){
                        return context.parent.tree[0]
                    }
                    if(context.tree[0].tree.length > 0){
                        return context.parent
                    }
                    break
                case ':':
                    return new AbstractExprCtx(new SliceCtx(context), false)
                case ',':
                    return new AbstractExprCtx(context, false)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)
        case 'target_list':
            switch(token) {
                case 'id':
                    if(context.expect == 'id'){
                        context.expect = ','
                        return new IdCtx(
                            new ExprCtx(context, 'target', false),
                                value)
                    }
                case 'op':
                    if(context.expect == 'id' && value == '*'){
                        // form "for a, *b in X"
                        return new PackedCtx(context)
                    }
                case '(':
                case '[':
                    if(context.expect == 'id'){
                      context.expect = ','
                      return new TargetListCtx(context)
                    }
                case ')':
                case ']':
                    if(context.expect == ','){return context.parent}
                case ',':
                    if(context.expect == ','){
                        context.expect = 'id'
                        return context
                    }
            }

            if(context.expect == ',') {
                return $transition(context.parent, token, value)
            }else if(token == 'in'){
                // Support syntax "for x, in ..."
                return $transition(context.parent, token, value)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' + context)
        case 'ternary':
            if(token == 'else'){
                context.in_else = true
                return new AbstractExprCtx(context, false)
            }else if(! context.in_else){
                $_SyntaxError(context, 'token ' + token + ' after ' + context)
            }
            return $transition(context.parent, token, value)
        case 'try':
            if(token == 'eol'){return context.parent}
            $_SyntaxError(context, 'unexpected token ' + token)
        case 'unary':
            switch(token) {
                case 'int':
                case 'float':
                    // replace by real value of integer or float
                    // parent of context is a ExprCtx
                    // grand-parent is a AbstractExprCtx
                    // we remove the ExprCtx and trigger a transition
                    // from the $AbstractExpCtx with an integer or float
                    // of the correct value
                    var expr = context.parent
                    context.parent.parent.tree.pop()
                    if(context.op == '-'){value = "-" + value}
                    else if(context.op == '~'){value = ~value}
                    return $transition(context.parent.parent, token, value)
                case 'id':
                    // replace by x.__neg__(), x.__invert__ or x.__pos__
                    context.parent.parent.tree.pop()
                    var expr = new ExprCtx(context.parent.parent, 'call',
                        false)
                    var expr1 = new ExprCtx(expr, 'id', false)
                    new IdCtx(expr1,value) // create id
                    var repl = new AttrCtx(expr)
                    if(context.op == '+'){repl.name = '__pos__'}
                    else if(context.op == '-'){repl.name = '__neg__'}
                    else{repl.name = '__invert__'}
                    // new context is the expression above the id
                    return expr1
                case 'op':
                    if('+' == value || '-' == value){
                       if(context.op === value){context.op = '+'}
                       else{context.op = '-'}
                       return context
                    }
            }
            return $transition(context.parent, token, value)

        case 'when':
            switch(token){
                case 'id':
                    if(context.expect == "id"){
                        context.event_names.push(value)
                        context.expect = "on"
                        return context
                    }else if(context.expect == "expr"){
                        context.expect = "as"
                        var expr = new ExprCtx(context, "event", false)
                        expr.tree[0] = new IdCtx(expr, value)
                        return expr
                    }else if(context.expect == "alias"){
                        context.expect = "eol"
                        context.set_var_name(value)
                        return context
                    }
                    $_SyntaxError(context, 'token ' + token + ", expected id")
                case 'on':
                    if(context.expect == "on"){
                        context.expect = "expr"
                        return context
                    }
                    $_SyntaxError(context, 'token ' + token + ", expected 'on'")
                case 'as':
                    if(context.expect == "as"){
                        context.expect = "alias"
                        return context
                    }
                    $_SyntaxError(context, 'token ' + token)
                case ',':
                    if(context.expect == "on"){
                        context.expect = "id"
                        return context
                    }
                    $_SyntaxError(context, 'token ' + token)
                case 'eol':
                    if(context.expect == "as" || context.expect == "eol"){
                        return context.parent
                    }
                    $_SyntaxError(context, 'token ' + token)
            }
            $_SyntaxError(context, 'token ' + token)

        case 'yield':
            switch(token){
                case 'id':
                    if(context.expect == "id"){
                        context.expect = "eol"
                        var expr_ctx = new ExprCtx(context, "yield", true),
                            id_ctx = new IdCtx(expr_ctx, value)
                        return id_ctx
                    }
                    $_SyntaxError(context, "invalid token " + token)
                case 'eol':
                    if(context.expect == "eol"){
                        return context.parent
                    }
                    $_SyntaxError(context, "invalid token " + token)
                default:
                    $_SyntaxError(context, "invalid token " + token)
            }

    }
}

// Names that can't be given to variable names or attributes
$B.forbidden = []
    //enum, export, extends, import, and super
$B.aliased_names = $B.list2obj($B.forbidden)

var s_escaped = 'abfnrtvxuU"0123456789' + "'" + '\\',
    is_escaped = {}
for(var i = 0; i < s_escaped.length; i++){
    is_escaped[s_escaped.charAt(i)] = true
}

var kwdict = [
    "return", "break", "for", "lambda", "try", "finally",
    "raise", "def", "while", "del",
    "as", "elif", "else", "if",
    "except", "raise", "in", "continue",
    "async", "await",
    "when", "on", "module", "yield"
    ]

var $tokenize = function(root, src) {
    var br_close = {")": "(", "]": "[", "}": "{"},
        br_stack = "",
        br_pos = []
    var unsupported = []
    var $indented = [
        "def", "for", "condition", "single_kw", "try", "except",
         "when"
    ]
    // from https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Reserved_Words

    var int_pattern = /^(\d[0-9_]*)/,
        float_pattern1 = /^(\d[\d_]*)\.(\d*)([eE][+-]?\d+(_\d+)*)?/,
        float_pattern2 = /^(\d[\d_]*)([eE][+-]?\d+(_\d+)*)/,
        hex_pattern = /^0[xX]([\da-fA-F_]+)/,
        octal_pattern = /^0[oO]([0-7_]+)/,
        binary_pattern = /^0[bB]([01_]+)/

    var context = null
    var new_node = new $Node(),
        current = root,
        name = "",
        _type = null,
        pos = 0,
        indent = null,
        string_modifier = false

    var module = root.module

    var lnum = root.line_num || 1
    while(pos < src.length){
        var car = src.charAt(pos)
        // build tree structure from indentation
        if(indent === null){
            var indent = 0
            while(pos < src.length){
                var _s = src.charAt(pos)
                if(_s == " "){indent++; pos++}
                else if(_s == "\t"){
                    // tab : fill until indent is multiple of 8
                    indent++; pos++
                    if(indent % 8 > 0){indent += 8 - indent % 8}
                }else{break}
            }
            // ignore empty lines
            var _s = src.charAt(pos)
            if(_s == '\n'){pos++; lnum++; indent = null; continue}
            else if(_s == '#'){ // comment
                var offset = src.substr(pos).search(/\n/)
                if(offset == -1){break}
                pos += offset + 1
                lnum++
                indent = null
                continue
            }
            new_node.indent = indent
            new_node.line_num = lnum
            new_node.module = module

            if(current.is_body_node){
                // A "body node" starts after the ":" and has no indent
                // initially set, so we take the number of spaces after the ":"
                current.indent = indent
            }

            // attach new node to node with indentation immediately smaller
            if(indent > current.indent){
                // control that parent ended with ':'
                if(context !== null){
                    if($indented.indexOf(context.tree[0].type) == -1){
                        $pos = pos
                        $_SyntaxError(context, 'unexpected indent', pos)
                    }
                }
                // add a child to current node
                current.add(new_node)
            }else if(indent <= current.indent && context && context.tree[0] &&
                    $indented.indexOf(context.tree[0].type) > -1 &&
                    context.tree.length < 2){
                $pos = pos
                $_SyntaxError(context, 'expected an indented block',pos)
            }else{ // same or lower level
                while(indent !== current.indent){
                    current = current.parent
                    if(current === undefined || indent > current.indent){
                        $pos = pos
                        $_SyntaxError(context, 'unexpected indent', pos)
                    }
                }
                current.parent.add(new_node)
            }
            current = new_node
            context = new NodeCtx(new_node)
            continue
        }
        // comment
        if(car == "#"){
            var end = src.substr(pos + 1).search('\n')
            if(end == -1){end = src.length - 1}
            // Keep track of comment positions
            root.comments.push([pos, end])
            pos += end + 1
            continue
        }
        // string
        if(car == '"' || car == "'"){
            var raw = context.type == 'str' && context.raw,
                bytes = false,
                fstring = false,
                sm_length, // length of string modifier
                end = null;
            if(string_modifier){
                switch(string_modifier) {
                    case 'r': // raw string
                        raw = true
                        break
                    case 'u':
                        // in string literals, '\U' and '\u' escapes in raw strings
                        // are not treated specially.
                        break
                    case 'b':
                        bytes = true
                        break
                    case 'rb':
                    case 'br':
                        bytes = true; raw = true
                        break
                    case 'f':
                        fstring = true
                        sm_length = 1
                        break
                    case 'fr', 'rf':
                        fstring = true
                        sm_length = 2
                        raw = true
                        break
                }
                string_modifier = false
            }
            if(src.substr(pos, 3) == car + car + car){
                _type = "triple_string"
                end = pos + 3
            }else{
                _type = "string"
                end = pos + 1
            }
            var escaped = false,
                zone = car,
                found = false
            while(end < src.length){
                if(escaped){
                    if(src.charAt(end) == "a"){
                        zone = zone.substr(0, zone.length - 1) + "\u0007"
                    }else{
                        zone += src.charAt(end)
                        if(raw && src.charAt(end) == '\\'){zone += '\\'}
                    }
                    escaped = false
                    end++
                }else if(src.charAt(end) == "\\"){
                    if(raw){
                        if(end < src.length - 1 &&
                                src.charAt(end + 1) == car){
                            zone += '\\\\' + car
                            end += 2
                        }else{
                            zone += '\\\\'
                            end++
                        }
                        escaped = true
                    }else{
                        if(src.charAt(end + 1) == '\n'){
                            // explicit line joining inside strings
                            end += 2
                            lnum++
                        }else if(src.substr(end + 1, 2) == 'N{'){
                            // Unicode literal ?
                            var end_lit = end + 3,
                                re = new RegExp("[-A-Z0-9 ]+"),
                                search = re.exec(src.substr(end_lit))
                            if(search === null){
                                $_SyntaxError(context,"(unicode error) " +
                                    "malformed \\N character escape", pos)
                            }
                            var end_lit = end_lit + search[0].length
                            if(src.charAt(end_lit) != "}"){
                                $_SyntaxError(context, "(unicode error) " +
                                    "malformed \\N character escape", pos)
                            }
                            var description = search[0]
                            // Load unicode table if not already loaded
                            if($B.unicodedb === undefined){
                                var xhr = new XMLHttpRequest
                                xhr.open("GET",
                                    $B.baragwin_path + "unicode.txt", false)
                                xhr.onreadystatechange = function(){
                                    if(this.readyState == 4){
                                        if(this.status == 200){
                                            $B.unicodedb = this.responseText
                                        }else{
                                            console.log("Warning - could not " +
                                                "load unicode.txt")
                                        }
                                    }
                                }
                                xhr.send()
                            }
                            if($B.unicodedb !== undefined){
                                var re = new RegExp("^([0-9A-F]+);" +
                                    description + ";.*$", "m")
                                search = re.exec($B.unicodedb)
                                if(search === null){
                                    $_SyntaxError(context,"(unicode error) " +
                                        "unknown Unicode character name",pos)
                                }
                                if(search[1].length == 4){
                                    zone += "\\u" + search[1]
                                    end = end_lit + 1
                                }else{
                                    end++
                                }
                            }else{
                                end++
                            }
                        }else{
                            if(end < src.length - 1 &&
                                is_escaped[src.charAt(end + 1)] === undefined){
                                    zone += '\\'
                            }
                            zone += '\\'
                            escaped = true
                            end++
                        }
                    }
                }else if(src.charAt(end) == '\n' && _type != 'triple_string'){
                    // In a string with single quotes, line feed not following
                    // a backslash raises SyntaxError
                    $pos = end
                    $_SyntaxError(context, ["EOL while scanning string literal"])
                }else if(src.charAt(end) == car){
                    if(_type == "triple_string" &&
                            src.substr(end, 3) != car + car + car){
                        zone += src.charAt(end)
                        end++
                    }else{
                        found = true
                        // end of string
                        $pos = pos
                        // Escape quotes inside string, except if they are
                        // already escaped.
                        // In raw mode, always escape.
                        var $string = zone.substr(1), string = ''
                        for(var i = 0; i < $string.length; i++){
                            var $car = $string.charAt(i)
                            if($car == car &&
                                    (raw || (i == 0 ||
                                        $string.charAt(i - 1) != '\\'))){
                                string += '\\'
                            }
                            string += $car
                        }
                        if(fstring){
                            try{
                                var re = new RegExp("\\\\" + car, "g"),
                                    string_no_bs = string.replace(re, car)
                                var elts = $B.parse_fstring(string_no_bs) // in py_string.js
                            }catch(err){
                                $_SyntaxError(context, [err.toString()])
                            }
                        }

                        if(bytes){
                            context = $transition(context, 'str',
                                'b' + car + string + car)
                        }else if(fstring){
                            $pos -= sm_length
                            context = $transition(context, 'str', elts)
                            $pos += sm_length
                        }else{
                            context = $transition(context, 'str',
                                car + string + car)
                        }
                        context.raw = raw;
                        pos = end + 1
                        if(_type == "triple_string"){
                            pos = end + 3
                        }
                        break
                    }
                }else{
                    zone += src.charAt(end)
                    if(src.charAt(end) == '\n'){lnum++}
                    end++
                }
            }
            if(!found){
                if(_type === "triple_string"){
                    $_SyntaxError(context, "Triple string end not found")
                }else{
                    $_SyntaxError(context, "String end not found")
                }
            }
            continue
        }
        // identifier ?
        if(name == "" && car != '$'){
            // $B.unicode_tables is defined in unicode_data.js. Its attributes
            // XID_Start and XID_Continue are objects with keys = the code
            // points of valid characters for identifiers.
            // Cf. https://docs.python.org/3/reference/lexical_analysis.html#identifiers
            if($B.unicode_tables.XID_Start[car.charCodeAt(0)]){
                name = car // identifier start
                var p0 = pos
                pos++
                while(pos < src.length &&
                        $B.unicode_tables.XID_Continue[src.charCodeAt(pos)]){
                    name += src.charAt(pos)
                    pos++
                }
            }
            if(name){
                if(kwdict.indexOf(name) > -1){
                    $pos = pos - name.length
                    if(unsupported.indexOf(name) > -1){
                        $_SyntaxError(context,
                            "Unsupported Python keyword '" + name + "'")
                    }
                    context = $transition(context, name)
                }else if(typeof $operators[name] == 'string' &&
                        ['is_not', 'not_in'].indexOf(name) == -1){
                    // Literal operators : "and", "or", "is", "not"
                    // The additional test is to exclude the name "constructor"
                    if(name == 'is'){
                        // if keyword is "is", see if it is followed by "not"
                        var re = /^\s+not\s+/
                        var res = re.exec(src.substr(pos))
                        if(res !== null){
                            pos += res[0].length
                            $pos = pos - name.length
                            context = $transition(context, 'op', 'is_not')
                        }else{
                            $pos = pos - name.length
                            context = $transition(context, 'op', name)
                        }
                    }else if(name == 'not'){
                        // if keyword is "not", see if it is followed by "in"
                        var re = /^\s+in\s+/
                        var res = re.exec(src.substr(pos))
                        if(res !== null){
                            pos += res[0].length
                            $pos = pos - name.length
                            context = $transition(context, 'op', 'not_in')
                        }else{
                            $pos = pos - name.length
                            context = $transition(context, name)
                        }
                    }else{
                        $pos = pos - name.length
                        context = $transition(context, 'op', name)
                    }
                }else if((src.charAt(pos) == '"' || src.charAt(pos) == "'")
                        && ['r', 'b', 'u', 'rb', 'br', 'f', 'fr', 'rf'].
                            indexOf(name.toLowerCase()) !== -1){
                    string_modifier = name.toLowerCase()
                    name = ""
                    continue
                }else{
                    if($B.forbidden.indexOf(name) > -1){name = '$$' + name}
                    $pos = pos - name.length
                    context = $transition(context, 'id', name)
                }
                name = ""
                continue
            }
        }else if(name == "" && car == "$"){
            $pos = pos
            context = $transition(context, "id", car)
            pos++
            continue
        }

        function rmuf(numeric_literal){
            // Remove underscores inside a numeric literal (PEP 515)
            // Raises SyntaxError for consecutive or trailing underscore
            if(numeric_literal.search("__") > -1){
                // consecutive underscores is a syntax error
                $_SyntaxError(context, "invalid literal")
            }else if(numeric_literal.endsWith("_")){
                // trailing underscore is a syntax error
                $_SyntaxError(context, "invalid literal")
            }
            return numeric_literal.replace(/_/g, "")
        }

        function check_int(numeric_literal){
            // Check that the integer in numeric_literal is valid :
            // same control as rmuf above + special case for integers
            // starting with 0
            rmuf(numeric_literal)
            if(numeric_literal.startsWith("0")){
                if(numeric_literal.substr(1).search(/[^0_]/) > -1){
                    // 007 or 0_7 is invalid, only 0_0 is ok
                    $_SyntaxError(context, "invalid literal")
                }else{
                    return "0"
                }
            }
        }

        function rmu(numeric_literal){
            return numeric_literal.replace(/_/g, "")
        }

        switch(car) {
            case ' ':
            case '\t':
                pos++
                break
            case '.':
                // point, ellipsis (...)
                if(pos < src.length - 1 && /^\d$/.test(src.charAt(pos + 1))){
                    // number starting with . : add a 0 before the point
                    var j = pos + 1
                    while(j < src.length &&
                        src.charAt(j).search(/\d|e|E|_/) > -1){j++}

                    context = $transition(context, 'float',
                        '0' + rmu(src.substr(pos, j - pos)))

                    pos = j
                    break
                }
                $pos = pos
                context = $transition(context, '.')
                pos++
                break
            case '0':
              // octal, hexadecimal, binary
              var res = hex_pattern.exec(src.substr(pos))
              if(res){
                  rmuf(res[1])
                  context = $transition(context, 'int', [16, rmu(res[1])])
                  pos += res[0].length
                  break
              }
              var res = octal_pattern.exec(src.substr(pos))
              if(res){
                  context = $transition(context, 'int', [8, rmuf(res[1])])
                  pos += res[0].length
                  break
              }
              var res = binary_pattern.exec(src.substr(pos))
              if(res){
                  context = $transition(context, 'int', [2, rmuf(res[1])])
                  pos += res[0].length
                  break
              }
              // literal like "077" is not valid in Python3
              if(src.charAt(pos + 1).search(/\d/) > -1){
                  // literal like "000" is valid in Python3
                  if(parseInt(src.substr(pos)) === 0){
                      res = int_pattern.exec(src.substr(pos))
                      $pos = pos
                      check_int(res[0])
                      context = $transition(context, 'int',
                          [10, rmu(res[0])])
                      pos += res[0].length
                      break
                  }else{$_SyntaxError(context,
                      'invalid literal starting with 0')}
              }
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                // digit
                var res = float_pattern1.exec(src.substr(pos))
                if(res){
                    check_int(res[1]) // check that the part before "." is ok
                    if(res[2]){rmuf(res[2])} // same for the part after "."
                    $pos = pos
                    context = $transition(context, 'float', rmuf(res[0]))
                }else{
                    res = float_pattern2.exec(src.substr(pos))
                    if(res){
                        check_int(res[1]) // check the part before "e"
                        $pos = pos
                        context = $transition(context, 'float', rmuf(res[0]))
                    }else{
                        res = int_pattern.exec(src.substr(pos))
                        check_int(res[1])
                        $pos = pos

                        context = $transition(context, 'int',
                            [10, rmu(res[0])])
                    }
                }
                pos += res[0].length
                break
            case '\n':
                // line end
                lnum++
                if(br_stack.length > 0){
                    // implicit line joining inside brackets
                    pos++
                }else{
                    if(current.context.tree.length > 0 || current.context.async){
                        $pos = pos
                        context = $transition(context, 'eol')
                        indent = null
                        new_node = new $Node()
                    }else{
                        new_node.line_num = lnum
                    }
                    pos++
                }
                break
            case '(':
            case '[':
            case '{':
                br_stack += car
                br_pos[br_stack.length - 1] = [context, pos]
                $pos = pos
                context = $transition(context, car)
                pos++
                break
            case ')':
            case ']':
            case '}':
                if(br_stack == ""){
                    $pos = pos
                    $_SyntaxError(context, "Unexpected closing bracket")
                }else if(br_close[car] !=
                        br_stack.charAt(br_stack.length - 1)){
                    $pos = pos
                    $_SyntaxError(context, "Unbalanced bracket")
                }else{
                    br_stack = br_stack.substr(0, br_stack.length - 1)
                    $pos = pos
                    context = $transition(context, car)
                    pos++
                }
                break
            case '=':
                if(src.charAt(pos + 1) != "="){
                    $pos = pos
                    context = $transition(context, '=')
                    pos++
                }else{
                    $pos = pos
                    context = $transition(context, 'op', '==')
                    pos += 2
                }
                break
            case ',':
            case ':':
                $pos = pos
                if(src.substr(pos, 2) == ":="){
                    // PEP 572 : assignment expression
                    context = $transition(context, ":=")
                    pos++
                }else{
                    context = $transition(context, car)
                }
                pos++
                break
            case ';':
                $transition(context, 'eol') // close previous instruction
                // create a new node, at the same level as current's parent
                if(current.context.tree.length == 0){
                    // consecutive ; are not allowed
                    $pos = pos
                    $_SyntaxError(context, 'invalid syntax')
                }
                // if ; ends the line, ignore it
                var pos1 = pos + 1
                var ends_line = false
                while(pos1 < src.length){
                    var _s = src.charAt(pos1)
                    if(_s == '\n' || _s == '#'){ends_line = true; break}
                    else if(_s == ' '){pos1++}
                    else{break}
                }
                if(ends_line){pos++; break}

                new_node = new $Node()
                new_node.indent = $get_node(context).indent
                new_node.line_num = lnum
                new_node.module = module
                $get_node(context).parent.add(new_node)
                current = new_node
                context = new NodeCtx(new_node)
                pos++
                break
            case '/':
            case '%':
            case '&':
            case '>':
            case '<':
            case '-':
            case '+':
            case '*':
            case '/':
            case '^':
            case '=':
            case '|':
            case '~':
            case '!':
                // Operators

                // find longest match
                var op_match = ""
                for(var op_sign in $operators){
                    if(op_sign == src.substr(pos, op_sign.length)
                            && op_sign.length > op_match.length){
                        op_match = op_sign
                    }
                }
                $pos = pos
                if(op_match.length > 0){
                    if(op_match in $augmented_assigns){
                        context = $transition(context, 'augm_assign', op_match)
                    }else{
                        context = $transition(context, 'op', op_match)
                    }
                    pos += op_match.length
                }else{
                    $_SyntaxError(context, 'invalid character: ' + car)
                }
                break
            case '\\':
                if(src.charAt(pos + 1) == '\n'){
                  lnum++
                  pos += 2
                  break
                }else{
                    $pos = pos
                    $_SyntaxError(context,
                        ['unexpected character after line continuation character'])
                }
            case String.fromCharCode(12): // Form Feed : ignore
                pos += 1
                break
            default:
                $pos = pos
                $_SyntaxError(context, 'unknown token [' + car + ']')
        }
    }

    if(br_stack.length != 0){
        var br_err = br_pos[0]
        $pos = br_err[1]
        var lines = src.split("\n"),
            id = root.id,
            fname = id.startsWith("$") ? '<string>' : id
        $_SyntaxError(br_err[0],
            ["unexpected EOF while parsing (" + fname + ", line " +
                (lines.length - 1) + ")"])
    }
    if(context !== null && context.type == "async"){
        // issue 941
        console.log("error with async", pos, src, src.substr(pos))
        $pos = pos - 7
        throw $_SyntaxError(context, "car " + car + "after async", pos)
    }
    if(context !== null && context.tree[0] &&
            $indented.indexOf(context.tree[0].type) > -1){
        $pos = pos - 1
        $_SyntaxError(context, 'expected an indented block', pos)
    }

}

var $create_root_node = function(src, module,
        locals_id, parent_block, line_num){
    var root = new $Node('module')
    root.module = module
    root.id = locals_id
    root.binding = {
        __doc__: true,
        __name__: true,
        __file__: true,
        __package__: true
    }

    root.parent_block = parent_block
    root.line_num = line_num
    root.indent = -1
    root.comments = []
    root.imports = {}
    if(typeof src == "object"){
        root.is_comp = src.is_comp
        src = src.src
    }
    root.src = src
    root.$file = $B.script_path +
                    ($B.script_path.endsWith("/") ? "" : "/") + module

    return root
}

$B.bg2js = function(src, module, locals_id, parent_scope, line_num){
    // src = Python source (string)
    // module = module name (string)
    // locals_id = the id of the block that will be created
    // parent_scope = the scope where the code is created
    // line_info = [line_num, parent_block_id] if debug mode is set
    //
    // Returns a tree structure representing the Python source code
    $pos = 0

    if(typeof module == "object"){
        var __package__ = module.__package__
        module = module.$name
    }else{
        var __package__ = ""
    }

    parent_scope = parent_scope || $B.builtins_scope

    var t0 = new Date().getTime(),
        is_comp = false

    if(typeof src == 'object'){
        var is_comp = src.is_comp
        src = src.src
    }

    // Normalise line ends
    src = src.replace(/\r\n/gm, "\n")

    var lines = src.split("\n")
    if(lines[0] == "bg`"){
        lines.shift()
        while($B.last(lines).trim() == ""){
            lines.pop()
        }
        if($B.last(lines).trim() != "`"){
            throw SyntaxError('code should end with "`"')
        }
        lines.pop()
        src = lines.join("\n")
    }

    // Remove trailing \, cf issue 970
    // but don't hide syntax error if ends with \\, cf issue 1210
    if(src.endsWith("\\") && !src.endsWith("\\\\")){
        src = src.substr(0, src.length - 1)
    }
    // Normalise script end
    if(src.charAt(src.length - 1) != "\n"){src += "\n"}

    var locals_is_module = Array.isArray(locals_id)
    if(locals_is_module){
        locals_id = locals_id[0]
    }
    var internal = locals_id.charAt(0) == '$'

    var local_ns = 'locals_' + locals_id.replace(/\./g,'_')

    var global_ns = 'locals_' + module.replace(/\./g,'_')

    var root = $create_root_node(
        {src: src, is_comp: is_comp},
        module, locals_id, parent_scope, line_num)

    $tokenize(root, src)

    root.is_comp = is_comp
    root.transform()

    // Create internal variables
    var js = ['var $B = __BARAGWIN__,\n',
              '    _b_ = __BARAGWIN__.builtins,\n',
              '    locals = ' + local_ns]
        pos = js.length

    var offset = 0

    root.insert(0, NodeJS(js.join('')))
    offset++

    root.insert(offset++, NodeJS('locals.$name = "' + locals_id + '"'))
    root.insert(offset++, NodeJS('locals.$file = "' + root.$file + '"'))

    // Code to create the execution frame and store it on the frames stack
    var enter_frame_pos = offset,
        js = '$B.frames_stack.push(locals);'
    root.insert(offset++, NodeJS(js))

    // Wrap code in a try/finally to make sure we leave the frame
    var try_node = new NodeJS('try'),
        children = root.children.slice(enter_frame_pos + 1,
            root.children.length)
    root.insert(enter_frame_pos + 1, try_node)

    // Add module body to the "try" clause
    if(children.length == 0){children = [NodeJS('')]} // in case the script is empty
    children.forEach(function(child){
        try_node.add(child)
    })
    // add node to exit frame in case no exception was raised
    try_node.add(NodeJS('$B.leave_frame()'))

    root.children.splice(enter_frame_pos + 2, root.children.length)

    var catch_node = NodeJS('catch(err)')
    catch_node.add(NodeJS('err.frames = err.frames || $B.frames_stack.slice()'))
    catch_node.add(NodeJS('$B.leave_frame()'))
    catch_node.add(NodeJS('throw err'))

    root.add(catch_node)

    $add_line_num(root, null, module)

    var t1 = new Date().getTime()
    if($B.debug > 2){
        if(module == locals_id){
            console.log('module ' + module + ' translated in ' +
                (t1 - t0) + ' ms')
        }
    }

    $B.compile_time += t1 - t0

    return root
}

var baragwin = function(options){
    // By default, only set debug level
    if(options === undefined){options = {'debug': 0}}

    // If the argument provided to baragwin() is a number, it is the debug
    // level
    if(typeof options == 'number'){options = {'debug': options}}
    if(options.debug === undefined){options.debug = 0}
    $B.debug = options.debug
    // set built-in variable __debug__
    _b_.__debug__ = $B.debug > 0

    $B.compile_time = 0

    if(options.profile === undefined){options.profile = 0}
    $B.profile = options.profile

    // If a VFS is present, _Baragwin normally stores a precompiled version
    // in an indexedDB database. Setting options.indexedDB to false disables
    // this feature (cf issue #927)
    if(options.indexedDB === undefined){options.indexedDB = true}

    // For imports, default mode is to search modules of the standard library
    // using a static mapping stored in stdlib_paths.js
    // This can be disabled by setting option "static_stdlib_import" to false
    if(options.static_stdlib_import === undefined){
        options.static_stdlib_import = true
    }
    $B.static_stdlib_import = options.static_stdlib_import

    $B.$options = options

    // URL of the script where function baragwin() is called
    var $href = $B.script_path,
        $href_elts = $href.split('/')
    $href_elts.pop()
    if($B.isWebWorker || $B.isNode){$href_elts.pop()} // WebWorker script is in the web_workers subdirectory
    $B.curdir = $href_elts.join('/')


    if(!($B.isWebWorker || $B.isNode)){
        _run_scripts(options)
    }
}


$B.run_script = function(src, name, run_loop){
    // run_loop is set to true if run_script is added to tasks in
    // ajax_load_script

    try{
        var root = $B.bg2js(src, name, name),
            js = root.to_js(),
            script = {
                $doc: root.$doc,
                js: js,
                $name: name,
                $src: src,
                $file: $B.script_path +
                    ($B.script_path.endsWith("/") ? "" : "/") + name
            }
            $B.file_cache[script.__file__] = src
            if($B.debug > 1){console.log(js)}
    }catch(err){
        $B.handle_error(err) // in loaders.js
    }
    $B.tasks.push(["execute", script])
}

var _run_scripts = function(options){
    // Save initial Javascript namespace
    var kk = Object.keys(_window)

    // Id sets to scripts
    var defined_ids = {}

    var scripts = document.getElementsByTagName('script'),
        $elts = [],
        webworkers = []
    // Freeze the list of scripts here ; other scripts can be inserted on
    // the fly by viruses
    for(var i = 0; i < scripts.length; i++){
        var script = scripts[i]
        if(script.type == "text/baragwin"){
            if(script.className == "webworker"){
                if(script.id === undefined){
                    throw _b_.AttributeError.$factory(
                        "webworker script has no attribute 'id'")
                }
                webworkers.push(script)
            }else{
                $elts.push(script)
            }
        }
    }

    // Get all scripts with type = text/baragwin and run them

    var first_script = true, module_name

    // Get all explicitely defined ids, to avoid overriding
    for(var i = 0; i < $elts.length; i++){
        var elt = $elts[i]
        if(elt.id){
            if(defined_ids[elt.id]){
                throw Error("_Baragwin error : Found 2 scripts with the " +
                  "same id '" + elt.id + "'")
            }else{
                defined_ids[elt.id] = true
            }
        }
    }

    var src
    for(var i = 0, len = webworkers.length; i < len; i++){
        var worker = webworkers[i]

        // Get source code inside the script element
        src = (worker.innerHTML || worker.textContent)
        // remove leading CR if any
        src = src.replace(/^\n/, '')
        $B.webworkers[worker.id] = src
    }

    for(var i = 0; i < $elts.length; i++){
        var elt = $elts[i]
        if(elt.type == "text/baragwin"){
            // Set the module name, ie the value of the builtin variable
            // __name__.
            // If the <script> tag has an attribute "id", it is taken as
            // the module name.
            if(elt.id){
                module_name = elt.id
            }else{
                // If no explicit name is given, the module name is
                // "__main__" for the first script, and "__main__" + a
                // random value for the next ones.
                if(first_script){
                    module_name = '__main__'
                    first_script = false
                }else{
                    module_name = '__main__' + $B.UUID()
                }
                while(defined_ids[module_name] !== undefined){
                    module_name = '__main__' + $B.UUID()
                }
            }

            // Get source code inside the script element
            src = (elt.innerHTML || elt.textContent)
            // remove leading CR if any
            src = src.replace(/^\n/, '')
            if(src.match(new RegExp("^bg`"))){
                if(!src.trim().endsWith("`")){
                    throw SyntaxError('script starts with "bg`" ' +
                        'but does not end with "`"')
                }else{
                    src = src.substr(3).trim()
                    src = src.substr(0, src.length - 1)
                }
            }
            $B.run_script(src, module_name)
        }
    }


    $B.loop()

    /* Uncomment to check the names added in global Javascript namespace
    var kk1 = Object.keys(_window)
    for (var i  =0; i < kk1.length; i++){
        if(kk[i] === undefined){
            console.log(kk1[i])
        }
    }
    */
}

$B.$operators = $operators
$B.$Node = $Node
$B.NodeJSCtx = NodeJSCtx

// in case the name 'baragwin' is used in a Javascript library,
// we can use $B.baragwin

$B.baragwin = baragwin

})(__BARAGWIN__)

var baragwin = __BARAGWIN__.baragwin

if (__BARAGWIN__.isNode) {
    global.__BARAGWIN__ = __BARAGWIN__
    module.exports = { __BARAGWIN__ }
}
