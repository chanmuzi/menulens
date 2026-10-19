/**
 * 초대 코드 게이트.
 * ACCESS_CODES="code1,code2" 환경변수에 등록된 코드만 통과한다.
 * 배포 환경(VERCEL 변수 존재)에서 ACCESS_CODES 가 비어 있으면 모두 거부한다.
 * 로컬 개발에서만 미설정 시 통과를 허용한다.
 */
const parseCodes = (raw: string | undefined): readonly string[] =>
  (raw ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0);

export const isAllowed = (code: string | null): boolean => {
  const codes = parseCodes(process.env.ACCESS_CODES);
  const deployed = Boolean(process.env.VERCEL);
  if (codes.length === 0) return !deployed;
  return code !== null && codes.includes(code.trim());
};

export const codeFrom = (req: Request): string | null => req.headers.get('x-access-code');
