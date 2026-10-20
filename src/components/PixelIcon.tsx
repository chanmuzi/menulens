import { gridToShadow } from '../lib/pixel';

type Props = { readonly icon: string; readonly size?: number; readonly label?: string; readonly className?: string; /** 생성된 격자가 있으면 CSS 클래스 대신 이걸 그린다 */ readonly grid?: readonly string[] | null };

/** box-shadow 로 그린 16×16 픽셀 아이콘. size 는 픽셀 한 칸의 px 크기. */
export const PixelIcon = ({ icon, size = 4, label, className = '', grid = null }: Props) => (
  <div
    className={className}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    style={{ width: size * 16, height: size * 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', flexShrink: 0 }}
  >
    {grid ? <div className="px" style={{ fontSize: size, boxShadow: gridToShadow(grid) }} /> : <div className={`px px-${icon}`} style={{ fontSize: size }} />}
  </div>
);
