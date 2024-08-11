  const ft8_examples = [
    { notest: true, name: "input example: <free text>", comment: 'To make sure your message is sent as free text, write it between < and >. Free text will be uppercased and truncated to 13 characters. Valid characters are 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./? and space.', value: "<YOUR MSG HERE>" },
    { notest: true, name: "input example: telemetry data", comment: 'To sent a message as the telemetry data type, or enter T: followed by 1 to 18 hex digits. Telemetry data is 71-bits.', value: "Telemetry: A858DE45 F56D9BC9" },
    { notest: true, name: 'input example: telemetry data (exactly 18 digits)', comment: 'Another way to enter telemetry message. Use exactly 18 hexadecimal digits. The first digit must be between 0 and 7.', value: "1005e1eafcafec0ffe" },
    { notest: true, name: "input example: packed hex", comment: 'Format used by FT8_lib. Exactly 10 hexadecimal digits containing your 77-bit payload (zero-padded on the end, not the start). Input may contain spaces or dashes between the bytes. This format is found in the output of gen_ft8, a command line tool which comes as source code in FT8_lib', value: '5f a5 ec 39 30 6f aa c3 d6 00' },
    { notest: true, name: 'test pattern: siren', comment: 'Not a valid FT8 message.', value: '0707070 70707070707070707070707070707 0707070 70707070707070707070707070707 0707070' },
    { notest: true, name: 'test pattern: chirp', comment: 'Not a valid FT8 message.', value: '2345670 12345670123456701234567012345 6701234 56701234567012345670123456701 2345670' },
    { notest: true, name: 'test pattern: coincidental costas', comment: 'A technically valid FT8 message.', value: '8M6TVW/R R3NFJ/R DN12' },
    { notest: true, name: "error example: one bit flipped", comment: 'This message contains a single bit error.', value: "01101110111011001100001110100110100001110001110011001110110010101100101000000 00101000101001 11011001110010010010001100011001011000001110110010001010011110110001000011110111001" },
    { notest: true, name: 'error example: mutliple RX errors demo', value: '3140652 00306403035757676071360401511 3140652 01713355253025012537125536152 3140652'},
    { notest: true, name: "error example: wrong sync symbols", comment: 'Example of a message containing errors in the sync symbols.', value: "5550001 00000000011541472111206301447 5550001 52112705440021501172302627711 5550001" },
    { notest: true, name: 'error example: telemetry too long (bad input)', value: 'Telemetry: F20F1044242408F20F' },
  ]
  
