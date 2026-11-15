/** The Inloop mark in a solid rounded square (reads on light and dark), with the product name. */
export default function Logo({ compact = false }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-logo.webp" alt="Inloop" className="h-auto w-6" />
      </span>
      {!compact && (
        <span className="text-[16px] font-semibold leading-none tracking-tight">
          inloop <span className="font-normal text-muted">crm</span>
        </span>
      )}
    </span>
  );
}
