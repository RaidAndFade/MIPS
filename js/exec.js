/*
TODO: Static Data
TODO: memory proxy
TODO: impl syscalls properly
TODO: the rest
*/

var registers = []
for(var i=0;i<32;i++){ 
    registers[i] = 0;
}
registers.HI = 0;
registers.LO = 0;
var registers = new Proxy(registers,{
    set: function(e,p,v){
        if(REGISTERS[p] && REGISTERS[p][1] === false){ return; }
        e[p] = v & 0xffffffff;
    }
});

var mem = {};
//for(var i=0;i<1024;i++){ mem[i] = 0; }

var debug = true;

function runMIPS(bin){

    for(var mi in bin){
        mem[mi] = bin[mi];
    }

    mem[1] = 0xff;
    var pc = {p:0x00400000};
    while(mem[1] == 0xff && pc.p > -1){
        var line = (mem[pc.p]<<24)+(mem[pc.p+1]<<16)+(mem[pc.p+2]<<8)+(mem[pc.p+3])
        if(isNaN(line)){
            break;
        }

        var op = (line >> 26) & 0b111111;
        var instr = lookupOpcode(op);
        
        if(instr == null){
            instr = lookupFunction(op,line & 0b111111);
        }
        instid = instr;
        instr = INSTRS[instr];

        if(!instid || instr == undefined) throw "Execution Failed: UNSUPPORTED OPCODE 0x" + op.toString(16);

        var args = {};
        var c = 26;
        for(var vi in instr[3]){
            var v = instr[3][vi];
            c -= v[1];
            args[v[0]] = (line >> c) & Math.pow(2,v[1])-1;
        }

        var exechandler = INSTR_EXEC[op];
        if(!exechandler) throw "Execution Failed: NO EXECUTION HANDLER FOUND FOR OPCODE 0x" + (op>>>0).toString(16) + " ( " + instid + " )";

        if(debug) console.log("EXECUTING "+instid+" INSTR @0x"+pc.p.toString(16)+": 0x"+(line>>>0).toString(16))
        if(instr[1] == 'R'){
            if(!exechandler.hasOwnProperty(instr[2][1])) throw "Execution Failed: NO EXECUTION HANDLER FOUND FOR OPCODE 0x" + op.toString(16) + " FUNCTION 0x"+instr[2][1].toString(16)+" ( " + instid + " )";

            exechandler[instr[2][1]](args,pc,registers,mem);
        }else{
            if(op == 0b000001){
                console.log("EXECUTING BRANCH 0x"+args.o);
                exechandler[args.o](args,pc,registers,mem);
            }else{
                exechandler(args,pc,registers,mem);
            }
        }

        //console.log("exec'd " + instid + " with args",args);
        pc.p += 4;
    }
}

/************************
 *  EVALUATOR CONSTANTS *
 ************************/

//instructions list, with stuff used for executing (such as the exec function)
//format : [type(R,I,J), execfunc]
//execfunction is an array for R types and a single function for I,J
const INSTR_EXEC = []

// 0b000000 ~ SPECIAL(R)
INSTR_EXEC[0b000000] = []
// 0b000001 ~ BRANCH(I)
INSTR_EXEC[0b000001] = []

/********** SYSCALL *********/

// 0b000000 ~ SPECIAL(R) : 0b001100 ~ SYSCALL
INSTR_EXEC[0b000000][0b001100] = function(args,pc,regs,mem){
    var sid = regs[getReg("v0")];

    console.log("~~SYSCALL "+sid);
    
    switch(sid){
        case 2: case 3: case 6: case 7:
            throw "UNSUPPORTED SYSCALL (Floats are not supported in this version of the MIPS executer";
        case 1: //PRINT INT FROM REG
            var val = regs[getReg("a0")];
            document.write(val);
            break;
        case 4: //PRINT STR FROM ADDR
            var addr = regs[getReg("a0")];
            console.log(addr.toString(16));
            var str = "";
            var d = 0;
            var c = null;
            do{
                c = mem[addr++];
                if(c==0)break;
                str += String.fromCharCode(c);
                console.log(mem[addr]);
            }while(true);
            document.write(str.replace("\n","<br>"));
            break;
        case 5: //READ INT
            var i;
            while(!i){
                var n = prompt("Input an integer");
                if(parseInt(n) == n) i = parseInt(n);
            } 
            regs[getReg("v0")] = i;
            document.write(regs[getReg("v0")]+"<br>")
            break;
        case 8: //READ STR
            var memaddr = regs[getReg("a0")];
            var slen = regs[getReg("a1")]-1;
            var str;
            while(!str){
                var st = prompt("Input a string of max length " + slen);
                if(st.length <= slen) str = st;
            }
            for(var i=0;i<slen;i++){
                if(!str[i]) continue;

                mem[memaddr+i] = str.charCodeAt(i);
                document.write(str[i]);
            }
            document.write("<br>")
            break;
        case 10:
            mem[1]=0x0;
            pc.p = undefined;
            break;
        default:
            throw "UNSUPPORTED SYSCALL " + sid;
    }
}

