// node 테스트용: api/_lib 의 `./x.js` import 를 같은 자리의 x.ts 로 푼다(Vercel 빌드 관례는 .js). 사용: node --experimental-strip-types --import ./scripts/bench/register-ts.mjs --test <파일>
import { register } from 'node:module';
register('./ts-resolver.mjs', import.meta.url);
