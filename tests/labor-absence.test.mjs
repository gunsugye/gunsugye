import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
test('전체/현재 독방은 외출 여부를 다르게 반영하고 학년 필터로 독방을 만들지 않는다',{skip:!existsSync(new URL('../Code.gs.txt',import.meta.url))},()=>{
 const source=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8');
 const take=name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}\n',start)+3);};
 const room=id=>({id,room:id,building:'본관'}),a=room('101'),b=room('102');
 const people=[{personKey:'a',room:a,duty:''},{personKey:'b',room:a,duty:'외출'},{personKey:'c',room:b,duty:''}].map(p=>({...p,roomId:p.room.id,matched:true,cohort:'77',company:'1',name:p.personKey}));
 const context=vm.createContext({laborGradeSetV261_:()=>[],laborGradeMatchV261_:p=>p.personKey!=='b',laborPhysicalKeyV260_:r=>r.id,laborSoloPairStateV264_:()=>({pairs:{},blocked:[]}),laborMainCategoryV375_:()=>'',laborUnitV259_:x=>x});
 vm.runInContext(['laborStatusV259_','laborAbsentAllV259_','laborAbsentNowV259_','laborRoomOccupancyV260_','laborPairsV259_'].map(take).join('\n'),context);
 const calc=mode=>context.laborPairsV259_(people,mode,'all',2,'company');
 assert.deepEqual(Array.from(calc('whole').singles,p=>p.key),['c']);
 assert.deepEqual(Array.from(calc('current').singles,p=>p.key),['a','c']);
 assert.equal(calc('current').pairs.length,1);
 for(const status of ['휴가','입원','특별외출']){people[1].duty=status;assert.equal(calc('current').activeCount,2);assert.equal(calc('whole').activeCount,1);}
 people[1].duty='위탁';assert.equal(calc('whole').activeCount,2);
 people[2].duty='외출';assert.equal(calc('current').activeCount,1);assert.equal(calc('current').pairs.length,0);
 assert.equal(calc('current').singles.find(p=>p.key==='c').active,false);
});
