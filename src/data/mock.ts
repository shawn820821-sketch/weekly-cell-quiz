import type { Group, QuizDefinition, ReviewQuestion } from "@/domain/types";

export const groups: Group[] = [
  { id: "g1", name: "이유신님 셀", members: [
    { id: "p1", name: "김민수", leader: true, active: true },
    { id: "p2", name: "박지훈", active: true },
    { id: "p3", name: "이서연", active: true },
    { id: "p4", name: "이정민", active: true },
    { id: "p5", name: "정다은", active: true },
  ]},
  { id: "g2", name: "김민수님 셀", members: [
    { id: "p6", name: "최유진", leader: true, active: true },
    { id: "p7", name: "한지수", active: true },
    { id: "p8", name: "윤하늘", active: true },
  ]},
  { id: "g3", name: "박지현님 셀", members: [
    { id: "p9", name: "박지현", leader: true, active: true },
    { id: "p10", name: "조은별", active: true },
  ]},
];

export const weeklyQuiz: QuizDefinition & { questions: ReviewQuestion[] } = {
  id: "weekly-2026-10-2",
  title: "10월 둘째 주 주간 셀 퀴즈",
  subtitle: "지난주 말씀 돌아보기",
  lifeDateRange: "생명의삶 10월 1일–7일",
  bibleRange: "마태복음 5:1–7:29",
  questions: [
    { id:"q1", type:"MCQ", text:"예수님께서 제자들에게 ‘너희는 세상의 무엇’이라고 말씀하셨나요?", source:"마태복음 5:14", choices:["소금","빛","양","포도나무"], answerIndex:1, explanation:"예수님은 제자들을 ‘세상의 빛’이라고 부르셨습니다. 빛은 감추기보다 사람들 앞에서 하나님을 드러내는 삶을 가리킵니다." },
    { id:"q2", type:"OX", text:"예수님은 원수를 사랑하고 박해하는 사람을 위해 기도하라고 말씀하셨다.", source:"마태복음 5:44", choices:["O","X"], answerIndex:0, explanation:"마태복음 5장 44절에서 예수님은 원수를 사랑하고 박해하는 자를 위하여 기도하라고 가르치십니다." },
    { id:"q3", type:"MCQ", text:"예수님이 기도를 가르치시며 ‘오늘 우리에게’ 달라고 하신 것은 무엇인가요?", source:"마태복음 6:11", choices:["재물","지혜","일용할 양식","표적"], answerIndex:2, explanation:"주기도문에는 ‘오늘 우리에게 일용할 양식을 주시옵고’라고 기록되어 있습니다." },
    { id:"q4", type:"OX", text:"예수님은 보물을 땅에만 쌓아 두라고 말씀하셨다.", source:"마태복음 6:19-20", choices:["O","X"], answerIndex:1, explanation:"예수님은 땅이 아니라 하늘에 보물을 쌓으라고 말씀하셨습니다." },
    { id:"q5", type:"MCQ", text:"‘먼저 그의 나라와 그의 의를 구하라’는 말씀은 어느 장에 나오나요?", source:"마태복음 6:33", choices:["마태복음 4장","마태복음 5장","마태복음 6장","마태복음 7장"], answerIndex:2, explanation:"마태복음 6장 33절의 말씀입니다. 필요에 대한 염려보다 하나님의 나라와 의를 우선하라는 가르침입니다." },
    { id:"q6", type:"MCQ", text:"예수님은 다른 사람을 판단하기 전에 먼저 무엇을 보라고 하셨나요?", source:"마태복음 7:3-5", choices:["그의 열매","자기 눈 속의 들보","율법책","성전"], answerIndex:1, explanation:"형제의 눈 속 티를 말하기 전에 자기 눈 속 들보를 먼저 보라고 하셨습니다." },
    { id:"q7", type:"OX", text:"예수님은 ‘구하라, 찾으라, 두드리라’고 말씀하셨다.", source:"마태복음 7:7", choices:["O","X"], answerIndex:0, explanation:"마태복음 7장 7절에 ‘구하라… 찾으라… 두드리라’는 권면이 이어집니다." },
    { id:"q8", type:"MCQ", text:"예수님이 말씀하신 황금률에 가장 가까운 것은 무엇인가요?", source:"마태복음 7:12", choices:["받은 만큼만 돌려준다","남이 해주길 바라는 대로 남에게 한다","악한 사람은 피한다","모든 판단을 멈춘다"], answerIndex:1, explanation:"‘무엇이든지 남에게 대접을 받고자 하는 대로 너희도 남을 대접하라’는 말씀입니다." },
    { id:"q9", type:"OX", text:"좁은 문과 좁은 길은 생명으로 인도한다고 예수님이 말씀하셨다.", source:"마태복음 7:13-14", choices:["O","X"], answerIndex:0, explanation:"예수님은 생명으로 인도하는 문은 좁고 길이 협착하다고 말씀하셨습니다." },
    { id:"q10", type:"MCQ", text:"산상수훈의 마지막 비유에서 말씀을 듣고 행하는 사람은 어디에 집을 지은 사람과 같나요?", source:"마태복음 7:24", choices:["모래 위","들판","반석 위","산꼭대기"], answerIndex:2, explanation:"말씀을 듣고 행하는 사람은 반석 위에 집을 지은 지혜로운 사람과 같다고 하셨습니다." },
  ],
};
