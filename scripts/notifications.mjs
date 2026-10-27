export const notificationReadCode=`
const changeReadV309=new Set();
async function changeReadPageV309(page,ids){
 const selected=ids.filter(id=>!changeReadV309.has(id));if(!selected.length)return;
 const before=changeStateV283.unread.filter(x=>selected.includes(x.id));
 selected.forEach(id=>changeReadV309.add(id));
 changeStateV283.unread=changeStateV283.unread.filter(x=>!changeReadV309.has(x.id));changeRightRenderV283();
 try{await server('dismissChangePageV286',page,selected);}
 catch(e){selected.forEach(id=>changeReadV309.delete(id));const present=new Set(changeStateV283.unread.map(x=>x.id));changeStateV283.unread.push(...before.filter(x=>!present.has(x.id)));changeRightRenderV283();toast('확인 상태를 저장하지 못했습니다. 다시 확인해 주세요. '+e.message);}
}
`;
export function updateNotificationsJs(js){
 const pattern=/function changeOpenV283\(id\)\{[\s\S]*?\n\}\nasync function changeDismissV283/;
 if(!pattern.test(js))throw Error('수정사항 확인 처리 위치를 확인하세요.');
 js=js.replace(pattern,`function changeOpenV283(id,wholePage=false){
 const r=changeStateV283.items.find(x=>x.id===id);if(!r)return false;
 const page=viewNames[r.page]?r.page:'changes';
 const ids=changeStateV283.unread.filter(x=>wholePage?x.page===r.page:x.id===id).map(x=>x.id);
 if(switchView(page)===false)return false;
 changeReadPageV309(r.page,ids);
 const searchMap={roster:'rosterSearch',saber:'saberSearchV276',supply:'supplySearch',uniform:'uniformSearchV278',dorm:'dormSearch'};
 if(page==='all'){const el=$('search');el.value=r.title;renderAll();return true;}
 const el=$(searchMap[page]);if(el){el.value=r.title;el.dispatchEvent(new Event('input',{bubbles:true}));}
 return true;
}
async function changeDismissV283`)
 .replaceAll('if(rec)changeOpenV283(rec.id);','if(rec)changeOpenV283(rec.id,true);')
 .replace('changeStateV283.unread=r.unread||[];', 'changeStateV283.unread=(r.unread||[]).filter(x=>!changeReadV309.has(x.id));')
 .replace('if(panel.parentNode!==document.body)document.body.appendChild(panel);', "const dock=$('notificationDockV309');if(dock&&panel.parentNode!==dock)dock.appendChild(panel);")
 .replace("document.title='군수계 업무일지 v2.99';", "document.title='군수계 업무일지';");
 const end=js.lastIndexOf('})();');return js.slice(0,end)+notificationReadCode+js.slice(end);
}
