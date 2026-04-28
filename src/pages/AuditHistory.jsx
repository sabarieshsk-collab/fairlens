import { DEMO_AUDITS } from '../data/demoAudit';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function AuditHistory() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-rule">
        <h2 className="font-serif text-2xl font-bold text-ink mb-6">Audit History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-rule bg-paper">
                <th className="px-6 py-4 text-sm font-semibold text-ink-muted">Audit Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-ink-muted">Date Range</th>
                <th className="px-6 py-4 text-sm font-semibold text-ink-muted">Candidates</th>
                <th className="px-6 py-4 text-sm font-semibold text-ink-muted">Fairness Score</th>
                <th className="px-6 py-4 text-sm font-semibold text-ink-muted">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-ink-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_AUDITS.map((audit) => {
                const healthScore = audit.metrics?.fairnessHealthScore || 0;
                const scoreColor = healthScore >= 75 ? 'text-success' : healthScore >= 50 ? 'text-warn' : 'text-accent';
                
                return (
                  <tr key={audit.auditId} className="border-b border-rule hover:bg-paper-warm transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-ink">{audit.audit_cycle_name}</div>
                      <div className="text-xs text-ink-muted">{audit.job_role}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-muted">
                      {format(new Date(audit.start_date), 'MMM d, yyyy')} - {format(new Date(audit.end_date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink">{audit.candidate_count}</td>
                    <td className={`px-6 py-4 text-lg font-mono font-bold ${scoreColor}`}>
                      {healthScore}/100
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-bold rounded bg-success text-white">
                        {audit.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        to="/dashboard"
                        state={{ auditId: audit.auditId }}
                        className="text-accent hover:text-accent2 font-medium"
                      >
                        View Audit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
