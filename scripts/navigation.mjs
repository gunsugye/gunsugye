// schemaVersion 2에는 활성 메뉴만 저장합니다. 삭제 목록이나 숨김 항목을 남기지 않습니다.
export function normalizeNavigation(value, defaults, available) {
  const known = new Map(defaults.map(g => [g.id, g]));
  const allowed = new Set(available), used = new Set(), groups = [];
  const valid = value && Array.isArray(value.groups);
  const modern = valid && value.schemaVersion === 2;
  const hiddenGroups = new Set(valid && Array.isArray(value.hiddenGroups) ? value.hiddenGroups : []);
  const excluded = new Set(valid && Array.isArray(value.hiddenItems) ? value.hiddenItems : []);
  for (const g of valid ? value.groups : defaults) {
    if (!g || !known.has(g.id) || groups.some(x => x.id === g.id)) continue;
    if (!modern && hiddenGroups.has(g.id)) { for (const id of g.items || []) excluded.add(id); continue; }
    const items = [];
    for (const id of Array.isArray(g.items) ? g.items : []) {
      if (allowed.has(id) && !used.has(id) && (modern || !excluded.has(id))) { items.push(id); used.add(id); }
    }
    groups.push({ id: g.id, title: String(g.title || known.get(g.id).title).trim().slice(0, 25) || known.get(g.id).title, items });
  }
  if (!modern) {
    for (const g of defaults) {
      if (hiddenGroups.has(g.id)) { for (const id of g.items) excluded.add(id); continue; }
      if (!groups.some(x => x.id === g.id)) groups.push({ id: g.id, title: g.title, items: [] });
    }
    for (const id of available) {
      if (used.has(id) || excluded.has(id)) continue;
      const preferred = defaults.find(g => g.items.includes(id));
      const target = groups.find(g => g.id === preferred?.id) || groups.find(g => g.id === 'other') || groups[0];
      if (target) { target.items.push(id); used.add(id); }
    }
  }
  const labels = {};
  for (const [id, label] of Object.entries(valid ? value.labels || {} : {})) {
    if (used.has(id) && typeof label === 'string' && label.trim()) labels[id] = label.trim().slice(0, 50);
  }
  return { schemaVersion: 2, groups, labels };
}

