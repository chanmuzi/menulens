/** 서버가 오류 상태를 돌려줌. 분석·챗·통역 세 클라이언트가 같이 쓴다. 401 은 초대 코드 만료이고 화면은 문구가 아니라 status 로 판별한다 */
import { dict } from '../i18n';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(status === 401 ? dict().common.accessCodeInvalid : dict().common.serverError(status));
    this.status = status;
  }
}

/** 초대 코드가 더 이상 유효하지 않음(401) → 게이트로 */
export const isAccessCodeError = (e: unknown): boolean => e instanceof ApiError && e.status === 401;

/** 응답 본문이 없을 때 */
export const emptyResponseError = (): Error => new Error(dict().common.emptyResponse);
