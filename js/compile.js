/*
TODO: Parse Labels, Translate them to addresses and put them in the right place
*/


function compileCode(codeStr){
    var lines = codeStr.replace(/\t/g," ").trim().split("\n");

    var textlines = [];
    var databytes = new Array(4096).fill(0);

    var secpos = {};

    var labels = {};
    var c = 0;
    var lineid = -1;
    var align = -1;
    var alignCount = 0;

    var cursec = ".text";
    var secoff = 0x00400000; //default as text
    while ((++lineid) < lines.length) {
        var line = lines[lineid];
        line = line.trim();
        if(line == "") continue;

        if(line[0] == "#" || line[0] == ";"){
            continue;
        }

        var cpos = line.indexOf("#");
        if(cpos>-1){
            line = line.substr(0,cpos).trim();
        }
        cpos = line.indexOf(";");
        if(cpos>-1){
            line = line.substr(0,cpos).trim();
        }

        if(line[0] == "."){
            var sec = line.split(" ")[0];

            if(cursec == ".text" && sec != ".data" && sec != ".globl") {
                throw "COMPILATION FAILED: Unsupported Directive "+sec+" in text section";
            }

            if(sec == ".text" || sec == ".data"){
                if(c!=0) secpos[cursec] = c;
                if(sec == ".data"){
                    align = -1;
                    secoff = 0x10010000; // this is where data should start
                }else{
                    secoff = 0x00400000; // this is where text starts
                }
                c = (secpos.hasOwnProperty(sec)?secpos[sec]:0);
                cursec = sec;
            }

            if(cursec == ".data" && sec != ".data"){
                var type = sec.substr(1).toLowerCase();
                var datavar = line.substr(line.indexOf(type)+type.length);
                console.log(datavar);
                switch(type){
                    case "align":
                        align = new Number(datavar);
                        if(isNaN(align)) throw "COMPILATION FAILED: ALIGN PARAM IS NaN";
                        alignCount = Math.pow(2,align);
                        break;
                    case "byte":
                        if(c%alignCount>0){
                            c += (alignCount - c%alignCount)
                        }
                        var vars = datavar.replace(" ","").split(",")
                        for(var v of vars){
                            var n = new Number(v);
                            if(n>0xff) throw "COMPILATION FAILED: NONBYTE 0x"+n.toString(16)+" PASSED AS BYTE ARGUMENT";
                            databytes.splice.apply(databytes,[c,1,n&0xff]);
                            c += vbytes.length;
                        }
                        break;
                    case "half":
                        if(align==-1 && c%2>0){
                            c += (2-c%2)
                        }else if(c%alignCount>0){
                            c += (alignCount - c%alignCount)
                        }
                        var vars = datavar.replace(" ","").split(",")
                        for(var v of vars){
                            var n = new Number(v);
                            if(n>0xffff) throw "COMPILATION FAILED: NONWORD 0x"+n.toString(16)+" PASSED AS WORD ARGUMENT";
                            var vbytes = [
                                (n>>8)&0xff,n&0xff
                            ]
                            databytes.splice.apply(databytes,[c,2].concat(vbytes));
                            c += vbytes.length;
                        }
                        break;
                    case "word":
                        if(align==-1 && c%4>0){
                            c += (4-c%4)
                        }else if(c%alignCount>0){
                            c += (alignCount - c%alignCount)
                        }
                        var vars = datavar.replace(" ","").split(",")
                        for(var v of vars){
                            var n = new Number(v);
                            if(n>0xffffffff) throw "COMPILATION FAILED: NONWORD 0x"+n.toString(16)+" PASSED AS WORD ARGUMENT";
                            var vbytes = [
                                (n>>>24)&0xff,(n>>>16)&0xff,(n>>>8)&0xff,n&0xff
                            ]
                            databytes.splice.apply(databytes,[c,4].concat(vbytes));
                            c += vbytes.length;
                        }
                        break;
                    case "ascii":
                    case "asciiz":
                        var dvars = JSON.parse("\""+datavar.slice(datavar.indexOf("\"")+1,datavar.lastIndexOf("\""))+"\"")
                        for(var ch of dvars){
                            databytes.splice.apply(databytes,[c,1,ch.charCodeAt(0)]);
                            c++;
                        }
                        if(type=="asciiz"){
                            databytes.splice.apply(databytes,[c,1,0]);
                            c++;
                        }
                        break;
                    default:
                        throw "COMPILATION FAILED: UNSUPPORTED DATA FORMAT "+type+" WAS USED";
                }
            }

            continue;
        }

        var op = line.split(" ")[0].indexOf(":");
        var li = line.indexOf(":");
        if(li>=0&&li==op){
            labels[line.substr(0,li)] = c+secoff;
            lines.splice(lineid,1,explodeStr(line,":",2)[1].trim())
            lineid--;
            continue;
        }

        line = line.trim();
        if(line == "") continue;

        if(cursec == ".text"){
            c+=4;
            textlines.push(line);
        }
    }

    console.log(labels);
    console.log(databytes);
    console.log(textlines);
    
    //PARSING INSTRUCTIONS:
    var text = []; //code array
    var lineid=-1;
    while ((++lineid) < textlines.length) {
        var line = textlines[lineid];
        if(line.trim() == "") continue;

        line = line.trim();
        //console.log("Parsing Line \"" + line +"\"");

        var opcode = line.split(" ")[0].toUpperCase();
        if(!INSTRS[opcode]){
            if(!PSEUDOINSTRS[opcode]){
                throw "COMPILATION FAILED: UNSUPPORTED INSTRUCTION "+opcode;
            }else{
                var replacement = PSEUDOINSTRS[opcode](line);
                if(replacement.length > 1) {
                    for(var labeli in labels){

                        //dont need to adjust data since its already in a different segment
                        if(labels[labeli] >= 0x10010000) continue;

                        var pseudopos = lineid*4+0x00400000;
                        if(labels[labeli] >= pseudopos){
                            labels[labeli] += (replacement.length-1)*4;
                            console.log("Adjusting label "+labeli+" to be at "+labels[labeli]+" to adjust for pseudoinstruction length");
                        }
                    }
                }
                if(opcode.toUpperCase() == "LA"){
                    textlines.splice.apply(textlines,[lineid,1].concat(new Array(replacement.length).fill("")));
                    text.push.apply(text,[].concat(replacement));
                }else{
                    textlines.splice.apply(textlines,[lineid,1].concat(replacement));
                    lineid-=1;
                }
            }
        }else{
            var instr_bin = 0;

            var instr = INSTRS[opcode];

            var instr_type = instr[1];
            var instr_op = instr[2];
            var instr_vars = instr[3];
            var instr_order = instr[4];

            var isBrancher = instr_type == 'J';

            if(instr_type == "R"){
                instr_bin |= (instr_op[0] & 0b111111) << (32-6) // Set opcode
                instr_bin |= (instr_op[1] & 0b111111)  // Set funcnum
            }else{
                instr_bin |= (instr_op & 0b111111) << (32-6) // Set opcode
            }

            if(instr_vars.length > 0){
                var args = explodeStr(line," ",2)[1].split(",").map(function(v){return v.trim().split(" ",1)[0]});
                
                var optionalPos = undefined;
                var optionalVar = undefined;

                var c = 6;

                for(var vi in instr_vars){
                    var v = instr_vars[vi];

                    if(v[3]===0 && args.length < instr_vars.length){
                        if(v[4] == undefined){
                            optionalVar = vi;
                            c += v[1];
                            optionalPos = c;
                            continue;
                        }else{
                            args.splice(vi,0,v[4]+"");
                        }
                    } 

                    var vk = vi;
                    if(instr_order){
                        vk = instr_order[vi]
                    }
                    var ai = optionalVar?vk-1:vk;

                    var val = args[ai];
                    
                    if(optionalVar && args.length < instr_vars.length && val.indexOf("(") > -1) {
                        var ov = instr_vars[optionalVar];
                        optval = val.substr(val.indexOf("(")+1);
                        optval = optval.substr(0,optval.length-1);
                        val = val.substr(0,val.indexOf("("));
                        if(ov[2] == undefined || ov[2] === 1){
                            try{
                                optval = getRegNum(optval);
                            }catch(e){
                                throw "Compilation Failed: " + e;
                            }
                        }else{
                            optval = Number(optval);
                        }                

                        //console.log((instr_bin >>> 0).toString(2) + " | " + ((optval>>>0)& (Math.pow(2,ov[1])-1)).toString(2) + " @ "+ (32-optionalPos) );
                    
                        instr_bin |= (((optval >>> 0) & (Math.pow(2,ov[1])-1)) << (32 - optionalPos));
                    }
                    
                    if(v[2] == undefined || v[2] === 1){
                        try{
                            val = getRegNum(val);
                        }catch(e){
                            throw "Compilation Failed: " + e;
                        }
                    }else{
                        if(val[0] == "'"){
                            if(val.length != 3) throw "Compilation Failed: Invalid Character Value \""+val+"\" in line \""+ line + "\"";
                            val = val.charCodeAt(1);
                        }
                        var neg = false;
                        if(val[0] == "-"){
                            val = val.substr(1);
                            neg = true;
                        }
                        val = Number(val);
                        if(neg) val = -val;
                    }

                    // ** SPECIAL CASES THAT REQUIRE LABEL INTERATION **
                    if(instr_type == 'J'){
                        args[ai] = "{"+args[ai]+"}"
                        continue;
                    }
                    switch(opcode.toUpperCase()){ 
                        case "BEQ":
                        case "BNE":
                        case "BLEZ":
                        case "BGTZ":

                        case "BGEZ":
                        case "BGEZAL":
                        case "BLTZ":
                        case "BLTZAL":
                            isBrancher = true;
                            if(ai == 2){
                                args[ai] = "{"+args[ai]+"}";
                                continue;
                            }
                    }

                    if(isNaN(val)) 
                        throw "Compilation Failed: Invalid Variable \""+args[vi]+"\" for "+v[0]+" arg IN LINE \""+ line + "\"";
                    c += v[1];
                    

                    //console.log((instr_bin >>> 0).toString(2) + " | " + ((val>>>0)& (Math.pow(2,v[1])-1)).toString(2) + " @ "+ (32-c) );
                    
                    instr_bin |= (((val >>> 0) & (Math.pow(2,v[1])-1)) << (32 - c));
                }
            }

            //console.log((instr_bin >>> 0).toString(2));

            if(instr_type != 'J' && instr_op != 0b000001 && !isBrancher) //this is all a disgusting workaround for jumps
                text.push(instr_bin);
            else{
                line = opcode + " " + args.join(",");
                text.push(line);
            }
        }
    }



    for(var li in text){
        var t = text[li];
        var lpos = li*4+0x00400000;
        if(typeof t == "string"){ //if it has not been compiled yet, it contains a label
            console.log(t);
            var line = t;
            var opcode = line.split(" ")[0].toUpperCase();

            var instr_bin = 0;

            var instr = INSTRS[opcode];

            var instr_type = instr[1];
            var instr_op = instr[2];
            var instr_vars = instr[3];

            if(instr_type == "R"){
                instr_bin |= (instr_op[0] & 0b111111) << (32-6) // Set opcode
                instr_bin |= (instr_op[1] & 0b111111)  // Set funcnum
            }else{
                instr_bin |= (instr_op & 0b111111) << (32-6) // Set opcode
            }

            if(instr_vars.length > 0){
                var args = explodeStr(line," ",2)[1].split(",").map(function(v){return v.trim().split(" ",1)[0]});
                
                var optionalPos = undefined;
                var optionalVar = undefined;

                var c = 6;
                for(var vi in instr_vars){
                    var v = instr_vars[vi];

                    if(v[3]===0 && args.length < instr_vars.length){
                        optionalVar = vi;
                        c += v[1];
                        optionalPos = c;
                        continue;
                    } 

                    var ai = optionalVar?vi-1:vi;

                    var val = args[ai];

                    if(optionalVar && args.length < instr_vars.length && val.indexOf("(") > -1) {
                        var ov = instr_vars[optionalVar];
                        var optval = val.substr(val.indexOf("(")+1);
                        optval = optval.substr(0,optval.length-1);
                        val = val.substr(0,val.indexOf("("));
                        if(ov[2] == undefined || ov[2] === 1){
                            try{
                                optval = getRegNum(optval);
                            }catch(e){
                                throw "Compilation Failed: " + e;
                            }
                        }else{
                            optval = Number(optval);
                        }                

                        //console.log((instr_bin >>> 0).toString(2) + " | " + ((optval>>>0)& (Math.pow(2,ov[1])-1)).toString(2) + " @ "+ (32-optionalPos) );
                    
                        instr_bin |= (((optval >>> 0) & (Math.pow(2,ov[1])-1)) << (32 - optionalPos));
                    }
                    
                    if(v[2] == undefined || v[2] === 1){
                        try{
                            val = getRegNum(val);
                        }catch(e){
                            throw "Compilation Failed: " + e;
                        }
                    }else if(val[0] == "{"){
                        var lbl = val.substr(1,val.indexOf("}")-1);

                        if(lbl.indexOf(":")>-1){
                            var lname = lbl.split(":")[0]
                            var lb = lbl.split(":")[1]

                            if(!labels.hasOwnProperty(lname)){
                                throw "Compilation Failed: Reference to nonexistant label "+lname;
                            }
                            if(lb == "h"){
                                val = (labels[lname]>>16)&0xffff;
                            }else if(lb == "l"){
                                val = labels[lname]&0xffff;
                            }
                        }else{
                            if(instr_type == 'J'){
                                //console.log(opcode + " asked for " + lbl + "'s addr. it is "+labels[lbl]);
                                val = (labels[lbl])>>>2;
                                if(val == lpos){
                                    throw "Compilation Error (Endless Loop Prevention): Jumping to self @"+line;
                                }
                            }else if(instr_op == 0b000001 || ['BEQ','BNE','BLEZ','BGTZ'].indexOf(opcode) >= 0){ //it is a branch REDIMM or its one of the presets
                                var offset = labels[lbl]-lpos-4;
                                val = (labels[lbl]-lpos-4)>>>2;
                                console.log(opcode + " asked for " + lbl + "'s offset. it is "+val+" ("+offset+")");
                                if(offset == lpos){
                                    throw "Compilation Error (Endless Loop Prevention): Branching to self @"+line;
                                }
                            }
                        }
                    }else{
                        var neg = false;
                        if(val[0] == "-"){
                            val = val.substr(1);
                            neg = true;
                        }
                        val = Number(val);
                        if(neg) val = -val;
                    }
                    if(isNaN(val)) throw "Compilation Failed: Invalid Variable \""+args[vi]+"\" for "+v[0]+" arg  IN LINE \""+ line + "\"";
                    c += v[1];
                    

                    //console.log((instr_bin >>> 0).toString(2) + " | " + ((val>>>0)& (Math.pow(2,v[1])-1)).toString(2) + " @ "+ (32-c) );
                    
                    instr_bin |= (((val >>> 0) & (Math.pow(2,v[1])-1)) << (32 - c));
                }
            }

            //console.log((instr_bin >>> 0).toString(2));
            text[li] = instr_bin;
        }
    }

    console.log(textlines);
    console.log(labels)
    console.log(text);

    var bin = {};
    for(var ti in text){
        bin[0x00400000 - (-ti*4)] = (text[ti]>>24) & 0xff;
        bin[0x00400001 - (-ti*4)] = (text[ti]>>16) & 0xff;
        bin[0x00400002 - (-ti*4)] = (text[ti]>>8) & 0xff;
        bin[0x00400003 - (-ti*4)] = (text[ti]) & 0xff;
    }
    for(var di in databytes){
        bin[0x10010000 - (-di)] = databytes[di];
    }

    return bin;
}