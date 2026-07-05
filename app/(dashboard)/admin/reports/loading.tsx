export default function ReportsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded bg-gray-200" />
        <div className="h-4 w-64 rounded bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-white border border-[#E0E3E5]" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-white border border-[#E0E3E5]" />
    </div>
  )
}
