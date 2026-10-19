type Props = { readonly icon: string; readonly size?: number; readonly label?: string; readonly className?: string };

/** box-shadow 로 그린 16×16 픽셀 아이콘. size 는 픽셀 한 칸의 px 크기. */
export const PixelIcon = ({ icon, size = 4, label, className = '' }: Props) => (
  <div
    className={className}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    style={{ width: size * 16, height: size * 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', flexShrink: 0 }}
  >
    <div className={`px px-${icon}`} style={{ fontSize: size }} />
  </div>
);
