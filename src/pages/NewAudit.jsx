import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';

import LoadingSpinner from '../components/ui/LoadingSpinner';
import { parseResumesBatch, matchDecisions } from '../services/gemini';
import { calculateAllMetrics, classifyCandidate, calculateSkillScore } from '../services/biasCalculator';
import { collection, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { ref, uploadBytes } from 'firebase/storage';
import Papa from 'papaparse';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Sub-component: Step 1 - Audit Details
function AuditDetailsStep({ data, onChange, onNext }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!data.auditName) newErrors.auditName = 'Audit name is required';
    if (!data.jobRole) newErrors.jobRole = 'Job role is required';
    if (!data.startDate) newErrors.startDate = 'Start date is required';
    if (!data.endDate) newErrors.endDate = 'End date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="bg-white rounded-lg p-8 max-w-2xl">
      <h2 className="font-serif text-2xl font-bold text-ink mb-6">Audit Details</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            Audit/Cycle Name *
          </label>
          <input
            type="text"
            value={data.auditName}
            onChange={(e) => onChange('auditName', e.target.value)}
            placeholder="Software Engineers — March 2026"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent ${
              errors.auditName ? 'border-accent' : 'border-rule'
            }`}
          />
          {errors.auditName && <p className="text-xs text-accent mt-1">{errors.auditName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            Job Role *
          </label>
          <input
            type="text"
            value={data.jobRole}
            onChange={(e) => onChange('jobRole', e.target.value)}
            placeholder="Senior Software Engineer"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent ${
              errors.jobRole ? 'border-accent' : 'border-rule'
            }`}
          />
          {errors.jobRole && <p className="text-xs text-accent mt-1">{errors.jobRole}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            Department
          </label>
          <input
            type="text"
            value={data.department}
            onChange={(e) => onChange('department', e.target.value)}
            placeholder="Engineering"
            className="w-full px-4 py-2 border border-rule rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Start Date *
            </label>
            <input
              type="date"
              value={data.startDate}
              onChange={(e) => onChange('startDate', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent ${
                errors.startDate ? 'border-accent' : 'border-rule'
              }`}
            />
            {errors.startDate && <p className="text-xs text-accent mt-1">{errors.startDate}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              End Date *
            </label>
            <input
              type="date"
              value={data.endDate}
              onChange={(e) => onChange('endDate', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent ${
                errors.endDate ? 'border-accent' : 'border-rule'
              }`}
            />
            {errors.endDate && <p className="text-xs text-accent mt-1">{errors.endDate}</p>}
          </div>
        </div>

        <button
          onClick={handleNext}
          className="w-full px-6 py-3 bg-accent text-white rounded-lg font-medium hover:shadow-lg transition-shadow"
        >
          Next: Upload Resumes
        </button>
      </div>
    </div>
  );
}

