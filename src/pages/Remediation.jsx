import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { generateBiasFinding } from '../services/gemini';
import LoadingSpinner from '../components/ui/LoadingSpinner';


function Remediation() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [requestChanges, setRequestChanges] = useState('');
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Fetch pending proposal from Firestore
  useEffect(() => {
    if (!organization?.orgId) {
      setLoading(false);
      return;
    }

    const fetchProposal = async () => {
      try {
        const proposalQuery = query(
          collection(db, `organizations/${organization.orgId}/remediation_proposals`),
          where('status', '==', 'pending'),
          orderBy('created_date', 'desc'),
          limit(1)
        );

        const querySnapshot = await getDocs(proposalQuery);
        
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          setProposal({ id: docSnap.id, ...docSnap.data() });
        } else {
          setProposal(null);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching remediation proposal:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchProposal();
  }, [organization?.orgId]);

  // Generate plain English summary from Gemini
  useEffect(() => {
    if (!proposal?.metrics) {
      return;
    }

    const generateSummary = async () => {
      setSummaryLoading(true);
      try {
        const metricsJSON = JSON.stringify(proposal.metrics, null, 2);
        const prompt = `In 2-3 plain English sentences for a non-technical HR compliance officer, describe this hiring bias finding. Be specific about which groups are affected and by how much. Do not use technical jargon. Metrics: ${metricsJSON}`;
        
        const response = await generateBiasFinding(prompt);
        setSummary(response);
      } catch (err) {
        console.error('Error generating summary:', err);
        setSummary('Unable to generate summary at this time. Please review metrics directly.');
      } finally {
        setSummaryLoading(false);
      }
    };

    generateSummary();
  }, [proposal]);

  const handleApprove = async () => {
    if (!proposal?.id) return;
    
    setActionInProgress(true);
    try {
      const proposalRef = doc(db, `organizations/${organization.orgId}/remediation_proposals/${proposal.id}`);
      await updateDoc(proposalRef, {
        status: 'approved_by_hr',
        hr_approval_timestamp: Timestamp.now(),
        hr_officer_id: user.uid,
      });
      
      setProposal({
        ...proposal,
        status: 'approved_by_hr',
        hr_approval_timestamp: Timestamp.now(),
        hr_officer_id: user.uid,
      });
    } catch (err) {
      console.error('Error approving proposal:', err);
      alert('Failed to approve proposal. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    if (!proposal?.id || !rejectReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    
    setActionInProgress(true);
    try {
      const proposalRef = doc(db, `organizations/${organization.orgId}/remediation_proposals/${proposal.id}`);
      await updateDoc(proposalRef, {
        status: 'rejected_by_hr',
        rejection_reason: rejectReason,
        hr_rejection_timestamp: Timestamp.now(),
        hr_officer_id: user.uid,
      });
      
      setProposal({
        ...proposal,
        status: 'rejected_by_hr',
        rejection_reason: rejectReason,
        hr_rejection_timestamp: Timestamp.now(),
        hr_officer_id: user.uid,
      });
      setShowRejectForm(false);
      setRejectReason('');
    } catch (err) {
      console.error('Error rejecting proposal:', err);
      alert('Failed to reject proposal. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!proposal?.id || !requestChanges.trim()) {
      alert('Please specify what changes are needed.');
      return;
    }
    
    setActionInProgress(true);
    try {
      const proposalRef = doc(db, `organizations/${organization.orgId}/remediation_proposals/${proposal.id}`);
      await updateDoc(proposalRef, {
        status: 'changes_requested_by_hr',
        changes_requested: requestChanges,
        hr_changes_request_timestamp: Timestamp.now(),
        hr_officer_id: user.uid,
      });
      
      setProposal({
        ...proposal,
        status: 'changes_requested_by_hr',
        changes_requested: requestChanges,
        hr_changes_request_timestamp: Timestamp.now(),
        hr_officer_id: user.uid,
      });
      setShowChangesForm(false);
      setRequestChanges('');
    } catch (err) {
      console.error('Error requesting changes:', err);
      alert('Failed to request changes. Please try again.');
    } finally {
      setActionInProgress(false);
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

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!proposal) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-accent-light rounded-lg p-8 text-center border-l-4 border-accent">
          <h2 className="font-serif text-2xl font-bold text-ink mb-4">No Pending Remediation Proposals</h2>
          <p className="text-ink-muted text-lg">
            When bias is detected above threshold, FairLens will automatically generate a proposal for your review.
          </p>
        </div>
      </div>
    );
  }

  const isApproved = proposal.status === 'approved_by_hr';
  const isRejected = proposal.status === 'rejected_by_hr';
  const changesRequested = proposal.status === 'changes_requested_by_hr';

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <h1 className="font-serif text-4xl font-bold text-ink">Remediation Proposal</h1>
          <div className="flex gap-2">
            <span className={`px-4 py-2 rounded-full font-bold text-sm ${
              isApproved ? 'bg-success text-white' :
              isRejected ? 'bg-accent text-white' :
              changesRequested ? 'bg-warn text-white' :
              'bg-accent text-white'
            }`}>
              {isApproved ? '✓ APPROVED' : isRejected ? '✗ REJECTED' : changesRequested ? '⚠ CHANGES REQUESTED' : 'PENDING APPROVAL'}
            </span>
          </div>
        </div>
        <p className="text-ink-muted">
          <strong>Created:</strong> {formatDate(proposal.created_date)} 
          {proposal.audit_cycle_name && ` • Cycle: ${proposal.audit_cycle_name}`}
        </p>
      </div>

      {/* SECTION 1: What Was Found */}
      <div className="mb-8 bg-accent-light rounded-lg p-8 border-l-4 border-accent">
        <h2 className="font-serif text-2xl font-bold text-ink mb-4">What Was Found</h2>
        {summaryLoading ? (
          <p className="text-ink-muted italic">Generating summary...</p>
        ) : summary ? (
          <p className="text-ink leading-relaxed">{summary}</p>
        ) : (
          <p className="text-ink leading-relaxed">{proposal.findings_summary || 'Summary not available'}</p>
        )}
      </div>

      {/* SECTION 2: Proposed Changes */}
      <div className="mb-8 bg-white rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 border-b border-rule">
          <h2 className="font-serif text-2xl font-bold text-ink">Proposed Changes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-paper-warm border-b border-rule">
                <th className="px-6 py-3 text-left text-sm font-bold text-ink">Variable</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-ink">Current</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-ink">Proposed</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-ink">Reason</th>
              </tr>
            </thead>
            <tbody>
              {proposal.proposed_changes && proposal.proposed_changes.map((change, idx) => (
                <tr key={idx} className="border-b border-rule hover:bg-paper">
                  <td className="px-6 py-4 text-sm text-ink font-medium">{change.variable}</td>
                  <td className="px-6 py-4 text-sm text-accent bg-accent-light">{change.current}</td>
                  <td className="px-6 py-4 text-sm text-success bg-success-light">{change.proposed}</td>
                  <td className="px-6 py-4 text-sm text-ink-muted">{change.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Projected Impact */}
      <div className="mb-8 bg-white rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 border-b border-rule">
          <h2 className="font-serif text-2xl font-bold text-ink">Projected Impact</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-paper-warm border-b border-rule">
                <th className="px-6 py-3 text-left text-sm font-bold text-ink">Metric</th>
                <th className="px-6 py-3 text-center text-sm font-bold text-ink">Before</th>
                <th className="px-6 py-3 text-center text-sm font-bold text-ink">After</th>
                <th className="px-6 py-3 text-center text-sm font-bold text-ink">Change</th>
              </tr>
            </thead>
            <tbody>
              {proposal.projected_impact && proposal.projected_impact.map((impact, idx) => (
                <tr key={idx} className="border-b border-rule hover:bg-paper">
                  <td className="px-6 py-4 text-sm text-ink font-medium">{impact.metric}</td>
                  <td className="px-6 py-4 text-sm text-center text-ink">{impact.before}</td>
                  <td className="px-6 py-4 text-sm text-center text-ink">{impact.after}</td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className="inline-flex items-center justify-center">
                      {impact.improved ? '✅' : '⚠️'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-paper-warm border-t border-rule text-xs text-ink-muted">
          <strong>Note:</strong> Projected values are estimates based on surrogate model
        </div>
      </div>

      {/* SECTION 4: Approval Chain */}
      {!isRejected && (
        <div className="mb-8 bg-white rounded-lg p-8 shadow-sm">
          <h2 className="font-serif text-2xl font-bold text-ink mb-8">Approval Chain</h2>
          
          <div className="space-y-6">
            {/* Step 1: HR Officer */}
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                isApproved || changesRequested || isRejected ? 'bg-success' : 'bg-accent'
              }`}>
                1
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-ink">HR Officer — YOU</h3>
                <p className="text-sm text-ink-muted">
                  {isApproved || changesRequested || isRejected 
                    ? `Status: ${isApproved ? 'APPROVED' : changesRequested ? 'CHANGES REQUESTED' : 'REJECTED'}` 
                    : 'Status: PENDING'}
                </p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-1 h-8 bg-rule"></div>
            </div>

            {/* Step 2: Legal Reviewer */}
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                isApproved ? 'bg-ink-faint' : 'bg-ink-faint'
              }`}>
                2
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-ink">Legal Reviewer</h3>
                <p className="text-sm text-ink-muted">
                  {isApproved ? 'Status: Awaiting' : 'Status: Awaiting Step 1'}
                </p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-1 h-8 bg-rule"></div>
            </div>

            {/* Step 3: ML Team */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-ink-faint">
                3
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-ink">ML Team</h3>
                <p className="text-sm text-ink-muted">Status: Awaiting Step 2</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION BUTTONS */}
      {!isRejected && !isApproved && !changesRequested && (
        <div className="space-y-4">
          {/* Approve Button */}
          <button
            onClick={handleApprove}
            disabled={actionInProgress}
            className="w-full bg-success text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            {actionInProgress ? 'Processing...' : '✓ APPROVE — Send to Legal Reviewer'}
          </button>

          {/* Reject Section */}
          <div>
            <button
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={actionInProgress}
              className="w-full border-2 border-accent text-accent font-bold py-3 px-6 rounded-lg hover:bg-accent-light disabled:opacity-50 transition"
            >
              ✗ REJECT — With Reason
            </button>
            {showRejectForm && (
              <div className="mt-3 bg-accent-light rounded-lg p-4">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why you are rejecting this proposal..."
                  className="w-full p-3 border border-accent rounded text-sm text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  rows="4"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={actionInProgress}
                    className="flex-1 bg-accent text-white font-bold py-2 px-4 rounded hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {actionInProgress ? 'Processing...' : 'Confirm Rejection'}
                  </button>
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="flex-1 border border-accent text-accent font-bold py-2 px-4 rounded hover:bg-accent-light transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Request Changes Section */}
          <div>
            <button
              onClick={() => setShowChangesForm(!showChangesForm)}
              disabled={actionInProgress}
              className="w-full border-2 border-warn text-warn font-bold py-3 px-6 rounded-lg hover:bg-warn-light disabled:opacity-50 transition"
            >
              ⚠ REQUEST CHANGES
            </button>
            {showChangesForm && (
              <div className="mt-3 bg-warn-light rounded-lg p-4">
                <textarea
                  value={requestChanges}
                  onChange={(e) => setRequestChanges(e.target.value)}
                  placeholder="Specify what changes are needed to this proposal..."
                  className="w-full p-3 border border-warn rounded text-sm text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-warn"
                  rows="4"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleRequestChanges}
                    disabled={actionInProgress}
                    className="flex-1 bg-warn text-white font-bold py-2 px-4 rounded hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {actionInProgress ? 'Processing...' : 'Submit Changes'}
                  </button>
                  <button
                    onClick={() => setShowChangesForm(false)}
                    className="flex-1 border border-warn text-warn font-bold py-2 px-4 rounded hover:bg-warn-light transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Messages */}
      {isApproved && (
        <div className="bg-success-light rounded-lg p-6 border-l-4 border-success">
          <p className="text-success font-bold">✓ This proposal has been approved by HR. It is now awaiting review by the Legal team.</p>
        </div>
      )}

      {isRejected && (
        <div className="bg-accent-light rounded-lg p-6 border-l-4 border-accent">
          <p className="text-accent font-bold mb-2">✗ This proposal has been rejected.</p>
          {proposal.rejection_reason && (
            <p className="text-ink-muted text-sm">Reason: {proposal.rejection_reason}</p>
          )}
        </div>
      )}

      {changesRequested && (
        <div className="bg-warn-light rounded-lg p-6 border-l-4 border-warn">
          <p className="text-warn font-bold mb-2">⚠ Changes requested by HR</p>
          {proposal.changes_requested && (
            <p className="text-ink-muted text-sm">Changes needed: {proposal.changes_requested}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Remediation;
