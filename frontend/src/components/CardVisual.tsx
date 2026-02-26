/**
 * Wirex 스타일 카드 비주얼 컴포넌트
 * app.wirexapp.com Cards UI 참조
 */

import { useTranslation } from 'react-i18next';

export interface CardVisualProps {
  panLast4: string;
  status: 'active' | 'inactive' | 'blocked' | 'closed';
  currency: string;
  type?: 'virtual' | 'plastic';
  variant?: 'dark' | 'blue' | 'purple';
}

const VARIANTS = {
  dark: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
  blue: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1e40af 100%)',
  purple: 'linear-gradient(135deg, #2e1b4e 0%, #6b21a8 50%, #4c1d95 100%)',
};

export default function CardVisual({
  panLast4,
  status,
  currency,
  type = 'virtual',
  variant = 'dark',
}: CardVisualProps) {
  const { t } = useTranslation();
  const bg = VARIANTS[variant];

  return (
    <div
      className="card-visual"
      style={{ background: bg }}
    >
      <div className="card-visual-header">
        <span className="card-visual-brand">wirex</span>
        <span className={`card-visual-status badge badge-${status}`}>
          {t(`cards.status.${status}`)}
        </span>
      </div>
      <div className="card-visual-pan">•••• •••• •••• {panLast4}</div>
      <div className="card-visual-footer">
        <span className="card-visual-type">{type.toUpperCase()} · {currency}</span>
        <span className="card-visual-network">VISA</span>
      </div>
    </div>
  );
}