/*********** ALU START ***********/

// 0b000000 ~ SPECIAL(R) : 0b100000 ~ ADD
INSTR_EXEC[0b000000][0b100000] = function(args,pc,regs,mem){
    var d = regs[args.rd];
    d = (d>>31)?-(Math.pow(2,32)-d):d;
    regs[args.rs] = regs[args.rt] + d;
    if(debug) console.log("ADD $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+regs[args.rt]+") + $",getRegName(args.rd),"("+d+") ");
}

// 0b000000 ~ SPECIAL(R) : 0b100011 ~ SUB
INSTR_EXEC[0b000000][0b100010] = function(args,pc,regs,mem){
    var d = regs[args.rd];
    d = (d>>31)?-(Math.pow(2,32)-d):d;
    regs[args.rs] = regs[args.rt] - d;
    if(debug) console.log("SUB $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+regs[args.rt]+") - $",getRegName(args.rd),"("+regs[args.rd]+") ");
}

// 0b000000 ~ SPECIAL(R) : 0b100001 ~ ADDU
INSTR_EXEC[0b000000][0b100001] = function(args,pc,regs,mem){
    var t = regs[args.rt]
    regs[args.rs] = (regs[args.rt]>>>0) + (regs[args.rd]>>>0);
    if(debug) console.log("ADDU $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+(t>>>0)+") + $",getRegName(args.rd),"("+(regs[args.rd]>>>0)+") ");
}

// 0b000000 ~ SPECIAL(R) : 0b100011 ~ SUBU
INSTR_EXEC[0b000000][0b100011] = function(args,pc,regs,mem){
    regs[args.rs] = regs[args.rt] - regs[args.rd];
    if(debug) console.log("SUBU $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+regs[args.rt]+") - $",getRegName(args.rd),"("+regs[args.rd]+") ");
}

// 0b000000 ~ SPECIAL(R) : 0b100001 ~ OR
INSTR_EXEC[0b000000][0b100101] = function(args,pc,regs,mem){
    regs[args.rs] = (regs[args.rt]>>>0) | (regs[args.rd]>>>0);
    if(debug) console.log("OR $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+regs[args.rt]+") | $",getRegName(args.rd),"("+regs[args.rd]+") ");
}

// 0b000000 ~ SPECIAL(R) : 0b100001 ~ AND
INSTR_EXEC[0b000000][0b100100] = function(args,pc,regs,mem){
    regs[args.rs] = (regs[args.rt]>>>0) & (regs[args.rd]>>>0);
    if(debug) console.log("AND $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+regs[args.rt]+") & $",getRegName(args.rd),"("+regs[args.rd]+") ");
}

// 0b000000 ~ SPECIAL(R) : 0b100001 ~ XOR
INSTR_EXEC[0b000000][0b100110] = function(args,pc,regs,mem){
    regs[args.rs] = regs[args.rt] ^ regs[args.rd];
    if(debug) console.log("XOR $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+regs[args.rt]+") ^ $",getRegName(args.rd),"("+regs[args.rd]+") ");
}

// 0b000000 ~ SPECIAL(R) : 0b000000 ~ SLL
INSTR_EXEC[0b000000][0b000000] = function(args,pc,regs,mem){
    regs[args.rt] = (regs[args.rd] << args.sa) & 0xffffffff;
}

// 0b000000 ~ SPECIAL(R) : 0b000100 ~ SLLV
INSTR_EXEC[0b000000][0b000100] = function(args,pc,regs,mem){
    regs[args.rt] = (regs[args.rd] << regs[args.rd]) & 0xffffffff;
}

// 0b000000 ~ SPECIAL(R) : 0b000011 & 0b000010 ~ SRL & SRA
INSTR_EXEC[0b000000][0b000011] = INSTR_EXEC[0b000000][0b000010] = function(args,pc,regs,mem){
    regs[args.rt] = (regs[args.rd] >> args.sa) & 0xffffffff;
}

