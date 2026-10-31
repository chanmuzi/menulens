import type { ko } from '../ko';
import { common } from './common';
import { data } from './data';
import { home } from './home';
import { history } from './history';
import { confirm } from './confirm';
import { processing } from './processing';
import { result } from './result';
import { order } from './order';
import { chat } from './chat';
import { talk } from './talk';
import { lib } from './lib';
import { tips } from './tips';
import { app } from './app';

/** 일본어 사전. 한국어 사전과 키가 같아야 한다 */
export const ja: typeof ko = { common, data, home, history, confirm, processing, result, order, chat, talk, lib, tips, app };
