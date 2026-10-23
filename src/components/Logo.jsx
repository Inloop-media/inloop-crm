export default function Logo({ compact = false }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/hero-logo.webp" alt="Inloop" className="h-auto w-9" />
      {!compact && (
        <span className="text-[17px] font-semibold leading-none tracking-tight">
          inloop <span className="text-muted">crm</span>
        </span>
      )}
    </span>
  );
}
