export function personalDutyLayoutV404(order){
 const defaults=['room','firearm','duty','assets','uniform','supplies'],known=new Set(defaults);
 return [...new Set([...(Array.isArray(order)?order:[]),...defaults])].filter(id=>known.has(id));
}