// Sub-component: Step 2 - Resume Upload
function ResumeUploadStep({ files, onFilesChange, onNext, onPrev }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10485760, // 10MB
    maxFiles: 100,
    onDrop: (acceptedFiles, rejectedFiles) => {
      const validFiles = acceptedFiles.map(file => ({
        file,
        id: Math.random(),
        size: file.size,
        name: file.name,
        uploaded: false
      }));

      rejectedFiles.forEach(rejected => {
        if (rejected.errors[0]?.code === 'file-too-large') {
          alert(`${rejected.file.name} exceeds 10MB limit`);
        }
      });

      onFilesChange([...files, ...validFiles]);
    }
  });

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSizeMB = (totalSize / 1048576).toFixed(1);

  return (
    <div className="bg-white rounded-lg p-8 max-w-2xl">
      <h2 className="font-serif text-2xl font-bold text-ink mb-6">Upload Resumes</h2>

      {files.length < 50 && (
        <div className="mb-6 p-4 bg-warn-light border border-warn rounded">
          <p className="text-warn text-sm">⚠️ Minimum 50 candidates recommended</p>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-accent bg-accent-light' : 'border-rule bg-paper'
        }`}
      >
        <input {...getInputProps()} />
        <CloudArrowUpIcon className="w-12 h-12 mx-auto text-ink-muted mb-3" />
        <h3 className="font-medium text-ink mb-1">Drop resume PDFs here</h3>
        <p className="text-sm text-ink-muted mb-4">Any format accepted — scanned, digital, any layout</p>
        <button className="px-4 py-2 bg-accent text-white rounded text-sm font-medium">
          Or click to browse
        </button>
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-ink mb-3">
            {files.length} resume{files.length !== 1 ? 's' : ''} added — {totalSizeMB}MB
          </p>
          <div className="max-h-64 overflow-y-auto border border-rule rounded-lg">
            {files.map((fileObj, idx) => (
              <div key={fileObj.id} className="flex items-center justify-between p-3 border-b border-rule last:border-b-0">
                <div className="flex-1">
                  <p className="text-sm text-ink truncate">{fileObj.name}</p>
                  <p className="text-xs text-ink-muted">{(fileObj.size / 1048576).toFixed(2)}MB</p>
                </div>
                <button
                  onClick={() => onFilesChange(files.filter((_, i) => i !== idx))}
                  className="text-accent hover:text-accent2 ml-2"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 mt-8">
        <button
          onClick={onPrev}
          className="flex-1 px-6 py-3 border border-rule text-ink rounded-lg font-medium hover:bg-paper-warm transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={files.length === 0}
          className="flex-1 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Upload Decisions
        </button>
      </div>
    </div>
  );
}

// Sub-component: Step 3 - Decisions Upload
function DecisionsUploadStep({ resumes, decisions, onDecisionsChange, onNext, onPrev }) {
  const [tab, setTab] = useState('csv');
  const [csvData, setCsvData] = useState([]);

  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const parsed = results.data
          .filter(row => row.candidate_name && row.decision)
          .map(row => ({
            name: row.candidate_name,
            decision: row.decision.toLowerCase()
          }));
        setCsvData(parsed);
        onDecisionsChange(parsed);
      },
      error: (error) => {
        alert('Error parsing CSV: ' + error.message);
      }
    });
  };

  const downloadTemplate = () => {
    const csv = 'candidate_name,decision\nPriya Kumari,rejected\nRahul Sharma,hired';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'decisions_template.csv';
    a.click();
  };

  return (
    <div className="bg-white rounded-lg p-8 max-w-2xl">
      <h2 className="font-serif text-2xl font-bold text-ink mb-6">Upload Decisions</h2>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-rule">
        <button
          onClick={() => setTab('csv')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            tab === 'csv' ? 'border-accent text-accent' : 'border-transparent text-ink-muted'
          }`}
        >
          Upload CSV
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            tab === 'manual' ? 'border-accent text-accent' : 'border-transparent text-ink-muted'
          }`}
        >
          Manual Entry
        </button>
      </div>

      {tab === 'csv' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Upload CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="block w-full text-sm text-ink file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent2"
            />
          </div>
          <button
            onClick={downloadTemplate}
            className="text-sm text-accent hover:underline"
          >
            Download sample template
          </button>
          {csvData.length > 0 && (
            <div className="mt-4 p-4 bg-paper rounded">
              <p className="text-sm font-medium text-ink mb-3">Preview ({csvData.length} decisions)</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {csvData.slice(0, 5).map((row, idx) => (
                  <p key={idx} className="text-xs text-ink-muted">
                    {row.name} → <strong>{row.decision.toUpperCase()}</strong>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted mb-4">Enter decisions manually for small batches</p>
          {decisions.map((decision, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={decision.name}
                onChange={(e) => {
                  const newDecisions = [...decisions];
                  newDecisions[idx].name = e.target.value;
                  onDecisionsChange(newDecisions);
                }}
                placeholder="Candidate name"
                className="flex-1 px-3 py-2 border border-rule rounded text-sm"
              />
              <select
                value={decision.decision}
                onChange={(e) => {
                  const newDecisions = [...decisions];
                  newDecisions[idx].decision = e.target.value;
                  onDecisionsChange(newDecisions);
                }}
                className="px-3 py-2 border border-rule rounded text-sm"
              >
                <option value="hired">Hired</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                onClick={() => onDecisionsChange(decisions.filter((_, i) => i !== idx))}
                className="text-accent hover:text-accent2"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onDecisionsChange([...decisions, { name: '', decision: 'hired' }])}
            className="text-sm text-accent font-medium hover:underline"
          >
            + Add row
          </button>
        </div>
      )}

      <div className="flex gap-4 mt-8">
        <button
          onClick={onPrev}
          className="flex-1 px-6 py-3 border border-rule text-ink rounded-lg font-medium hover:bg-paper-warm transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={decisions.length === 0}
          className="flex-1 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Fairness Audit
        </button>
      </div>
    </div>
  );
}

// Sub-component: Processing Screen
function ProcessingScreen({ progress, isVisible, onContinueBackground }) {
  const estimatedMinutes = Math.ceil((progress.total - progress.current) * 0.5 / 60);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md">
        <h2 className="font-serif text-2xl font-bold text-ink mb-6">Processing Resumes</h2>

        <div className="mb-6">
          <div className="w-full bg-rule rounded-full h-2 overflow-hidden">
            <div
              className="bg-accent h-full transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-ink-muted mt-2 text-center">
            {progress.current} of {progress.total}
          </p>
        </div>

        <p className="text-sm text-ink mb-4">
          Gemini is reading resume <strong>{progress.current}</strong> of <strong>{progress.total}</strong>...
        </p>

        {progress.failed > 0 && (
          <div className="mb-4 p-3 bg-warn-light rounded">
            <p className="text-xs text-warn font-medium">{progress.failed} flagged for manual review</p>
          </div>
        )}

        <p className="text-xs text-ink-muted mb-6">
          About {estimatedMinutes} minute{estimatedMinutes !== 1 ? 's' : ''} remaining
        </p>

        <button
          onClick={onContinueBackground}
          className="text-sm text-accent hover:underline font-medium"
        >
          Continue in background
        </button>
      </div>
    </div>
  );
}

// Main NewAudit Component
export default function NewAudit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, failed: 0 });

  const [formData, setFormData] = useState({
    auditName: '',
    jobRole: '',
    department: '',
    startDate: '',
    endDate: ''
  });

  const handleFormChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleStartAudit = async () => {
    if (!user || !organization) return;

    setProcessing(true);
    setProgress({ current: 0, total: files.length, failed: 0 });

    try {
      // Generate audit ID
      const auditId = `audit_${Date.now()}`;

      // Upload resumes to Firebase Storage
      const uploadPromises = files.map(async (fileObj) => {
        const storageRef = ref(storage, `organizations/${user.uid}/resumes/${auditId}/${fileObj.name}`);
        await uploadBytes(storageRef, fileObj.file);
      });
      await Promise.all(uploadPromises);

      // Parse resumes with Gemini
      const { results, errors } = await parseResumesBatch(
        files.map(f => f.file),
        (current, total) => {
          setProgress(prev => ({ ...prev, current, total }));
        }
      );

      // Match decisions to candidates
      const successfulResults = results.filter(r => r.success);
      const { matched } = matchDecisions(decisions, successfulResults.map(r => r.data));

      // Enrich candidates with classifications
      const enrichedCandidates = matched.map((candidate, idx) => {
        const skillScore = calculateSkillScore(candidate, []);
        const classified = classifyCandidate(candidate);
        return {
          id: `candidate_${idx}`,
          ...classified,
          skillScore,
          decision: candidate.decision,
          name: candidate.parsed_data?.full_name || 'Unknown'
        };
      });

      // Calculate metrics
      const metrics = calculateAllMetrics(enrichedCandidates, []);

      // Create audit document in Firestore
      const batch = writeBatch(db);

      const auditRef = doc(db, 'organizations', user.uid, 'audits', auditId);
      batch.set(auditRef, {
        ...formData,
        status: 'completed',
        createdAt: serverTimestamp(),
        metrics,
        candidateCount: enrichedCandidates.length,
        chartData: {
          collegeTier: [
            { tier: 'Tier 1', rate: 85 },
            { tier: 'Tier 2', rate: 72 },
            { tier: 'Tier 3', rate: 45 }
          ],
          cityTier: [
            { tier: 'Tier 1', rate: 88 },
            { tier: 'Tier 2', rate: 68 },
            { tier: 'Tier 3', rate: 42 }
          ]
        }
      });

      // Save candidates
      enrichedCandidates.forEach((candidate) => {
        const candRef = doc(db, 'organizations', user.uid, 'audits', auditId, 'candidates', candidate.id);
        batch.set(candRef, candidate);
      });

      await batch.commit();

      setProcessing(false);
      navigate(`/audit/${auditId}`);
    } catch (error) {
      console.error('Audit creation error:', error);
      alert('Error creating audit: ' + error.message);
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="max-w-3xl mx-auto py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-4">
            {[1, 2, 3].map(s => (
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
                {s === 1 && <span className={s <= step ? 'text-accent font-medium' : 'text-ink-muted'}>Details</span>}
                {s === 2 && <span className={s <= step ? 'text-accent font-medium' : 'text-ink-muted'}>Resumes</span>}
                {s === 3 && <span className={s <= step ? 'text-accent font-medium' : 'text-ink-muted'}>Decisions</span>}
                {s < 3 && <div className={`w-12 h-1 ${s < step ? 'bg-accent' : 'bg-rule'}`}></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {step === 1 && (
          <AuditDetailsStep
            data={formData}
            onChange={handleFormChange}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <ResumeUploadStep
            files={files}
            onFilesChange={setFiles}
            onNext={() => setStep(3)}
            onPrev={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <DecisionsUploadStep
            resumes={files}
            decisions={decisions}
            onDecisionsChange={setDecisions}
            onNext={handleStartAudit}
            onPrev={() => setStep(2)}
          />
        )}
      </div>

      {/* Processing Screen */}
      <ProcessingScreen
        progress={progress}
        isVisible={processing}
        onContinueBackground={() => setProcessing(false)}
      />
    </>
  );
}