// 0b000000 ~ SPECIAL(R) : 0b000111 & 0b000110 ~ SRLV & SRAV
INSTR_EXEC[0b000000][0b000111] = INSTR_EXEC[0b000000][0b000110] = function(args,pc,regs,mem){
    regs[args.rt] = (regs[args.rd] >> args.sa) & 0xffffffff;
}


// 0b000000 ~ SPECIAL(R) : 0b011000 ~ MULT
INSTR_EXEC[0b000000][0b011000] = function(args,pc,regs,mem){
    var v = regs[args.rs] * regs[args.rt];
    regs.LO = v & 0xffffffff;
    regs.HI = ~~(v / 4294967296);
    console.log("MULT (HI("+regs.HI+"),LO("+regs.LO+")) = $",getRegName(args.rs),"("+regs[args.rs]+") * $",getRegName(args.rt),"("+regs[args.rt]+")")
}

// 0b000000 ~ SPECIAL(R) : 0b011000 ~ MFHI
INSTR_EXEC[0b000000][0b010000] = function(args,pc,regs,mem){
    regs[args.rd] = regs.HI;
}

// 0b000000 ~ SPECIAL(R) : 0b011000 ~ MFLO
INSTR_EXEC[0b000000][0b010010] = function(args,pc,regs,mem){
    regs[args.rd] = regs.LO;
}

// 0b000000 ~ SPECIAL(R) : 0b011000 ~ MTHI
INSTR_EXEC[0b000000][0b010001] = function(args,pc,regs,mem){
    regs.HI = regs[args.rs];
}

// 0b000000 ~ SPECIAL(R) : 0b011000 ~ MTLO
INSTR_EXEC[0b000000][0b010011] = function(args,pc,regs,mem){
    regs.LO = regs[args.rs];
}


// 0b000000 ~ SPECIAL(R) : 0b101010 ~ SLT
INSTR_EXEC[0b000000][0b101010] = function(args,pc,regs,mem){
    console.log("SLT "+regs[args.rs]+"<"+regs[args.rt]+"?$"+getRegName(args.rd)+"="+(regs[args.rs] < regs[args.rt]?1:0));
    if(regs[args.rs] < regs[args.rt]){
        regs[args.rd] = 1;
    }else{
        regs[args.rd] = 0;
    }
}

// 0b000000 ~ SPECIAL(R) : 0b101011 ~ SLTU
INSTR_EXEC[0b000000][0b101011] = function(args,pc,regs,mem){
    console.log("SLTU "+(regs[args.rs]>>>0)+"<"+(regs[args.rt]>>>0)+"?$"+getRegName(args.rd)+"="+((regs[args.rs]>>>0) < (regs[args.rt]>>>0)?1:0));
    if((regs[args.rs]>>>0) < (regs[args.rt]>>>0)){
        regs[args.rd] = 1;
    }else{
        regs[args.rd] = 0;
    }
}

// 0b001010 ~ SLTI
INSTR_EXEC[0b001010] = function(args,pc,regs,mem){
    args.imm = (args.imm>>15)?-(Math.pow(2,16)-args.imm):args.imm;
    console.log("SLTI "+regs[args.rs]+"<"+args.imm+"?$"+getRegName(args.rd)+"="+(regs[args.rs] < args.imm?1:0));
    if((regs[args.rs]) < (args.imm)){
        regs[args.rd] = 1;
    }else{
        regs[args.rd] = 0;
    }
}

// 0b001011 ~ SLTIU
INSTR_EXEC[0b001011] = function(args,pc,regs,mem){
    var unsgrs = regs[args.rs]
    var unsgimm = (args.imm>>15)?-(Math.pow(2,16)-args.imm):args.imm;
    if(unsgrs < 0)
        unsgrs = unsgrs + 0xffffffff + 1;
    if(unsgimm < 0)
        unsgimm = unsgimm + 0xffffffff + 1;

    console.log("SLTIU "+(unsgrs)+"<"+(unsgimm)+"?$"+getRegName(args.rd)+"="+(unsgrs < unsgimm?1:0));
    if(unsgrs < unsgimm){
        regs[args.rd] = 1;
    }else{
        regs[args.rd] = 0;
    }
}


// 0b001000 ~ ADDI
INSTR_EXEC[0b001000] = function(args,pc,regs,mem){
    args.imm = (args.imm>>15)?-(Math.pow(2,16)-args.imm):args.imm;
    regs[args.rs] = regs[args.rt] + args.imm;
    if(debug) console.log("ADDI $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+regs[args.rt]+") + ",args.imm);
}

