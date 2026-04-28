import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { collection, query, where, orderBy, limit, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { DEMO_AUDITS, DEMO_REMEDIATION } from '../data/demoAudit';
import { generateBiasFinding } from '../services/gemini';
import { CheckCircleIcon, LockClosedIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';

export default function Remediation() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  
  const [remediationState, setRemediationState] = useState(null);
  const [latestAudit, setLatestAudit] = useState(null);
  const [summary, setSummary] = useState('');
  const { showToast } = useToast();
  
  const [actionText, setActionText] = useState('');
  const [activeAction, setActiveAction] = useState(null); // 'reject', 'changes'
  
  useEffect(() => {
    const initData = async () => {
      if (!organization?.orgId) {
        setLoading(false);
        return;
      }
      
      const isMock = organization.orgId === 'demo-org-001' || user?.uid?.includes('demo-');
      
      try {
        if (isMock) {
          // Get latest audit
          const lastAuditStr = sessionStorage.getItem('fairlens_last_audit');
          const audit = lastAuditStr ? JSON.parse(lastAuditStr).audit : DEMO_AUDITS[2];
          setLatestAudit(audit);
          
          // Get remediation
          const remStr = sessionStorage.getItem('fairlens_remediation');
          if (remStr) {
            setRemediationState(JSON.parse(remStr));
          } else {
            setRemediationState(DEMO_REMEDIATION);
            sessionStorage.setItem('fairlens_remediation', JSON.stringify(DEMO_REMEDIATION));
          }
        } else {
          // Real Firebase mode
          // 1. Get latest complete audit
          const auditQ = query(collection(db, `organizations/${organization.orgId}/audits`), where('status', '==', 'complete'), orderBy('createdAt', 'desc'), limit(1));
          const auditSnap = await getDocs(auditQ);
          let audit = null;
          if (!auditSnap.empty) {
            audit = { id: auditSnap.docs[0].id, ...auditSnap.docs[0].data() };
            setLatestAudit(audit);
          }
          
          // 2. Get active remediation
          const remQ = query(collection(db, `organizations/${organization.orgId}/remediations`), where('status', 'not-in', ['completed', 'rejected']), orderBy('createdAt', 'desc'), limit(1));
          const remSnap = await getDocs(remQ);
          
          if (!remSnap.empty) {
            setRemediationState({ id: remSnap.docs[0].id, ...remSnap.docs[0].data() });
          } else if (audit && audit.metrics.fairnessHealthScore < 80) {
            // Auto generate proposal
            const generatedSummary = await generateBiasFinding(audit.metrics, audit);
            const newRem = {
              remediationId: `rem-${Date.now()}`,
              auditId: audit.id || audit.auditId,
              auditName: audit.audit_cycle_name,
              status: 'pending_hr',
              createdAt: new Date(),
              summary: generatedSummary,
              proposedChanges: [
                { id: 'c1', change: 'Adjust model weighting to prioritize skill scores over proxy indicators.', projectedImpact: 'Expected to improve overall DI ratios by 5-10%.' },
                { id: 'c2', change: 'Implement automated blind resume screening for initial pass.', projectedImpact: 'Removes potential surname and college biases from top-of-funnel.' }
              ],
              projectedMetrics: {
                fairnessHealthScore: Math.min(100, audit.metrics.fairnessHealthScore + 12),
                disparateImpactByCollege: { ratio: Math.min(1.0, audit.metrics.disparateImpactByCollege.ratio + 0.1), status: 'pass' },
                disparateImpactByCity: { ratio: Math.min(1.0, audit.metrics.disparateImpactByCity.ratio + 0.1), status: 'pass' },
                disparateImpactBySurname: { ratio: Math.min(1.0, audit.metrics.disparateImpactBySurname.ratio + 0.1), status: 'pass' },
                accuracyChange: -0.5
              },
              approvalChain: [
                { role: 'hr_officer', name: 'HR Officer', status: 'pending', approvedAt: null },
                { role: 'legal_reviewer', name: 'Legal Reviewer', status: 'pending', approvedAt: null }
              ]
            };
            setRemediationState(newRem);
            // setDoc(doc(db, `organizations/${organization.orgId}/remediations/${newRem.remediationId}`), newRem);
          }
        }
      } catch(err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [organization?.orgId, user?.uid]);
  
  useEffect(() => {
    if (!remediationState || !latestAudit) return;
    const isMock = organization?.orgId === 'demo-org-001' || user?.uid?.includes('demo-');
    
    if (isMock || remediationState.summary) {
      setSummary(remediationState.summary);
    } else {
      generateBiasFinding(latestAudit.metrics, latestAudit).then(setSummary);
    }
  }, [remediationState, latestAudit, organization?.orgId, user?.uid]);

  const saveRemediation = async (updated) => {
    setRemediationState(updated);
    const isMock = organization?.orgId === 'demo-org-001' || user?.uid?.includes('demo-');
    if (isMock) {
      sessionStorage.setItem('fairlens_remediation', JSON.stringify(updated));
    } else {
      // await setDoc(doc(db, `organizations/${organization.orgId}/remediations/${updated.id}`), updated);
    }
  };

  const handleApprove = async () => {
    const updated = { ...remediationState };
    if (user.role === 'hr_officer') {
      updated.approvalChain[0].status = 'approved';
      updated.approvalChain[0].approvedAt = new Date().toISOString();
      updated.status = 'pending_legal';
    } else if (user.role === 'legal_reviewer') {
      updated.approvalChain[1].status = 'approved';
      updated.approvalChain[1].approvedAt = new Date().toISOString();
      updated.status = 'approved';
    }
    await saveRemediation(updated);
    // Notify on final approval
    if (updated.status === 'approved') {
      try { showToast && showToast('Proposal approved. Implementation spec sent to ML team.', 'success'); } catch(e){}
    }
  };

  const handleConfirmAction = async () => {
    if (!actionText.trim()) return;
    const updated = { ...remediationState };
    
    if (activeAction === 'reject') {
      updated.status = 'rejected';
      updated.rejectionReason = actionText;
    } else if (activeAction === 'changes') {
      updated.status = 'changes_requested';
      updated.changesRequested = actionText;
    }
    
    await saveRemediation(updated);
    setActiveAction(null);
    setActionText('');
  };

  if (loading) return <LoadingSpinner />;

  // Task 5: No active proposal state
  const noActiveRemediation = !remediationState || ['approved', 'rejected'].includes(remediationState.status);
  const scoreIsGood = latestAudit && latestAudit.metrics.fairnessHealthScore >= 80;

  if (noActiveRemediation && scoreIsGood) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <CheckCircleIcon className="w-20 h-20 text-success mx-auto mb-6" />
        <h2 className="font-serif text-3xl font-bold text-ink mb-4">No Remediation Required</h2>
        <p className="text-lg text-ink-muted mb-8 max-w-2xl mx-auto">
          Your latest hiring cycle ({latestAudit.audit_cycle_name}) received a Fairness Health Score of {latestAudit.metrics.fairnessHealthScore}/100, within the legal threshold. Continue monitoring to maintain this standard.
        </p>
        <Link to="/monitoring" className="px-6 py-3 bg-accent text-white font-medium rounded hover:opacity-90 transition">
          View Monitoring Dashboard
        </Link>
      </div>
    );
  }

  // Task 4: Reject grey state
  if (remediationState?.status === 'rejected') {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-paper p-8 rounded-lg border border-rule text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-ink-muted mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-ink mb-2">No Active Proposals</h2>
          <p className="text-ink-muted">Proposal rejected. The hiring process will be reviewed and a new proposal generated after the next audit cycle.</p>
        </div>
      </div>
    );
  }

  if (!remediationState || !latestAudit) return null;

  const hrChain = remediationState.approvalChain[0];
  const legalChain = remediationState.approvalChain[1];
  const isHr = user?.role === 'hr_officer';
  const isLegal = user?.role === 'legal_reviewer';

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-ink mb-2">Remediation Proposal</h1>
        <p className="text-ink-muted text-lg">Action plan for: {remediationState.auditName}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section A: What Was Found */}
          <div className="bg-white p-6 rounded-lg border border-rule shadow-sm">
            <h3 className="font-serif text-xl font-bold text-ink mb-3">What Was Found</h3>
            <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>

          {/* Section B: Proposed Changes */}
          <div className="bg-white p-6 rounded-lg border border-rule shadow-sm">
            <h3 className="font-serif text-xl font-bold text-ink mb-4">Proposed Changes</h3>
            <div className="space-y-4">
              {remediationState.proposedChanges.map((change, idx) => (
                <div key={change.id} className="bg-paper-warm p-4 rounded-lg border border-rule">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm text-ink mb-2 font-medium">{change.change}</p>
                      <p className="text-xs text-ink-muted"><span className="font-bold">Projected Impact:</span> {change.projectedImpact}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section C: Projected Outcome */}
          <div className="bg-white p-6 rounded-lg border border-rule shadow-sm">
            <h3 className="font-serif text-xl font-bold text-ink mb-4">Projected Outcome If Changes Are Implemented</h3>
            <div className="grid grid-cols-2 gap-6 bg-paper p-4 rounded border border-rule">
              <div>
                <p className="text-xs font-bold text-ink-muted uppercase mb-3">Before (Current):</p>
                <div className="space-y-2 text-sm text-ink">
                  <p>Health Score: <span className="font-bold">{latestAudit.metrics.fairnessHealthScore}</span></p>
                  <p>College DI: <span className="font-mono">{latestAudit.metrics.disparateImpactByCollege?.ratio?.toFixed(2) || 'N/A'}</span></p>
                  <p>City DI: <span className="font-mono">{latestAudit.metrics.disparateImpactByCity?.ratio?.toFixed(2) || 'N/A'}</span></p>
                  <p>Accuracy change: —</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-ink-muted uppercase mb-3">After (Projected):</p>
                <div className="space-y-2 text-sm text-ink">
                  <p>Health Score: <span className="font-bold text-success">{remediationState.projectedMetrics.fairnessHealthScore}</span></p>
                  <p>College DI: <span className="font-mono text-success">{remediationState.projectedMetrics.disparateImpactByCollege.ratio.toFixed(2)}</span> ✓</p>
                  <p>City DI: <span className="font-mono text-success">{remediationState.projectedMetrics.disparateImpactByCity.ratio.toFixed(2)}</span> ✓</p>
                  <p>Accuracy change: <span className="font-bold">{remediationState.projectedMetrics.accuracyChange}%</span> (acceptable)</p>
                </div>
              </div>
            </div>
          </div>
          
        </div>

        {/* Sidebar: Approval Workflow */}
        <div className="space-y-6">
          <h3 className="font-serif text-xl font-bold text-ink mb-2">Approval Required</h3>
          
          {remediationState.status === 'changes_requested' ? (
            <div className="bg-warn-light p-6 rounded-lg border border-warn text-warn">
              <h4 className="font-bold mb-2">Changes Requested</h4>
              <p className="text-sm">The proposal has been flagged for revision. A new version will be generated after review.</p>
            </div>
          ) : remediationState.status === 'approved' ? (
            <div className="space-y-4">
              <div className="bg-success-light p-6 rounded-lg border border-success text-center">
                <CheckCircleIcon className="w-12 h-12 text-success mx-auto mb-2" />
                <h4 className="font-bold text-success text-lg mb-2">✓ Fully Approved</h4>
                <p className="text-sm text-success font-medium mb-2">This remediation proposal has been approved by both the HR Officer and Legal Reviewer.</p>
                <p className="text-xs text-success">Implementation specification sent to the ML/Data Science team.</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-rule shadow-sm">
                <p className="text-xs text-ink-muted mb-2 font-medium">📧 Email sent to: ml-team@company.com</p>
                <p className="text-sm font-bold text-ink mb-2">Subject: FairLens Remediation — Action Required</p>
                <p className="text-xs text-ink leading-relaxed">
                  The {remediationState.auditName} remediation proposal has been approved. Please review the implementation specification and deploy the changes before the next hiring cycle.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* HR Card */}
              <div className={`p-5 rounded-lg border ${hrChain.status === 'approved' ? 'bg-success-light border-success' : isHr && hrChain.status === 'pending' ? 'bg-white border-accent shadow-md' : 'bg-paper border-rule'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {hrChain.status === 'approved' ? <CheckCircleIcon className="w-5 h-5 text-success" /> : <LockClosedIcon className={`w-5 h-5 ${isHr && hrChain.status === 'pending' ? 'text-accent' : 'text-ink-muted'}`} />}
                  <h4 className={`font-bold ${hrChain.status === 'approved' ? 'text-success' : isHr && hrChain.status === 'pending' ? 'text-ink' : 'text-ink-muted'}`}>HR Officer</h4>
                </div>
                
                {hrChain.status === 'approved' ? (
                  <p className="text-xs text-success font-medium">Approved by {hrChain.name || 'you'}</p>
                ) : (
                  <>
                    <p className={`text-xs mb-4 ${isHr && hrChain.status === 'pending' ? 'text-ink' : 'text-ink-muted'}`}>
                      {isHr && hrChain.status === 'pending' ? 'Your approval is required to proceed.' : 'Awaiting HR Officer approval.'}
                    </p>
                    
                    {isHr && hrChain.status === 'pending' && !activeAction && (
                      <div className="flex flex-col gap-2">
                        <button onClick={handleApprove} className="w-full py-2 bg-success text-white text-sm font-bold rounded hover:opacity-90">Approve</button>
                        <button onClick={() => setActiveAction('changes')} className="w-full py-2 border border-rule text-ink text-sm font-bold rounded hover:bg-paper-warm">Request Changes</button>
                        <button onClick={() => setActiveAction('reject')} className="w-full py-2 border border-accent text-accent text-sm font-bold rounded hover:bg-accent-light">Reject</button>
                      </div>
                    )}

                    {isHr && hrChain.status === 'pending' && activeAction && (
                      <div className="mt-4">
                        <textarea 
                          value={actionText}
                          onChange={(e) => setActionText(e.target.value)}
                          placeholder={activeAction === 'reject' ? 'Reason for rejection (required)...' : 'Describe the changes needed to this proposal...'}
                          className="w-full px-3 py-2 text-sm border border-rule rounded focus:border-accent outline-none mb-2"
                          rows="3"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleConfirmAction} disabled={!actionText.trim()} className="flex-1 py-1.5 bg-accent text-white text-xs font-bold rounded disabled:opacity-50">
                            {activeAction === 'reject' ? 'Confirm Rejection' : 'Submit Request'}
                          </button>
                          <button onClick={() => {setActiveAction(null); setActionText('');}} className="flex-1 py-1.5 border border-rule text-ink text-xs font-bold rounded hover:bg-paper-warm">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Success inline message after HR approval before Legal */}
              {hrChain.status === 'approved' && legalChain.status === 'pending' && isHr && (
                <div className="bg-success-light px-3 py-2 rounded border border-success">
                  <p className="text-xs text-success font-medium">✓ Approved by {hrChain.name}. Awaiting Legal Reviewer: {legalChain.name}.</p>
                </div>
              )}

              {/* Legal Card */}
              <div className={`p-5 rounded-lg border ${legalChain.status === 'approved' ? 'bg-success-light border-success' : isLegal && hrChain.status === 'approved' && legalChain.status === 'pending' ? 'bg-white border-accent shadow-md' : 'bg-paper border-rule'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {legalChain.status === 'approved' ? <CheckCircleIcon className="w-5 h-5 text-success" /> : <LockClosedIcon className={`w-5 h-5 ${isLegal && hrChain.status === 'approved' && legalChain.status === 'pending' ? 'text-accent' : 'text-ink-muted'}`} />}
                  <h4 className={`font-bold ${legalChain.status === 'approved' ? 'text-success' : isLegal && hrChain.status === 'approved' && legalChain.status === 'pending' ? 'text-ink' : 'text-ink-muted'}`}>Legal Reviewer</h4>
                </div>
                
                {legalChain.status === 'approved' ? (
                  <p className="text-xs text-success font-medium">Approved by {legalChain.name || 'you'}</p>
                ) : (
                  <>
                    <p className={`text-xs mb-4 ${isLegal && hrChain.status === 'approved' && legalChain.status === 'pending' ? 'text-ink' : 'text-ink-muted'}`}>
                      {hrChain.status === 'pending' ? 
                        (isLegal ? 'This proposal requires HR Officer approval before Legal review. Please ask the HR Compliance Officer to review first.' : 'Awaiting HR Officer approval first.') :
                        (isLegal && legalChain.status === 'pending' ? 'Your approval is required.' : 'Awaiting Legal Reviewer approval.')}
                    </p>

                    {isLegal && hrChain.status === 'approved' && legalChain.status === 'pending' && !activeAction && (
                      <div className="flex flex-col gap-2">
                        <button onClick={handleApprove} className="w-full py-2 bg-success text-white text-sm font-bold rounded hover:opacity-90">Approve</button>
                        <button onClick={() => setActiveAction('changes')} className="w-full py-2 border border-rule text-ink text-sm font-bold rounded hover:bg-paper-warm">Request Changes</button>
                        <button onClick={() => setActiveAction('reject')} className="w-full py-2 border border-accent text-accent text-sm font-bold rounded hover:bg-accent-light">Reject</button>
                      </div>
                    )}

                    {isLegal && hrChain.status === 'approved' && legalChain.status === 'pending' && activeAction && (
                      <div className="mt-4">
                        <textarea 
                          value={actionText}
                          onChange={(e) => setActionText(e.target.value)}
                          placeholder={activeAction === 'reject' ? 'Reason for rejection (required)...' : 'Describe the changes needed to this proposal...'}
                          className="w-full px-3 py-2 text-sm border border-rule rounded focus:border-accent outline-none mb-2"
                          rows="3"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleConfirmAction} disabled={!actionText.trim()} className="flex-1 py-1.5 bg-accent text-white text-xs font-bold rounded disabled:opacity-50">
                            {activeAction === 'reject' ? 'Confirm Rejection' : 'Submit Request'}
                          </button>
                          <button onClick={() => {setActiveAction(null); setActionText('');}} className="flex-1 py-1.5 border border-rule text-ink text-xs font-bold rounded hover:bg-paper-warm">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
