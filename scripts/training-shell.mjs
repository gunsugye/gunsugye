export const trainingGroups=[
 {title:'운영',items:[['train','훈련 현황'],['trainPersonnel','인원 · 지도편성']]},
 {title:'보급',items:[['trainSupply','군수품 현황'],['trainSupplyRequests','군수품 수정 요청']]},
 {title:'피복',items:[['trainUniform','피복 현황'],['trainUniformRequests','피복 수정 요청']]},
 {title:'장비',items:[['trainSaber','예도 대여']]},
 {title:'종료',items:[['trainHandoff','일반학기 이관']]},
 {title:'일지',items:[['trainJournal','일자별 업무일지'],['trainCalendar','캘린더']]}
];
const placeholders=trainingGroups.flatMap(g=>g.items).filter(([id])=>!['train','trainJournal','trainCalendar'].includes(id));
export function trainingShellHtml(html){
 const menu=trainingGroups.map(g=>'<div class="v294-train-menu-section">'+g.title+'</div>'+g.items.map(([id,title])=>'<button type="button" class="nav-btn" data-training-quick="'+id+'">'+title+'</button>').join('')).join('');
 html=html.replace(/(<nav id="trainingSidebarMenuV294"[^>]*>)[\s\S]*?<\/nav>/,'$1'+menu+'</nav>');
 html=html.replace('<section id="trainView" class="hidden">','<section id="trainView" class="hidden"><div id="trainDashboardV473"></div>');
 html=html.replace('id="trainFoundationV289" class="v289-train-wrap"','id="trainFoundationV289" class="v289-train-wrap hidden"');
 const panels=placeholders.map(([id,title])=>'<section id="'+id+'View" class="hidden"><div class="panel"><h2>'+title+'</h2><p>인원 등록 후 구성 예정</p></div></section>').join('');
 html=html.replace('</main>',panels+'</main>');
 html=html.replace(/<button class="v294-mobile-training hidden"[^>]*data-training-quick="train">예비 명단<\/button>/,'');
 const mobile=placeholders.map(([id,title])=>'<button class="v294-mobile-training hidden" type="button" data-training-quick="'+id+'">'+title+'</button>').join('');
 return html.replace(/(<nav class="mobile-nav"[^>]*>)/,'$1'+mobile);
}
export function trainingShellJs(js){
 const ids=['train','trainJournal','trainCalendar',...placeholders.map(([id])=>id)],literal=JSON.stringify(ids);
 js=js.replaceAll("['train','trainJournal','trainCalendar']",literal)
 .replace("trainSharedModeV289=(v==='train'||v==='trainJournal'||v==='trainCalendar');",'trainSharedModeV289='+literal+'.includes(v);')
 .replace("if(v==='train')trainEnterV227();",'')
 .replace("if(id==='trainJournal'||id==='trainCalendar')id='train';",'if('+literal+'.includes(id))id=\'train\';');
 const names=placeholders.map(([id,title])=>id+':['+JSON.stringify('BASIC MILITARY TRAINING')+','+JSON.stringify(title)+',"성무기초군사훈련 전용 자료"],').join('');
 js=js.replace('const viewNames={','const viewNames={'+names)
 .replace("if(v==='access')v='staff';",'if(v284Scoped&&!trainingScopeV473&&'+literal+'.includes(v))v=\'today\';if(v===\'access\')v=\'staff\';')
 .replace("['uniformRequests','assetRequests','departures','today'",JSON.stringify(placeholders.map(([id])=>id)).slice(0,-1)+",'uniformRequests','assetRequests','departures','today'")
 .replace("v==='uniformRequests'||v==='assetRequests'",placeholders.map(([id])=>"v==='"+id+"'").join('||')+"||v==='uniformRequests'||v==='assetRequests'");
 return js.replace("badge.textContent='현재 근무: '+(v288ActiveTerm||'미설정');", "badge.textContent='현재 근무: '+(document.body.classList.contains('v294-training-mode')?'00기 성무기초군사훈련':v288ActiveTerm||'미설정');")
 .replace('const training='+literal+'.includes(v);','const training=(!v284Scoped||trainingScopeV473)&&'+literal+'.includes(v);')
 .replace("document.body.classList.toggle('v294-training-mode',training);", "document.body.classList.toggle('v294-training-mode',training);v288ShowActiveTerm(v288ActiveTerm);");
}
