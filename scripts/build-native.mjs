/** Private generated business module: contains existing embedded roster seeds. Never publish it. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const source=readFileSync('apps-script/Legacy.gs','utf8');
const marker='function pagesCreateLegacy_(pagesActor_) {';
if(!source.includes(marker))throw Error('Business factory missing');
let code=source.slice(source.indexOf(marker));
code=code.replace(marker,'export function createBusiness(pagesActor_, pagesStorage_, services) {\nconst {Utilities,LockService,ScriptApp,Session,UrlFetchApp,FormApp,HtmlService,pagesStorageRpc_,pagesNativeFormBook_,Date}=services;\nfunction pagesForbidden_(){const e=Error("접근 권한이 없습니다.");e.pagesCode="FORBIDDEN";throw e;}');
code=code.replace('const pagesStorage_ = pagesStorageContext_(pagesActor_);','');
if(code.includes('pagesStorageContext_('))throw Error('Apps Script runtime dependency remains');
mkdirSync('.deploy/native',{recursive:true});
writeFileSync('.deploy/native/business.mjs',code);
writeFileSync('.deploy/native/methods.json',readFileSync('apps-script/methods.json'));
console.log('Private independent business module generated');
