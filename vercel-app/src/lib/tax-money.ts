// Decimal arithmetic: money is stored in integer cents; percentages are basis points.
export function moneyCents(value:string){
 if(!/^\d{1,11}(\.\d{1,2})?$/.test(value))throw new Error('Importe monetario inválido');
 const [integer,fraction='']=value.split('.');return Number(integer)*100+Number(fraction.padEnd(2,'0'));
}
export const decimalMoney=(cents:number)=>(cents/100).toFixed(2);
export function ratio(cents:number,numerator:number,denominator=10000){return Number((BigInt(cents)*BigInt(numerator)+BigInt(Math.floor(denominator/2)))/BigInt(denominator));}
export function xmlMicros(value:unknown){const v=String(value??'0');if(!/^\d{1,11}(\.\d{1,6})?$/.test(v))throw new Error('Importe del XML inválido');const [i,f='']=v.split('.');return BigInt(i)*BigInt(1000000)+BigInt(f.padEnd(6,'0'));}
export const microsMoney=(value:bigint)=>decimalMoney(Number((value+BigInt(5000))/BigInt(10000)));
