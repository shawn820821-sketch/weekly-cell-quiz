import type { Group, Person } from "@/domain/types";
export function SettingsScreen({person,group,onBack,onChangeUser}:{person:Person;group:Group;onBack:()=>void;onChangeUser:()=>void}){return <><div className="screenHeader"><button className="back" onClick={onBack}>←</button><div><small>SETTINGS</small><h1>설정</h1></div></div>
<section className="section card"><div className="eyebrow">내 정보</div><h2>{person.name}</h2><p className="subtle">{group.name}</p><button className="btn btnSecondary full" onClick={onChangeUser}>사용자 변경</button></section>
<section className="section card"><div className="eyebrow">이용 안내</div><p className="subtle">첫 공식 제출만 주간·월간 기록에 반영됩니다. 다시 풀기는 연습으로 기록됩니다.</p></section>
<section className="section card"><div className="eyebrow">운영</div><a className="btn btnPrimary full" href="/operator">운영자 모드</a></section>
<section className="section card"><div className="eyebrow">정보</div><p className="subtle">주간 셀 퀴즈 · v1.0 QA Fix</p></section></>};
