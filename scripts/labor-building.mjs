export function laborBuildingHtml(html){return html.replace('<select id="laborDivisorV259"',`<label class="labor-building-switch"><input type="checkbox" id="laborByBuildingV357">관별 기준</label><div id="laborBuildingRatesV357" class="labor-building-rates hidden"></div><select id="laborDivisorV259"`).replace('<small>1개당 인원</small>','<small id="laborRateHelpV357">1개당 인원</small>');}
export function laborBuildingJs(js){
 js=js.replace("escapeH(g.label)+'</strong>'","escapeH(g.label)+'</strong>'+(result.buildingDivisors?'<small class=\"labor-virtual-count-v268\">'+g.divisor+'인 1개</small>':'')");
 js=js.replace('laborExplanationV324(g,denom)','laborExplanationV324(g,g.divisor||denom)');
 js=js.replace("['지급 기준',divisor+'명당 1개']","['지급 기준',result.buildingDivisors?'관별 기준':divisor+'명당 1개']");
 js=js.replace("$('laborGradeV261').value);laborShowV259(r);","$('laborGradeV261').value,laborBuildingInputV357());laborShowV259(r);");
 js=js.replace('function laborShowV259(result){','function laborShowV259(result){\n laborBuildingRenderV357(result);');
 js=js.replace('const denom=Number(result.divisor)||2;','const denom=laborPairDivisorV357(result);');
 js=js.replace("const locked=mode==='total';","const locked=mode==='total'||$('laborByBuildingV357').checked;\n $('laborByBuildingV357').disabled=mode==='total';if(mode==='total')$('laborByBuildingV357').checked=false;");
 js=js.replace("sel.title=locked?'총인원은", "sel.title=$('laborByBuildingV357').checked?'관별 지급 기준 적용 중':locked?'총인원은");
 js=js.replace("$('laborDimLockV262').textContent=locked?", "laborBuildingVisibilityV357();$('laborDimLockV262').textContent=$('laborByBuildingV357').checked?'관별 지급 기준 적용 · 분배 단위: 관별':locked?");
 js=js.replace("sel.value='company';\n }else if(sel.disabled)","sel.value=mode==='total'?'company':'building';\n }else if(sel.disabled)");
 js=js.replace("const ratio=$('laborDivisorV259').selectedOptions", "const ratio=laborBuildingInputV357()?Object.entries(laborBuildingInputV357()).map(([b,d])=>b+' '+d+'인 1개').join(' · '):$('laborDivisorV259').selectedOptions");
 js=js.replace("grade:$('laborGradeV261').value};}","grade:$('laborGradeV261').value,buildingDivisors:laborBuildingInputV357()};}");
 js=js.replace('divisor:laborResultV259.divisor,grade:laborResultV259.grade','divisor:laborResultV259.divisor,buildingDivisors:laborResultV259.buildingDivisors,grade:laborResultV259.grade');
 js=js.replaceAll("Number($('laborDivisorV259').value)===1","laborPairDivisorV357(laborResultV259)===1").replaceAll('Number(laborResultV259.divisor)===1','laborPairDivisorV357(laborResultV259)===1');
 js=js.replace("finally{laborLoadingV259=false;$('laborRefreshV259')", "finally{laborLoadingV259=false;laborBuildingBusyV357(false);$('laborRefreshV259')");
 js=js.replace("laborLoadingV259=true;$('laborRefreshV259')","laborLoadingV259=true;laborBuildingBusyV357(true);$('laborRefreshV259')");
 js=js.replace("$('laborRefreshV259').addEventListener('click',laborLoadV259);",`$('laborByBuildingV357').addEventListener('change',()=>{laborBuildingVisibilityV357();laborLoadV259();});
 $('laborBuildingRatesV357').addEventListener('change',laborLoadV259);
 $('laborRefreshV259').addEventListener('click',laborLoadV259);`);
 js=js.replace('laborSyncDimensionV262_();\nlet laborPairSavingV264', 'laborSyncDimensionV262_();\nlet laborPairSavingV264');
 const end=js.lastIndexOf('})();');return js.slice(0,end)+`
function laborBuildingInputV357(){if(!$('laborByBuildingV357').checked||$('laborModeV259').value==='total')return null;return Object.fromEntries(qsa('[data-labor-building]',$('laborBuildingRatesV357')).map(s=>[s.dataset.laborBuilding,Number(s.value)]));}
function laborPairDivisorV357(result){return result?.buildingDivisors?Math.max(1,...Object.values(result.buildingDivisors).map(Number)):Number(result?.divisor||$('laborDivisorV259').value)||2;}
function laborBuildingVisibilityV357(){const enabled=$('laborByBuildingV357').checked&&$('laborModeV259').value!=='total';$('laborBuildingRatesV357').classList.toggle('hidden',!enabled);$('laborDivisorV259').classList.toggle('hidden',enabled);$('laborRateHelpV357').textContent=enabled?'호실 미확인: '+$('laborDivisorV259').value+'인 1개':'1개당 인원';}
function laborBuildingRenderV357(result){
 const root=$('laborBuildingRatesV357'),previous=Object.fromEntries(qsa('[data-labor-building]',root).map(s=>[s.dataset.laborBuilding,s.value]));
 root.innerHTML=(result.buildings||[]).map(b=>'<label><span>'+escapeH(b)+'</span><select class="field" data-labor-building="'+escapeH(b)+'" aria-label="'+escapeH(b)+' 지급 기준">'+[1,2,3,4,5,6].map(d=>'<option value="'+d+'" '+(Number(result.buildingDivisors?.[b]||previous[b]||$('laborDivisorV259').value)===d?'selected':'')+'>'+d+'인 1개</option>').join('')+'</select></label>').join('');laborBuildingVisibilityV357();
}
function laborBuildingBusyV357(busy){['laborByBuildingV357','laborDivisorV259','laborGradeV261','laborModeV259'].forEach(id=>$(id).disabled=busy);qsa('[data-labor-building]').forEach(s=>s.disabled=busy);if(!busy)laborSyncDimensionV262_();}
`+js.slice(end);
}
export const laborBuildingCSS=`.labor-building-switch{display:flex;align-items:center;gap:7px;font-size:14px;margin-bottom:10px}.labor-building-switch input{width:18px;height:18px}.labor-building-rates{display:grid;gap:8px}.labor-building-rates label{display:grid;grid-template-columns:minmax(65px,1fr) minmax(105px,1fr);align-items:center;gap:8px;font-size:13px}.labor-building-rates .field{min-width:0}`;
