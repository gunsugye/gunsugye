export function referenceMenuV409(source,server=false){
 const marker=server?'const NAV_GROUPS_V233=[':'const NAV_GROUP_DEFAULT_V233=[';
 source=source.replace(marker,marker+"{id:'inputManagement',title:'입력 및 관리',items:['roster','dutyCadets','dorm']},").replace("items:['equipment','dorm','roomAsset','assetRequests']","items:['equipment','roomAsset','assetRequests']").replace("items:['roster','dutyCadets','saber','dutyItems','dutyRequests','repairs']","items:['saber','dutyItems','dutyRequests','repairs']");return source;
}
export function referenceBatchClientV409(source,client){return referenceMenuV409(source).replace("if(v==='departures')departuresLoadV305();","if(['roster','dutyCadets','dorm'].includes(v))referenceOpenV409(v);if(v==='departures')departuresLoadV305();")+'\n'+client;}
