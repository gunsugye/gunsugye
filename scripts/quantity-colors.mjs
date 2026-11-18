export function quantityColorV502(required,quantity){
 if(quantity===null||quantity===undefined||quantity==='')return 'background:#edf0f5!important;color:#526174!important;box-shadow:inset 3px 0 #8895a7';
 const missing=Math.max(0,Number(required)-Number(quantity));if(!missing)return '';
 const level=Math.min(4,Math.ceil(missing)),background=['','#fff4df','#ffe1ab','#ffc875','#ffad42'][level];
 return 'background:'+background+'!important;color:#783b08!important;box-shadow:inset 3px 0 #d97706';
}
export function quantityColorsClientV502(source){
 return source.replace("(needsAction?' style=\"background:#fff7ed\"':'')","(' style=\"'+quantityColorV502(n,qty)+'\"')")
 .replace("개</td><td>'+x.short+'개</td><td>'+x.unknown+'명", "개</td><td style=\"'+quantityColorV502(x.short,0)+'\">'+x.short+'개</td><td style=\"'+(x.unknown?quantityColorV502(1,null):'')+'\">'+x.unknown+'명")
 .replace("</td><td>'+escapeH((x.quantity??'미등록')","</td><td style=\"'+quantityColorV502(dutyItemRequirementsV368(x.person)[x.kind.id],x.quantity)+'\">'+escapeH((x.quantity??'미등록')")
 .replace(/^init\(\);$/m,()=>quantityColorV502.toString()+'\ninit();');
}