// ft8code.exe
const testInputs_ft8code = [
    {
      "message": "<TNX BOB 73 GL>",
      "decoded": "TNX BOB 73 GL",
      "type": "0.0",
      "symbols": "3140652 20744714706333640177350001770 3140652 64642730654607244050367013053 3140652"
    },
    {
      "message": "TNX BOB 73 GL",
      "type": "0.0",
      "symbols": "3140652 20744714706333640177350001770 3140652 64642730654607244050367013053 3140652"
    },
    {
      "message": "K1ABC RR73; W9XYZ <KH1/KH7Z> -08",
      "type": "0.1",
      "symbols": "3140652 03224752351513326402113431715 3140652 02740707273004136231012725466 3140652"
    },
    {
      "message": "PA9XYZ 590003 IO91NP",
      "type": "0.0",
      "symbols": "3140652 36257267322002374467244500537 3140652 01042071121564667014036461075 3140652",
      "error": true,
      "decoded": "PA9XYZ 590003"
    },
    {
      "message": "G4ABC/P R 570007 JO22DB",
      "type": "0.0",
      "symbols": "3140652 16770637516504600143773300336 3140652 22074530464727123431431003167 3140652",
      "error": true,
      "decoded": "G4ABC/P R 570"
    },
    {
      "message": "K1ABC W9XYZ 6A WI",
      "type": "0.3",
      "symbols": "3140652 03224752351513326403532040530 3140652 10102016670002655450507772062 3140652"
    },
    {
      "message": "W9XYZ K1ABC R 17B EMA",
      "type": "0.4",
      "symbols": "3140652 02035572501167241620053701303 3140652 33067700140344412531772156322 3140652"
    },
    {
      "message": "123456789ABCDEF012",
      "type": "0.5",
      "symbols": "3140652 11045365753236716724005630431 3140652 62063315364670325657643764734 3140652"
    },
    {
      "message": "CQ K1ABC FN42",
      "type": "1.",
      "symbols": "3140652 00000000100547670460602153343 3140652 73601104751700733474545513354 3140652"
    },
    {
      "message": "K1ABC W9XYZ EN37",
      "type": "1.",
      "symbols": "3140652 03224752350406114700513432537 3140652 46455756156477030037617546223 3140652"
    },
    {
      "message": "W9XYZ K1ABC -11",
      "type": "1.",
      "symbols": "3140652 02035572500547670461746302406 3140652 53631651575170007704437750721 3140652"
    },
    {
      "message": "K1ABC W9XYZ R-09",
      "type": "1.",
      "symbols": "3140652 03224752350406114702746352703 3140652 32340613021374326763445304061 3140652"
    },
    {
      "message": "W9XYZ K1ABC RRR",
      "type": "1.",
      "symbols": "3140652 02035572500547670461745553031 3140652 56430553516111752452312775327 3140652"
    },
    {
      "message": "K1ABC W9XYZ 73",
      "type": "1.",
      "symbols": "3140652 03224752350406114701745602375 3140652 17607411336153312604471562627 3140652"
    },
    {
      "message": "K1ABC W9XYZ RR73",
      "type": "1.",
      "symbols": "3140652 03224752350406114701742633261 3140652 07130116160034651115122642402 3140652"
    },
    {
      "message": "CQ FD K1ABC FN42",
      "type": "1.",
      "symbols": "3140652 00000111050547670460602153374 3140652 55174470534654011726436723642 3140652"
    },
    {
      "message": "CQ TEST K1ABC/R FN42",
      "type": "1.",
      "symbols": "3140652 00040627550547670465602152224 3140652 71213145507156124364617773774 3140652"
    },
    {
      "message": "K1ABC/R W9XYZ EN37",
      "type": "1.",
      "symbols": "3140652 03224752340406114700513433215 3140652 62370751224150151376024752710 3140652"
    },
    {
      "message": "W9XYZ K1ABC/R R FN42",
      "type": "1.",
      "symbols": "3140652 02035572500547670464602153406 3140652 44723332345776463750651236762 3140652"
    },
    {
      "message": "K1ABC/R W9XYZ RR73",
      "type": "1.",
      "symbols": "3140652 03224752340406114701742632543 3140652 21615111232711530254513456331 3140652"
    },
    {
      "message": "CQ TEST K1ABC FN42",
      "type": "1.",
      "symbols": "3140652 00040627550547670460602152013 3140652 21250156061177140165223103534 3140652"
    },
    {
      "message": "W9XYZ <PJ4/K1ABC> -11",
      "type": "1.",
      "symbols": "3140652 02035572500163365131746302533 3140652 72170230536772674157704703716 3140652"
    },
    {
      "message": "<PJ4/K1ABC> W9XYZ R-09",
      "type": "1.",
      "symbols": "3140652 00461340600406114702746352340 3140652 70026642670307536111017334622 3140652"
    },
    {
      "message": "CQ W9XYZ EN37",
      "type": "1.",
      "symbols": "3140652 00000000100406114700513432702 3140652 52747657056166064010134615661 3140652"
    },
    {
      "message": "<YW18FIFA> W9XYZ -11",
      "type": "1.",
      "symbols": "3140652 00623063400406114701746302517 3140652 30150124063350453045610770170 3140652"
    },
    {
      "message": "W9XYZ <YW18FIFA> R-09",
      "type": "1.",
      "symbols": "3140652 02035572500134513652746353567 3140652 66624306126013657212127134512 3140652"
    },
    {
      "message": "<YW18FIFA> KA1ABC",
      "type": "1.",
      "symbols": "3140652 00623063411370435511745532507 3140652 11234620355321153427122035255 3140652"
    },
    {
      "message": "KA1ABC <YW18FIFA> -11",
      "type": "1.",
      "symbols": "3140652 56252133050134513651746303556 3140652 74533650035271066027111247354 3140652"
    },
    {
      "message": "<YW18FIFA> KA1ABC R-17",
      "type": "1.",
      "symbols": "3140652 00623063411370435512746053034 3140652 74604310174542156350005646506 3140652"
    },
    {
      "message": "<YW18FIFA> KA1ABC 73",
      "type": "1.",
      "symbols": "3140652 00623063411370435511745602026 3140652 67366214515344515710231352751 3140652"
    },
    {
      "message": "CQ G4ABC/P IO91",
      "type": "2.",
      "symbols": "3140652 00000000100551506545740545627 3140652 31175355577321326610325460211 3140652"
    },
    {
      "message": "G4ABC/P PA9XYZ JO22",
      "type": "2.",
      "symbols": "3140652 03304034222247341351054655667 3140652 12536520441247353333124433552 3140652"
    },
    {
      "message": "PA9XYZ G4ABC/P RR73",
      "type": "2.",
      "symbols": "3140652 66726206300551506546742636670 3140652 15517475057750450200643367234 3140652"
    },
    {
      "message": "K1ABC W9XYZ 579 WI",
      "type": "3.",
      "symbols": "3140652 01167241630406114703772534752 3140652 30651246340340407163645351036 3140652"
    },
    {
      "message": "W9XYZ K1ABC R 589 MA",
      "type": "3.",
      "symbols": "3140652 01513326400547670467273637070 3140652 55623141267017142221066633172 3140652"
    },
    {
      "message": "K1ABC KA0DEF 559 MO",
      "type": "3.",
      "symbols": "3140652 01167241621370305261773434421 3140652 53073311535771475412613547162 3140652"
    },
    {
      "message": "TU; KA0DEF K1ABC R 569 MA",
      "type": "3.",
      "symbols": "3140652 43640510730547670464273634510 3140652 33075230717267321153244675425 3140652"
    },
    {
      "message": "KA1ABC G3AAA 529 0013",
      "type": "3.",
      "symbols": "3140652 33641561030550731540000234316 3140652 70274723435676575424462342006 3140652"
    },
    {
      "message": "TU; G3AAA K1ABC R 559 MA",
      "type": "3.",
      "symbols": "3140652 51101452150547670466773637467 3140652 14744315730123530774210116161 3140652"
    },
    {
      "message": "CQ KH1/KH7Z",
      "type": "4.",
      "symbols": "3140652 15540000031701604265033021440 3140652 24633254146442554247330021155 3140652"
    },
    {
      "message": "CQ PJ4/K1ABC",
      "type": "4.",
      "symbols": "3140652 36620001607315314363000521041 3140652 66141674641464745632374427542 3140652"
    },
    {
      "message": "PJ4/K1ABC <W9XYZ>",
      "type": "4.",
      "symbols": "3140652 75410001607315314363000410440 3140652 26077017614526132255145210301 3140652"
    },
    {
      "message": "<W9XYZ> PJ4/K1ABC RRR",
      "type": "4.",
      "symbols": "3140652 75410001607315314363000561406 3140652 36120666006707717126111740701 3140652"
    },
    {
      "message": "PJ4/K1ABC <W9XYZ> 73",
      "type": "4.",
      "symbols": "3140652 75410001607315314363000761140 3140652 31017216621763234100217441572 3140652"
    },
    {
      "message": "<W9XYZ> YW18FIFA",
      "type": "4.",
      "symbols": "3140652 75410000026470717462032511444 3140652 12630524656764232273327446164 3140652"
    },
    {
      "message": "YW18FIFA <W9XYZ> RRR",
      "type": "4.",
      "symbols": "3140652 75410000026470717462032460402 3140652 02547175064545617102353316564 3140652"
    },
    {
      "message": "<W9XYZ> YW18FIFA 73",
      "type": "4.",
      "symbols": "3140652 75410000026470717462032660144 3140652 07650725643521134124055215735 3140652"
    },
    {
      "message": "CQ YW18FIFA",
      "type": "4.",
      "symbols": "3140652 12410000026470717462032520503 3140652 43235636455104172263345306357 3140652"
    },
    {
      "message": "<KA1ABC> YW18FIFA RR73",
      "type": "4.",
      "symbols": "3140652 12320000026470717462032610755 3140652 73041016005003413426660204571 3140652"
    }
  ];
