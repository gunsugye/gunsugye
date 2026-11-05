import {dutyAssignmentKeyV391} from './duty-assignments.mjs';
export function dutyPasteV371(text){
 const rows=[],errors=[];let organization='',unit='',term='';for(const [i,raw] of String(text||'').normalize('NFKC').split(/\r?\n/).entries()){const line=raw.trim();if(!line)continue;if(/^<.*>$/.test(line)){term=line.slice(1,-1);continue;}const header=line.match(/^\[(.+)\]$/);if(header){const label=header[1].replace(/\s/g,'');unit=label.replace(/본부$/,'');organization=({'동기회':'동기회','명예위원회':'명예위','명예위':'명예위','생도생활발전위원회':'생발위','생발위':'생발위'})[unit]|| (unit==='전대'?'전대':/^[12]대대$/.test(unit)?unit:/^[1-8]중대$/.test(unit)?'중대':'');if(!organization)errors.push((i+1)+'행: 조직 확인');continue;}if(/^기수[\s,\t]+중대/.test(line))continue;
 const cells=line.split(/\t|,/).map(v=>v.trim());let cohort,company,name,duty;
 const structured=line.match(/^(.+?)[:：]\s*(\d{2,3})\s*\.\s*([1-8])\s*\.\s*(.+?)\s*$/);
 if(structured){[,duty,cohort,company,name]=structured;if(!organization){errors.push((i+1)+'행: 본부 제목 확인');continue;}if(organization==='중대'&&unit!==company+'중대'){errors.push((i+1)+'행: 본부와 소속 중대 불일치');continue;}duty=duty.startsWith(unit)?duty:unit+' '+duty;}
 else if(cells.length>=4)[cohort,company,name,...duty]=cells,duty=duty.join(' · ');
 else{const m=line.match(/^(\d{2,3})\s*기?\s*[·|/]?\s*([1-8])\s*중대\s*[·|/]?\s*([가-힣]{2,5}[A-D]?)\s*[·|/]?\s+(.+)$/);if(m)[,cohort,company,name,duty]=m;}
 cohort=String(cohort||'').replace(/(?:기)+$/,'').trim();company=String(company||'').replace(/(?:중대)+$/,'').trim();if(!/^\d{2,3}$/.test(cohort)||! /^[1-8]$/.test(company)||!name||!duty){errors.push((i+1)+'행: 기수 / 중대 / 이름 / 근무 확인');continue;}rows.push({cohort,company,name,duty,...(structured?{organization}: {})});
 }return {rows,errors,term};
}
export function dutyMatchV371(row,reference){
 const norm=v=>String(v||'').normalize('NFKC').replace(/\s/g,''),c=v=>norm(v).replace(/(?:기)+$/,''),u=v=>norm(v).replace(/(?:중대)+$/,''),name=norm(row.name),base=name.replace(/([가-힣])[A-D]$/,'$1');
 const scoped=reference.filter(p=>(!c(row.cohort)||c(row.cohort)===c(p.cohort))&&(!u(row.company)||u(row.company)===u(p.company))),exact=scoped.filter(p=>norm(p.name)===name);
 if(exact.length)return exact;const aliases=scoped.filter(p=>norm(p.name).replace(/([가-힣])[A-D]$/,'$1')===base&&(name===base||norm(p.name)===base));return aliases;
}
export function dutyMergeV371(pdf,paste){const used=new Set(),rows=[];for(const p of paste){const matches=dutyMatchV371({...p,cohort:'',company:''},pdf).filter(r=>(!r.cohort||String(r.cohort).normalize('NFKC').replace(/(?:기)+$/,'')===p.cohort)&&(!r.company||String(r.company).normalize('NFKC').replace(/(?:중대)+$/,'')===p.company)),roleMatches=matches.filter(r=>dutyAssignmentKeyV391({...r,cohort:p.cohort,company:p.company,name:p.name})===dutyAssignmentKeyV391(p)),candidates=roleMatches.length?roleMatches:matches,found=candidates.length===1?candidates[0]:null;if(found)used.add(found);rows.push({...found,...p,pdf:!!found,pasted:true,pdfStatus:candidates.length>1?'PDF 중복':found?(roleMatches.length?'일치':'근무 다름'):'PDF 없음'});}for(const p of pdf)if(!used.has(p))rows.push({...p,pdf:true,pasted:false,pdfStatus:'붙여넣기 없음'});return rows;}
