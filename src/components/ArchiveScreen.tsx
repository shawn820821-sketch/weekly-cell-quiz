export function ArchiveScreen({ items, onBack, onPractice }:{items:any[];onBack:()=>void;onPractice:(quizId:string)=>void}){
  return <>
    <div className="topbar"><button className="back" onClick={onBack}>←</button><strong>지난 퀴즈</strong><span /></div>
    <div className="archiveFilter"><span className="pill">전체 기록</span><span className="pill">Weekly + Special</span></div>
    <section className="section stackList">{items.length ? items.map((item:any)=><article className="archiveItem" key={item.quizId}><div className="archiveMeta"><span>{item.quizType === "SPECIAL" ? "SPECIAL" : item.periodName ?? "WEEKLY"}</span><small>{item.lifeDateRange || item.bibleRange || ""}</small></div><h3>{item.title}</h3>{item.official ? <div className="archiveResult"><strong>{item.official.score}점</strong><span>{item.official.correct}/{item.official.total} 정답</span></div> : <div className="archiveResult mutedResult"><strong>–</strong><span>미참여</span></div>}<button className="btn btnSecondary full" onClick={()=>onPractice(item.quizId)}>연습으로 풀기</button></article>) : <div className="emptyState">아직 지난 퀴즈가 없어요.</div>}</section>
  </>;
}
