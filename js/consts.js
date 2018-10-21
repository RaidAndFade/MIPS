// [[name, type(R,I,J), opcode*, vararr, varorder],...]
// *IF TYPE = R , opcode is [opcode,func]
// vararr (binary representation of vars) : [[name,bitlen,isreg=true,required=true,forceval=undefined],...]
//    required = is this variable required in ASM
//    forceval = Is this value a forced value, if so what is the value
// varorder (array vararr.length-1) 
// varorder[x] defines the position of variable vararr[x] according to its order in asm args

//i use 0 and 1 instead of false and true because im too lazy to type out the characters... :)
const INSTRS = {
//BRANCH
    "SYSCALL": ["SYSCALL"   , 'R', [0b000000, 0b001100],[]],

    "BEQ"    : ["BR =="     ,'I', 0b000100, [["rs",5],["rt",5],["offset",16,0]]],
    "BNE"    : ["BR !="     ,'I', 0b000101, [["rs",5],["rt",5],["offset",16,0]]],
    "BLEZ"   : ["BR <= 0"   ,'I', 0b000110, [["rs",5],["0",5,0,0,0],["offset",16,0]]],
    "BGTZ"   : ["BR > 0"    ,'I', 0b000111, [["rs",5],["0",5,0,0,0],["offset",16,0]]],

    // branch - these have the opcode in "o" var (this is done in compile and exec individually)
    "BLTZ"   : ["BR < 0"    ,'I', 0b000001, [["rs",5],["o",5,0,0,0b00000],["offset",16,0]]],
    "BLTZAL" : ["BRAL < 0"  ,'I', 0b000001, [["rs",5],["o",5,0,0,0b10000],["offset",16,0]]],
    "BGEZ"   : ["BR >= 0"   ,'I', 0b000001, [["rs",5],["o",5,0,0,0b00001],["offset",16,0]]],
    "BGEZAL" : ["BRAL >= 0" ,'I', 0b000001, [["rs",5],["o",5,0,0,0b10001],["offset",16,0]]],

    "J"      : ["JUMP "             ,'J' ,0b000010, [["ra",26,0]]],
    "JAL"    : ["JUMP AND LOAD"     ,'J' ,0b000011, [["ra",26,0]]],
    "JR"     : ["JUMP REG"          ,'R' ,[0b000000, 0b001000], [["ra",5]]],  
    "JALR"   : ["JUMP REG AND LOAD" ,'R' ,[0b000000, 0b001001], [["rd",5,1,0,-1],["ra",5]]],
//MEMORY
    "LB"     : ["LOAD BYTE"          ,'I' ,0b100000 ,[["rs",5,1,0],["rt",5],["offset",16,0]]],
    "LBU"    : ["LOAD BYTE UNSG"     ,'I' ,0b100100 ,[["rs",5,1,0],["rt",5],["offset",16,0]]],
    "LH"     : ["LOAD HALFWORD"      ,'I' ,0b100001 ,[["rs",5,1,0],["rt",5],["offset",16,0]]],
    "LHU"    : ["LOAD HALFWORD UNSG" ,'I' ,0b100101 ,[["rs",5,1,0],["rt",5],["offset",16,0]]],
    "LW"     : ["LOAD WORD"          ,'I' ,0b100011 ,[["rs",5,1,0],["rt",5],["offset",16,0]]],

    "SB"     : ["STORE BYTE"     ,'I' ,0b101000 ,[["rs",5,1,0],["rt",5],["offset",16,0]]],
    "SH"     : ["STORE HALFWORD" ,'I' ,0b101001 ,[["rs",5,1,0],["rt",5],["offset",16,0]]],
    "SW"     : ["STORE WORD"     ,'I' ,0b101011 ,[["rs",5,1,0],["rt",5],["offset",16,0]]],

//ALU
    "ADD"    : ["ADD"           ,'R' , [0b000000, 0b100000], [["rs",5],["rt",5],["rd",5]]],
    "ADDU"   : ["ADD UNSG"      ,'R' , [0b000000, 0b100001], [["rs",5],["rt",5],["rd",5]]],
    "ADDI"   : ["ADD IMM"       ,'I' , 0b001000,             [["rs",5],["rt",5],["imm",16,0]]],
    "ADDIU"  : ["ADD IMM UNSG"  ,'I' , 0b001001,             [["rs",5],["rt",5],["imm",16,0]]],
    "SUB"    : ["SUBTRACT"      ,'R' , [0b000000, 0b100010], [["rs",5],["rt",5],["rd",5]]],
    "SUBU"   : ["SUBTRACT UNSG" ,'R' , [0b000000, 0b100011], [["rs",5],["rt",5],["rd",5]]],
    "AND"    : ["AND"           ,'R' , [0b000000, 0b100100], [["rs",5],["rt",5],["rd",5]]],
    "ANDI"   : ["AND IMM"       ,'I' , 0b001100,             [["rs",5],["rt",5],["imm",16,0]]],
    "OR"     : ["OR"            ,'R' , [0b000000, 0b100101], [["rs",5],["rt",5],["rd",5]]],
    "ORI"    : ["OR IMM"        ,'I' , 0b001101,             [["rs",5],["rt",5],["imm",16,0]]],
    "XOR"    : ["AND"           ,'R' , [0b000000, 0b100110], [["rs",5],["rt",5],["rd",5]]],
    "XORI"   : ["AND IMM"       ,'I' , 0b001110,             [["rs",5],["rt",5],["imm",16,0]]],
    "LUI"    : ["LD UP IMM"     ,'I' , 0b001111,             [["0",5,0,0,0],["rt",5],["imm",16,0]]],

    //these... headaches.
    "SLT"    : ["SET IF <"         ,'R' , [0b000000, 0b101010], [["rs",5],["rt",5],["rd",5],["0",5,0,0,0]], [1,2,0,3]],
    "SLTU"   : ["SET IF UNSG <"    ,'R' , [0b000000, 0b101011], [["rs",5],["rt",5],["rd",5],["0",5,0,0,0]], [1,2,0,3]],
    "SLTI"   : ["SET IMM IF <"     ,'I' , 0b001010, [["rs",5],["rd",5],["imm",16]], [1,0,2]],
    "SLTIU"  : ["SET IMM IF UNSG <",'I' , 0b001011, [["rs",5],["rd",5],["imm",16]], [1,0,2]],

//MUL DIV

    "MULT"   : ["MULTIPLY"      ,'R' , [0b000000, 0b011000], [["rs",5],["rt",5]]],
    "MFHI"   : ["MV FROM HI"    ,'R' , [0b000000, 0b010000], [["rd",5]]],
    "MTHI"   : ["MV TO HI"      ,'R' , [0b000000, 0b010001], [["rs",5]]],
    "MFLO"   : ["MV FROM LO"    ,'R' , [0b000000, 0b010010], [["rd",5]]],
    "MTLO"   : ["MV TO LO"      ,'R' , [0b000000, 0b010011], [["rs",5]]],

//SHIFTER
    "SLL"    : ["SHIFT LFT LGC"      ,'R' , [0b000000, 0b000000], [["0",5,0,0,0],["rt",5],["rd",5],["sa",5]]],
    "SLLV"   : ["SHIFT LFT LGC VAR"  ,'R' , [0b000000, 0b000100], [["rd",5],["rt",5],["rd",5]]],
    "SRL"    : ["SHIFT RGT LGC"      ,'R' , [0b000000, 0b000011], [["0",5,0,0,0],["rt",5],["rd",5],["sa",5]]],
    "SRLV"   : ["SHIFT RGT LGC VAR"  ,'R' , [0b000000, 0b000111], [["rd",5],["rt",5],["rd",5]]],
    "SRA"    : ["SHIFT RGT ARTH"     ,'R' , [0b000000, 0b000010], [["0",5,0,0,0],["rt",5],["rd",5],["sa",5]]],
    "SRAV"   : ["SHIFT RGT ARTH VAR" ,'R' , [0b000000, 0b000110], [["rd",5],["rt",5],["rd",5]]],
}

