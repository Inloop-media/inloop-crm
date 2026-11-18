/** Kyro: the red lightning "K" mark (same shapes as public/kyro-mark.svg), with the lowercase wordmark. */
export function KyroMark({ size = 28, className = "" }) {
  return (
    <svg viewBox="0 0 433 384" width={size} height={(size * 384) / 433} className={className} fill="#E5303C" aria-hidden>
      <polygon points="0,0 128,0 128,117 68,210 243,180 128,297 128,384 0,384" />
      <polygon points="278,0 428,0 316,122 146,160" />
      <polygon points="278,197 433,384 283,384 200,277" />
    </svg>
  );
}

/** The full lockup (red K + "kyro") from public/kyro-logo-*.png. The word is a mask filled with the text colour,
 *  so it is white on the dark theme and near-black on the light one. */
const WORD = { WebkitMask: "url(/kyro-logo-word.png) center / contain no-repeat", mask: "url(/kyro-logo-word.png) center / contain no-repeat" };

export default function Logo({ compact = false, height = 28 }) {
  if (compact)
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center" aria-label="Kyro">
        <KyroMark size={26} />
      </span>
    );
  return (
    <span role="img" aria-label="Kyro" className="relative block shrink-0" style={{ height, width: (height * 1088) / 345 }}>
      <span className="absolute inset-0 bg-ink" style={WORD} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/kyro-logo-mark.png" alt="" className="absolute inset-0 h-full w-full" />
    </span>
  );
}
