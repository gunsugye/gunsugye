import test from 'node:test';
import assert from 'node:assert/strict';
import {supplyOverview} from '../scripts/supply-overview.mjs';
test('overview counts people once per issue type, preserves zero and separates missing from shortage',()=>{
 const schema={fields:['클립','보호피','턱끈 상태','세부사항'],numeric:{클립:2},options:{보호피:['유','무']},quantityRange:{max:1}};
 const s=supplyOverview({schema,rows:[{name:'A',status:'정상',extra:{수량:0,클립:0,보호피:'무','턱끈 상태':'수리 필요'}},{name:'B',status:'사용불가',extra:{수량:1,클립:2,보호피:'유','턱끈 상태':'사용불가'}},{name:'C',status:'',extra:{}}]});
 assert.equal(s.people,3);assert.equal(s.quantity,1);assert.equal(s.shortage,1);assert.equal(s.absent,1);assert.equal(s.repair,1);assert.equal(s.unusable,1);assert.equal(s.incomplete,1);assert.equal(s.issues[0].reasons.length,4);
});
test('complete normal rows need no details and disabled status is not required',()=>{const s=supplyOverview({schema:{includeStatus:false,fields:[],quantityRange:{max:1}},rows:[{extra:{수량:1},detail:''}]});assert.equal(s.issues.length,0);assert.equal(s.incomplete,0);assert.equal(s.quantity,1);});
test('overview never invents people outside the supplied permission-scoped roster',()=>{const s=supplyOverview({quantityRange:{max:2},rows:[{company:'2',name:'A',status:'정상',extra:{수량:1}}]});assert.equal(s.people,1);assert.equal(s.issues[0].company,'2');assert.equal(s.shortage,1);});
