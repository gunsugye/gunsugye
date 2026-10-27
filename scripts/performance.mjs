// 한 API 요청 안의 중복 조회만 합칩니다. 새 요청은 새 원본·권한을 읽습니다.
export function requestMemo(original, enabled) {
  let ready=false,value,scope;
  return function(...args){
    const current=enabled();if(!current)return original.apply(this,args);
    if(current!==scope){ready=false;scope=current;}
    if(!ready){value=original.apply(this,args);ready=true;}
    return value;
  };
}
export function requestObjectMemo(original, enabled) {
  let values=new WeakMap(),scope;
  return function(object,...args){
    const current=enabled();if(!current||!object||typeof object!=='object')return original.call(this,object,...args);
    if(current!==scope){values=new WeakMap();scope=current;}
    if(!values.has(object))values.set(object,original.call(this,object,...args));
    return values.get(object);
  };
}
export const requestPerformanceCode = `
const pagesReadMethodsV307_=new Set(['getBootstrap','getRosterData','getEquipmentData','getSupplyCatalog','getSupplyItemData','getUniformV278','getRepairDashboardV219','getSmartDutyExceptionV253','getDepartureDashboardV305']);
let pagesReadRequestV307_=false;
const pagesMemoV307_=${requestMemo.toString()};
const pagesObjectMemoV307_=${requestObjectMemo.toString()};
const pagesMemoEnabledV307_=()=>pagesReadRequestV307_;
config_=pagesMemoV307_(config_,pagesMemoEnabledV307_);
fullEditorsV281_=pagesMemoV307_(fullEditorsV281_,pagesMemoEnabledV307_);
limitedEditorEmailsV226_=pagesMemoV307_(limitedEditorEmailsV226_,pagesMemoEnabledV307_);
accessProfilesV284_=pagesMemoV307_(accessProfilesV284_,pagesMemoEnabledV307_);
accessPolicyV284_=pagesMemoV307_(accessPolicyV284_,pagesMemoEnabledV307_);
spreadsheet_=pagesMemoV307_(spreadsheet_,pagesMemoEnabledV307_);
wxPages_=pagesObjectMemoV307_(wxPages_,pagesMemoEnabledV307_);
`;
