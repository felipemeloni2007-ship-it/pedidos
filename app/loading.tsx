export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-16 rounded-xl bg-[#eae8e2]" />
        <div className="mt-6 h-64 rounded-[28px] bg-[#e4e1da]" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-72 rounded-[22px] bg-[#eae8e2]" />
          ))}
        </div>
      </div>
    </main>
  );
}
