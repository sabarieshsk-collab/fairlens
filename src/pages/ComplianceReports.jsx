import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { generateComplianceReport } from '../services/reportGenerator';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { DocumentArrowDownIcon, EyeIcon, TrashIcon } from '@heroicons/react/24/outline';

function ComplianceReports() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Fetch all generated compliance reports
  useEffect(() => {
    if (!organization?.orgId) {
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
      try {
        const reportsQuery = query(
          collection(db, `organizations/${organization.orgId}/compliance_reports`),
          orderBy('generated_date', 'desc')
        );

        const querySnapshot = await getDocs(reportsQuery);
        const reportsData = [];

        querySnapshot.forEach((doc) => {
          reportsData.push({
            id: doc.id,
            ...doc.data()
          });
        });

        setReports(reportsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching compliance reports:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchReports();
  }, [organization?.orgId]);

  const handleDownloadPDF = (report) => {
    try {
      // Generate fresh PDF from report data
      const doc = generateComplianceReport(
        {
          cycleName: report.audit_cycle_name,
          startDate: report.start_date,
          endDate: report.end_date,
          candidateCount: report.candidate_count,
          modelAccuracy: report.model_accuracy
        },
        report.metrics,
        organization
      );

      const fileName = `fairlens-compliance-report-${report.audit_cycle_name?.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    setDeleting(reportId);
    try {
      const reportRef = doc(db, `organizations/${organization.orgId}/compliance_reports/${reportId}`);
      await deleteDoc(reportRef);
      setReports(reports.filter(r => r.id !== reportId));
    } catch (err) {
      console.error('Error deleting report:', err);
      alert('Failed to delete report. Please try again.');
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

  const calculateFairnessScore = (metrics) => {
    let score = 100;
    if (metrics.disparateImpactBySurname > 1.25) score -= 30;
    else if (metrics.disparateImpactBySurname > 1.1) score -= 15;
    if (metrics.disparateImpactByCollege > 1.25) score -= 15;
    else if (metrics.disparateImpactByCollege > 1.1) score -= 8;
    if (metrics.disparateImpactByCity > 1.25) score -= 15;
    else if (metrics.disparateImpactByCity > 1.1) score -= 8;
    if (metrics.equalOpportunityDiff > 0.2) score -= 10;
    else if (metrics.equalOpportunityDiff > 0.1) score -= 5;
    return Math.max(0, Math.min(100, score));
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (reports.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-accent-light rounded-lg p-8 text-center border-l-4 border-accent">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-light flex items-center justify-center">
            <DocumentArrowDownIcon className="w-8 h-8 text-accent" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-ink mb-2">No Compliance Reports Yet</h2>
          <p className="text-ink-muted text-lg">
            Complete a hiring audit to generate your first compliance report.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* HEADER */}
      <div className="mb-12">
        <h1 className="font-serif text-4xl font-bold text-ink mb-2">Compliance Reports</h1>
        <p className="text-ink-muted text-lg">
          Generated fairness compliance documentation for your hiring audits
        </p>
      </div>

      {/* REPORTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => {
          const fairnessScore = calculateFairnessScore(report.metrics);
          const statusColor = getComplianceStatusColor(fairnessScore);
          const statusText = getComplianceStatusText(fairnessScore);

          return (
            <div key={report.id} className="bg-white rounded-lg shadow-sm border border-rule overflow-hidden hover:shadow-md transition">
              {/* Card Header */}
              <div className="p-6 border-b border-rule">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-grow">
                    <h3 className="font-serif text-xl font-bold text-ink mb-1">
                      {report.audit_cycle_name || 'Unnamed Cycle'}
                    </h3>
                    <p className="text-sm text-ink-muted">
                      Generated {formatDate(report.generated_date)}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full font-bold text-xs ${statusColor}`}>
                    {statusText}
                  </div>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-6 space-y-4">
                {/* Fairness Score */}
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

                {/* Metrics Summary */}
                <div className="bg-paper-warm rounded p-3 space-y-2">
                  <p className="text-xs font-bold text-ink-muted uppercase">Key Metrics</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-ink-muted">Disparate Impact (Surname)</p>
                      <p className="font-mono font-bold text-ink">{(report.metrics?.disparateImpactBySurname || 1.0).toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-ink-muted">Candidate Count</p>
                      <p className="font-mono font-bold text-ink">{report.candidate_count || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Date Range */}
                {report.start_date && report.end_date && (
                  <div className="text-xs text-ink-muted">
                    <p className="font-medium mb-1">Hiring Period</p>
                    <p>{formatDate(report.start_date)} to {formatDate(report.end_date)}</p>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="bg-paper-warm px-6 py-3 flex gap-2 border-t border-rule">
                <button
                  onClick={() => handleDownloadPDF(report)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-success text-white font-bold text-sm rounded hover:opacity-90 transition"
                >
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={() => handleDeleteReport(report.id)}
                  disabled={deleting === report.id}
                  className="px-3 py-2 border border-accent text-accent font-bold text-sm rounded hover:bg-accent-light transition disabled:opacity-50"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