const PSEUDOINSTRS = {}
PSEUDOINSTRS["LI"] = function(instr){
    var args = explodeStr(instr," ",2)[1].split(",").map(function(v){return v.trim().split(" ",1)[0]});
    var rt = args[0];
    var c = new Number(args[1]);
    if(isNaN(c)){
        throw "PSEUDOINSTR EXPANSION FAILED: IMM VALUE IS NaN"
    }
    var clo = c&0xffff;
    var chi = (c>>16)&0xffff;
    if(chi==0){
        return ["ADDIU "+rt+", $zero, "+clo];
    }else{
        return [
            "LUI $AT,"+chi,
            "ORI "+rt+",$AT,"+clo
        ]
    }
}
PSEUDOINSTRS["LA"] = function(instr){
    var args = explodeStr(instr," ",2)[1].split(",").map(function(v){return v.trim().split(" ",1)[0]});
    var rt = args[0];
    var c = args[1];

    return [ 
        "LUI $AT,{"+c+":h}",
        "ORI "+rt+",$AT,{"+c+":l}"
    ]
}

//[ids, canWrite?, canRead?]
// canwrite is optional (true by default)
// canread is optional (true by default)
// ids: ["idstr1","idstr2",etc]
const REGISTERS = [
    [["ZERO","0"],false],   //reg 0, constant 0
    [["AT"]],           //reg 1, assembler temp
    [["V0"]],           //reg 2, function return value 0
    [["V1"]],           //reg 3, function return value 1
    [["A0"]],           //reg 4, function argument 0
    [["A1"]],           //reg 5, function argument 1
    [["A2"]],           //reg 6, function argument 2
    [["A3"]],           //reg 7, function argument 3
    [["T0"]],           //reg 8, temporary (no carry thru funcs)
    [["T1"]],           //reg 9, temporary (no carry thru funcs)
    [["T2"]],           //reg 10, temporary (no carry thru funcs)
    [["T3"]],           //reg 11, temporary (no carry thru funcs)
    [["T4"]],           //reg 12, temporary (no carry thru funcs)
    [["T5"]],           //reg 13, temporary (no carry thru funcs)
    [["T6"]],           //reg 14, temporary (no carry thru funcs)
    [["T7"]],           //reg 15, temporary (no carry thru funcs)
    [["S0"]],           //reg 16, temporary (carry thru funcs)
    [["S1"]],           //reg 17, temporary (carry thru funcs)
    [["S2"]],           //reg 18, temporary (carry thru funcs)
    [["S3"]],           //reg 19, temporary (carry thru funcs)
    [["S4"]],           //reg 20, temporary (carry thru funcs)
    [["S5"]],           //reg 21, temporary (carry thru funcs)
    [["S6"]],           //reg 22, temporary (carry thru funcs)
    [["S7"]],           //reg 23, temporary (carry thru funcs)
    [["T8"]],           //reg 24, temporary (no carry thru funcs)
    [["T9"]],           //reg 25, temporary (no carry thru funcs)
    [["K0"]],           //reg 26, kernel reg 0
    [["K1"]],           //reg 27, kernel reg 1
    [["GP"]],           //reg 28, Global Pointer
    [["SP"]],           //reg 29, Stack Pointer
    [["S8","FP"]],           //reg 30, temporary (carry thru funcs)
    [["RA"]],           //reg 31, Return Pointer
]

