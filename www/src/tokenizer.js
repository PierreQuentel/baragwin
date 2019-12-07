var id_start_str = "abcdefghijklmnopqrstuvwxyz"
id_start_str += id_start_str.toUpperCase() + "_"
var id_continue_str = id_start_str + "0123456789"

var id_start = {}
for(const char of id_start_str){
    id_start[char] = true
}
var id_continue = {}
for(const char of id_continue_str){
    id_continue[char] = true
}

// Mapping between operators and special Python method names
var operators = "//= >>= <<= **= " +
        "+= -= *= /= %= &= |= ^= ** // << >> <= >= == != " +
        "+ - * / % & | ~ ^ < > = , . ; :"
operators = operators.split(" ")

function token(type, value, pos){
    this.type = type
    this.value = value
    this.pos = pos
    this.toString = function(){
        return '<' + this.type + 
            (this.value === null ? '' : ' ' + this.value)  + 
            ' at ' + this.pos + '>'
    }
}

function* tokenize(src) {
    // normalize line ends
    src = src.replace(/\r\n/g, '\n')
    src = src.replace(/\r/g, '\n')

    var br_close = {")": "(", "]": "[", "}": "{"},
        br_stack = [],
        br_pos = [],
        comments = []

    var int_pattern = /^(\d[0-9_]*)/,
        float_pattern1 = /^(\d[\d_]*)\.(\d*)([eE][+-]?\d+(_\d+)*)?/,
        float_pattern2 = /^(\d[\d_]*)([eE][+-]?\d+(_\d+)*)/,
        hex_pattern = /^0[xX]([\da-fA-F]+)/,
        octal_pattern = /^0[oO]([0-7]+)/,
        binary_pattern = /^0[bB]([01]+)/

    var number_pattern = /^(\d+)(\.\d+)?([eE]\d+)?/
    var name = "",
        pos = 0

    var lnum = 1
    while(pos < src.length){
        var car = src.charAt(pos)

        // comment
        if(car == "#"){
            var end = src.substr(pos + 1).search('\n')
            if(end == -1){end = src.length - 1}
            // Keep track of comment positions
            comments.push([pos, end])
            pos += end + 1
            continue
        }
        // string
        if(car == '"' || car == "'"){
            var i = pos + 1,
                nb_escape
            while(true){
                if(i == src.length){
                    yield new token('error', 'unterminated string', pos)
                    return
                }else if(src.charAt(i) == car){
                    nb_escape = 0
                    while(src.charAt(i - nb_escape - 1) == "\\"){
                        nb_escape++
                    }
                    if(nb_escape % 2){
                        // string termination is escaped: search further
                        i++
                        continue
                    }
                    yield new token('string',
                        src.substr(pos + 1, i - pos - 1), pos)
                    pos = i + 1
                    break
                }else{
                    i++
                }
            }
            continue
        }
        // identifier ?
        if(name == ""){
            if(id_start[car]){
                name = car // identifier start
                pos++
                while(pos < src.length &&
                        id_continue[src.charAt(pos)]){
                    name += src.charAt(pos)
                    pos++
                }
            }
            if(name){
                yield new token("name", name, pos)
                name = ""
                continue
            }
        }

        function check_int(numeric_literal){
            // Check that the integer in numeric_literal is valid :
            // same control as rmuf above + special case for integers
            // starting with 0
            if(numeric_literal.startsWith("0")){
                if(numeric_literal.substr(1).search(/[^0_]/) > -1){
                    // 007 or 0_7 is invalid, only 0_0 is ok
                    throw SyntaxError("Invalid literal")
                }else{
                    return "0"
                }
            }
        }

        switch(car) {
            case ' ':
            case '\t':
                pos++
                break
            case '.':
                if(pos < src.length - 1 && /^\d$/.test(src.charAt(pos + 1))){
                    console.log("num pattern", num_pattern.exec(src.substr(pos + 1)))
                    // number starting with . : add a 0 before the point
                    var j = pos + 1
                    while(j < src.length &&
                        src.charAt(j).search(/\d|e|E|_/) > -1){j++}
                    yield new token('float',
                               '0' + src.substr(pos, j - pos),
                               pos)

                    pos = j
                    break
                }else{
                    yield new token('op', car, pos)
                    pos++
                }
                break
            case '0':
              // octal, hexadecimal, binary
              var res = hex_pattern.exec(src.substr(pos))
              if(res){
                  yield new token('number', res[0], pos)
                  pos += res[0].length
                  break
              }
              var res = octal_pattern.exec(src.substr(pos))
              if(res){
                  yield new token('number', res[0], pos)
                  pos += res[0].length
                  break
              }
              var res = binary_pattern.exec(src.substr(pos))
              if(res){
                  yield new token('number', res[0], pos)
                  pos += res[0].length
                  break
              }
              // literal like "077" is not valid in Python3
              if(src.charAt(pos + 1).search(/\d/) > -1){
                  // literal like "000" is valid in Python3
                  if(parseInt(src.substr(pos)) === 0){
                      res = int_pattern.exec(src.substr(pos))
                      check_int(res[0])
                      yield new token('int', [10, res[0]], pos)
                      pos += res[0].length
                      break
                  }else{
                      yield new token('error',
                          'invalid literal starting with 0', pos)
                  }
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
                var match = number_pattern.exec(src.substr(pos))
                if(match){
                    yield new token("number", match[0], pos)
                    pos += match[0].length
                    continue
                }
                break
            case '\n':
                // line end
                lnum++
                if(br_stack.length > 0){
                    // implicit line joining inside brackets
                    yield new token('nl', null, pos)
                }else{
                    yield new token('newline', null, pos)
                }
                pos++
                break
            case '(':
            case '[':
            case '{':
                yield new token('op', car , pos)
                br_stack.push(car)
                pos++
                break
            case ')':
            case ']':
            case '}':
                yield new token('op', car , pos)
                if(br_stack[br_stack.length - 1] == br_close[car]){
                    br_stack.pop()
                }
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
            case '@':
            case '/':
            case '^':
            case '=':
            case '|':
            case '~':
            case '!':
            case ':':
            case ',':
                // Operators
                // find longest match
                var op_match = ""
                for(const op_sign of operators){
                    if(op_sign == src.substr(pos, op_sign.length)
                            && op_sign.length > op_match.length){
                        op_match = op_sign
                    }
                }
                if(op_match.length > 0){
                    yield new token('op', op_match, pos)
                    pos += op_match.length
                }else{
                    yield new token('error', car, pos)
                    pos++
                }
                break
            case '\\':
                if(src.charAt(pos + 1) == '\n'){
                  lnum++
                  pos += 2
                  break
                }else{
                    yield new token('error', car, pos)
                    pos++
                }
            case String.fromCharCode(12): // Form Feed : ignore
                pos++
                break
            default:
                yield new token('error', car, pos)
                pos++
        }
    }
    if(br_stack.length){
        throw SyntaxError("EOF inside bracket " +
            br_stack[br_stack.length - 1])
    }else{
        yield new token("eof", null, pos)
    }
}

