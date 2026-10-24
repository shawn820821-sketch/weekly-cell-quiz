/** Monthly settlement is determined ONLY by the Sunday on/after a weekly quiz's
 * scheduled end, in Asia/Seoul. Quiz sheet name and calendar month are irrelevant. */
const ZONE = "Asia/Seoul";

function seoulYmd(input:Date|string){
 const date = typeof input==="string"?new Date(input):input;
 if(!Number.isFinite(date.getTime()))throw new Error("Invalid settlement date");
 const p=new Intl.DateTimeFormat("en-GB",{
  timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(date);
 const get=(type:string)=>Number(p.find(x=>x.type===type)?.value);
 return {year:get("year"),month:get("month"),day:get("day")};
}
function isoDate(utcMs:number){return new Date(utcMs).toISOString().slice(0,10);}
export function lastSundayOfMonth(year:number,month:number):string{
 const last=new Date(Date.UTC(year,month,0));
 last.setUTCDate(last.getUTCDate()-last.getUTCDay());
 return isoDate(last.getTime());
}
export function monthCycleBounds(month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error("Invalid settlement month");
 const [year,m]=month.split("-").map(Number);
 const prev=lastSundayOfMonth(year,m-1);
 return {
  month,
  startsOn:isoDate(Date.parse(prev+"T00:00:00Z")+86400000),
  endsOn:lastSundayOfMonth(year,m)
 };
}
export function settlementSunday(input:Date|string):string{
 const {year,month,day}=seoulYmd(input);
 const date=new Date(Date.UTC(year,month-1,day));
 date.setUTCDate(date.getUTCDate()+(7-date.getUTCDay())%7);
 return isoDate(date.getTime());
}
export function settlementMonthForDate(input:Date|string):string{
 return settlementSunday(input).slice(0,7);
}
export function settlementMonthForQuiz(closeAt:string|null):string|null{
 return closeAt?settlementMonthForDate(closeAt):null;
}
export function isSettlementMonthClosed(month:string,now:Date=new Date()):boolean{
 const {endsOn}=monthCycleBounds(month);
 // 00:00 KST Monday immediately following the last Sunday.
 return now.getTime()>=Date.parse(endsOn+"T15:00:00.000Z");
}
