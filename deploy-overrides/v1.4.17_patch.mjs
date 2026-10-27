import fs from "node:fs";
// Native form submit: pressing Enter and clicking the button use identical validated login flow.
const path="src/app/operator/page.tsx";
let s=fs.readFileSync(path,"utf8");
const replacements=[["<h1>운영자 로그인</h1><label>운영자","<h1>운영자 로그인</h1><form onSubmit={e=>{e.preventDefault();if(busy)return;if(currentOperator?.pinConfigured){if(pin.length===4)void login();}else if(setupCode.length===6&&newPin.length===4){void setup();}}}><label>운영자"],["<label>4자리 PIN<input inputMode=\"numeric\" maxLength={4} value={pin}","<label>4자리 PIN<input type=\"password\" autoComplete=\"current-password\" inputMode=\"numeric\" maxLength={4} value={pin}"],["<button className=\"primary\" disabled={busy||pin.length!==4} onClick={()=>void login()}>로그인</button>","<button type=\"submit\" className=\"primary\" disabled={busy||pin.length!==4}>로그인</button>"],["<button className=\"primary\" disabled={busy||newPin.length!==4||setupCode.length!==6} onClick={()=>void setup()}>PIN 만들고 시작</button>","<button type=\"submit\" className=\"primary\" disabled={busy||newPin.length!==4||setupCode.length!==6}>PIN 만들고 시작</button>"],[">PIN 만들고 시작</button></>}{error&&",">PIN 만들고 시작</button></>}</form>{error&&"]];
for(const [before,after] of replacements){
 if(!s.includes(before))throw new Error("OPERATOR_ENTER_LOGIN_ANCHOR_MISSING:"+before.slice(0,60));
 s=s.replace(before,after);
}
if(!s.includes('type="password" autoComplete="current-password"')||!s.includes('</form>{error&&'))
 throw new Error("OPERATOR_ENTER_LOGIN_POSTCHECK_FAILED");
fs.writeFileSync(path,s);
console.log("v1.4.17 operator PIN Enter-to-login form restored");
