import test from 'node:test';import assert from 'node:assert/strict';
import {distributionExplanation} from '../scripts/labor-interface.mjs';
test('분배 설명은 반 개와 온전한 개수를 구분하고 소수 수량을 올림 지급으로 바꾸지 않는다',()=>{
 assert.equal(distributionExplanation({full:2,remainder:1},2),'1명 · 0.5개');
 assert.equal(distributionExplanation({full:3,remainder:0},2),'—');
 assert.equal(distributionExplanation({full:0,remainder:0},2),'—');
 assert.equal(distributionExplanation({full:0,remainder:1},2),'1명 · 0.5개');
 assert.match(distributionExplanation({full:1,remainder:2},3),/약 0\.667개/);
});
