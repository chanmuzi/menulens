/** 대화 말풍선. 위 작은 줄(원문) → 가운데 큰 줄(읽을 사람의 언어) → 발음. 내 말은 오른쪽 종이색(누르면 크게 보여주기), 상대 말은 왼쪽 먹색 */
import type { TalkPair, TalkTurn } from '../types';
import { bubbleView } from '../lib/talk';

type Props = {
  readonly turn: TalkTurn;
  readonly pair: TalkPair;
  readonly showPron: boolean;
  /** 같은 사람이 이어 말한 마디면 위 간격을 좁힌다 */
  readonly joined: boolean;
  readonly onShow: (turn: TalkTurn) => void;
  readonly onRetry: (turn: TalkTurn) => void;
};

const fontOf = (lang: 'ko' | 'ja' | 'en') => (lang === 'ja' ? 'var(--font-jp)' : 'var(--font-ui)');

export const TalkBubble = ({ turn, pair, showPron, joined, onShow, onRetry }: Props) => {
  const v = bubbleView(turn, pair, showPron);
  const mine = turn.who === 'me';
  const waiting = turn.status === 'translating' && !v.main;
  const body = (
    <>
      <span lang={v.smallLang} style={{ fontSize: 12, lineHeight: 1.45, fontFamily: fontOf(v.smallLang), color: mine ? 'var(--muted)' : '#D9CCB4', overflowWrap: 'anywhere' }}>
        {turn.via === 'helper' ? '도우미가 추천한 문장' : v.small || '…'}
      </span>
      {turn.status === 'error' ? (
        <span style={{ fontSize: 14, color: mine ? 'var(--vermilion)' : '#F4B6A8' }}>번역하지 못했어요</span>
      ) : (
        <span lang={v.mainLang} style={{ fontFamily: fontOf(v.mainLang), fontWeight: 700, fontSize: mine ? 20 : 17, lineHeight: 1.45, overflowWrap: 'anywhere', opacity: waiting ? 0.6 : 1 }}>
          {waiting ? <>번역 중<span className="blink">▌</span></> : v.main}
        </span>
      )}
      {v.pron && <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--vermilion-dark)' }}>{v.pron}</span>}
    </>
  );
  const box = { maxWidth: '84%', display: 'flex', flexDirection: 'column' as const, gap: 3, padding: '9px 12px 10px', textAlign: 'left' as const };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 4, marginTop: joined ? 6 : 16 }}>
      {mine ? (
        <button type="button" onClick={() => onShow(turn)} disabled={turn.status !== 'done'} aria-label={`${v.main || v.small} 크게 보여주기`}
          style={{ ...box, background: 'var(--paper-2)', color: 'var(--ink)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', cursor: turn.status === 'done' ? 'pointer' : 'default', font: 'inherit' }}>
          {body}
        </button>
      ) : (
        <div style={{ ...box, background: 'var(--ink)', color: 'var(--paper)' }}>{body}</div>
      )}
      {turn.status === 'error' && (
        <button type="button" className="btn btn--quiet" onClick={() => onRetry(turn)} style={{ minHeight: 32, padding: '0 6px', color: 'var(--vermilion)' }}>다시 번역</button>
      )}
    </div>
  );
};
