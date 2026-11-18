import test from 'node:test';
import assert from 'node:assert/strict';
import {quantityColorV502,quantityColorsClientV502} from '../scripts/quantity-colors.mjs';
import {readFileSync} from 'node:fs';
test('shortages darken by absolute count, unknown differs from surveyed zero',()=>{
 const colors=[1,2,3,4].map(n=>quantityColorV502(n,0));assert.equal(new Set(colors).size,4);
 assert.equal(quantityColorV502(10,0),colors[3]);assert.equal(quantityColorV502(2,2),'');assert.equal(quantityColorV502(2,4),'');
 assert.notEqual(quantityColorV502(2,null),quantityColorV502(2,0));assert.equal(quantityColorV502(2,''),quantityColorV502(2,null));
});
test('quantity colors apply only to individual input cells, not overview tables',()=>{
 const source=readFileSync(new URL('../scripts/duty-items-client.js.txt',import.meta.url),'utf8');const result=quantityColorsClientV502(source);
 assert.match(result,/quantityColorV502\(n,qty\)/);assert.doesNotMatch(result,/quantityColorV502\(x.short,0\)/);assert.doesNotMatch(result,/quantityColorV502\(dutyItemRequirementsV368\(x.person\)/);assert.doesNotMatch(result,/x.short\|\|x.unknown\?/);
});
