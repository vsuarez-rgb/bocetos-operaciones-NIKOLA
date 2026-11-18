/* Pruebas de la calculadora de fórmulas (js/ficha/formulas.js): las reglas de Excel que importan
   para Campos Autocad. node scripts/probar-formulas.mjs */
import { leerFormula, evaluar, esErr } from '../js/ficha/formulas.js';

const hoja = { A1: 5, A2: null, A3: 'texto', A4: 0, A5: 3, B1: 'SUN2000-8K-LC0', B2: 'SUN2000-10K-LC0', C1: 40, C2: 63, D1: 10, D2: 20, D3: 30, E1: 'EMT', E2: 'Flex. Met.' };
const col = c => String.fromCharCode(64 + c);
const leer = (h, c, r) => hoja[`${col(c)}${r}`] ?? null;
const calc = (f, op = {}) => { const v = evaluar(leerFormula(f), { hoja: 'H', leer, opciones: op }); return esErr(v) ? v.codigo : v; };
let ok = 0, mal = 0;
const es = (f, esperado, op) => { const v = calc(f, op); if (JSON.stringify(v) === JSON.stringify(esperado)) ok++; else { mal++; console.error(`✗ =${f} → ${JSON.stringify(v)} (se esperaba ${JSON.stringify(esperado)})`); } };

es('A1+A2', 5);                                   // vacío = 0 en cuentas
es('A2&"x"', 'x');                                // vacío = "" en texto
es('A2=""', true); es('A2=0', true);              // vacío se compara como "" o 0
es('ISBLANK(A2)', true); es('ISBLANK(A4)', false);
es('IF(A1>3,"si","no")', 'si'); es('IF(A1>9,"si")', false); es('IF(A1>3,,"no")', 0);
es('IF(A3>0,1,2)', 1);                            // texto > número en el orden de Excel
es('"abc"="ABC"', true);                          // sin distinguir mayúsculas
es('IFERROR(1/0,"div")', 'div'); es('1/0', '#DIV/0!');
es('VLOOKUP("sun2000-10k-lc0",B1:C2,2,FALSE)', 63);        // exacto, sin mayúsculas
es('VLOOKUP("X",B1:C2,2,FALSE)', '#N/A');
es('VLOOKUP(15,D1:D3,1,TRUE)', 10); es('VLOOKUP(25,D1:D3,1)', 20);   // aproximado
es('VLOOKUP("5",A1:A1,1,FALSE)', '#N/A');                  // "5" no es 5 en BUSCARV exacto
es('HLOOKUP(20,D1:D3,1,FALSE)', '#N/A');
es('MATCH("SUN2000-8K-LC0",B1:B2,0)', 1);
es('MIN(IF(D1:D3>15,D1:D3))', 20);                        // fórmula matricial
es('SUM(D1:D3)', 60); es('MAX(D1:D3)', 30); es('COUNTIF(D1:D3,"<>0")', 3); es('COUNTIF(A1:A5,"<>0")', 4);
es('ROUND(2.345,2)', 2.35); es('ROUND(-2.5,0)', -3);
es('MID("MÓDULOS string A.1.1",SEARCH(" ","MÓDULOS string A.1.1",1)+1,12)', 'string A.1.1');
es('SEARCHB("Empalme","TG - Empalme",1)', 6); es('SEARCH("x","abc")', '#VALUE!');
es('SUBSTITUTE(LEFT("-35.82, -71.57",SEARCH(",","-35.82, -71.57")-1),",",".")', '-35.82');
es('TRIM(MID("-35.82, -71.57",SEARCH(",","-35.82, -71.57")+1,99))', '-71.57');
es('TEXT(3,0)&"x"&8.37', '3x8,37', { separadorDecimal: ',' });     // Excel en español
es('TEXT(3,0)&"x"&8.37', '3x8.37', { separadorDecimal: '.' });
es('E1&" "&E2', 'EMT Flex. Met.');
es("'Hoja con espacios'!A1", 5);                                     // referencias con nombre de hoja
es('PI()*(20/2)^2', Math.PI * 100);
es('-2^2', 4);                                                       // en Excel el signo va antes que la potencia
es('MONTH(TODAY())', 11, { hoy: new Date(2026, 10, 18) });
es('NOEXISTE(1)', '#NAME?');                                         // función desconocida: error visible, no se cae

console.log(`${ok} pruebas de fórmulas correctas, ${mal} con error.`);
process.exit(mal ? 1 : 0);
