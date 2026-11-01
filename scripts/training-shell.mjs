export const trainingGroups=[
 {title:'인원관리',items:[['trainPersonnel','인원관리']]},
 {title:'일지',items:[['trainJournal','일자별 업무일지'],['trainTasks','전체 업무 관리'],['trainStats','업무 통계'],['trainCalendar','캘린더']]},
 {title:'보급',items:[['trainSupply','군수품 관리']]},
 {title:'피복',items:[['trainUniform','피복 사이즈표'],['trainUniformRequests','피복 사이즈 수정 요청']]},
 {title:'급식',items:[['trainMeal','급식 관리']]},
 {title:'시설',items:[['trainEquipment','공용비품'],['trainRooms','생활실 인원 현황'],['trainRoomAssets','생활실 비품'],['trainAssetRequests','비품 수정 요청']]},
 {title:'장비',items:[['trainRoster','명단·총기 관리'],['trainSaber','예도 관리'],['trainRepairs','수리 필요 목록']]},
 {title:'행정',items:[['trainSurveys','조사 관리']]}
];
const placeholders=trainingGroups.flatMap(g=>g.items).filter(([id])=>!['trainJournal','trainCalendar'].includes(id));
export function trainingShellHtml(html){
 const menu=trainingGroups.map(g=>'<div class="v294-train-menu-section">'+g.title+'</div>'+g.items.map(([id,title])=>'<button type="button" class="nav-btn" data-training-quick="'+id+'">'+title+'</button>').join('')).join('');
 html=html.replace(/(<nav id="trainingSidebarMenuV294"[^>]*>)[\s\S]*?<\/nav>/,'$1'+menu+'</nav>');
 html=html.replace('<section id="trainView" class="hidden">','<section id="trainView" class="hidden"><div class="panel"><h2>성무기초군사훈련</h2><p>메뉴 구성 완료 · 인원 등록 전</p><button type="button" class="btn btn-primary" data-training-quick="trainPersonnel">인원관리</button></div>');
 html=html.replace('id="trainFoundationV289" class="v289-train-wrap"','id="trainFoundationV289" class="v289-train-wrap hidden"');
 const panels=placeholders.map(([id,title])=>'<section id="'+id+'View" class="hidden"><div class="panel"><h2>'+title+'</h2><p>인원 등록 후 구성 예정</p></div></section>').join('');
 html=html.replace('</main>',panels+'</main>');
 html=html.replace(/<button class="v294-mobile-training hidden"[^>]*data-training-quick="train">예비 명단<\/button>/,'');
 const mobile=placeholders.map(([id,title])=>'<button class="v294-mobile-training hidden" type="button" data-training-quick="'+id+'">'+title+'</button>').join('');
 return html.replace(/(<nav class="mobile-nav"[^>]*>)/,'$1'+mobile)
 .replace('data-train-nav="train">성무기초군사훈련','data-train-nav="train">00기 성무기초군사훈련')
 .replace('<h2>성무기초군사훈련</h2>','<h2>00기 성무기초군사훈련</h2>')
 .replace('aria-label="성무기초군사훈련 메뉴"','aria-label="00기 성무기초군사훈련 메뉴"')
 .replace('<button data-view="train">성무훈련</button>','<button data-view="train">00기 성무훈련</button>');
}
export function trainingShellJs(js){
 const ids=['train','trainJournal','trainCalendar',...placeholders.map(([id])=>id)],literal=JSON.stringify(ids);
 js=js.replaceAll("['train','trainJournal','trainCalendar']",literal)
 .replace("trainSharedModeV289=(v==='train'||v==='trainJournal'||v==='trainCalendar');",'trainSharedModeV289='+literal+'.includes(v);')
 .replace("if(v==='train')trainEnterV227();",'')
 .replace("if(id==='trainJournal'||id==='trainCalendar')id='train';",'if('+literal+'.includes(id))id=\'train\';');
 const names=placeholders.map(([id,title])=>id+':['+JSON.stringify('BASIC MILITARY TRAINING')+','+JSON.stringify(title)+',"인원 등록 전 · 메뉴 준비"],').join('');
 js=js.replace('const viewNames={','const viewNames={'+names)
 .replace("['uniformRequests','assetRequests','departures','today'",JSON.stringify(placeholders.map(([id])=>id)).slice(0,-1)+",'uniformRequests','assetRequests','departures','today'")
 .replace("v==='uniformRequests'||v==='assetRequests'",placeholders.map(([id])=>"v==='"+id+"'").join('||')+"||v==='uniformRequests'||v==='assetRequests'");
 return js.replace("train:['BASIC MILITARY TRAINING','성무기초군사훈련'","train:['BASIC MILITARY TRAINING','00기 성무기초군사훈련'")
 .replace("'성무기초군사훈련 · 업무일지'","'00기 성무기초군사훈련 · 업무일지'")
 .replace("'성무기초군사훈련 · 캘린더'","'00기 성무기초군사훈련 · 캘린더'")
 .replace("training?'훈련 업무 메뉴':'일반학기 메뉴'","training?'00기 성무기초군사훈련':'일반학기 메뉴'");
}
