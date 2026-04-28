import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { parseResume, getResumeParseApiUrl } from '../services/gemini';
import { calculateAllMetrics, classifyCandidate, calculateSkillScore } from '../services/biasCalculator';
import { buildModel, getFeatureContributions } from '../services/surrogateModel';
import { collection, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import Papa from 'papaparse';
import { CloudArrowUpIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useToast } from '../components/ui/Toast';

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getResumeFileType(fileName = '') {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.docx')) return 'DOCX';
  return 'UNKNOWN';
}

function enrichCandidate(geminiData, decisionsList) {
  const pd = geminiData.parsed_data || geminiData;
  const name = pd.full_name || geminiData.full_name || 'Unknown';
  const decision = (decisionsList.find(d =>
    d.name.toLowerCase().trim() === name.toLowerCase().trim()
  )?.decision) || 'unknown';

  const classified = classifyCandidate({
    college: pd.college_name,
    home_city: pd.home_city,
    surname: pd.surname,
    employment_gaps: pd.employment_gaps || [],
    work_history: (pd.previous_companies || []).map(c => ({ company: c }))
  });

  const skillScore = calculateSkillScore({
    skills: pd.skills || [],
    years_experience: pd.years_experience || 0,
    projects_count: pd.projects_count || 0,
    github_active: pd.github_active || false
  }, []);

  const surnameScore = classified?.surnameScore || { flagged: false, score: 0.5 };
  const collegeTier = classified?.collegeTier || 3;
  const flagged = surnameScore.flagged || collegeTier >= 3;
  const proxyRisk = (collegeTier >= 3 && surnameScore.flagged) ? 'high' :
    (collegeTier >= 3 || surnameScore.flagged) ? 'medium' : 'low';

  return {
    id: generateId(),
    name,
    decision,
    skillScore,
    collegeTier,
    collegeName: pd.college_name,
    collegeCity: pd.college_city,
    collegeState: pd.college_state,
    cityTier: classified?.cityTier || 2,
    homeCity: pd.home_city,
    homeState: pd.home_state,
    surname: pd.surname,
    gapScore: classified?.gapScore ?? 1.0,
    companyTier: classified?.companyTier || 3,
    skills: pd.skills || [],
    yearsExperience: pd.years_experience || 0,
    projectsCount: pd.projects_count || 0,
    githubActive: pd.github_active || false,
    proxyRisk,
    flagged,
    surnameScore,
    featureContributions: null,
    counterfactual: null,
    geminiMetadata: {
      confidence_scores: geminiData.confidence_scores || {},
      extraction_type: geminiData.extraction_type || 'normal',
      parsed_at: new Date().toISOString()
    },
    source_file: geminiData.source_file || ''
  };
}

// ── Step 1 ──────────────────────────────────────────────
function AuditDetailsStep({ data, onChange, onNext }) {
  const [errors, setErrors] = useState({});
  const validate = () => {
    const e = {};
    if (!data.auditName) e.auditName = 'Required';
    if (!data.jobRole) e.jobRole = 'Required';
    if (!data.startDate) e.startDate = 'Required';
    if (!data.endDate) e.endDate = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  return (
    <div className="bg-white rounded-lg p-8 max-w-2xl shadow-sm border border-rule">
      <h2 className="font-serif text-2xl font-bold text-ink mb-6">Audit Details</h2>
      <div className="space-y-6">
        {[['auditName','Audit/Cycle Name','Software Engineers — April 2026'],['jobRole','Job Role','Senior Software Engineer'],['department','Department (optional)','Engineering']].map(([key,label,ph]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-ink mb-2">{label}</label>
            <input type="text" value={data[key]} onChange={e=>onChange(key,e.target.value)} placeholder={ph}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent ${errors[key]?'border-accent':'border-rule'}`}/>
            {errors[key]&&<p className="text-xs text-accent mt-1">{errors[key]}</p>}
          </div>
        ))}
        <div className="grid grid-cols-2 gap-4">
          {[['startDate','Start Date'],['endDate','End Date']].map(([key,label])=>(
            <div key={key}>
              <label className="block text-sm font-medium text-ink mb-2">{label}</label>
              <input type="date" value={data[key]} onChange={e=>onChange(key,e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${errors[key]?'border-accent':'border-rule'}`}/>
              {errors[key]&&<p className="text-xs text-accent mt-1">{errors[key]}</p>}
            </div>
          ))}
        </div>
        <button onClick={()=>{ if(validate()) onNext(); }} className="w-full px-6 py-3 bg-accent text-white rounded-lg font-medium hover:shadow-lg transition-shadow">
          Next: Upload Resumes
        </button>
      </div>
    </div>
  );
}

// ── Step 2 ──────────────────────────────────────────────
function ResumeUploadStep({ files, onFilesChange, onNext, onPrev }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10485760,
    onDrop: (accepted, rejected) => {
      rejected.forEach((r) => {
        const code = r.errors[0]?.code;
        if (code === 'file-too-large') {
          alert(`${r.file.name} exceeds 10MB`);
        } else if (code === 'file-invalid-type') {
          alert(`${r.file.name} is not supported. Upload .pdf or .docx files only.`);
        }
      });
      onFilesChange([
        ...files,
        ...accepted.map((f) => ({
          file: f,
          id: Math.random(),
          name: f.name,
          size: f.size,
          typeLabel: getResumeFileType(f.name)
        }))
      ]);
    }
  });
  return (
    <div className="bg-white rounded-lg p-8 max-w-2xl shadow-sm border border-rule">
      <h2 className="font-serif text-2xl font-bold text-ink mb-6">Upload Resumes</h2>
      {files.length < 50 && <div className="mb-4 p-3 bg-warn-light border border-warn rounded text-warn text-sm">⚠️ Minimum 50 candidates recommended for statistical significance</div>}
      <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive?'border-accent bg-accent-light':'border-rule bg-paper'}`}>
        <input {...getInputProps()} />
        <CloudArrowUpIcon className="w-12 h-12 mx-auto text-ink-muted mb-3"/>
        <h3 className="font-medium text-ink mb-1">Drop resume files here (.pdf or .docx)</h3>
        <p className="text-sm text-ink-muted mb-4">Supported file types: PDF, Word (.docx)</p>
        <button className="px-4 py-2 bg-accent text-white rounded text-sm font-medium">Or click to browse</button>
      </div>
      {files.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink mb-2">{files.length} resume{files.length!==1?'s':''} added</p>
          <div className="max-h-48 overflow-y-auto border border-rule rounded-lg">
            {files.map((f,i) => (
              <div key={f.id} className="flex items-center justify-between p-3 border-b border-rule last:border-b-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm text-ink truncate">{f.name}</span>
                  <span className="px-2 py-0.5 text-xxs rounded bg-rule text-ink-muted font-bold">
                    {f.typeLabel || getResumeFileType(f.name)}
                  </span>
                </div>
                <button onClick={()=>onFilesChange(files.filter((_,j)=>j!==i))} className="text-ink-muted hover:text-accent ml-2"><XMarkIcon className="w-4 h-4"/></button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-4 mt-6">
        <button onClick={onPrev} className="flex-1 px-6 py-3 border border-rule text-ink rounded-lg font-medium hover:bg-paper-warm">Back</button>
        <button onClick={onNext} disabled={files.length===0} className="flex-1 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Next: Upload Decisions</button>
      </div>
    </div>
  );
}

// ── Step 3 ──────────────────────────────────────────────
function DecisionsStep({ decisions, onDecisionsChange, onNext, onPrev, apiError }) {
  const [tab, setTab] = useState('csv');
  const downloadTemplate = () => {
    const blob = new Blob(['candidate_name,decision\nPriya Kumari,rejected\nRahul Sharma,hired'],{type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='decisions_template.csv'; a.click();
  };
  return (
    <div className="bg-white rounded-lg p-8 max-w-2xl shadow-sm border border-rule">
      <h2 className="font-serif text-2xl font-bold text-ink mb-6">Upload Decisions</h2>
      {apiError && <div className="mb-4 p-4 bg-accent-light border border-accent rounded text-accent text-sm font-medium">{apiError}</div>}
      <div className="flex gap-4 mb-6 border-b border-rule">
        {['csv','manual'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 font-medium border-b-2 transition-colors ${tab===t?'border-accent text-accent':'border-transparent text-ink-muted'}`}>
            {t==='csv'?'Upload CSV':'Manual Entry'}
          </button>
        ))}
      </div>
      {tab==='csv' && (
        <div className="space-y-3">
          <input type="file" accept=".csv" onChange={e=>{
            const f=e.target.files?.[0]; if(!f) return;
            Papa.parse(f,{header:true,complete:r=>{
              const parsed=r.data.filter(row=>row.candidate_name&&row.decision).map(row=>({name:row.candidate_name,decision:row.decision.toLowerCase()}));
              onDecisionsChange(parsed);
            }});
          }} className="block w-full text-sm text-ink file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white"/>
          <button onClick={downloadTemplate} className="text-sm text-accent hover:underline">Download sample template</button>
          {decisions.length>0&&<p className="text-sm text-success font-medium">✅ {decisions.length} decisions loaded</p>}
        </div>
      )}
      {tab==='manual' && (
        <div className="space-y-3">
          {decisions.map((d,i)=>(
            <div key={i} className="flex gap-2">
              <input type="text" value={d.name} placeholder="Candidate name" onChange={e=>{const n=[...decisions];n[i]={...n[i],name:e.target.value};onDecisionsChange(n);}} className="flex-1 px-3 py-2 border border-rule rounded text-sm"/>
              <select value={d.decision} onChange={e=>{const n=[...decisions];n[i]={...n[i],decision:e.target.value};onDecisionsChange(n);}} className="px-3 py-2 border border-rule rounded text-sm">
                <option value="hired">Hired</option>
                <option value="rejected">Rejected</option>
              </select>
              <button onClick={()=>onDecisionsChange(decisions.filter((_,j)=>j!==i))}><XMarkIcon className="w-4 h-4 text-ink-muted"/></button>
            </div>
          ))}
          <button onClick={()=>onDecisionsChange([...decisions,{name:'',decision:'hired'}])} className="text-sm text-accent font-medium hover:underline">+ Add row</button>
        </div>
      )}
      <div className="flex gap-4 mt-8">
        <button onClick={onPrev} className="flex-1 px-6 py-3 border border-rule text-ink rounded-lg font-medium hover:bg-paper-warm">Back</button>
        <button onClick={onNext} disabled={decisions.length===0||!!apiError} className="flex-1 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Start Fairness Audit</button>
      </div>
    </div>
  );
}

