import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <p className="text-9xl font-serif font-bold text-rule mb-4">404</p>
      <h2 className="font-serif text-2xl font-bold text-ink mb-2">Page not found</h2>
      <p className="text-ink-muted mb-8">The page you are looking for does not exist.</p>
      <Link to="/dashboard" className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:opacity-90 transition">
        Return to Dashboard
      </Link>
    </div>
  );
}
