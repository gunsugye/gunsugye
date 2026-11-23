import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('Forms 시스템 표시는 한국어로 바꾸고 응답값과 사용자 제목은 보존한다',()=>{
 const data=[['タイムスタンプ','メールアドレス','スコア','방탄모 · 상태'],['2026-11-24','user@example.test','0','수리 필요']],before=JSON.stringify(data[1]),formats=[];
 let locale='ja_JP',zone='Asia/Tokyo',name='フォームの回答 1';
 const tab={getFormUrl:()=> 'https://docs.google.com/forms/d/form/viewform',getName:()=>name,setName:v=>name=v,getSheetId:()=>1,getLastColumn:()=>4,getLastRow:()=>2,getRange:(r,c,h=1,w=1)=>({getDisplayValues:()=>[data[r-1].slice(c-1,c-1+w)],setValue:v=>data[r-1][c-1]=v,setNumberFormat:v=>formats.push([r,c,v])})};
 const other={getFormUrl:()=>null,getName:()=> '메모'},book={getSpreadsheetLocale:()=>locale,setSpreadsheetLocale:v=>locale=v,getSpreadsheetTimeZone:()=>zone,setSpreadsheetTimeZone:v=>zone=v,getSheets:()=>[tab,other],getSheetByName:n=>n===name?tab:null};
 const c=vm.createContext({supplyInboxBookV542_:()=>book});vm.runInContext(readFileSync(new URL('../scripts/supply-form-korean-server.gs.txt',import.meta.url),'utf8'),c);c.supplyFormsKoreanV553_();
 assert.equal(locale,'ko_KR');assert.equal(zone,'Asia/Seoul');assert.equal(name,'설문 응답 1');assert.deepEqual(data[0],['제출 시각','이메일 주소','점수','방탄모 · 상태']);assert.equal(JSON.stringify(data[1]),before);assert.deepEqual(formats[0],[2,1,'yyyy-mm-dd hh:mm:ss']);c.supplyFormsKoreanV553_();assert.equal(name,'설문 응답 1');
});
