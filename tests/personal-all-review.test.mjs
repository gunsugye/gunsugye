import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scripts/personal-all-review.js.txt',import.meta.url),'utf8');
test('일괄 검토는 모든 항목의 변경값만 나열하고 진행 중인 전수조사는 변경 없이도 저장 대상으로 잡는다',()=>{
 const c=vm.createContext({
  personalSupplyModelV507:{entries:[{item:{id:'blanket',name:'모포',snapshot:'s1'},baseline:{status:'정상',detail:'',extra:{수량:'1'}},value:{status:'수리 필요',detail:'',extra:{수량:'1'}}},{item:{id:'helmet',name:'방탄모',snapshot:'s2'},baseline:{status:'정상',detail:'',extra:{수량:'1'}},value:{status:'정상',detail:'',extra:{수량:'1'}}}],loading:false,direct:true,policyId:'survey'},
  supplyDisplayValuesV521:entry=>[['수량',entry.value.extra.수량],['상태',entry.value.status],['세부사항',entry.value.detail]],supplyFieldLabelV509:key=>key,
  personalDutyReviewV533:null,personalUniformReviewV533:{meta:{updatedAt:'u',policy:{id:'uniform-survey'}},direct:true,changes:()=>[]},personalFirearmReviewV533:{info:{snapshot:'f',policy:{id:'firearm-survey'}},direct:true,editable:true,current:()=>({status:'정상',detail:''}),baseline:()=>({status:'정상',detail:''})},assetItems:[],assetSurveyPolicyV416:null
 });vm.runInContext(source,c);vm.runInContext('personalUniformReviewV533=globalThis.personalUniformReviewV533;personalFirearmReviewV533=globalThis.personalFirearmReviewV533',c);const plans=c.personalAllPlansV533();assert.equal(plans.length,3);assert.equal(plans[0].name,'군수품');assert.equal(plans[0].changes.length,1);assert.equal(plans[0].changes[0].label,'모포 · 상태');assert.equal(plans[0].body.changes.length,2);assert.deepEqual(Array.from(plans.slice(1),plan=>plan.name),['피복','총기']);assert.ok(plans.slice(1).every(plan=>plan.changes.length===0&&plan.direct));
});
