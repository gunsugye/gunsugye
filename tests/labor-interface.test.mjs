import test from 'node:test';import assert from 'node:assert/strict';
import {distributionExplanation} from '../scripts/labor-interface.mjs';
test('분배 설명은 반 개와 온전한 개수를 구분하고 소수 수량을 올림 지급으로 바꾸지 않는다',()=>{
 assert.equal(distributionExplanation({full:2,remainder:1},2),'2개를 나눠주고, 남은 1명에게 0.5개 분량이 더 필요해요.');
 assert.equal(distributionExplanation({full:3,remainder:0},2),'3개를 나눠주면 돼요.');
 assert.equal(distributionExplanation({full:0,remainder:0},2),'나눠줄 물품이 없어요.');
 assert.equal(distributionExplanation({full:0,remainder:1},2),'남은 1명에게 0.5개 분량이 더 필요해요.');
 assert.match(distributionExplanation({full:1,remainder:2},3),/약 0\.667개/);
});
