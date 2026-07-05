export default function PatientsLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded bg-gray-200" />
          <div className="h-4 w-56 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-32 rounded-md bg-gray-200" />
      </div>
      {/* Search bar */}
      <div className="h-11 w-full rounded-md bg-gray-100 border border-[#E0E3E5]" />
      {/* Stage cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-white border border-[#E0E3E5]" />
        ))}
      </div>
      {/* Patient rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[72px] rounded-xl bg-white border border-[#E0E3E5]" />
        ))}
      </div>
    </div>
  )
}
