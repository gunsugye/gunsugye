export function saberDutyGroupV498(item){
 const unit=String(item.unit||'').normalize('NFKC').replace(/\s/g,'');
 if(unit==='전대')return '전대 근무';
 if(/^[12]대대$/.test(unit))return '대대 근무';
 if(/^[1-8]중대$/.test(unit))return '중대 근무';
 if(/동기회/.test(unit))return '동기회';
 if(/명예/.test(unit))return '명예위원회';
 if(/생발|생도생활발전/.test(unit))return '생도생활발전위원회';
 return item.group||unit||'기타 근무';
}
export function saberGroupsClientV498(source){
 const start=source.indexOf('function saberRenderV276(){'),end=source.indexOf('const saberTimersV277=',start);
 if(start<0||end<0)throw Error('예도 표시 함수 위치 확인');
 let render=source.slice(start,end);
 render=render.replace("const units=[...new Set(data.items.map(x=>x.unit))];","const units=[...new Set(data.items.map(saberDutyGroupV498))];")
 .replace('전체 조직','전체 근무').replace('(!unit||x.unit===unit)','(!unit||saberDutyGroupV498(x)===unit)')
 .replace("$('saberRowsV276').innerHTML=list.map(p=>{","const root=$('saberRowsV276'),open=new Set([...root.querySelectorAll('[data-saber-group][open]')].map(node=>node.dataset.saberGroup));\n const renderRowsV498=items=>items.map(p=>{");
 const marker=" $('saberInfoV276').textContent=";
 if(!render.includes(marker))throw Error('예도 명단 표시 위치 확인');
 render=render.replace(marker,` const groupNames=['전대 근무','대대 근무','중대 근무','동기회','명예위원회','생도생활발전위원회'];
 const groups=[...new Set(list.map(saberDutyGroupV498))].sort((a,b)=>(groupNames.indexOf(a)<0?99:groupNames.indexOf(a))-(groupNames.indexOf(b)<0?99:groupNames.indexOf(b)));
 root.innerHTML=groups.map(group=>{const items=list.filter(item=>saberDutyGroupV498(item)===group);return '<details data-saber-group="'+escapeH(group)+'" '+(open.has(group)||unit?'open':'')+' class="saber-duty-group-v498"><summary>'+escapeH(group)+' · '+items.length+'개 직책</summary><div class="eq-scroll"><table class="eq-table saber-table-v277"><thead><tr><th>조직</th><th>직책</th><th>상태</th><th>세부사항</th></tr></thead><tbody>'+renderRowsV498(items)+'</tbody></table></div></details>';}).join('')||'<p>검색 결과가 없습니다.</p>';
`+marker);
 return source.slice(0,start)+saberDutyGroupV498.toString()+'\n'+render+source.slice(end);
}
export function saberGroupsHtmlV498(html){
 return html.replace(/<div class="eq-scroll"><table class="eq-table saber-table-v277"><thead>[\s\S]*?<tbody id="saberRowsV276"><\/tbody><\/table><\/div>/,'<div id="saberRowsV276"></div>')
 .replace('aria-label="조직 선택"','aria-label="근무 선택"')
 .replace('placeholder="조직·직책·세부사항 검색"','placeholder="근무·직책·세부사항 검색"')
 .replace('</head>','<style>.saber-duty-group-v498{border:1px solid #dce4ef;border-radius:10px;padding:12px;margin:12px 0}.saber-duty-group-v498>summary{cursor:pointer;font-weight:700;padding:4px}.saber-duty-group-v498 .eq-scroll{margin-top:12px}</style></head>');
}
