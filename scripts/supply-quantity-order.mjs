import {insertAppClient} from './app-client.mjs';
export function supplyQuantityOrderClientV500(source,client){
 source=source.replace("${cell('extra:수량',v.extra?.['수량']??'',30)}","${supplyQuantityInputV500(p,v,disabled)}")
 .replace('function supplyCatalogUI(){','function supplyCatalogUI(){supplyOrderButtonV500();')
 .replace('async function supplySave(id){','async function supplySave(id){if(!supplyQuantityValidV500(id))return;')
 .replace('수량·상태·세부사항은 고정이며 종류·사이즈 항목을 설정할 수 있습니다.','수량은 선택하면 자동 저장됩니다. 수량 범위와 품목 순서를 설정할 수 있습니다.')
 .replace("e.target.closest('[data-supply-field=\"status\"]')","e.target.closest('[data-supply-field=\"status\"],[data-supply-field=\"extra:수량\"]')")
 .replace('window.logbookReloadState=()=>({busy:!!(','window.logbookReloadState=()=>({busy:!!(supplyOrderSavingV500||');
 return insertAppClient(source,client);
}
export function supplyQuantityOrderServerV500(source,server){
 const original="return sh.getRange(2,1,n,4).getDisplayValues().filter(r=>r[0]).map(r=>({id:r[0],name:r[1],sheetId:Number(r[2]),createdAt:r[3]}));";
 if(!source.includes(original))throw Error('군수품 목록 조회 위치 확인');
 source=source.replace(original,"return supplyOrderedItemsV500_(sh.getRange(2,1,n,4).getDisplayValues().filter(r=>r[0]).map(r=>({id:r[0],name:r[1],sheetId:Number(r[2]),createdAt:r[3]})));")
 .replace('function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(['saveSupplyOrderV500','saveSupplyQuantityRangeV500'].includes(name)){referenceAdminV409_();return accessPolicyV284_();}")
 .replace('return {...r.item,schema:supplySchemaV408_(r.item),','return {...r.item,quantityRange:supplyQuantityRangeV500_(r.item.id),schema:supplySchemaV408_(r.item),');
 const start=source.indexOf('function saveSupplyRow(itemId,source){'),end=source.indexOf('function normalizeSupplyCohort(',start);
 if(start<0||end<0)throw Error('군수품 수량 저장 위치 확인');
 let save=source.slice(start,end).replace('r=supplyOne_(ss,itemId)','r=supplyEnsureQuantityV500_(ss,itemId)')
 .replace('    const timestamp=iso_();',"    supplyCheckQuantityV500_(r.item.id,extra['수량'],old?.extra?.['수량']);\n    const timestamp=iso_();");
 source=source.slice(0,start)+save+source.slice(end);
 return source+'\n'+server;
}