const OPCODE_LOOKUP_TABLE = {};

//returns the id of the opcode, or null if it's an "R" opcode
function lookupOpcode(opcode){
    if(OPCODE_LOOKUP_TABLE.hasOwnProperty(opcode)) return OPCODE_LOOKUP_TABLE[opcode];
    
    for(var instid in INSTRS){
        var instr = INSTRS[instid];
        if(instr[1] == "R"){
            OPCODE_LOOKUP_TABLE[instr[2][0]] = null;
            if(instr[2][0] == opcode){
                return null;
            }
        }else{
            OPCODE_LOOKUP_TABLE[instr[2]] = instid;
            if(instr[2] == opcode){
                return instid;
            }
        }
    }
    throw "Lookup for opcode 0x"+(opcode>>>0).toString(16)+" failed, no such opcode exists";
}

const FUNCTION_LOOKUP_TABLE = {};
function lookupFunction(opcode,funccode){
    if(FUNCTION_LOOKUP_TABLE.hasOwnProperty(opcode+"|"+funccode))return FUNCTION_LOOKUP_TABLE[opcode+"|"+funccode];

    for(var instid in INSTRS){
        var instr = INSTRS[instid];
        if(instr[1] == "R"){
            FUNCTION_LOOKUP_TABLE[opcode+"|"+instr[2][1]] = instid;
            if(instr[2][0] == opcode && instr[2][1] == funccode){
                return instid;
            }
        }else{
            if(instr[2] == opcode){
                throw "Looking for function 0x" + funccode + " on opcode 0x" + opcode + " but opcode is R type.";
            }
        }
    }
    throw "Lookup for opcode 0x"+(opcode>>>0).toString(16) + " function 0x" + (funccode>>>0).toString(16)+" failed, no such combination exists";
}

//yes this is me rn 4am boys lets fucking go
function getReg(regAddr){ return getRegNum(regAddr); }
function getRegNum(regName){
    var n = Number(regName);
    if(!isNaN(n)){
        return n;
    }

    if(regName[0] == "$") regName = regName.substr(1);

    if(regName[0] == "R"){
        var reg = parseInt(regName.substr(1));
        if(reg<0||reg>31) throw "INVALID REGISTER R"+reg;

        return reg;
    }

    for(var reg in REGISTERS){
        var rnames = REGISTERS[reg][0];
        if(rnames.includes(regName.toUpperCase())){
            return reg;
        }
    }

    throw "INVALID REGISTER "+regName;
}

function getRegName(id){
    return REGISTERS[id][0][0];
}