/** Shown while a page loads: the page's shape in soft shimmering blocks. */
export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-3 h-11 w-72 max-w-full" />
      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(300px,1fr)_2.3fr]">
        <div className="card flex flex-col gap-3 p-6">
          <div className="skeleton h-5 w-44" />
          <div className="skeleton h-11 w-full rounded-full" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 w-full rounded-[24px]" />
          ))}
        </div>
        <div className="flex flex-col gap-5">
          <div className="card p-6">
            <div className="skeleton h-5 w-36" />
            <div className="skeleton mt-6 h-52 w-full rounded-2xl" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="card flex flex-col gap-3 p-6">
                <div className="skeleton h-5 w-32" />
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
                    <div className="skeleton h-4 flex-1" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
