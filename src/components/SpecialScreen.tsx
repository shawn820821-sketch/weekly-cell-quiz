export function SpecialScreen({ specials, onBack, onStart }:{specials:any[];onBack:()=>void;onStart:(quizId:string)=>void}){
  return <>
    <div className="topbar"><button className="back" onClick={onBack}>←</button><strong>Special Quiz</strong><span /></div>
    <section className="specialHero"><div className="eyebrow gold">SPECIAL</div><h1>이번 시즌의<br/>특별 퀴즈</h1><p>정규 Weekly 점수와는 별도로 진행돼요.</p></section>
    <section className="section stackList">{specials.length ? specials.map((s:any)=><article className="specialCard" key={s.quizId}><div className="archiveMeta"><span>{s.specialMode}</span><small>{s.specialMode==="PASS"?(s.passed?"PASS 완료":`${s.passScore}점 이상 PASS`):s.specialMode==="RANKING"?"점수 순위형":"일반 참여형"}</small></div><h3>{s.title}</h3>{s.latestScore!==null && <p className="subtle">최근 점수 {s.latestScore}점 · {s.attemptCount}회 도전</p>}{s.specialMode==="PASS"&&s.passed ? <div className="passStamp">PASS</div> : s.canAttempt!==false ? <button className="btn btnPrimary full" onClick={()=>onStart(s.quizId)}>도전하기</button> : <div className="subtle">도전 가능 횟수를 모두 사용했어요.</div>}</article>) : <div className="emptyState">현재 진행 중인 Special Quiz가 없어요.</div>}</section>
  </>;
}
