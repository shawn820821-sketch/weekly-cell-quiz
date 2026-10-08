import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseRest } from "@/lib/supabase/rest";

const COOKIE = "wcq_operator";
const SESSION_SECONDS = 60 * 60 * 8;

type RoleRow = { role: "PARTICIPANT" | "LEADER" | "ADMIN"; target_group_id: string | null };
type CredentialRow = { person_id: string; pin_hash: string; failed_attempts: number; locked_until: string | null };
type SessionPayload = { personId: string; roles: RoleRow[]; exp: number };

function secret() {
  const value = process.env.OPERATOR_SESSION_SECRET;
  if (!value) throw new Error("OPERATOR_SESSION_SECRET is not configured.");
  return value;
}

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function hashPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string) {
  const [kind, salt, expected] = stored.split(":");
  if (kind !== "scrypt" || !salt || !expected || !/^\d{4}$/.test(pin)) return false;
  const actual = scryptSync(pin, salt, 32);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
}

export function hashSetupCode(code: string) {
  return createHmac("sha256", secret()).update(`setup:${code}`).digest("hex");
}

export async function getActiveRoles(personId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return supabaseRest<RoleRow[]>(`roles?person_id=eq.${personId}&starts_on=lte.${today}&or=(ends_on.is.null,ends_on.gte.${today})&role=in.(LEADER,ADMIN)&select=role,target_group_id`);
}

export async function createOperatorSession(personId: string) {
  const roles = await getActiveRoles(personId);
  if (!roles.length) throw new Error("운영자 권한이 없습니다.");
  const payload: SessionPayload = { personId, roles, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
  const encoded = encode(payload);
  const token = `${encoded}.${sign(encoded)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS });
  return payload;
}

export async function clearOperatorSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getOperatorSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getOperatorSession();
  if (!session) throw new Error("ADMIN_REQUIRED");
  const roles = await getActiveRoles(session.personId);
  if (!roles.some((r) => r.role === "ADMIN")) throw new Error("ADMIN_REQUIRED");
  return { ...session, roles };
}

export async function requireOperator() {
  const session = await getOperatorSession();
  if (!session) throw new Error("OPERATOR_REQUIRED");
  const roles = await getActiveRoles(session.personId);
  if (!roles.length) throw new Error("OPERATOR_REQUIRED");
  return { ...session, roles };
}

export async function getCredential(personId: string) {
  const rows = await supabaseRest<CredentialRow[]>(`operator_credentials?person_id=eq.${personId}&select=person_id,pin_hash,failed_attempts,locked_until`);
  return rows[0] ?? null;
}
