// 상태 명칭을 최종 생성 단계에서 통일합니다. 기존 시트 값은 공통 변환기로 읽습니다.
export function canonicalConditionV497(value){
 const text=String(value??'').trim(),key=text.replace(/\s/g,'');
 if(key==='교체필요'||key==='사용불가')return '사용 불가';
 if(key.includes('수리필요'))return '수리 필요';
 return text;
}
export function conditionTextV497(source){
 let text=source.replaceAll('교체 필요','사용 불가')
 .replaceAll('교체·사용불가','사용 불가')
 .replace(/(['"])(?:교체필요|사용불가)\1/g,(_,quote)=>quote+'사용 불가'+quote)
 .replace(/>(?:교체필요|사용불가)</g,'>사용 불가<').replaceAll('[사용불가]','[사용 불가]').replaceAll('사용불가 ·','사용 불가 ·');
 // 서로 다른 보고 상태였던 선택지 두 개를 수리/사용 불가로 교정합니다.
 text=text.replaceAll("['수리 필요','수리 필요'],['수리 필요','수리 필요']","['수리 필요','수리 필요'],['사용 불가','사용 불가']");
 text=text.replaceAll("'정상','수리 필요','수리 필요'","'정상','수리 필요','사용 불가'");
 text=text.replaceAll("'수리 필요','사용 불가','사용 불가'","'수리 필요','사용 불가'");
 text=text.replace(/(<option\b[^>]*>수리 필요<\/option>)\s*(<option\b[^>]*>수리 필요<\/option>)/g,(_,first,second)=>first+second.replaceAll('수리 필요','사용 불가'));
 text=text.replace(/(<option\b[^>]*>사용 불가<\/option>)\s*<option\b[^>]*>사용 불가<\/option>/g,'$1');
 text=text.replaceAll('수리 필요 / 수리 필요','수리 필요 / 사용 불가');
 text=text.replaceAll("'사용 불가':'교체'","'사용 불가':'사용 불가'")
 .replaceAll("text.includes('교체')?","(text.includes('교체')||text.includes('사용불가'))?")
 .replace(/(?<=[ ·☑])사용불가(?=['"<·:를 ])/g,'사용 불가');
 text=text.replace(/function repairResponseV310\(value\)\{[\s\S]*?\n \}/,`function repairResponseV310(value){
  if(Array.isArray(value))return value.map(repairResponseV310);
  if(value&&typeof value==='object')for(const key of Object.keys(value)){
   if(['status','firearmStatus'].includes(key)&&typeof value[key]==='string')value[key]=(${canonicalConditionV497.toString()})(value[key]);
   else repairResponseV310(value[key]);
  }return value;
 }`);
 return text;
}
export function conditionServerV497(source){
 return conditionTextV497(source).replace(/function canonicalRepairStateV216_\(value\)\{[\s\S]*?\n\}/,canonicalConditionV497.toString().replace('canonicalConditionV497','canonicalRepairStateV216_'));
}
