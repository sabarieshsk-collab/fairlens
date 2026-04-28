import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    sessionStorage.removeItem('fairlens_mock_user');
    localStorage.removeItem('fairlens_onboarding_complete');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const isHrDemo = email === 'hr@fairlens.demo' && password === 'Demo@123';
    const isLegalDemo = email === 'legal@fairlens.demo' && password === 'Demo@123';
    
    if (isHrDemo) {
      sessionStorage.setItem('fairlens_mock_user', JSON.stringify({
        uid: 'demo-user-hr-001',
        email: 'hr@fairlens.demo',
        displayName: 'Ananya Krishnan',
        role: 'hr_officer',
        orgId: 'demo-org-001'
      }));
      navigate('/dashboard');
      return;
    } else if (isLegalDemo) {
      sessionStorage.setItem('fairlens_mock_user', JSON.stringify({
        uid: 'demo-user-legal-001',
        email: 'legal@fairlens.demo',
        displayName: 'Vikram Mehta',
        role: 'legal_reviewer',
        orgId: 'demo-org-001'
      }));
      navigate('/dashboard');
      return;
    }

    if (!process.env.REACT_APP_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY === 'your_value_here') {
      setError('Invalid credentials. Use the demo accounts shown below.');
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      const orgRef = doc(db, 'users', user.uid);
      const orgSnap = await getDoc(orgRef);

      if (orgSnap.exists()) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink overflow-hidden relative flex items-center justify-center">
      {/* Decorative circles */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-accent opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent2 opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-accent opacity-3 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>

      {/* Loading spinner */}
      {loading && <LoadingSpinner />}

      {/* Main card */}
      <div className="relative z-10 max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl p-12 shadow-2xl">
          {/* Label */}
          <div className="text-center mb-8">
            <p className="font-mono text-sm font-bold text-accent tracking-widest">
              FAIRLENS
            </p>
          </div>

          {/* Heading */}
          <h1 className="font-serif text-5xl font-bold text-ink text-center mb-4">
            Fair Hiring
          </h1>

          {/* Subtitle */}
          <p className="text-center text-ink-muted italic mb-6">
            Making AI bias visible, measurable, and governable
          </p>

          {/* Divider */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-1 bg-accent"></div>
          </div>

          {/* Description */}
          <p className="text-center text-ink-muted text-sm leading-relaxed mb-8">
            FairLens audits your AI hiring system for bias against underrepresented
            candidates — without requiring access to your AI model's code.
          </p>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-warn-light border border-warn rounded-lg">
              <p className="text-sm text-warn">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-rule rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder="hr@fairlens.demo"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-rule rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-white rounded-lg px-6 py-4 font-medium flex items-center justify-center gap-3 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed mb-6"
            >
              Secure Sign In
            </button>
          </form>

          {/* Demo Access */}
          <div className="mt-8 border-t border-rule pt-6 mb-6">
            <h3 className="text-sm font-medium text-ink mb-4 text-center">Demo Access</h3>
            <div className="space-y-3">
              <button 
                type="button"
                onClick={() => { setEmail('hr@fairlens.demo'); setPassword('Demo@123'); }}
                className="w-full text-left p-3 rounded bg-ink/5 hover:bg-ink/10 transition-colors"
              >
                <div className="text-sm font-medium text-ink">HR Officer</div>
                <div className="text-xs text-ink-muted font-mono">hr@fairlens.demo / Demo@123</div>
              </button>
              <button 
                type="button"
                onClick={() => { setEmail('legal@fairlens.demo'); setPassword('Demo@123'); }}
                className="w-full text-left p-3 rounded bg-ink/5 hover:bg-ink/10 transition-colors"
              >
                <div className="text-sm font-medium text-ink">Legal Reviewer</div>
                <div className="text-xs text-ink-muted font-mono">legal@fairlens.demo / Demo@123</div>
              </button>
            </div>
          </div>

          {/* Small text */}
          <p className="text-center text-xs text-ink-muted leading-relaxed">
            Authorized HR compliance officers and legal teams only.
          </p>
        </div>
      </div>
    </div>
  );
}