// 0b001001 ~ ADDIU
INSTR_EXEC[0b001001] = function(args,pc,regs,mem){
    regs[args.rs] = regs[args.rt] + args.imm;
    if(debug) console.log("ADDIU $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+regs[args.rt]+") + ",args.imm);
}

// 0b001111 ~ ORI
INSTR_EXEC[0b001101] = function(args,pc,regs,mem){
    regs[args.rs] = regs[args.rt] | args.imm;
    if(debug) console.log("ORI $",getRegName(args.rs),"("+regs[args.rs]+") = $",getRegName(args.rt),"("+regs[args.rt]+") | ",args.imm);
}

// 0b001111 ~ LUI
INSTR_EXEC[0b001111] = function(args,pc,regs,mem){
    var d = args.imm<<16>>>0;
    d = (d>>31)?-(Math.pow(2,32)-d):d; 
    regs[args.rt] = d;
    if(debug) console.log("LUI $",getRegName(args.rt),"("+regs[args.rt]+") = ",args.imm,"<< 16 (",d,")");
}
/*********** MEM START ***********/

// 0b100011 ~ LW
INSTR_EXEC[0b100011] = function(args,pc,regs,mem){
    var a = args.offset + regs[args.rs]
    a = (a>>15)==1?-(Math.pow(2,16)-a):a;
    var d = ((mem[a]&0xff)<<24) + ((mem[a+1]&0xff)<<16) + ((mem[a+2]&0xff)<<8) + ((mem[a+3]&0xff)) 
    d = (d>>31)==1?-(Math.pow(2,32)-d):d;
    regs[args.rt] = d;
    if(debug) console.log("$",getRegName(args.rt)," <- MEM["+(args.offset + regs[args.rs])+"] (0x"+(d>>>0).toString(16)+")")
}

// 0b100001 ~ LH
INSTR_EXEC[0b100001] = function(args,pc,regs,mem){
    var a = args.offset + regs[args.rs]
    a = (a>>15)==1?-(Math.pow(2,16)-a):a;
    var d = ((mem[a]&0xff)<<8) + ((mem[a+1]&0xff)) 
    d = (d>>15)==1?(0xffff0000|d):d;
    regs[args.rt] = d;
    if(debug) console.log("$",getRegName(args.rt)," <- MEM["+(args.offset + regs[args.rs])+"] (0x"+(d>>>0).toString(16)+")")
}

// 0b100101 ~ LHU
INSTR_EXEC[0b100101] = function(args,pc,regs,mem){
    var a = args.offset + regs[args.rs]
    a = (a>>15)==1?-(Math.pow(2,16)-a):a;
    var d = ((mem[a]&0xff)<<8) + ((mem[a+1]&0xff));
    regs[args.rt] = d;
    if(debug) console.log("$",getRegName(args.rt)," <- MEM["+(args.offset + regs[args.rs])+"] (0x"+(d>>>0).toString(16)+")")
}

// 0b100000 ~ LB
INSTR_EXEC[0b100000] = function(args,pc,regs,mem){
    var a = args.offset + regs[args.rs]
    a = (a>>15)==1?-(Math.pow(2,16)-a):a;
    var d = ((mem[a]&0xff))

    d = (d>>7)==1?(0xffffff00|d):d;
    regs[args.rt] = d;
    if(debug) console.log("$",getRegName(args.rt)," <- MEM["+(args.offset + regs[args.rs])+"] (0x"+(d).toString(16)+")")
}

// 0b100100 ~ LBU
INSTR_EXEC[0b100100] = function(args,pc,regs,mem){
    var a = args.offset + regs[args.rs]
    a = (a>>15)==1?-(Math.pow(2,16)-a):a;
    var d = ((mem[a]&0xff))
    regs[args.rt] = d;
    if(debug) console.log("$",getRegName(args.rt)," <- MEM["+(args.offset + regs[args.rs])+"] (0x"+(d>>>0).toString(16)+")")
}


// 0b101011 ~ SW
INSTR_EXEC[0b101011] = function(args,pc,regs,mem){
    var a = args.offset + regs[args.rs]
    a = (a>>15)==1?-(Math.pow(2,16)-a):a;
    var d = regs[args.rt]
    d = (d>>31)==1?-(Math.pow(2,32)-d):d;
    mem[a] = (d>>24) & 0xff;
    mem[a+1] = (d>>16) & 0xff;
    mem[a+2] = (d>>8) & 0xff;
    mem[a+3] = (d) & 0xff;
    if(debug) console.log("$",getRegName(args.rt)," -> MEM["+(args.offset + regs[args.rs])+"] (0x"+(d>>>0).toString(16)+")")
}

