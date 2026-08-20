export const formatClp=(value:number|null|undefined):string=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value??0);
