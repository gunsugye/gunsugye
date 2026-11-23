import {insertAppClient} from './app-client.mjs';
export function surveyHistoryClientV528(source,client){
 source=source.replace('const NAV_BUILTIN_V233=[',"const NAV_BUILTIN_V233=['surveyRecords',")
  .replace('const viewNames={',"const viewNames={surveyRecords:['SURVEY RECORDS','전수조사 기록','항목별 조사 기간과 응답 기록을 확인합니다.'],")
  .replace('function navInitV220(){',"function navInitV220(){const surveyRecordsButtonV528=document.createElement('button');surveyRecordsButtonV528.type='button';surveyRecordsButtonV528.className='nav-btn';surveyRecordsButtonV528.dataset.view='surveyRecords';surveyRecordsButtonV528.textContent='전수조사 기록';$('sidebarMenu').appendChild(surveyRecordsButtonV528);")
  .replace('function switchView(v){firearmsInitV410();',"function switchView(v){firearmsInitV410();if(v==='surveyRecords')queueMicrotask(()=>{if(view==='surveyRecords')surveyHistoryLoadV528();});");
 return insertAppClient(source,client);
}
export function surveyHistoryHtmlV528(html){return html.replace('</main>','<section id="surveyRecordsView" class="hidden"><div class="panel"><div class="panel-head"><h2>전수조사 기록</h2><button id="surveyRecordsRefreshV528" class="btn" type="button">새로고침</button></div><p>항목과 조사 기간을 선택하면 응답 인원과 저장 이력을 확인할 수 있습니다.</p><div class="supply-actions"><select id="surveyRecordsKindV528" class="field" aria-label="전수조사 항목"><option value="duty">근무생도 물품</option><option value="uniform">피복 사이즈</option><option value="asset">생활실 비품</option><option value="firearm">총기</option></select><select data-survey-period class="field" aria-label="전수조사 기간"></select><input data-survey-search type="search" class="field" placeholder="기수·중대·이름 검색"></div><p id="surveyRecordsStatusV528" role="status"></p><p data-survey-count></p><div data-survey-records></div></div></section></main>');}
