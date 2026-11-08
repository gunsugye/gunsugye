import {insertAppClient} from './app-client.mjs';
function requiredReplace(source,from,to){if(!source.includes(from))throw Error('조사 연동 위치 없음: '+from.slice(0,70));return source.replace(from,to);}
export function surveyServerV416(source,code){
 const specs=[
  ['Uniform','resolveUniformRequestV350','const person=rosterRows_','\n const saved=', 'r','uniform'],
  ['Duty','resolveDutyRequestV400','const person=rosterRows_','\n }\n const saved=','request','duty'],
  ['Asset','resolveDormInventoryRequestV336','const people=rosterRows_','\n  }\n  const status=','request','asset']
 ];
 let helpers='';
 for(const [name,fn,start,end,request,kind] of specs){
  const pos=source.indexOf('function '+fn+'('),a=source.indexOf(start,pos),b=source.indexOf(end,a);
  if(pos<0||a<0||b<0)throw Error('조사 반영 함수 추출 실패: '+fn);
  let body=source.slice(a,b);
  if(kind==='uniform'){if(!body.endsWith('}'))throw Error('피복 반영 경계 오류');body=body.slice(0,-1);}
  helpers+='\nfunction surveyApply'+name+'V416_(ss,'+request+',edits){let applied=null,acceptedEdits=[];'+body+'\nreturn applied;}\n';
 }
 for(const [fn,kind] of [['personalUniformRequestV350_','uniform'],['personalDutyRequestV400_','duty'],['personalSaveAssetsV331_','asset'],['personalFirearmRequestV413_','firearm']]){
  source=requiredReplace(source,'function '+fn+'(input){','function '+fn+'(input){if(surveyPolicyV416_(\''+kind+'\').mode===\'direct\')return surveySubmitV416_(\''+kind+'\',input);if(input?.campaignId)throw Error(\'조사 기간이 종료되었거나 변경되었습니다. 새로고침하세요.\');');
 }
 source=requiredReplace(source,'function uniformRequestInfoV350_(ss,person,row){return {','function uniformRequestInfoV350_(ss,person,row){return {policy:surveyPolicyV416_(\'uniform\'),');
 source=requiredReplace(source,'return {initialized:true,position:room.personalPosition,requests:','return {initialized:true,policy:surveyPolicyV416_(\'asset\'),position:room.personalPosition,requests:');
 source=requiredReplace(source,'result.snapshot=personalHashV330_(result);','result.policy=surveyPolicyV416_(\'duty\');result.snapshot=personalHashV330_(result);');
 source=requiredReplace(source,'function setFirearmSurveyV413(input){',"function setFirearmSurveyV413(input){return setSurveyPeriodV416('firearm',input?.enabled===false?{...input,id:surveyPolicyV416_('firearm').id}:input);");
 source=requiredReplace(source,'function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(['getSurveyPeriodsV416','setSurveyPeriodV416'].includes(name)){assetRequestAdminV336_();return accessPolicyV284_();}");
 return source+'\n'+helpers+'\n'+code;
}
export function surveyClientV416(source,code){return insertAppClient(requiredReplace(source,'function switchView(v){firearmsInitV410();','function switchView(v){firearmsInitV410();surveyViewV416(v);'),code);}
