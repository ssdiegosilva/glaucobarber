import type { CardBrand } from "@/lib/card-fees";

function MastercardLogo({ size = 28 }: { size?: number }) {
  const r = size * 0.36;
  const cx1 = size * 0.38;
  const cx2 = size * 0.62;
  const cy = size / 2;
  return (
    <svg width={size} height={size * 0.63} viewBox={`0 0 ${size} ${size * 0.63}`} xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx1} cy={cy * 0.63} r={r} fill="#EB001B" />
      <circle cx={cx2} cy={cy * 0.63} r={r} fill="#F79E1B" />
      <path
        d={`M${size / 2},${cy * 0.63 - r * 0.68} a${r},${r} 0 0,1 0,${r * 1.36} a${r},${r} 0 0,1 0,-${r * 1.36}z`}
        fill="#FF5F00"
      />
    </svg>
  );
}

function VisaLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.35} viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%"
        y="13"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontStyle="italic"
        fontSize="15"
        fill="#1A1F71"
        letterSpacing="1"
      >
        VISA
      </text>
    </svg>
  );
}

function EloLogo({ size = 28 }: { size?: number }) {
  const w = size * 1.4;
  const h = size * 0.63;
  return (
    <svg width={w} height={h} viewBox="0 0 56 26" xmlns="http://www.w3.org/2000/svg">
      {/* e */}
      <circle cx="10" cy="13" r="8" fill="none" stroke="#FFD700" strokeWidth="3.5" />
      <rect x="2.5" y="11" width="9" height="3" fill="#FFD700" />
      {/* l */}
      <rect x="22" y="3" width="3.5" height="20" rx="1.5" fill="#FFD700" />
      {/* o */}
      <circle cx="41" cy="13" r="8" fill="none" stroke="#FFD700" strokeWidth="3.5" />
    </svg>
  );
}

function AmexLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size * 1.4} height={size * 0.45} viewBox="0 0 56 18" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%"
        y="13"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="13"
        fill="#2E77BC"
        letterSpacing="0.5"
      >
        AMEX
      </text>
    </svg>
  );
}

export function CardBrandLogo({ brand, size = 28 }: { brand: CardBrand; size?: number }) {
  switch (brand) {
    case "MASTERCARD": return <MastercardLogo size={size} />;
    case "VISA":       return <VisaLogo size={size} />;
    case "ELO":        return <EloLogo size={size} />;
    case "AMEX":       return <AmexLogo size={size} />;
  }
}
