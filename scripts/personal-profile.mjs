export function personalDutyLayoutV404(order){
 const defaults=['room','firearm','duty','assets','uniform','supplies'],known=new Set(defaults),values=[...new Set([...(Array.isArray(order)?order:[]),...defaults])].filter(id=>known.has(id)),fixed=new Set(['room','firearm','duty','assets']);
 const before=values.slice(0,values.indexOf('room')).filter(id=>!fixed.has(id)).length,rest=values.filter(id=>!fixed.has(id));rest.splice(before,0,'room','firearm','duty','assets');return rest;
}