export function updateNavigationJs(js) {
  js = js.replace(/function navNormalizeV233\(input\)\{[\s\S]*?\n\}\n/, `function navNormalizeV233(input){return navModelV301_(input,NAV_GROUP_DEFAULT_V233,navAllowedV221());}\n`);
  js = js.replace("const t={groups:navDeepCopyV233(NAV_GROUP_DEFAULT_V233),labels:{},hiddenGroups:[],hiddenItems:[]}", "const t={schemaVersion:2,groups:navDeepCopyV233(NAV_GROUP_DEFAULT_V233),labels:{}}")
    .replace("nav.replaceChildren(frag);v284AddUtilityNav();", "nav.replaceChildren(frag);v284AddUtilityNav();const activeItemsV301=new Set(navTreeV233.groups.flatMap(g=>g.items));qsa('.mobile-nav [data-view]').forEach(button=>button.classList.toggle('nav-removed-v301',!activeItemsV301.has(button.dataset.view)));" )
    .replace("삭제(숨김)가 구글 계정에 저장되었습니다.", "삭제가 저장되었습니다.")
    .replace(/const prop=isGroup\?'hiddenGroups':'hiddenItems';[\s\S]*?navTreeV233\[prop\]=old\?existing\.filter\(x=>x!==key\):existing\.concat\(key\);/, `if(!confirm('이 메뉴를 구성에서 삭제할까요? 상위 메뉴는 포함된 하위 메뉴도 함께 제거됩니다. 저장 후 적용됩니다.'))return;
  if(isGroup){const group=navTreeV233.groups.find(g=>g.id===key);(group?.items||[]).forEach(id=>delete navTreeV233.labels[id]);navTreeV233.groups=navTreeV233.groups.filter(g=>g.id!==key);}
  else{navTreeV233.groups.forEach(g=>{g.items=g.items.filter(id=>id!==key);});delete navTreeV233.labels[key];}
  navTreeV233.schemaVersion=2;`)
    .replace(/\$\('navRestoreButtonV266'\)\.addEventListener\('click',\(\)=>\{[^\n]+\}\);/, `$('navRestoreButtonV266').addEventListener('click',navOpenCatalogV301);`)
    .replace("del.textContent=(navTreeV233.hiddenGroups||[]).includes(group.id)?'↩':'×';del.title=(navTreeV233.hiddenGroups||[]).includes(group.id)?'삭제 취소 · 메뉴 복원':'상위 메뉴 삭제 (화면에서만 숨김)'", "del.textContent='×';del.title='상위 메뉴 삭제'")
    .replace("del.textContent=(navTreeV233.hiddenItems||[]).includes(id)?'↩':'×';del.title=(navTreeV233.hiddenItems||[]).includes(id)?'삭제 취소 · 메뉴 복원':'하위 메뉴 삭제 (화면에서만 숨김)'", "del.textContent='×';del.title='하위 메뉴 삭제'")
    .replace("await wxLoadAll();switchView(page.id);", "await wxLoadAll();await navAttachCreatedV301(page.id);switchView(page.id);");
  const extra = `
function navOpenCatalogV301(){
 if(!navEditModeV220)return;
 const active=new Set(navTreeV233.groups.flatMap(g=>g.items));
 $('navAddGroupV301').innerHTML='<option value="">상위 메뉴 선택</option>'+NAV_GROUP_DEFAULT_V233.filter(g=>!navTreeV233.groups.some(x=>x.id===g.id)).map(g=>'<option value="'+escapeH(g.id)+'">'+escapeH(g.title)+'</option>').join('');
 $('navAddParentV301').innerHTML=navTreeV233.groups.map(g=>'<option value="'+escapeH(g.id)+'">'+escapeH(g.title)+'</option>').join('');
 $('navAddItemV301').innerHTML='<option value="">하위 메뉴 선택</option>'+navAllowedV221().filter(id=>!active.has(id)).map(id=>'<option value="'+escapeH(id)+'">'+escapeH(navItemDefaultTitleV233(id))+'</option>').join('');
 $('navCatalogV301').showModal();
}
function navAddCatalogV301(groupMode){
 if(groupMode){const id=$('navAddGroupV301').value,def=NAV_GROUP_DEFAULT_V233.find(g=>g.id===id);if(!def)return;
  const active=new Set(navTreeV233.groups.flatMap(g=>g.items));navTreeV233.groups.push({id:def.id,title:def.title,items:def.items.filter(item=>!active.has(item))});navExpandedV233.add(id);
 }else{const group=navTreeV233.groups.find(g=>g.id===$('navAddParentV301').value),id=$('navAddItemV301').value;if(!group||!id)return;group.items.push(id);navExpandedV233.add(group.id);}
 navTreeV233=navNormalizeV233({...navTreeV233,schemaVersion:2});$('navCatalogV301').close();navRenderV233();navUpdateDirtyV220();
}
async function navAttachCreatedV301(id){
 if(navTreeV233.groups.some(g=>g.items.includes(id)))return;
 let group=navTreeV233.groups.find(g=>g.id==='other')||navTreeV233.groups[0];
 if(!group){group={id:'other',title:'기타',items:[]};navTreeV233.groups.push(group);}
 group.items.push(id);navTreeV233.schemaVersion=2;
 const saved=await server('saveNavTreeV233',navTreeV233);navTreeV233=navNormalizeV233(saved);navSavedTreeV233=navDeepCopyV233(navTreeV233);navRenderV233();navUpdateDirtyV220();
}
$('navAddGroupButtonV301').addEventListener('click',()=>navAddCatalogV301(true));
$('navAddItemButtonV301').addEventListener('click',()=>navAddCatalogV301(false));
$('navCatalogCloseV301').addEventListener('click',()=>$('navCatalogV301').close());
`;
  // 원본 IIFE 안에 삽입하여 메뉴 편집 상태와 권한 검사를 그대로 사용합니다.
  const index = js.lastIndexOf('})();');
  if (index < 0 || js.includes("navTreeV233[prop]=old?")) throw Error('메뉴 화면 패치 위치를 확인하세요.');
  return `const navModelV301_ = ${normalizeNavigation.toString()};\n` + js.slice(0, index) + extra + js.slice(index);
}

export function updateNavigationHtml(html) {
  return html.replace('☷ 이동 · ✎ 이름 변경 · × 메뉴 삭제(화면에서만 숨김) · ↩ 삭제 취소. 원본 시트·기록은 유지됩니다.', '☷ 이동 · ✎ 이름 변경 · × 메뉴 구성에서 삭제. 삭제한 메뉴는 편집 목록에서도 제거됩니다. 업무 기록과 설문 응답은 유지됩니다.')
    .replace('title="숨겨 둔 모든 메뉴를 다시 표시">숨김 복원', 'title="상위 메뉴나 기능 항목을 추가">＋ 메뉴 추가')
    .replace('</body>', `<dialog id="navCatalogV301" class="nav-catalog"><h2>메뉴 추가</h2><p>상위 메뉴를 추가하거나, 기존 상위 메뉴 안에 기능을 넣으세요.</p><label for="navAddGroupV301">상위 메뉴</label><select id="navAddGroupV301"></select><button id="navAddGroupButtonV301" type="button">상위 메뉴 추가</button><hr><label for="navAddParentV301">추가할 위치</label><select id="navAddParentV301"></select><label for="navAddItemV301">하위 메뉴</label><select id="navAddItemV301"></select><button id="navAddItemButtonV301" type="button">하위 메뉴 추가</button><button id="navCatalogCloseV301" type="button">닫기</button><p>추가 후 ‘변경사항 저장’을 누르면 적용됩니다.</p></dialog></body>`);
}
