export function distributionExplanation(group,divisor){
 const remainder=Number(group.remainder)||0;
 if(!remainder)return '—';
 const portion=Number((remainder/divisor).toFixed(3));
 const approximate=Math.abs(portion-remainder/divisor)>1e-9?'약 ':'';
 return remainder+'명 · '+approximate+portion+'개';
}
export function laborInterfaceJs(js){
 const stats=js.indexOf(" $('laborStatsV259').innerHTML="),review=js.indexOf(' // v2.97',stats);
 if(stats<0||review<0)throw Error('사역 요약 표시 위치를 확인하세요.');
 js=js.slice(0,stats)+' laborSummaryV324(result);\n'+js.slice(review);
 const table=js.indexOf(" $('laborTableV259').innerHTML=groups.map"),after=js.indexOf(' const virtualTransfers=',table);
 if(table<0||after<0)throw Error('사역 분배 표 위치를 확인하세요.');
 js=js.slice(0,table)+` $('laborTableV259').innerHTML=groups.map(g=>'<tr><td><strong>'+escapeH(g.label)+'</strong>'+(g.key==='호실 미확인'?' <button type="button" class="labor-review-inline-v297" data-review-open="missingRoom">명단</button>':'')+'</td><td>'+laborFmtV259(g.count)+'명'+(g.allocationCount!==undefined&&g.allocationCount!==g.count?'<small class="labor-virtual-count-v268">짝 반영 '+laborFmtV259(g.allocationCount)+'명분</small>':'')+'</td><td class="labor-quantity-v324"><b>'+laborFmtV259(g.quota)+'</b><span>개</span></td><td class="labor-how-v324">'+escapeH(laborExplanationV324(g,denom))+'</td></tr>').join('')||'<tr><td colspan="4">대상 없음</td></tr>';\n`+js.slice(after);
 const hook=js.lastIndexOf('})();');
 const extra=`
const laborExplanationV324=${distributionExplanation.toString()};
function laborSummaryV324(result){
 const groups=result.groups||[],people=groups.reduce((s,g)=>s+Number(g.count||0),0),quantity=groups.reduce((s,g)=>s+Number(g.quota||0),0),divisor=Number(result.divisor)||2;
 $('laborStatsV259').innerHTML=[['대상 인원',laborFmtV259(people)+'명'],['지급 기준',divisor+'명당 1개'],['총수량',laborFmtV259(quantity)+'개']].map(([label,value])=>'<div class="labor-answer-v324"><span>'+label+'</span><strong>'+value+'</strong></div>').join('');
}
`;
 return js.slice(0,hook)+extra+js.slice(hook);
}
export const laborInterfaceCSS=`
#laborStatsV259{display:grid;grid-template-columns:minmax(190px,.7fr) minmax(220px,1.3fr);gap:16px;margin:20px 0}.labor-answer-v324{background:#eef5ff;border:1px solid #cadaef;border-radius:14px;padding:20px}.labor-answer-v324>span{font-size:14px;color:#435f82}.labor-answer-v324>strong{display:block;font-size:38px;color:#154a8a;line-height:1.4}.labor-answer-v324 strong small{font-size:18px;margin-left:6px}.labor-answer-v324 p,.labor-answer-note-v324 p{margin:8px 0 0;color:#52677d;line-height:1.7}.labor-answer-note-v324{padding:20px;align-self:center}.labor-quantity-v324{white-space:nowrap}.labor-quantity-v324 b{font-size:23px;color:#174f93;margin-right:5px}.labor-how-v324{line-height:1.7;min-width:180px}.labor-results-card .eq-table th{white-space:normal}.labor-results-card .eq-table td{padding:16px 12px}@media(max-width:650px){#laborStatsV259{grid-template-columns:1fr;gap:0}.labor-answer-note-v324{padding:16px 4px}.labor-results-card .eq-table td{padding:12px 8px}}
#laborStatsV259{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}.labor-answer-v324{padding:14px;border-radius:10px}.labor-answer-v324>span{font-size:12px}.labor-answer-v324>strong{font-size:24px;margin-top:5px}.labor-how-v324{min-width:100px}.labor-results-card .eq-table td{padding:12px}@media(max-width:450px){.labor-answer-v324{padding:10px}.labor-answer-v324>strong{font-size:18px}}
`;