// 0b101001 ~ SH
INSTR_EXEC[0b101001] = function(args,pc,regs,mem){
    var a = args.offset + regs[args.rs]
    a = (a>>15)==1?-(Math.pow(2,16)-a):a;
    var d = regs[args.rt]
    d = (d>>15)==1?-(Math.pow(2,32)-d):d;
    mem[a] = (d>>8) & 0xff;
    mem[a+1] = (d) & 0xff;
    if(debug) console.log("$",getRegName(args.rt)," -> MEM["+(args.offset + regs[args.rs])+"] (0x"+(d>>>0).toString(16)+")")
}

// 0b101000 ~ SB
INSTR_EXEC[0b101000] = function(args,pc,regs,mem){
    var a = args.offset + regs[args.rs]
    a = (a>>15)==1?-(Math.pow(2,16)-a):a;
    var d = regs[args.rt]
    d = (d>>7)==1?-(Math.pow(2,32)-d):d;
    mem[a] = (d) & 0xff;
    if(debug) console.log("$",getRegName(args.rt)," -> MEM["+(args.offset + regs[args.rs])+"] (0x"+(d>>>0).toString(16)+")")
}

/********** BRANCH START **********/



// 0b000000 ~ SPECIAL(R) : 0b001000 ~ JR
INSTR_EXEC[0b000000][0b001000] = function(args,pc,regs,mem){
    pc.p = (regs[args.ra])-4;
}

// 0b000000 ~ SPECIAL(R) : 0b001001 ~ JALR
INSTR_EXEC[0b000000][0b001001] = function(args,pc,regs,mem){
    var t = pc.p;
    pc.p = (regs[args.ra])-4;
    regs[getReg("ra")] = t+4;
}

// 0b000010 ~ J
INSTR_EXEC[0b000010] = function(args,pc,regs,mem){
    pc.p = (args.ra<<2)-4;
}
// 0b000011 ~ JAL
INSTR_EXEC[0b000011] = function(args,pc,regs,mem){
    var t = pc.p;
    pc.p = (args.ra<<2)-4;
    regs[getReg("ra")] = t+4;
}

// 0b000100 ~ BEQ
INSTR_EXEC[0b000100] = function(args,pc,regs,mem){
    console.log("BEQ : "+regs[args.rs]+"=="+regs[args.rt]+"?"+(regs[args.rs] == regs[args.rt])+" GOTO +0x"+(args.offset<<2))
    if(regs[args.rs] == regs[args.rt]){
        pc.p += (args.offset<<2);
    }
}
// 0b000101 ~ BNE
INSTR_EXEC[0b000101] = function(args,pc,regs,mem){
    console.log("BNE : "+regs[args.rs]+"!="+regs[args.rt]+"?"+(regs[args.rs] == regs[args.rt])+" GOTO +0x"+(args.offset<<2))
    if(regs[args.rs] != regs[args.rt]){
        pc.p += (args.offset<<2);
    }
}
// 0b000110 ~ BLEZ
INSTR_EXEC[0b000110] = function(args,pc,regs,mem){
    if(regs[args.rs] <= 0){
        pc.p += (args.offset<<2);
    }
}
// 0b000111 ~ BGTZ
INSTR_EXEC[0b000111] = function(args,pc,regs,mem){
    if(regs[args.rs] > 0){
        pc.p += (args.offset<<2);
    }
}

//SPECIAL BRANCHES
// 0b000001 ~ BRANCH(I) : 0b00001 ~ BGEZ
INSTR_EXEC[0b000001][0b00001] = function(args,pc,regs,mem){
    if(regs[args.rs] >= 0){
        pc.p += (args.offset<<2);
    }
}
// 0b000001 ~ BRANCH(I) : 0b00001 ~ BGEZAL
INSTR_EXEC[0b000001][0b10001] = function(args,pc,regs,mem){
    if(regs[args.rs] >= 0){
        var t = pc.p;
        pc.p += (args.offset<<2);
        regs[getReg("ra")] = t+4;
    }
}
// 0b000001 ~ BRANCH(I) : 0b00001 ~ BLTZ
INSTR_EXEC[0b000001][0b00000] = function(args,pc,regs,mem){
    if(regs[args.rs] < 0){
        pc.p += (args.offset<<2);
    }
}
// 0b000001 ~ BRANCH(I) : 0b00001 ~ BLTZAL
INSTR_EXEC[0b000001][0b10000] = function(args,pc,regs,mem){
    if(regs[args.rs] < 0){
        var t = pc.p;
        pc.p += (args.offset<<2);
        regs[getReg("ra")] = t+4;
    }
}