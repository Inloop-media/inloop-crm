/**
 * Shown the moment a link is clicked, while the page loads: the same shape as the pages (a title, a row of
 * three numbers, the work on the left and a side column) in soft shimmering blocks.
 */
export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-8 w-64 max-w-full" />
      <div className="skeleton mt-2 h-4 w-44" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card flex flex-col gap-2.5 px-4 py-3.5">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          {[4, 3].map((rows, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-4 w-32" />
              {Array.from({ length: rows }, (_, j) => (
                <div key={j} className="mt-4 flex items-center gap-3">
                  <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
                  <div className="flex-1">
                    <div className="skeleton h-3.5 w-3/5" />
                    <div className="skeleton mt-1.5 h-3 w-2/5" />
                  </div>
                  <div className="skeleton h-3 w-14" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-5">
          {[3, 4].map((rows, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-4 w-28" />
              {Array.from({ length: rows }, (_, j) => (
                <div key={j} className="skeleton mt-4 h-3.5 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
