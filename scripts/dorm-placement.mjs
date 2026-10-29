export function dormPlaceRoomV344(layout,room,target,after){
 const key=r=>[r.building,r.floor,String(r.room).split('-')[0]].join('|');
 if(room.building!==target.building||room.floor!==target.floor)throw Error('같은 관·층에서만 이동할 수 있습니다.');
 const anchor=layout.find(r=>key(r)===key(target));if(!anchor)throw Error('기준 방을 다시 선택하세요.');
 if(key(room)===key(target))throw Error('다른 방을 기준으로 선택하세요.');
 const next=layout.filter(r=>key(r)!==key(room)).map(r=>({...r}));
 const moved={...(layout.find(r=>key(r)===key(room))||room),page:anchor.page,y:anchor.y,x:anchor.x,width:anchor.width||.05,height:anchor.height||.1,unplaced:false};
 const band=next.filter(r=>r.page===anchor.page&&r.building===anchor.building&&r.floor===anchor.floor&&Math.abs(r.y-anchor.y)<.035).sort((a,b)=>a.x-b.x);
 const index=band.findIndex(r=>key(r)===key(target));band.splice(index+(after?1:0),0,moved);
 band.forEach((r,i)=>{r.x=(i+1)/(band.length+1);r.y=anchor.y;});next.push(moved);return next;
}
