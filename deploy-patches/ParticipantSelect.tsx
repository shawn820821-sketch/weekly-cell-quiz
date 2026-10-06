import type { Group, Person } from "@/domain/types";
import { Brand } from "@/components/Brand";

type Props = {
  groups: Group[];
  groupId: string;
  onGroup: (id: string) => void;
  onPerson: (person: Person) => void;
};

export function ParticipantSelect({ groups, groupId, onGroup, onPerson }: Props) {
  const group = groups.find((item) => item.id === groupId) ?? groups[0] ?? null;

  return <>
    <Brand />
    <section className="hero">
      <h1>내 이름을<br />선택해주세요</h1>
      <p>참여할 셀을 먼저 선택한 뒤, 이름을 선택해주세요.</p>
      <div className="verse">“주의 말씀은 내 발에 등이요…”</div>
    </section>

    {groups.length === 0 || !group ? (
      <section className="section">
        <div className="sectionTitle"><h2>아직 등록된 셀이 없어요</h2></div>
        <p className="emptyState">관리자에서 셀과 참여자를 등록하면 이곳에 표시됩니다.</p>
      </section>
    ) : (
      <>
        <section className="section">
          <div className="sectionTitle"><h2>셀 선택</h2><span>{groups.length}개 셀</span></div>
          <div className="cellTabs">
            {groups.map((item) => <button key={item.id} className={`tab ${item.id === groupId ? "active" : ""}`} onClick={() => onGroup(item.id)}>{item.name}</button>)}
          </div>
        </section>
        <section className="section">
          <div className="sectionTitle"><h2>{group.name}</h2><span>리더 우선 · 가나다순</span></div>
          <div className="people">
            {group.members.length === 0 ? (
              <p className="emptyState">이 셀에 등록된 참여자가 아직 없습니다.</p>
            ) : group.members.map((member) => <button key={member.id} className={`person ${member.leader ? "leader" : ""}`} onClick={() => onPerson(member)}>
              <span>{member.name} <span className="meta">{member.leader ? "셀 리더" : ""}</span></span><span>›</span>
            </button>)}
          </div>
        </section>
      </>
    )}
  </>;
}