// ── Processing Screen ────────────────────────────────────
function ProcessingScreen({ files, statusMap, errorMap, processed, failed, total, completedAudit, onAutoNav }) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const [countdown, setCountdown] = useState(3);

  // Estimated time remaining
  const remaining = (total - processed - failed) * 12; // ~12s per file
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  useEffect(() => {
    if (!completedAudit) return;
    const t = setInterval(() => setCountdown(c => { if(c<=1){clearInterval(t);onAutoNav();return 0;} return c-1; }), 1000);
    return () => clearInterval(t);
  }, [completedAudit, onAutoNav]);

  return (
    <div className="bg-white rounded-lg p-8 max-w-2xl shadow-sm border border-rule">
      {completedAudit ? (
        <div className="text-center">
          <CheckCircleIcon className="w-16 h-16 text-success mx-auto mb-4"/>
          <h2 className="font-serif text-3xl font-bold text-ink mb-2">Audit Complete</h2>
          <p className="text-2xl font-mono font-bold text-success mb-2">Fairness Health Score: {completedAudit.metrics?.fairnessHealthScore}/100</p>
          <p className="text-ink-muted mb-4">{completedAudit.candidate_count} candidates analysed · {failed} could not be parsed</p>
          {failed > 0 && <p className="text-sm text-warn mb-4">{failed} resume(s) could not be read and were skipped. This may reduce statistical confidence.</p>}
          <p className="text-sm text-ink-muted">Navigating to dashboard in {countdown}s...</p>
        </div>
      ) : (
        <>
          <h2 className="font-serif text-2xl font-bold text-ink mb-2">Analysing Resumes with Gemini AI</h2>
          <p className="text-ink-muted text-sm mb-6">Reading each resume for skills, background signals, and potential bias indicators</p>
          <div className="mb-2">
            <div className="flex justify-between text-sm text-ink-muted mb-1">
              <span>{processed} of {total} resumes processed</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-rule rounded-full h-3 overflow-hidden">
              <div className="bg-accent h-full rounded-full transition-all duration-700 ease-out" style={{width:`${pct}%`}}></div>
            </div>
          </div>
          {remaining > 0 && (
            <p className="text-xs text-ink-muted mb-4">
              Estimated time remaining: {minutes > 0 ? `${minutes}m ` : ''}{seconds}s
            </p>
          )}
          <div className="max-h-64 overflow-y-auto border border-rule rounded-lg mb-4">
            {files.map(f => {
              const s = statusMap[f.name] || 'pending';
              return (
                <div key={f.name} className="flex items-center gap-3 p-3 border-b border-rule last:border-b-0">
                  {s==='pending' && <span className="text-ink-muted text-sm">⏳</span>}
                  {s==='processing' && <span className="fl-spinner"></span>}
                  {s==='success' && <span className="text-success text-sm">✅</span>}
                  {s==='failed' && <span className="text-accent text-sm">❌</span>}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className={`text-sm truncate ${s==='processing'?'text-accent2 font-medium':s==='failed'?'text-accent':'text-ink'}`}>{f.name}</span>
                    <span className="px-2 py-0.5 text-xxs rounded bg-rule text-ink-muted font-bold">
                      {getResumeFileType(f.name)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs ${s==='processing'?'text-accent2':s==='failed'?'text-accent':s==='success'?'text-success':'text-ink-muted'}`}>
                      {s==='pending'?'Waiting...':s==='processing'?'Processing...':s==='success'?'Extracted':'Could not parse'}
                    </span>
                    {s==='failed' && errorMap?.[f.name] && (
                      <div className="text-xxs text-ink-muted mt-1 truncate max-w-sm" title={errorMap[f.name]}>
                        {errorMap[f.name]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-ink-muted">{processed} processed · {failed} failed · {total-processed-failed} remaining</p>
        </>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function NewAudit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [apiError, setApiError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusMap, setStatusMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [processed, setProcessedCount] = useState(0);
  const [failed, setFailedCount] = useState(0);
  const [completedAudit, setCompletedAudit] = useState(null);
  const [formData, setFormData] = useState({ auditName:'', jobRole:'', department:'', startDate:'', endDate:'' });

  const handleFormChange = (k,v) => setFormData(p=>({...p,[k]:v}));

  let parseApiUrl = '';
  try {
    parseApiUrl = getResumeParseApiUrl();
  } catch (e) {
    parseApiUrl = '';
  }
  const parseApiStatus = parseApiUrl ? parseApiUrl : 'NOT CONFIGURED';
  console.debug('📄 Resume parse API URL:', parseApiStatus);

  const checkApiKey = () => {
    if (!parseApiUrl) {
      setApiError('Resume parse API URL is missing. Set REACT_APP_API_URL=https://fairlens-backend-3m2c.onrender.com');
      return true;
    }
    setApiError('');
    return true;
  };

  const handleStartAudit = async () => {
    if (!checkApiKey()) return;
    if (!user || !organization) return;
    setProcessing(true);
    setStatusMap({});
    setProcessedCount(0);
    setFailedCount(0);

    let processedCount = 0;
    let failedCount = 0;
    const enriched = [];

    for (const fileObj of files) {
      const fname = fileObj.name || fileObj.file?.name;
      const actualFile = fileObj.file || fileObj;

      setStatusMap(p=>({...p,[fname]:'processing'}));
      const result = await parseResume(actualFile);

      if (result && result.success && result.data) {
        const candidate = enrichCandidate({ ...result.data, source_file: fname }, decisions);
        enriched.push(candidate);
        processedCount++;
        setStatusMap(p=>({...p,[fname]:'success'}));
        setErrorMap(p=>{ const n = {...p}; delete n[fname]; return n; });
      } else {
        failedCount++;
        setStatusMap(p=>({...p,[fname]:'failed'}));
        setErrorMap(p=>({...p,[fname]: result?.error || 'Parsing failed'}));
      }
      setProcessedCount(processedCount);
      setFailedCount(failedCount);
    }

    if (enriched.length < 2) {
      alert('Too few resumes were successfully parsed. Please try again with more resumes.');
      setProcessing(false);
      return;
    }

    // Build surrogate model
    let withContributions = enriched;
    const model = buildModel(enriched);
    if (!model.error) {
      withContributions = enriched.map(c => ({
        ...c,
        featureContributions: getFeatureContributions(c, model)
      }));
    }

    // Compute metrics
    const metrics = calculateAllMetrics(withContributions);

    // Compute chart data
    const collegeTierRates = [1,2,3,4].map(tier => {
      const inTier = withContributions.filter(c=>c.collegeTier===tier);
      if(!inTier.length) return null;
      return { tier:`Tier ${tier}`, rate:Math.round((inTier.filter(c=>c.decision==='hired').length/inTier.length)*100), count:inTier.length };
    }).filter(Boolean);
    const cityTierRates = [1,2,3].map(tier => {
      const inTier = withContributions.filter(c=>c.cityTier===tier);
      if(!inTier.length) return null;
      return { tier:`Tier ${tier}`, rate:Math.round((inTier.filter(c=>c.decision==='hired').length/inTier.length)*100), count:inTier.length };
    }).filter(Boolean);

    const auditId = generateId();
    const orgId = organization?.id || user?.orgId || user?.uid || 'demo-org-001';
    const completedAuditObj = {
      auditId,
      audit_cycle_name: formData.auditName,
      job_role: formData.jobRole,
      department: formData.department,
      start_date: formData.startDate,
      end_date: formData.endDate,
      candidate_count: withContributions.length,
      status: 'complete',
      org_id: orgId,
      createdAt: new Date(),
      completedAt: new Date(),
      metrics,
      chartData: { collegeTier: collegeTierRates, cityTier: cityTierRates }
    };

    // Save
    const isMock = orgId === 'demo-org-001' || user?.uid?.includes('demo-');
    if (isMock) {
      sessionStorage.setItem('fairlens_last_audit', JSON.stringify({ audit: completedAuditObj, candidates: withContributions }));
      const history = JSON.parse(sessionStorage.getItem('fairlens_audit_history') || '[]');
      history.push(completedAuditObj);
      sessionStorage.setItem('fairlens_audit_history', JSON.stringify(history));
    } else {
      try {
        const batch = writeBatch(db);
        const auditRef = doc(db, 'organizations', orgId, 'audits', auditId);
        batch.set(auditRef, { ...completedAuditObj, createdAt: serverTimestamp(), completedAt: serverTimestamp() });
        withContributions.forEach(c => {
          batch.set(doc(collection(auditRef, 'candidates')), c);
        });
        const reportId = generateId();
        batch.set(doc(db, 'organizations', orgId, 'reports', reportId), {
          reportId, auditId, auditName: completedAuditObj.audit_cycle_name,
          generatedAt: serverTimestamp(), candidateCount: completedAuditObj.candidate_count,
          fairnessHealthScore: metrics.fairnessHealthScore,
          hiringPeriod: `${formData.startDate} to ${formData.endDate}`
        });
        await batch.commit();
      } catch(e) { console.error('Firestore save error:', e); }
    }

    setCompletedAudit(completedAuditObj);
    // Notify user about parsing failures / AI availability
    if (failedCount === files.length && files.length > 0) {
      // All files failed — likely Gemini service unavailable
      try { showToast && showToast('AI service temporarily unavailable. Showing computed results from your uploaded data.', 'error'); } catch(e){}
    } else if (failedCount > 0) {
      try { showToast && showToast(`${failedCount} resumes could not be parsed and were skipped. Results are based on the remaining candidates.`, 'warning'); } catch(e){}
    }
  };

  const handleAutoNav = () => {
    navigate('/dashboard', { state: { auditId: completedAudit?.auditId } });
  };

  const steps = ['Details','Resumes','Decisions'];

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Debug banner: show env var status */}
      <div className={`mb-4 p-2 rounded text-xs font-mono ${parseApiUrl ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
        📄 Resume parse API: {parseApiStatus}
      </div>

      {!processing && (
        <div className="mb-8 flex items-center gap-2">
          {steps.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i+1<=step?'bg-accent text-white':'bg-rule text-ink-muted'}`}>{i+1}</div>
              <span className={`text-sm ${i+1<=step?'text-accent font-medium':'text-ink-muted'}`}>{label}</span>
              {i<steps.length-1 && <div className={`w-10 h-1 ${i+1<step?'bg-accent':'bg-rule'}`}></div>}
            </div>
          ))}
        </div>
      )}

      {processing ? (
        <ProcessingScreen
          files={files.map(f=>({
            name: f.name || f.file?.name,
            typeLabel: f.typeLabel || getResumeFileType(f.name || f.file?.name || '')
          }))}
          statusMap={statusMap}
          errorMap={errorMap}
          processed={processed}
          failed={failed}
          total={files.length}
          completedAudit={completedAudit}
          onAutoNav={handleAutoNav}
        />
      ) : (
        <>
          {step===1 && <AuditDetailsStep data={formData} onChange={handleFormChange} onNext={()=>setStep(2)}/>}
          {step===2 && <ResumeUploadStep files={files} onFilesChange={setFiles} onNext={()=>setStep(3)} onPrev={()=>setStep(1)}/>}
          {step===3 && <DecisionsStep decisions={decisions} onDecisionsChange={setDecisions} onNext={handleStartAudit} onPrev={()=>setStep(2)} apiError={apiError}/>}
        </>
      )}
    </div>
  );
}
