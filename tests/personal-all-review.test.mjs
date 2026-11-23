import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scripts/personal-all-review.js.txt',import.meta.url),'utf8');
test('근무생도 조사 기간에도 변경이 없으면 저장 요청을 만들지 않는다',()=>{const c=vm.createContext({personalSupplyModelV507:null,assetItems:[],assetSurveyPolicyV416:null});vm.runInContext(source,c);vm.runInContext("personalDutyReviewV533={duty:{snapshot:'d',policy:{id:'survey'}},direct:true,changes:()=>[]}",c);assert.equal(c.personalAllPlansV533().length,0);});
test('일괄 저장은 조사 기간에도 변경한 항목과 품목만 제출한다',()=>{
 const c=vm.createContext({
  personalSupplyModelV507:{entries:[{item:{id:'blanket',name:'모포',snapshot:'s1'},baseline:{status:'정상',detail:'',extra:{수량:'1'}},value:{status:'수리 필요',detail:'',extra:{수량:'1'}}},{item:{id:'helmet',name:'방탄모',snapshot:'s2'},baseline:{status:'정상',detail:'',extra:{수량:'1'}},value:{status:'정상',detail:'',extra:{수량:'1'}}}],loading:false,direct:true,policyId:'survey'},
  supplyDisplayValuesV521:entry=>[['수량',entry.value.extra.수량],['상태',entry.value.status],['세부사항',entry.value.detail]],supplyFieldLabelV509:key=>key,
  personalDutyReviewV533:null,personalUniformReviewV533:{meta:{updatedAt:'u',policy:{id:'uniform-survey'}},direct:true,changes:()=>[]},personalFirearmReviewV533:{info:{snapshot:'f',policy:{id:'firearm-survey'}},direct:true,editable:true,current:()=>({status:'정상',detail:''}),baseline:()=>({status:'정상',detail:''})},assetItems:[],assetSurveyPolicyV416:null
 });vm.runInContext(source,c);vm.runInContext('personalUniformReviewV533=globalThis.personalUniformReviewV533;personalFirearmReviewV533=globalThis.personalFirearmReviewV533',c);const plans=c.personalAllPlansV533();assert.equal(plans.length,1);assert.equal(plans[0].name,'군수품');assert.equal(plans[0].changes.length,1);assert.equal(plans[0].changes[0].label,'모포 · 상태');assert.equal(plans[0].body.changes.length,1);assert.equal(plans[0].body.changes[0].itemId,'blanket');
});

test('전수조사 외 변경은 조사 ID 없이 수정 요청으로 분리한다',()=>{
 const c=vm.createContext({personalSupplyModelV507:null,personalDutyReviewV533:null,personalUniformReviewV533:{meta:{updatedAt:'u',policy:{id:'closed'}},direct:false,changes:()=>[{item:'전투복',size:'100',before:'95'}]},personalFirearmReviewV533:{info:{snapshot:'f',policy:{id:'active'}},direct:true,editable:true,current:()=>({status:'정상',detail:''}),baseline:()=>({status:'정상',detail:''})},assetItems:[],assetSurveyPolicyV416:null});
 vm.runInContext(source,c);vm.runInContext('personalUniformReviewV533=globalThis.personalUniformReviewV533;personalFirearmReviewV533=globalThis.personalFirearmReviewV533',c);
 const plans=c.personalAllPlansV533();assert.equal(plans.length,1);assert.equal(plans[0].path,'uniform-request');assert.equal(plans[0].direct,false);assert.equal(plans[0].body.campaignId,'');assert.equal(plans[0].body.changes.length,1);
});
