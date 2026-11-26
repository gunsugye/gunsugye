import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,validateExport} from '../scripts/validate-sheet-export.mjs';
const headers=['revision','expected_books','expected_sheets','expected_rows','book_id','book_metadata','sheet_id','title','position','columns_count','rows_count','sheet_revision','chunk','chunk_rows','payload'];
const csv=row=>[headers,row].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
const record=['912','1','1','1','book','{"title":"한글"}','1','탭','1','1','1','1','0','1',JSON.stringify([{number:1,values:['한글,\n값']}])];
test('sheet export preserves quoted newlines and validates whole snapshot counts',()=>{
 assert.equal(parseCsv(csv(record))[1][14],record[14]);
 assert.equal(parseCsv('"줄\n바꿈",값')[0][0],'줄\n바꿈');
 assert.deepEqual(validateExport(csv(record)),{revision:912,books:1,sheets:1,rows:1});
 assert.throws(()=>validateExport(csv(record).slice(0,-2)));
 const incomplete=[...record];incomplete[3]='2';assert.throws(()=>validateExport(csv(incomplete)),/일치하지/);
});
