/** The Inloop mark in a solid rounded square (reads on light and dark), with the product name. */
export default function Logo({ compact = false }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand shadow-[0_8px_20px_-8px_rgb(232_101_79/0.9)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-logo.webp" alt="Inloop" className="h-auto w-7" />
      </span>
      {!compact && (
        <span className="text-lg font-semibold leading-none tracking-tight">
          inloop <span className="font-normal text-muted">crm</span>
        </span>
      )}
    </span>
  );
}
