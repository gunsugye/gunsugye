export const states=['정상','수리 필요','사용 불가'];
export const quantity=(key,label,max=1)=>({key,label,type:'quantity',max,standard:max});
export const choice=(key,label,options)=>({key,label,type:'select',options});
export const note={key:'notes',label:'세부사항',type:'text',optional:true};
const yn=(key,label)=>choice(key,label,['유','무']);
const status=choice('status','상태',states);
const item=(id,name,extra=[],max=1)=>({id,section:'supplies',name,fields:[quantity('quantity','수량',max),status,...extra,note]});
export const seedCatalog=[
 item('blanket','모포'),item('helmet','방탄모',[choice('type','종류',['구형','신형']),choice('size','사이즈',['대','중','소']),yn('cover','방탄모피'),choice('strap','턱끈 상태',states)]),
 item('vest','전투조끼',[quantity('attachments','부착물',6)]),item('canteen','수통',[yn('cover','수통피'),quantity('clips','수통피 클립',2)]),item('shovel','야전삽',[yn('cover','야전삽피'),quantity('clips','야전삽피 클립',2)]),
 item('belt','탄띠'),item('pouch','탄입대',[quantity('clips','탄입대 클립',4)],2),item('cleaning','총기 손질 도구',[quantity('clips','클립',1)]),
 item('mask','방독면',[choice('size','사이즈',['대','중','소']),yn('hood','방독면 보호두건'),yn('bag','방독면 휴대주머니'),choice('side','정화통 위치',['좌','우'])]),item('assault','공격 배낭'),item('pack','군장',[quantity('bags','보조낭',2)]),
 {id:'firearm',section:'firearm',name:'총기',fields:[{key:'number',label:'총기번호',type:'text'},status,choice('repair','수리 중',['아니오','예']),note]},
 ...['흉장','블럭','명패','아크릴판'].map((name,i)=>({id:`duty-${i}`,section:'duty',name,fields:[quantity('quantity','수량'),status,note]})),
 {id:'saber',section:'saber',name:'예도',fields:[quantity('quantity','수량'),status,{key:'number',label:'관리번호',type:'text',optional:true},note]},
 ...['전투복','전투화','체육복'].map((name,i)=>({id:`uniform-${i}`,section:'uniform',name,fields:[quantity('quantity','수량'),choice('size','사이즈',i===1?Array.from({length:17},(_,n)=>String(220+n*5)):['XS','S','M','L','XL','2XL','3XL']),status,note]})),
 ...['침대','책상','의자','옷장'].map((name,i)=>({id:`asset-${i}`,section:'assets',name,fields:[quantity('quantity','수량',2),status,note]})),
 {id:'shared',section:'shared',name:'공용비품',fields:[{key:'name',label:'비품명',type:'text'},quantity('quantity','수량',1),status,{key:'location',label:'위치',type:'text'},note]}
].map((c,i)=>({...c,position:i,enabled:true}));
export function completeness(c,values={}){const required=c.fields.filter(f=>!f.optional);const missing=required.filter(f=>values[f.key]===undefined||values[f.key]===null||values[f.key]==='').map(f=>f.label);return {missing,status:missing.length===required.length?'empty':missing.length?'partial':'complete'};}
export function issues(c,values={}){return c.fields.flatMap(f=>{const v=values[f.key];if(v===undefined||v===null||v==='')return [];if(v==='수리 필요'||v==='사용 불가')return [{label:`${f.label}: ${v}`,severity:v==='수리 필요'?'repair':'unusable'}];if(v==='무')return [{label:`${f.label}: 무`,severity:'shortage'}];if(f.type==='quantity'&&Number(v)<Number(f.standard??f.max))return [{label:`${f.label}: ${Number(f.standard??f.max)-Number(v)}개 부족`,severity:'shortage',ratio:(Number(f.standard??f.max)-Number(v))/Math.max(1,Number(f.standard??f.max))}];return [];});}
export function itemLabel(c,v={}){return c.id==='mask'&&['좌','우'].includes(v.side)?`방독면(${v.side})`:c.name;}
export function armoryFor(company){const n=Number(company);return n>=1&&n<=8?`${n<=4?1:2}대대 ${[1,2,5,6].includes(n)?1:2}무기고`:'';}
export const armories=['1대대 1무기고','1대대 2무기고','2대대 1무기고','2대대 2무기고'];
export function firearmLocation(person,values={}){return person.status==='퇴교'||values.repair==='예'?armories[3]:armoryFor(person.company);}
