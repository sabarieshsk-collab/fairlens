import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { generateComplianceReport } from '../services/reportGenerator';
import { DEMO_AUDITS } from '../data/demoAudit';
import { useToast } from '../components/ui/Toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { DocumentArrowDownIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

function ComplianceReports() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [downloaded, setDownloaded] = useState(null);
  const { showToast } = useToast();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [availableAudits, setAvailableAudits] = useState([]);
  const [selectedAuditId, setSelectedAuditId] = useState('');

  useEffect(() => {
    if (!organization?.orgId) {
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
      try {
        const isMock = organization.orgId === 'demo-org-001' || user?.uid?.includes('demo-');
        
        if (isMock) {
          // Source A: DEMO_AUDITS
          const demoReports = DEMO_AUDITS.map(audit => ({
            reportId: 'hist-report-' + audit.auditId,
            auditId: audit.auditId,
            auditName: audit.audit_cycle_name,
            generatedAt: audit.completedAt,
            candidateCount: audit.candidate_count,
            fairnessHealthScore: audit.metrics.fairnessHealthScore,
            disparateImpactSurname: audit.metrics.disparateImpactBySurname.ratio,
            hiringPeriod: audit.start_date + ' to ' + audit.end_date,
            source: 'historical',
            metrics: audit.metrics
          }));

          // Source B: sessionStorage
          const lastAuditStr = sessionStorage.getItem('fairlens_last_audit');
          if (lastAuditStr) {
            const { audit } = JSON.parse(lastAuditStr);
            demoReports.push({
              reportId: 'live-report-' + audit.auditId,
              auditId: audit.auditId,
              auditName: audit.audit_cycle_name,
              generatedAt: audit.completedAt || new Date().toISOString(),
              candidateCount: audit.candidate_count,
              fairnessHealthScore: audit.metrics.fairnessHealthScore,
              disparateImpactSurname: audit.metrics.disparateImpactBySurname.ratio,
              hiringPeriod: audit.start_date + ' to ' + audit.end_date,
              source: 'live',
              metrics: audit.metrics
            });
          }

          demoReports.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
          setReports(demoReports);

          // For the modal dropdown, available audits are these same ones
          setAvailableAudits(demoReports.map(r => ({ id: r.auditId, name: r.auditName, source: r.source })));

        } else {
          // Real Firebase
          const reportsQuery = query(
            collection(db, `organizations/${organization.orgId}/reports`),
            orderBy('generatedAt', 'desc')
          );
          const querySnapshot = await getDocs(reportsQuery);
          const reportsData = [];
          querySnapshot.forEach((doc) => {
            reportsData.push({ id: doc.id, ...doc.data(), source: 'firebase' });
          });
          setReports(reportsData);

          // Fetch audits for the modal dropdown
          const auditsQuery = query(
            collection(db, `organizations/${organization.orgId}/audits`),
            orderBy('completedAt', 'desc')
          );
          const auditsSnapshot = await getDocs(auditsQuery);
          const auditsData = [];
          auditsSnapshot.forEach((doc) => {
            auditsData.push({ id: doc.id, name: doc.data().audit_cycle_name, source: 'firebase' });
          });
          setAvailableAudits(auditsData);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching compliance reports:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchReports();
  }, [organization?.orgId, user?.uid]);

  const showToastMsg = (msg, type = 'error') => {
    showToast(msg, type);
  };

  const loadAuditFromFirestore = async (auditId) => {
    // We already fetch audits logic here, but let's just query the specific document
    // Using getDocs with where if needed, or directly doc if we know it's under audits/auditId
    const { getDoc, doc } = require('firebase/firestore');
    const docRef = doc(db, `organizations/${organization.orgId}/audits/${auditId}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return docSnap.data();
    throw new Error('Audit not found');
  };

  const loadCandidatesFromFirestore = async (auditId) => {
    const candQuery = query(collection(db, `organizations/${organization.orgId}/audits/${auditId}/candidates`));
    const candSnap = await getDocs(candQuery);
    const candidates = [];
    candSnap.forEach(d => candidates.push(d.data()));
    return candidates;
  };

  const handleDownloadPDF = async (report) => {
    setGenerating(report.reportId || report.id);
    try {
      let auditData, candidatesData;

      if (report.source === 'historical') {
        auditData = DEMO_AUDITS.find(a => a.auditId === report.auditId);
        candidatesData = []; 
      } else if (report.source === 'live') {
        const stored = JSON.parse(sessionStorage.getItem('fairlens_last_audit'));
        auditData = stored.audit;
        candidatesData = stored.candidates;
      } else {
        auditData = await loadAuditFromFirestore(report.auditId);
        candidatesData = await loadCandidatesFromFirestore(report.auditId);
      }

      const orgDetails = { name: organization?.name || 'FairLens Demo Org' };
      const doc = generateComplianceReport(auditData, candidatesData, orgDetails);

      const fileName = `fairlens-compliance-report-${(auditData.audit_cycle_name || auditData.cycleName || 'audit').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Brief "Downloaded" state
      const rid = report.reportId || report.id;
      setGenerating(null);
      setDownloaded(rid);
      showToast('Compliance report downloaded successfully.', 'success');
      setTimeout(() => setDownloaded(null), 1500);
    } catch (error) {
      console.error('PDF generation failed:', error);
      showToast('PDF generation failed. Please try again.', 'error');
      setGenerating(null);
    }
  };

  const handleGenerateNewReport = async () => {
    if (!selectedAuditId) return;
    
    // Find the audit info
    const auditObj = availableAudits.find(a => a.id === selectedAuditId);
    if (!auditObj) return;

    setShowModal(false);

    // Build a mock report object to pass to handleDownloadPDF
    const mockReport = {
      reportId: `gen-${Date.now()}`,
      auditId: auditObj.id,
      source: auditObj.source
    };

    await handleDownloadPDF(mockReport);

    // If real firebase, save metadata
    if (auditObj.source === 'firebase') {
      try {
        const auditData = await loadAuditFromFirestore(auditObj.id);
        const reportId = `rep-${Date.now()}`;
        await setDoc(doc(db, `organizations/${organization.orgId}/reports/${reportId}`), {
          reportId,
          auditId: auditObj.id,
          auditName: auditData.audit_cycle_name,
          generatedAt: serverTimestamp(),
          candidateCount: auditData.candidate_count,
          fairnessHealthScore: auditData.metrics.fairnessHealthScore,
          disparateImpactSurname: auditData.metrics.disparateImpactBySurname?.ratio || 1.0,
          hiringPeriod: `${auditData.start_date} to ${auditData.end_date}`
        });
        // We could also refresh reports here
      } catch (err) {
        console.error('Error saving report metadata:', err);
      }
    }
  };

  const handleDeleteReport = async (report) => {
    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    if (report.source === 'historical' || report.source === 'live') {
      showToastMsg('Demo reports cannot be deleted.');
      return;
    }

    setDeleting(report.id);
    try {
      const reportRef = doc(db, `organizations/${organization.orgId}/reports/${report.id}`);
      await deleteDoc(reportRef);
      setReports(reports.filter(r => r.id !== report.id));
    } catch (err) {
      console.error('Error deleting report:', err);
      showToastMsg('Failed to delete report. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getComplianceStatusColor = (score) => {
    if (score >= 80) return 'bg-success text-white';
    if (score >= 60) return 'bg-warn text-white';
    return 'bg-accent text-white';
  };

  const getComplianceStatusText = (score) => {
    if (score >= 80) return 'COMPLIANT';
    if (score >= 60) return 'CAUTION';
    return 'REVIEW REQUIRED';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 relative">
      {/* Toasts handled by ToastProvider */}

      {/* HEADER */}
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h1 className="font-serif text-4xl font-bold text-ink mb-2">Compliance Reports</h1>
          <p className="text-ink-muted text-lg">
            Generated fairness compliance documentation for your hiring audits
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setSelectedAuditId(availableAudits[0]?.id || ''); }}
          className="px-4 py-2 bg-accent text-white font-medium rounded hover:opacity-90 transition"
        >
          Generate New Report
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="bg-accent-light rounded-lg p-8 text-center border-l-4 border-accent">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-light flex items-center justify-center">
            <DocumentArrowDownIcon className="w-8 h-8 text-accent" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-ink mb-2">No Compliance Reports Yet</h2>
          <p className="text-ink-muted text-lg">
            Complete a hiring audit to generate your first compliance report.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((report) => {
            const fairnessScore = report.fairnessHealthScore || 100;
            const statusColor = getComplianceStatusColor(fairnessScore);
            const statusText = getComplianceStatusText(fairnessScore);
            const isGenerating = generating === (report.reportId || report.id);

            return (
              <div key={report.reportId || report.id} className="bg-white rounded-lg shadow-sm border border-rule overflow-hidden hover:shadow-md transition flex flex-col">
                <div className="p-6 border-b border-rule flex-grow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-grow">
                      <h3 className="font-serif text-xl font-bold text-ink mb-1">
                        {report.auditName || 'Unnamed Cycle'}
                      </h3>
                      <p className="text-sm text-ink-muted">
                        Generated {formatDate(report.generatedAt)}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full font-bold text-xs ${statusColor}`}>
                      {statusText}
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm text-ink-muted mb-2">Fairness Health Score</p>
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-full bg-paper flex items-center justify-center">
                          <div className={`absolute inset-0 rounded-full ${
                            fairnessScore >= 80 ? 'bg-success' :
                            fairnessScore >= 60 ? 'bg-warn' :
                            'bg-accent'
                          }`} style={{
                            background: `conic-gradient(
                              ${fairnessScore >= 80 ? '#1a6b3a' : fairnessScore >= 60 ? '#8a5a00' : '#c9400a'} 0deg ${(fairnessScore / 100) * 360}deg,
                              #e0dbd3 ${(fairnessScore / 100) * 360}deg 360deg
                            )`,
                            clipPath: 'inset(0)'
                          }}></div>
                          <span className="relative font-bold text-ink text-sm">{fairnessScore}</span>
                        </div>
                        <div>
                          <p className="font-bold text-ink">{fairnessScore}/100</p>
                          <p className="text-xs text-ink-muted">
                            {fairnessScore >= 80 ? 'Strong compliance' :
                             fairnessScore >= 60 ? 'Areas for improvement' :
                             'Requires review'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-paper-warm rounded p-3 space-y-2">
                      <p className="text-xs font-bold text-ink-muted uppercase">Key Metrics</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-ink-muted">Disparate Impact (Surname)</p>
                          <p className="font-mono font-bold text-ink">{(report.disparateImpactSurname || 1.0).toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-ink-muted">Candidate Count</p>
                          <p className="font-mono font-bold text-ink">{report.candidateCount || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {report.hiringPeriod && (
                      <div className="text-xs text-ink-muted">
                        <p className="font-medium mb-1">Hiring Period</p>
                        <p>{report.hiringPeriod}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-paper-warm px-6 py-3 flex gap-2 border-t border-rule">
                  { /* Button states: Normal / Generating / Done */ }
                  <button
                    onClick={() => handleDownloadPDF(report)}
                    disabled={isGenerating || downloaded === (report.reportId || report.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 font-bold text-sm rounded transition ${
                      downloaded === (report.reportId || report.id) ? 'bg-success text-white cursor-default' : isGenerating ? 'bg-accent opacity-80 text-white cursor-wait' : 'bg-accent text-white hover:opacity-90'
                    }`}
                  >
                    {downloaded === (report.reportId || report.id) ? (
                      <>
                        <CheckCircleIcon className="w-4 h-4" />
                        Downloaded ✓
                      </>
                    ) : isGenerating ? (
                      <>
                        <span className="spinner"></span>
                        Generating...
                      </>
                    ) : (
                      <>
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        Download PDF
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteReport(report)}
                    disabled={deleting === (report.reportId || report.id)}
                    className="px-3 py-2 border border-accent text-accent font-bold text-sm rounded hover:bg-accent-light transition disabled:opacity-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="font-serif text-xl font-bold text-ink mb-4">Generate Compliance Report</h2>
            <div className="mb-6">
              <label className="block text-sm font-medium text-ink mb-2">Select Audit Cycle</label>
              <select
                value={selectedAuditId}
                onChange={(e) => setSelectedAuditId(e.target.value)}
                className="w-full px-3 py-2 border border-rule rounded-lg focus:outline-none focus:border-accent"
              >
                {availableAudits.length === 0 && <option value="">No audits available</option>}
                {availableAudits.map(a => (
                  <option key={a.id} value={a.id}>{a.name || a.id}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-rule text-ink rounded font-medium hover:bg-paper">
                Cancel
              </button>
              <button 
                onClick={handleGenerateNewReport} 
                disabled={!selectedAuditId || !!generating}
                className={`px-4 py-2 font-medium rounded ${!selectedAuditId || !!generating ? 'bg-accent opacity-80 text-white disabled:cursor-wait' : 'bg-accent text-white hover:opacity-90'}`}
              >
                {generating ? (<><span className="spinner"></span> Generating...</>) : 'Generate & Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INFO SECTION */}
      <div className="mt-12 bg-paper rounded-lg p-8">
        <h3 className="font-serif text-lg font-bold text-ink mb-4">About Compliance Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-ink-muted">
          <div>
            <h4 className="font-bold text-ink mb-2">What's Included</h4>
            <ul className="space-y-1">
              <li>• Executive fairness health score</li>
              <li>• Bias metric analysis</li>
              <li>• Legal framework compliance assessment</li>
              <li>• Technical findings with surrogate model insights</li>
              <li>• Signature pages for HR and Legal teams</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-ink mb-2">Legal Frameworks Covered</h4>
            <ul className="space-y-1">
              <li>• Indian Constitution (Articles 15 & 16)</li>
              <li>• SC/ST Prevention of Atrocities Act 1989</li>
              <li>• Companies Act Amendment 2023</li>
              <li>• Digital Personal Data Protection Act 2023</li>
              <li>• EU AI Act 2024 (if applicable)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComplianceReports;
