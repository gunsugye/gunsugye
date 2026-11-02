export function dutyOrgKeyV372(p){const i=dutyRoleInfoV367(p);return i.organization==='중대'?(i.company?i.company+'중대':'중대 확인'):i.organization;}
export function dutyOrderRowsV372(rows){const sorted=dutySortV367(rows);return sorted.sort((a,b)=>{const x=Number.isFinite(a.manualOrder)&&a.orderGroup===dutyOrgKeyV372(a),y=Number.isFinite(b.manualOrder)&&b.orderGroup===dutyOrgKeyV372(b);return x&&y?a.manualOrder-b.manualOrder:x?-1:y?1:0;});}
export function dutyOrderSignatureV372(rows,group){return JSON.stringify(rows.filter(p=>dutyOrgKeyV372(p)===group).map(p=>[p.id,p.updatedAt||'']).sort((a,b)=>a[0].localeCompare(b[0])));}
import {dutyRoleInfoV367,dutySortV367} from './duty-roles.mjs';
