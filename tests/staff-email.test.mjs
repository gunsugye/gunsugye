import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync,existsSync} from 'node:fs';
const path=new URL('../Code.gs.txt',import.meta.url),available=existsSync(path),source=available?readFileSync(path,'utf8'):'';
function fixture(){
 const rows=[['직책','이름','전화번호','근무차수','등록시각','수정시각','등록자'],['기타','검증','010-0000-0000','75-3차','created','old','owner@example.com']],props=new Map([['term','75-3차']]);let columns=7,serial=0,admin=true;
 const sh={getMaxColumns:()=>columns,insertColumnsAfter:(_n,count)=>columns+=count,getLastRow:()=>rows.length,getMaxRows:()=>1000,insertRowsAfter(){},appendRow:row=>rows.push([...row]),getRange:(r,c,h=1,w=1)=>({getDisplayValue:()=>String(rows[r-1]?.[c-1]??''),getDisplayValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>String(rows[r+i-1]?.[c+j-1]??''))),setValue:value=>{rows[r-1][c-1]=value;},setValues:values=>{assert.equal(values.length,h);for(let i=0;i<h;i++){assert.equal(values[i].length,w);rows[r+i-1]??=[];for(let j=0;j<w;j++)rows[r+i-1][c+j-1]=values[i][j];}}})};
 const c=vm.createContext({ACCESS_V284_JOBS:['기타'],STAFF_TERM_V285_PROP:'term',requireAdminV281_:()=>{if(!admin)throw Error('관리자');},accessPolicyV284_:()=>({legacy:true,owner:admin}),staffTabV284_:()=>sh,spreadsheet_:()=>({}),PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},lockAndRun_:fn=>fn(),iso_:()=> 'v'+(++serial),text_:(v,n)=>String(v||'').slice(0,n),safeCell_:v=>v,config_:()=>({email:'owner@example.com'}),fullAuditV281_:()=>{},Logger:{log(){}}});
 for(const name of ['staffEmailColV366_','staffListV284','staffSaveV284','staffSetCommonTermV285']){const start=source.indexOf('function '+name+'(');vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+3),c);}
 return {c,rows,props,sh,setAdmin:value=>admin=value};
}
test('기존 7열 명단은 조회로 바꾸지 않고 이메일 저장 시 확장하며 차수 복사에도 보존한다',{skip:!available},()=>{
 const {c,rows,sh}=fixture();assert.equal(c.staffListV284('').items[0].email,'');assert.equal(sh.getMaxColumns(),7);
 c.staffSaveV284({job:'기타',name:'검증',phone:'010-0000-0000',row:2,expected:'old',email:' TEST@Example.com '});assert.equal(rows[0][7],'이메일');assert.equal(rows[1][7],'test@example.com');assert.equal(c.staffListV284('').items[0].email,'test@example.com');
 c.staffSetCommonTermV285('75-4차','copy');assert.equal(rows.length,3);assert.equal(rows[2][7],'test@example.com');assert.equal(rows[1][3],'75-3차');
 c.staffSaveV284({job:'기타',name:'수정',phone:'',row:3,expected:rows[2][5]});assert.equal(rows[2][7],'test@example.com');assert.throws(()=>c.staffSaveV284({job:'기타',name:'잘못',row:3,expected:'stale',email:'other@example.com'}),/다른 사용자/);assert.equal(rows[2][7],'test@example.com');
});
test('이메일 오류·다른 용도의 8열·권한 부족은 기존 명단을 변경하지 않는다',{skip:!available},()=>{
 const f=fixture();assert.throws(()=>f.c.staffSaveV284({job:'기타',name:'검증',email:'bad'}),/이메일/);assert.equal(f.rows.length,2);assert.equal(f.sh.getMaxColumns(),7);
 f.sh.insertColumnsAfter(7,1);f.rows[0][7]='기존 항목';f.rows[1][7]='보존';assert.throws(()=>f.c.staffSaveV284({job:'기타',name:'검증',row:2,expected:'old',email:'test@example.com'}),/8열/);assert.equal(f.rows[1][7],'보존');
 f.setAdmin(false);assert.throws(()=>f.c.staffSaveV284({job:'기타',name:'검증',email:'test@example.com'}),/관리자/);assert.equal(f.rows[1][5],'old');
});
