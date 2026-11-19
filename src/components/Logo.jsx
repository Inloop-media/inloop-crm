/* eslint-disable @next/next/no-img-element -- a small static image, sized by its parent */
// Inloop: the silver infinity mark (public/images/hero-logo.webp, same as the website) with "loop" next to it (the infinity reads as "in").
// On the light theme the silver mark is darkened a little (.logo-mark in globals.css) so it still reads.

const RATIO = 720 / 395; // the mark image's width / height

/** The infinity mark on its own. `size` is its width. */
export function InloopMark({ size = 40, className = "" }) {
  return <img src="/images/hero-logo.webp" alt="" width={size} height={Math.round(size / RATIO)} className={`logo-mark shrink-0 ${className}`} aria-hidden />;
}

export default function Logo({ compact = false, height = 28 }) {
  if (compact)
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center" aria-label="Inloop">
        <InloopMark size={30} />
      </span>
    );
  return (
    <span role="img" aria-label="Inloop" className="flex shrink-0 items-center" style={{ gap: height * 0.3, height }}>
      <InloopMark size={Math.round(height * 1.45)} />
      <span className="font-semibold leading-none tracking-[-0.03em] text-ink" style={{ fontSize: Math.round(height * 0.8) }}>
        loop
      </span>
    </span>
  );
}
