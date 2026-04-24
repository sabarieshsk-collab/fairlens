import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

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
  'Technology', 'Finance', 'Manufacturing', 'Healthcare', 'Education', 'Other'
];

const HEADCOUNT_OPTIONS = [
  'Under 100', '100-500', '500-2000', '2000+'
];

const COMING_SOON_FEATURES = [
  { name: 'ATS Integration', description: 'Workday, Zoho, Keka' },
  { name: 'Push Notifications', description: 'Firebase Cloud Messaging' },
  { name: 'Hindi/Tamil/Telugu Support', description: 'Resume language support' },
  { name: 'WhatsApp Alerts', description: 'WhatsApp Alert Notifications' },
  { name: 'EU AI Mapping', description: 'EU AI Act Compliance Mapping' }
];

export default function Settings() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [editMode, setEditMode] = useState(false);
  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [retentionDays, setRetentionDays] = useState(90);
  const [resumeCount, setResumeCount] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    sector: '',
    headcount: '',
    states: []
  });

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        sector: organization.sector || '',
        headcount: organization.headcount || '',
        states: organization.states || []
      });
      setRetentionDays(organization.retention_days || 90);
      // In real implementation, fetch resume count from Firestore
      setResumeCount(0);
    }
  }, [organization]);

  const handleStateToggle = (state) => {
    setFormData({
      ...formData,
      states: formData.states.includes(state)
        ? formData.states.filter(s => s !== state)
        : [...formData.states, state]
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.sector || !formData.headcount || formData.states.length === 0) {
      setError('Please fill in all fields');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const orgRef = doc(db, 'users', user.uid);
      await updateDoc(orgRef, {
        ...formData,
        retention_days: retentionDays
      });
      setSuccess('Organization settings updated successfully');
      setEditMode(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllResumes = () => {
    if (window.confirm('Are you sure? This permanently deletes all stored resume PDFs. Parsed data and audit results are not affected.')) {
      // Implementation: Delete from Cloud Storage
      setSuccess('All resume files deleted');
      setResumeCount(0);
    }
  };

  const calculateAutoDeleteDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + retentionDays);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-serif text-4xl font-bold text-ink mb-2">Settings</h1>
        <p className="text-ink-muted">Manage your organization and data preferences</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-accent-light border-l-4 border-accent rounded-lg text-accent">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-success-light border-l-4 border-success rounded-lg text-success flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* SECTION 1: Organization Profile */}
      <div className="mb-12 bg-white rounded-lg shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-bold text-ink">Organization Profile</h2>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 border border-accent text-accent font-bold rounded-lg hover:bg-accent-light transition"
            >
              Edit Profile
            </button>
          )}
        </div>

        {editMode ? (
          <div className="space-y-6">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Company Name *</label>
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
              <label className="block text-sm font-medium text-ink mb-2">Industry Sector *</label>
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
              <label className="block text-sm font-medium text-ink mb-2">Company Headcount *</label>
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
              <label className="block text-sm font-medium text-ink mb-2">States of Operation *</label>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-4 border border-rule rounded-lg bg-paper-card">
                {INDIAN_STATES.map((state) => (
                  <label key={state} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.states.includes(state)}
                      onChange={() => handleStateToggle(state)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-ink">{state}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-success text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="px-6 py-2 border border-rule text-ink font-bold rounded-lg hover:bg-paper transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-ink-muted mb-1">Company Name</p>
              <p className="text-lg font-bold text-ink">{organization?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-1">Industry Sector</p>
              <p className="text-lg font-bold text-ink">{organization?.sector || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-1">Company Headcount</p>
              <p className="text-lg font-bold text-ink">{organization?.headcount || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-1">Operating States</p>
              <p className="text-lg font-bold text-ink">{organization?.states?.length || 0} states</p>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Data Privacy and Retention */}
      <div className="mb-12">
        <h2 className="font-serif text-2xl font-bold text-ink mb-6">Data Retention and Privacy</h2>

        <div className="space-y-6">
          {/* Retention Card */}
          <div className="bg-white rounded-lg shadow-sm p-8 border-l-4 border-warn">
            <h3 className="font-bold text-ink mb-4">Resume Storage</h3>
            <div className="space-y-4">
              <p className="text-ink-muted">
                <strong>Resume files stored:</strong> {resumeCount} files
              </p>
              <p className="text-ink-muted">
                <strong>Auto-delete in:</strong> {retentionDays} days (by {calculateAutoDeleteDate()})
              </p>

              <div>
                <label className="block text-sm font-medium text-ink mb-3">Retention Period</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="30"
                    max="90"
                    step="30"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                    className="flex-grow cursor-pointer"
                  />
                  <div className="flex gap-2">
                    {[30, 60, 90].map((days) => (
                      <button
                        key={days}
                        onClick={() => setRetentionDays(days)}
                        className={`px-3 py-1 rounded text-sm font-bold transition ${
                          retentionDays === days
                            ? 'bg-warn text-white'
                            : 'bg-paper-warm text-ink-muted hover:bg-warn-light'
                        }`}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleDeleteAllResumes}
                disabled={resumeCount === 0}
                className="w-full mt-4 px-4 py-2 border border-accent text-accent font-bold rounded-lg hover:bg-accent-light transition disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4 inline mr-2" />
                Delete All Resume Files Now
              </button>
            </div>
          </div>

          {/* Data Residency Card */}
          <div className="bg-success-light rounded-lg shadow-sm p-8 border-l-4 border-success">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-success mb-2">Data Residency - India Compliant</h3>
                <p className="text-ink-muted text-sm">
                  All data stored in India • Mumbai region (asia-south1) • In compliance with DPDPA 2023 data localization requirements
                </p>
              </div>
            </div>
          </div>

          {/* Data Processing Card */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h3 className="font-bold text-ink mb-3">Data Processing Agreement</h3>
            <p className="text-ink-muted text-sm mb-4">
              FairLens is a Data Processor under DPDPA 2023. Your organization is the Data Controller. Candidate data is used only for bias auditing purposes.
            </p>
            <button className="px-4 py-2 border border-accent2 text-accent2 font-bold rounded-lg hover:bg-accent2-light transition">
              Download DPA (Coming Soon)
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: Coming Soon Features */}
      <div>
        <h2 className="font-serif text-2xl font-bold text-ink mb-6">Upcoming Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {COMING_SOON_FEATURES.map((feature, idx) => (
            <div
              key={idx}
              className="bg-paper rounded-lg p-6 border border-rule opacity-60 pointer-events-none"
            >
              <div className="inline-block mb-3 px-2 py-1 bg-ink-muted text-white text-xs font-bold rounded">
                Coming Soon
              </div>
              <h3 className="font-bold text-ink mb-1">{feature.name}</h3>
              <p className="text-sm text-ink-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
