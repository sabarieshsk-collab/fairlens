export default function LoadingSpinner() {
  return (
    <div className="fixed inset-0 bg-paper flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-rule border-t-accent rounded-full animate-spin"></div>
        <p className="text-ink-muted font-sans text-sm">Loading...</p>
      </div>
    </div>
  );
}
