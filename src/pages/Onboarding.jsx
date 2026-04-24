import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
  'Daman and Diu', 'Lakshadweep', 'Delhi', 'Puducherry', 'Ladakh'
];

const INDUSTRIES = [
  'Technology',
  'Finance',
  'Manufacturing',
  'Healthcare',
  'Education',
  'Other'
];

const HEADCOUNT_OPTIONS = [
  'Under 100',
  '100-500',
  '500-2000',
  '2000+'
];

const PROTECTED_GROUPS = [
  {
    id: 'caste',
    label: 'SC/ST Community Proxies',
    description: 'Detects if college tier, home city, surname patterns, and career gaps are producing disparate outcomes for candidates from underrepresented socioeconomic backgrounds',
    defaultEnabled: true
  },
  {
    id: 'gender',
    label: 'Gender Indicators',
    description: 'Detects name-based and career gap patterns that may correlate with gender discrimination',
    defaultEnabled: true
  },
  {
    id: 'regional',
    label: 'Regional Background',
    description: 'Detects if candidates from specific states or linguistic backgrounds are selected at lower rates',
    defaultEnabled: true
  },
  {
    id: 'religion',
    label: 'Religion Proxies',
    description: 'Detects name-based patterns that may correlate with religious community discrimination',
    defaultEnabled: false
  },
  {
    id: 'disability',
    label: 'Disability Indicators',
    description: 'Detects if career gaps or qualification patterns potentially associated with disability are penalized',
    defaultEnabled: false
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sector: '',
    headcount: '',
    states: [],
    protected_groups: PROTECTED_GROUPS.reduce((acc, group) => ({
      ...acc,
      [group.id]: group.defaultEnabled
    }), {}),
    upload_method: 'manual'
  });

  // Validation
  const validateStep1 = () => {
    if (!formData.name.trim()) {
      setError('Please enter company name');
      return false;
    }
    if (!formData.sector) {
      setError('Please select industry sector');
      return false;
    }
    if (!formData.headcount) {
      setError('Please select company headcount');
      return false;
    }
    if (formData.states.length === 0) {
      setError('Please select at least one state');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setError('');
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');

    if (!process.env.REACT_APP_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY === 'your_value_here') {
      localStorage.setItem('fairlens_onboarding_complete', 'true');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
      return;
    }

    try {
      if (!user) throw new Error('User not authenticated');

      await setDoc(doc(db, 'users', user.uid), {
        ...formData,
        onboarding_complete: true,
        created_at: serverTimestamp(),
        user_email: user.email,
        user_display_name: user.displayName
      });

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to save profile. Please try again.');
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-paper">
      {/* Progress bar */}
      <div className="bg-white border-b border-rule sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-serif text-2xl font-bold text-ink">
              Setup Your FairLens Account
            </h1>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    s <= step
                      ? 'bg-accent text-white'
                      : 'bg-rule text-ink-muted'
                  }`}
                >
                  {s}
                </div>
                {s === 1 && <span className={s <= step ? 'text-accent font-medium' : 'text-ink-muted'}>Organization</span>}
                {s === 2 && <span className={s <= step ? 'text-accent font-medium' : 'text-ink-muted'}>Protected Groups</span>}
                {s === 3 && <span className={s <= step ? 'text-accent font-medium' : 'text-ink-muted'}>Upload Method</span>}
                {s < 3 && <div className={`w-12 h-1 ${s < step ? 'bg-accent' : 'bg-rule'}`}></div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-8 py-12">
        {error && (
          <div className="mb-6 p-4 bg-warn-light border border-warn rounded-lg">
            <p className="text-sm text-warn">{error}</p>
          </div>
        )}

        {/* Step 1: Organization Profile */}
        {step === 1 && (
          <div>
            <h2 className="font-serif text-3xl font-bold text-ink mb-2">
              Tell us about your organization
            </h2>
            <p className="text-ink-muted mb-8">This helps us tailor FairLens for your hiring context</p>

            <div className="space-y-6">
              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-rule rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder="Enter company name"
                />
              </div>

              {/* Industry Sector */}
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Industry Sector *
                </label>
                <select
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  className="w-full px-4 py-2 border border-rule rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              {/* Company Headcount */}
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Company Headcount *
                </label>
                <select
                  value={formData.headcount}
                  onChange={(e) => setFormData({ ...formData, headcount: e.target.value })}
                  className="w-full px-4 py-2 border border-rule rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="">Select headcount...</option>
                  {HEADCOUNT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* States of Operation */}
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  States of Operation *
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto p-4 border border-rule rounded-lg bg-paper-card">
                  {INDIAN_STATES.map((state) => (
                    <label key={state} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.states.includes(state)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              states: [...formData.states, state]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              states: formData.states.filter(s => s !== state)
                            });
                          }
                        }}
                        className="w-4 h-4 rounded border-rule text-accent focus:ring-accent"
                      />
                      <span className="text-sm text-ink">{state}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Protected Groups */}
        {step === 2 && (
          <div>
            <h2 className="font-serif text-3xl font-bold text-ink mb-2">
              What bias patterns should FairLens monitor?
            </h2>
            <p className="text-ink-muted mb-8">You can change these in Settings anytime</p>

            <div className="space-y-4">
              {PROTECTED_GROUPS.map((group) => (
                <div key={group.id} className="border border-rule rounded-lg p-6 bg-paper-card hover:border-accent-light transition-colors">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => setFormData({
                        ...formData,
                        protected_groups: {
                          ...formData.protected_groups,
                          [group.id]: !formData.protected_groups[group.id]
                        }
                      })}
                      className={`mt-1 w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                        formData.protected_groups[group.id]
                          ? 'bg-success'
                          : 'bg-rule'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                          formData.protected_groups[group.id]
                            ? 'translate-x-6'
                            : 'translate-x-0.5'
                        }`}
                      ></div>
                    </button>
                    <div className="flex-1">
                      <h3 className="font-medium text-ink mb-1">{group.label}</h3>
                      <p className="text-sm text-ink-muted">{group.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Upload Method */}
        {step === 3 && (
          <div>
            <h2 className="font-serif text-3xl font-bold text-ink mb-2">
              How will you provide hiring data?
            </h2>
            <p className="text-ink-muted mb-8">Choose the method that works best for you</p>

            <div className="space-y-4">
              {/* Coming Soon Option */}
              <div className="border border-rule rounded-lg p-6 opacity-50 cursor-not-allowed bg-paper-warm">
                <div className="flex items-start gap-4">
                  <div className="w-5 h-5 rounded border-2 border-rule mt-1 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-ink">Connect ATS</h3>
                      <span className="text-xs font-bold text-accent bg-accent-light px-2 py-1 rounded">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-sm text-ink-muted mb-4">
                      Automatically sync hiring data from your ATS
                    </p>
                    <div className="flex gap-3">
                      <span className="text-xs text-ink-muted">Workday</span>
                      <span className="text-xs text-ink-muted">Zoho Recruit</span>
                      <span className="text-xs text-ink-muted">Keka</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Upload Option */}
              <button
                onClick={() => setFormData({ ...formData, upload_method: 'manual' })}
                className={`w-full border-2 rounded-lg p-6 text-left transition-all ${
                  formData.upload_method === 'manual'
                    ? 'border-accent bg-accent-light'
                    : 'border-rule bg-paper-card hover:border-accent-light'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-5 h-5 rounded border-2 ${
                      formData.upload_method === 'manual'
                        ? 'border-accent bg-accent'
                        : 'border-rule'
                    } mt-1 flex-shrink-0 flex items-center justify-center`}
                  >
                    {formData.upload_method === 'manual' && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-ink">Manual Upload</h3>
                      <span className="text-xs font-bold text-success bg-success-light px-2 py-1 rounded">
                        Recommended for getting started
                      </span>
                    </div>
                    <p className="text-sm text-ink-muted">
                      Upload resume PDFs and a decisions CSV file. Works with any ATS or manual process.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-12">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="px-6 py-2 border border-rule rounded-lg text-ink hover:bg-paper-warm transition-colors"
            >
              Back
            </button>
          )}
          {step < 3 && (
            <button
              onClick={handleNext}
              className="ml-auto px-6 py-2 bg-accent text-white rounded-lg hover:shadow-lg transition-shadow"
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleComplete}
              className="ml-auto px-6 py-2 bg-accent text-white rounded-lg hover:shadow-lg transition-shadow"
            >
              Complete Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
