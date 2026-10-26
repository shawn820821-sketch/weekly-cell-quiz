import { ImageResponse } from "next/og";

export const alt = "주간 셀 퀴즈 - 말씀을 복습하고 함께 성장하는 우리 셀";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{
      display:"flex",flexDirection:"column",justifyContent:"space-between",
      width:"100%",height:"100%",padding:"64px 76px",
      background:"#163249",color:"#fff",position:"relative",overflow:"hidden"
    }}>
      <div style={{
        display:"flex",alignItems:"center",gap:20
      }}>
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"center",
          width:74,height:74,borderRadius:22,background:"#D6A45B",
          fontSize:50,fontWeight:800,color:"#163249"
        }}>Q</div>
        <span style={{display:"flex",fontSize:27,fontWeight:700,letterSpacing:4,color:"#E9D1AA"}}>CELL WEEKLY</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <span style={{display:"flex",fontSize:90,fontWeight:800,letterSpacing:-3}}>WEEKLY QUIZ</span>
        <span style={{display:"flex",fontSize:34,color:"#ECD9B9"}}>GOD'S WORD, OUR DAILY LIFE</span>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          width:"100%",paddingTop:25,borderTop:"2px solid #526F80",fontSize:22,color:"#BBD0D8"}}>
        <span>Learn · Reflect · Grow</span>
        <span>weekly-cell-quiz.vercel.app</span>
      </div>
    </div>,
    size
  );
}
