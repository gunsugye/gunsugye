import {dutyRoleInfoV367} from './duty-roles.mjs';

export function dutySplitAssignmentsV391(value){
 const duty=String(value||'').trim(),parts=duty.split(/\s*[,，·;\/\r\n]+\s*/).filter(Boolean);
 const complete=text=>/중대임원|여생도임원|보좌관|중대기수|편대장|중대장|전대장|대대장|참모|회장|총무|위원장|위원|친목활동부장/.test(text.normalize('NFKC').replace(/\s/g,''));
 return parts.length>1&&parts.every(complete)?parts:[duty];
}

export function dutyFixedRolesV391(organization){
 const staff=['작전','인사','군수','체육','문화활동'];
 if(organization==='전대')return ['전대장',...staff.map(name=>'전대'+name+'참모'),...staff.map(name=>name+'참모보좌관')];
 if(/^[12]대대$/.test(organization))return [organization+'장',...staff.map(name=>organization+name+'참모')];
 return [];
}

export function dutyFixedRoleValidV391(row){
 const organization=dutyRoleInfoV367(row).organization,roles=dutyFixedRolesV391(organization);if(!roles.length)return true;
 const norm=value=>String(value||'').normalize('NFKC').replace(/\s|생도/g,'').replace(/(?:1st|2nd)$/i,'').replace(new RegExp('^'+organization),'').replace(organization==='전대'?/^전대장$/:/^대대장$/,'장').replace(/문화참모/,'문화활동참모');
 return roles.some(role=>norm(role)===norm(row.duty));
}

export function dutyAssignmentKeyV391(row){
 const norm=value=>String(value||'').normalize('NFKC').replace(/\s/g,''),info=dutyRoleInfoV367(row),unit=info.organization==='중대'?(info.company?info.company+'중대':'중대'):info.organization;
 let role=norm(row.duty).replace(/생도/g,'').replace(/(?:1st|2nd)$/i,'').replace(new RegExp('^'+unit),'').toLowerCase();if(['전대','1대대','2대대'].includes(info.organization))role=role.replace(info.organization==='전대'?/^전대장$/:/^대대장$/,'장').replace(/문화참모/,'문화활동참모');
 return JSON.stringify([norm(row.cohort).replace(/(?:기)+$/,''),norm(row.company).replace(/(?:중대)+$/,''),norm(row.name),unit,role]);
}
