import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { collection, query, where, orderBy, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { DEMO_AUDITS } from '../data/demoAudit';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function Monitoring() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [allAudits, setAllAudits] = useState([]);
  
  // Thresholds state
  const [thresholds, setThresholds] = useState({
    diMin: 0.80,
    eoMax: 10,
    healthMin: 60
  });
  const [savingThresholds, setSavingThresholds] = useState(false);

  // Load Audits
  useEffect(() => {
    if (!organization?.orgId) {
      setLoading(false);
      return;
    }

    const fetchAudits = async () => {
      try {
        const isMock = organization.orgId === 'demo-org-001' || user?.uid?.includes('demo-');
        let audits = [];

        if (isMock) {
          // Merge DEMO_AUDITS with sessionStorage history
          const historyStr = sessionStorage.getItem('fairlens_audit_history');
          const history = historyStr ? JSON.parse(historyStr) : [];
          
          // Add DEMO_AUDITS
          audits = [...DEMO_AUDITS];
          
          // Add history if not already there
          history.forEach(ha => {
            if (!audits.find(a => a.auditId === ha.auditId)) {
              audits.push(ha);
            }
          });

          // Sort oldest to newest (by createdAt or completedAt)
          audits.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.completedAt || 0);
            const dateB = new Date(b.createdAt || b.completedAt || 0);
            return dateA - dateB;
          });
        } else {
          // Real Firebase
          const auditsQuery = query(
            collection(db, `organizations/${organization.orgId}/audits`),
            where('status', '==', 'complete'),
            orderBy('createdAt', 'asc')
          );
          const snap = await getDocs(auditsQuery);
          snap.forEach(doc => {
            audits.push({ id: doc.id, ...doc.data() });
          });
        }
        
        setAllAudits(audits);

        // Load Thresholds
        if (isMock) {
          const stored = localStorage.getItem('fairlens_thresholds');
          if (stored) setThresholds(JSON.parse(stored));
        } else {
          // Could load from org doc, but for simplicity, default or use local if exists
          const stored = localStorage.getItem('fairlens_thresholds');
          if (stored) setThresholds(JSON.parse(stored));
        }

      } catch (err) {
        console.error('Error loading monitoring data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAudits();
  }, [organization?.orgId, user?.uid]);

  // Save thresholds
  const handleSaveThresholds = async () => {
    setSavingThresholds(true);
    try {
      const isMock = organization?.orgId === 'demo-org-001' || user?.uid?.includes('demo-');
      if (isMock) {
        localStorage.setItem('fairlens_thresholds', JSON.stringify(thresholds));
      } else {
        localStorage.setItem('fairlens_thresholds', JSON.stringify(thresholds));
        // Real: await setDoc(doc(db, 'organizations', organization.orgId), { thresholds }, { merge: true });
      }
      // Re-trigger calculations based on new thresholds is automatic via state update
    } catch(err) {
      console.error(err);
    } finally {
      setTimeout(() => setSavingThresholds(false), 500);
    }
  };

  // Helper functions
  const abbreviateAuditName = (name) => {
    if (!name) return 'Audit';
    const match = name.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    if (match) return `${match[1].substring(0,3)} '${match[2].substring(2)}`;
    return name.length > 12 ? name.substring(0, 10) + '...' : name;
  };

  // Dynamic status based on thresholds
  const getDiStatus = (val) => val < thresholds.diMin ? 'violation' : 'pass';
  const getEoStatus = (val) => (val * 100) > thresholds.eoMax ? 'violation' : 'pass';
  
  // Derived data
  const mostRecentAudit = allAudits[allAudits.length - 1];
  const previousAudit = allAudits[allAudits.length - 2];
  
  const scoreTrend = (mostRecentAudit && previousAudit) 
    ? (mostRecentAudit.metrics.fairnessHealthScore - previousAudit.metrics.fairnessHealthScore) 
    : 0;

  // Violations this quarter (last 90 days)
  const violationsThisQuarter = useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    return allAudits.filter(a => {
      const date = new Date(a.completedAt || a.createdAt);
      if (date < ninetyDaysAgo) return false;
      
      const m = a.metrics;
      if (
        getDiStatus(m.disparateImpactByCollege?.ratio || 1.0) === 'violation' ||
        getDiStatus(m.disparateImpactByCity?.ratio || 1.0) === 'violation' ||
        getDiStatus(m.disparateImpactBySurname?.ratio || 1.0) === 'violation' ||
        getEoStatus(m.equalOpportunityDiff || 0) === 'violation'
      ) {
        return true;
      }
      return false;
    }).length;
  }, [allAudits, thresholds]);

  // Alert History
  const alerts = useMemo(() => {
    const list = [];
    const mostRecentId = mostRecentAudit?.auditId || mostRecentAudit?.id;
    
    allAudits.forEach(audit => {
      const m = audit.metrics;
      const checks = [
        { key: 'college', label: 'College Tier DI', value: m.disparateImpactByCollege?.ratio || 1.0, status: getDiStatus(m.disparateImpactByCollege?.ratio || 1.0), threshold: thresholds.diMin },
        { key: 'city', label: 'City Tier DI', value: m.disparateImpactByCity?.ratio || 1.0, status: getDiStatus(m.disparateImpactByCity?.ratio || 1.0), threshold: thresholds.diMin },
        { key: 'surname', label: 'Surname DI', value: m.disparateImpactBySurname?.ratio || 1.0, status: getDiStatus(m.disparateImpactBySurname?.ratio || 1.0), threshold: thresholds.diMin },
        { key: 'eo', label: 'Equal Opportunity Diff', value: (m.equalOpportunityDiff || 0) * 100, status: getEoStatus(m.equalOpportunityDiff || 0), threshold: thresholds.eoMax }
      ];
      
      checks.forEach(check => {
        if (check.status === 'violation') {
          list.push({
            date: audit.completedAt || audit.createdAt,
            metric: check.label,
            value: check.key === 'eo' ? `${check.value.toFixed(1)}%` : check.value.toFixed(2),
            threshold: check.threshold,
            severity: 'Critical',
            auditName: audit.audit_cycle_name || audit.cycleName || 'Audit',
            resolved: (audit.auditId || audit.id) !== mostRecentId
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allAudits, thresholds, mostRecentAudit]);

  // Chart Data
  const scoreChartData = allAudits.map(a => ({
    name: abbreviateAuditName(a.audit_cycle_name || a.cycleName),
    score: a.metrics.fairnessHealthScore,
    auditName: a.audit_cycle_name || a.cycleName,
    date: new Date(a.completedAt || a.createdAt).toLocaleDateString()
  }));

  const diChartData = allAudits.map(a => ({
    name: abbreviateAuditName(a.audit_cycle_name || a.cycleName),
    college: a.metrics.disparateImpactByCollege?.ratio || 1.0,
    city: a.metrics.disparateImpactByCity?.ratio || 1.0,
    surname: a.metrics.disparateImpactBySurname?.ratio || 1.0,
    auditName: a.audit_cycle_name || a.cycleName
  }));

  if (loading) return <LoadingSpinner />;

  if (allAudits.length < 2) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold text-ink mb-4">Run at least 2 hiring audits to see fairness trends.</h2>
        <p className="text-ink-muted mb-6">Trend analysis requires multiple data points.</p>
        <Link to="/new-audit" className="px-6 py-3 bg-accent text-white font-medium rounded hover:opacity-90 transition">
          Start New Audit
        </Link>
      </div>
    );
  }

  // Custom Dot for Health Score Chart
  const CustomScoreDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    let fill = '#1A6B3A';
    if (payload.score < thresholds.healthMin) fill = '#C9400A';
    else if (payload.score < 80) fill = '#8A5A00'; // Hardcoded amber line at 80
    
    return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={2} />;
  };

  const ScoreTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const score = data.score;
      let status = 'Within threshold';
      if (score < thresholds.healthMin) status = 'Below threshold — action required';
      else if (score < 80) status = 'Approaching threshold';

      return (
        <div className="bg-white border border-rule p-3 shadow-lg rounded max-w-xs">
          <p className="font-bold text-ink mb-1">{data.auditName}</p>
          <p className="text-sm text-ink-muted mb-2">{data.date}</p>
          <p className="font-mono font-bold text-lg mb-1">Score: {score}</p>
          <p className={`text-xs font-bold ${score < thresholds.healthMin ? 'text-accent' : score < 80 ? 'text-warn' : 'text-success'}`}>{status}</p>
        </div>
      );
    }
    return null;
  };

  const DiTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-rule p-3 shadow-lg rounded w-56">
          <p className="font-bold text-ink mb-2">{data.auditName}</p>
          <div className="space-y-1">
            {payload.map((p, i) => {
              const isViolation = p.value < thresholds.diMin;
              return (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span style={{ color: p.color }}>{p.name}:</span>
                  <span className={`font-mono font-bold ${isViolation ? 'text-accent' : 'text-ink'}`}>
                    {p.value.toFixed(2)}
                    {isViolation && <span className="ml-1 text-xs">⚠️</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-rule text-xs">
            {payload.some(p => p.value < thresholds.diMin) ? (
              <span className="text-accent font-bold">VIOLATION</span>
            ) : (
              <span className="text-success font-bold">OK</span>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* SECTION 1: Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-serif text-4xl font-bold text-ink mb-2">Fairness Monitoring</h1>
          <p className="text-ink-muted text-lg">Track how your hiring AI's bias patterns change across hiring cycles</p>
        </div>
        <Link to="/new-audit" className="px-6 py-3 bg-accent text-white font-medium rounded hover:opacity-90 transition">
          Start New Audit
        </Link>
      </div>

      {/* SECTION 2: Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-lg border border-rule shadow-sm">
          <p className="text-sm font-bold text-ink-muted uppercase mb-1">Hiring cycles audited</p>
          <p className="font-serif text-3xl font-bold text-ink">{allAudits.length}</p>
        </div>
        
        <div className="bg-white p-5 rounded-lg border border-rule shadow-sm">
          <p className="text-sm font-bold text-ink-muted uppercase mb-1">Latest Fairness Health Score</p>
          <p className={`font-serif text-3xl font-bold ${
            mostRecentAudit?.metrics.fairnessHealthScore < thresholds.healthMin ? 'text-accent' : 
            mostRecentAudit?.metrics.fairnessHealthScore < 80 ? 'text-warn' : 'text-success'
          }`}>
            {mostRecentAudit?.metrics.fairnessHealthScore || 'N/A'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-rule shadow-sm">
          <p className="text-sm font-bold text-ink-muted uppercase mb-1">Change since last audit</p>
          <div className="flex items-center gap-2">
            <span className={`font-serif text-3xl font-bold ${scoreTrend > 0 ? 'text-success' : scoreTrend < 0 ? 'text-accent' : 'text-ink'}`}>
              {scoreTrend > 0 ? '+' : ''}{scoreTrend}
            </span>
            {scoreTrend !== 0 && (
              <span className={`text-xl ${scoreTrend > 0 ? 'text-success' : 'text-accent'}`}>
                {scoreTrend > 0 ? '▲' : '▼'}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-rule shadow-sm">
          <p className="text-sm font-bold text-ink-muted uppercase mb-1">Active threshold violations</p>
          <p className={`font-serif text-3xl font-bold ${violationsThisQuarter > 0 ? 'text-accent' : 'text-success'}`}>
            {violationsThisQuarter}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Main Charts Area */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* SECTION 4: Fairness Health Score Trend Chart */}
          <div className="bg-white p-6 rounded-lg border border-rule shadow-sm">
            <div className="mb-6">
              <h3 className="font-serif text-xl font-bold text-ink mb-1">Fairness Health Score Over Time</h3>
              <p className="text-sm text-ink-muted">Each data point represents one completed hiring cycle</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0DBD3" />
                  <XAxis dataKey="name" tick={{fill: '#6D675F', fontSize: 12}} tickLine={false} axisLine={{stroke: '#E0DBD3'}} />
                  <YAxis domain={[0, 100]} label={{ value: 'Fairness Score', angle: -90, position: 'insideLeft', fill: '#6D675F' }} tick={{fill: '#6D675F'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<ScoreTooltip />} />
                  <ReferenceLine y={80} stroke="#1A6B3A" strokeDasharray="5 5" label={{ value: "Legal Threshold", position: "right", fill: "#1A6B3A", fontSize: 12 }} />
                  <ReferenceLine y={thresholds.healthMin} stroke="#C9400A" strokeDasharray="5 5" label={{ value: "Action Required", position: "right", fill: "#C9400A", fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke="#1A6B3A" strokeWidth={2} dot={<CustomScoreDot />} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SECTION 5: Per-Proxy Disparate Impact Trends */}
          <div className="bg-white p-6 rounded-lg border border-rule shadow-sm">
            <div className="mb-6">
              <h3 className="font-serif text-xl font-bold text-ink mb-1">Disparate Impact Ratios by Proxy Variable</h3>
              <p className="text-sm text-ink-muted">Values below 0.80 indicate potential legal exposure</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={diChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0DBD3" />
                  <XAxis dataKey="name" tick={{fill: '#6D675F', fontSize: 12}} tickLine={false} axisLine={{stroke: '#E0DBD3'}} />
                  <YAxis domain={[0, 1.2]} label={{ value: 'Disparate Impact Ratio', angle: -90, position: 'insideLeft', fill: '#6D675F' }} tick={{fill: '#6D675F'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<DiTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  <ReferenceLine y={thresholds.diMin} stroke="#555" strokeDasharray="4 4" label={{ value: `Legal Minimum (${thresholds.diMin})`, position: "right", fill: "#555", fontSize: 11 }} />
                  
                  <Line type="monotone" dataKey="college" name="College Tier" stroke="#C9400A" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="city" name="City Tier" stroke="#1A4D7A" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="surname" name="Surname" stroke="#6B3FA0" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          
          {/* SECTION 3: Alert Threshold Configuration */}
          <div className="bg-white p-6 rounded-lg border border-rule shadow-sm">
            <h3 className="font-serif text-xl font-bold text-ink mb-4">Alert Thresholds</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="flex justify-between items-center text-sm font-medium text-ink mb-1">
                  Disparate Impact Min
                  {mostRecentAudit && (
                    <span className="flex items-center gap-1 text-xs font-normal">
                      {(mostRecentAudit.metrics.disparateImpactByCollege?.ratio < thresholds.diMin || 
                        mostRecentAudit.metrics.disparateImpactByCity?.ratio < thresholds.diMin || 
                        mostRecentAudit.metrics.disparateImpactBySurname?.ratio < thresholds.diMin) 
                        ? <><span className="w-2 h-2 rounded-full bg-accent"></span> Below threshold</>
                        : <><span className="w-2 h-2 rounded-full bg-success"></span> Within threshold</>
                      }
                    </span>
                  )}
                </label>
                <input 
                  type="number" step="0.05"
                  value={thresholds.diMin}
                  onChange={(e) => setThresholds(p => ({...p, diMin: parseFloat(e.target.value)}))}
                  className="w-full px-3 py-2 border border-rule rounded focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="flex justify-between items-center text-sm font-medium text-ink mb-1">
                  Eq. Opportunity Max Diff (%)
                  {mostRecentAudit && (
                    <span className="flex items-center gap-1 text-xs font-normal">
                      {(mostRecentAudit.metrics.equalOpportunityDiff * 100) > thresholds.eoMax
                        ? <><span className="w-2 h-2 rounded-full bg-accent"></span> Below threshold</>
                        : <><span className="w-2 h-2 rounded-full bg-success"></span> Within threshold</>
                      }
                    </span>
                  )}
                </label>
                <input 
                  type="number" step="1"
                  value={thresholds.eoMax}
                  onChange={(e) => setThresholds(p => ({...p, eoMax: parseFloat(e.target.value)}))}
                  className="w-full px-3 py-2 border border-rule rounded focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="flex justify-between items-center text-sm font-medium text-ink mb-1">
                  Health Score Min
                  {mostRecentAudit && (
                    <span className="flex items-center gap-1 text-xs font-normal">
                      {mostRecentAudit.metrics.fairnessHealthScore < thresholds.healthMin
                        ? <><span className="w-2 h-2 rounded-full bg-accent"></span> Below threshold</>
                        : <><span className="w-2 h-2 rounded-full bg-success"></span> Within threshold</>
                      }
                    </span>
                  )}
                </label>
                <input 
                  type="number" step="5"
                  value={thresholds.healthMin}
                  onChange={(e) => setThresholds(p => ({...p, healthMin: parseInt(e.target.value)}))}
                  className="w-full px-3 py-2 border border-rule rounded focus:border-accent outline-none"
                />
              </div>
            </div>

            <button 
              onClick={handleSaveThresholds}
              className="w-full px-4 py-2 bg-paper border border-rule hover:bg-paper-warm text-ink font-bold rounded transition"
            >
              {savingThresholds ? 'Saved!' : 'Save Thresholds'}
            </button>
          </div>

        </div>
      </div>

      {/* SECTION 6: Alert History Table */}
      <div className="bg-white rounded-lg border border-rule shadow-sm overflow-hidden">
        <div className="p-6 border-b border-rule bg-paper">
          <h3 className="font-serif text-xl font-bold text-ink">Alert History</h3>
        </div>
        
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-ink-muted">
            <p>No threshold breaches detected.</p>
            <p>All metrics are within acceptable ranges.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper-warm text-ink-muted">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Audit</th>
                  <th className="px-6 py-3 font-medium">Metric</th>
                  <th className="px-6 py-3 font-medium">Value</th>
                  <th className="px-6 py-3 font-medium">Threshold</th>
                  <th className="px-6 py-3 font-medium">Severity</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {alerts.map((alert, idx) => (
                  <tr key={idx} className="hover:bg-paper-warm transition">
                    <td className="px-6 py-4 text-ink">{new Date(alert.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-medium text-ink">{alert.auditName}</td>
                    <td className="px-6 py-4 text-ink-muted">{alert.metric}</td>
                    <td className="px-6 py-4 font-mono font-bold text-ink">{alert.value}</td>
                    <td className="px-6 py-4 font-mono text-ink-muted">{alert.threshold}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        alert.severity === 'Critical' ? 'bg-accent text-white' : 'bg-warn text-ink'
                      }`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {alert.resolved ? (
                        <span className="flex items-center gap-1.5 text-xs text-ink-muted bg-paper px-2 py-1 rounded-full w-fit">
                          <span className="w-2 h-2 rounded-full bg-rule"></span>
                          Resolved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-accent bg-accent-light px-2 py-1 rounded-full w-fit">
                          <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
