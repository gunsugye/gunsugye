import {insertAppClient} from './app-client.mjs';
export function supplyQuantityOrderClientV500(source,client){
 source=source.replace('고정 항목: 수량 · 상태 · 세부사항','고정 항목: 수량 · 상태 · 세부사항</p><fieldset><legend>수량 선택 범위</legend><p>최솟값: 0개</p><label>최댓값<input name="quantityMax" type="number" min="0" max="1000" step="1" required></label><label>기준 수량<input name="quantityStandard" type="number" min="0" max="1000" step="1" required></label></fieldset><p>0개부터 최댓값까지 선택합니다.')
 .replace("field('itemName').value=initial?.name||'';", "field('quantityMax').value=initial?.quantityRange?.max??1;field('quantityStandard').value=initial?.quantityRange?.standard??Math.min(1,initial?.quantityRange?.max??1);field('itemName').value=initial?.name||'';")
 .replace("value={fields,options:{종류:field('useKind').checked?split('kinds'):[],사이즈:field('useSize').checked?split('sizes'):[]}}", "value={fields,options:{종류:field('useKind').checked?split('kinds'):[],사이즈:field('useSize').checked?split('sizes'):[]},quantityRange:{min:0,max:Number(field('quantityMax').value),standard:Number(field('quantityStandard').value)}}")
 .replace('종류·사이즈 항목 설정','종류·사이즈·수량 수정')
 .replace('수량 · 상태 · 세부사항 (고정) · ', '상태 · 세부사항 (고정) · 수량 (범위 설정) · ');
 source=source.replace("${cell('extra:수량',v.extra?.['수량']??'',30)}","${supplyQuantityInputV500(p,v,disabled)}")
 .replace('function supplyCatalogUI(){','function supplyCatalogUI(){supplyOrderButtonV500();')
 .replace('async function supplySave(id){','async function supplySave(id){if(!supplyQuantityValidV500(id))return;')
 .replace('수량·상태·세부사항은 고정이며 종류·사이즈 항목을 설정할 수 있습니다.','수량은 선택하면 자동 저장됩니다. 수량 범위와 품목 순서를 설정할 수 있습니다.')
 .replace("e.target.closest('[data-supply-field=\"status\"]')","e.target.closest('[data-supply-field=\"status\"],[data-supply-field=\"extra:수량\"]')")
 .replace('window.logbookReloadState=()=>({busy:!!(','window.logbookReloadState=()=>({busy:!!(supplyOrderSavingV500||');
 return insertAppClient(source,client);
}
export function supplyQuantityOrderServerV500(source,server){
 source=source.replace('return {fields,options};',"return {fields,options,...(value?.quantityRange?{quantityRange:supplyValidateQuantityRangeV500_(value.quantityRange)}:{})};")
 .replace("PropertiesService.getScriptProperties().setProperty('SUPPLY_SCHEMA_V408_'+item.id,JSON.stringify(schema));", "if(schema.quantityRange)PropertiesService.getScriptProperties().setProperty('SUPPLY_QUANTITY_RANGE_V500_'+item.id,JSON.stringify(schema.quantityRange));PropertiesService.getScriptProperties().setProperty('SUPPLY_SCHEMA_V408_'+item.id,JSON.stringify(schema));");
 const original="return sh.getRange(2,1,n,4).getDisplayValues().filter(r=>r[0]).map(r=>({id:r[0],name:r[1],sheetId:Number(r[2]),createdAt:r[3]}));";
 if(!source.includes(original))throw Error('군수품 목록 조회 위치 확인');
 source=source.replace(original,"return supplyOrderedItemsV500_(sh.getRange(2,1,n,4).getDisplayValues().filter(r=>r[0]).map(r=>({id:r[0],name:r[1],sheetId:Number(r[2]),createdAt:r[3]})));")
 .replace('function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(['saveSupplyOrderV500','saveSupplyQuantityRangeV500'].includes(name)){referenceAdminV409_();return accessPolicyV284_();}")
 .replace('return {...r.item,schema:supplySchemaV408_(r.item),','return {...r.item,quantityRange:supplyQuantityRangeV500_(r.item.id),schema:supplySchemaV408_(r.item),');
 const start=source.indexOf('function saveSupplyRow(itemId,source){'),end=source.indexOf('function normalizeSupplyCohort(',start);
 if(start<0||end<0)throw Error('군수품 수량 저장 위치 확인');
 let save=source.slice(start,end).replace('r=supplyOne_(ss,itemId)','r=supplyEnsureQuantityV500_(ss,itemId)')
 .replace('    const timestamp=iso_();',"    supplyCheckQuantityV500_(r.item.id,extra['수량'],old?.extra?.['수량']);supplyPresetValidateValueV520_(supplySchemaV408_(r.item),extra);\n    const timestamp=iso_();");
 source=source.slice(0,start)+save+source.slice(end);
 return source+'\n'+server;
}
