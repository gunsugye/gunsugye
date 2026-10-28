export function distributionExplanation(group,divisor){
 const full=Number(group.full)||0,remainder=Number(group.remainder)||0;
 if(!remainder)return full?full+'개를 나눠주면 돼요.':'나눠줄 물품이 없어요.';
 const portion=Number((remainder/divisor).toFixed(3));
 const approximate=Math.abs(portion-remainder/divisor)>1e-9?'약 ':'';
 return (full?full+'개를 나눠주고, ':'')+'남은 '+remainder+'명에게 '+approximate+portion+'개 분량이 더 필요해요.';
}
export function laborInterfaceJs(js){
 const stats=js.indexOf(" $('laborStatsV259').innerHTML="),review=js.indexOf(' // v2.97',stats);
 if(stats<0||review<0)throw Error('사역 요약 표시 위치를 확인하세요.');
 js=js.slice(0,stats)+' laborSummaryV324(result);\n'+js.slice(review);
 const table=js.indexOf(" $('laborTableV259').innerHTML=groups.map"),after=js.indexOf(' const virtualTransfers=',table);
 if(table<0||after<0)throw Error('사역 분배 표 위치를 확인하세요.');
 js=js.slice(0,table)+` $('laborTableV259').innerHTML=groups.map(g=>'<tr><td><strong>'+escapeH(g.label)+'</strong>'+(g.key==='호실 미확인'?' <button type="button" class="labor-review-inline-v297" data-review-open="missingRoom">이름 확인</button>':'')+'</td><td>'+laborFmtV259(g.count)+'명'+(g.allocationCount!==undefined&&g.allocationCount!==g.count?'<small class="labor-virtual-count-v268">짝 배정 반영: '+laborFmtV259(g.allocationCount)+'명분</small>':'')+'</td><td class="labor-quantity-v324"><b>'+laborFmtV259(g.quota)+'</b><span>개</span></td><td class="labor-how-v324">'+escapeH(laborExplanationV324(g,denom))+'</td></tr>').join('')||'<tr><td colspan="4">이 기준으로 나눠줄 대상이 없어요.</td></tr>';\n`+js.slice(after);
 const hook=js.lastIndexOf('})();');
 const extra=`
const laborExplanationV324=${distributionExplanation.toString()};
function laborSummaryV324(result){
 const groups=result.groups||[],people=groups.reduce((s,g)=>s+Number(g.count||0),0),quantity=groups.reduce((s,g)=>s+Number(g.quota||0),0),divisor=Number(result.divisor)||2;
 $('laborStatsV259').innerHTML='<div class="labor-answer-v324"><span>이번에 필요한 양</span><strong>'+laborFmtV259(quantity)+'<small>개</small></strong><p>'+laborFmtV259(people)+'명에게 '+divisor+'명당 1개씩 나눌 때의 계산이에요.</p></div><div class="labor-answer-note-v324"><b>아래에서 나눠줄 곳별 수량을 확인하세요.</b><p>0.5개는 반 개예요. 물품을 쪼갤 수 없다면 실제 지급할 개수는 ‘사역 내역’에서 정해주세요.</p></div>';
}
`;
 return js.slice(0,hook)+extra+js.slice(hook);
}
export const laborInterfaceCSS=`
#laborStatsV259{display:grid;grid-template-columns:minmax(190px,.7fr) minmax(220px,1.3fr);gap:16px;margin:20px 0}.labor-answer-v324{background:#eef5ff;border:1px solid #cadaef;border-radius:14px;padding:20px}.labor-answer-v324>span{font-size:14px;color:#435f82}.labor-answer-v324>strong{display:block;font-size:38px;color:#154a8a;line-height:1.4}.labor-answer-v324 strong small{font-size:18px;margin-left:6px}.labor-answer-v324 p,.labor-answer-note-v324 p{margin:8px 0 0;color:#52677d;line-height:1.7}.labor-answer-note-v324{padding:20px;align-self:center}.labor-quantity-v324{white-space:nowrap}.labor-quantity-v324 b{font-size:23px;color:#174f93;margin-right:5px}.labor-how-v324{line-height:1.7;min-width:180px}.labor-results-card .eq-table th{white-space:normal}.labor-results-card .eq-table td{padding:16px 12px}@media(max-width:650px){#laborStatsV259{grid-template-columns:1fr;gap:0}.labor-answer-note-v324{padding:16px 4px}.labor-results-card .eq-table td{padding:12px 8px}}
`;
