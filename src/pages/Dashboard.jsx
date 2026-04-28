import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useLocation, Link } from 'react-router-dom';
import { DEMO_AUDITS } from '../data/demoAudit';

// Custom Tooltip for bar charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-rule p-3 shadow-lg rounded">
        <p className="font-semibold text-ink">{data.tier || label}: {data.rate}% hired ({data.count} candidates)</p>
      </div>
    );
  }
  return null;
};

// Sub-component: Metric Card
function MetricCard({ title, value, status, explanation, threshold }) {
  const statusColor = status === 'violation' ? 'text-accent border-l-4 border-accent bg-accent-light' :
    status === 'warning' ? 'text-warn border-l-4 border-warn bg-warn-light' :
    'text-success border-l-4 border-success bg-success-light';

  const badgeColor = status === 'violation' ? 'bg-accent text-white' :
    status === 'warning' ? 'bg-warn text-white' :
    'bg-success text-white';

  return (
    <div className={`rounded-lg p-6 ${statusColor.split(' bg-')[1] ? 'bg-' + statusColor.split(' bg-')[1] : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-medium text-ink">{title}</h3>
        <span className={`px-2 py-1 text-xs font-bold rounded ${badgeColor}`}>
          {status.toUpperCase()}
        </span>
      </div>
      <div className="mb-3">
        <p className="font-mono text-3xl font-bold text-ink">{value}</p>
      </div>
      <p className="text-sm text-ink-muted mb-2">{explanation}</p>
      <p className="text-xs text-ink-muted">{threshold}</p>
    </div>
  );
}

function generateProxySentence(proxyName, ratio) {
  const pct = Math.round(ratio * 100);
  const proxyLabels = {
    college: 'Candidates from non-premier institutions',
    city: 'Candidates from Tier 2 and Tier 3 cities',
    surname: 'Candidates with surnames associated with historically marginalized communities',
    company: 'Candidates from lower-tier previous employers',
    gap: 'Candidates with employment gaps'
  };
  const label = proxyLabels[proxyName] || proxyName;
  const status = ratio < 0.80 ? 'below the legal threshold' :
                 ratio < 0.90 ? 'approaching the legal threshold' :
                 'within acceptable range';
  return `${label} are selected at ${pct}% the rate of candidates from advantaged backgrounds — ${status}.`;
}

function normalizeProxyRankingEntry(entry) {
  if (typeof entry === 'string') {
    return { proxy: entry, score: null, debug: null };
  }
  if (entry && typeof entry === 'object') {
    const proxy = typeof entry.proxy === 'string' ? entry.proxy : null;
    const score = typeof entry.score === 'number' ? entry.score : null;
    return {
      proxy,
      score,
      debug: proxy ? null : JSON.stringify(entry, null, 2)
    };
  }
  return {
    proxy: null,
    score: null,
    debug: JSON.stringify(entry, null, 2)
  };
}

// Sub-component: Proxy Rankings Table
function ProxyRankingsTable({ rankings, disparateImpacts, proxyCorrelations }) {
  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <div className="p-6 border-b border-rule">
        <h2 className="font-serif text-2xl font-bold text-ink">Bias Drivers — Ranked by Severity</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rule bg-paper">
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">Rank</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">Variable</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">Correlation</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((entry, idx) => {
              const normalized = normalizeProxyRankingEntry(entry);
              const proxyName = normalized.proxy || 'unknown';
              const diData = disparateImpacts[proxyName];
              const status = diData?.status || 'compliant';
              const rowBg = status === 'violation' ? 'bg-accent-light' : status === 'warning' ? 'bg-warn-light' : '';
              const score = normalized.score ?? proxyCorrelations?.[proxyName] ?? 0;
              const variableLabel = normalized.proxy
                ? proxyName
                : `Unknown (${normalized.debug || 'unrecognized structure'})`;

              return (
                <tr key={`${proxyName}-${idx}`} className={`border-b border-rule ${rowBg}`}>
                  <td className="px-6 py-4 text-sm font-semibold text-ink">{idx + 1}</td>
                  <td className="px-6 py-4 text-sm text-ink capitalize">{variableLabel}</td>
                  <td className="px-6 py-4 text-sm font-mono text-ink">
                    {Number.isFinite(score) ? score.toFixed(2) : '0.00'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${
                      status === 'violation' ? 'bg-accent text-white' :
                      status === 'warning' ? 'bg-warn text-white' :
                      'bg-success text-white'
                    }`}>
                      {status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 bg-paper border-t border-rule">
        {rankings.map((entry, idx) => {
          const normalized = normalizeProxyRankingEntry(entry);
          const proxyName = normalized.proxy || 'unknown';
          const ratio = disparateImpacts[proxyName]?.ratio || 1;
          const label = normalized.proxy
            ? proxyName
            : `unknown (${normalized.debug || 'unrecognized structure'})`;
          return (
            <p key={`finding-${proxyName}-${idx}`} className="text-sm text-ink-muted mb-2">
              <strong className="text-ink capitalize">{label}:</strong> {generateProxySentence(proxyName, ratio)}
            </p>
          );
        })}
      </div>
    </div>
  );
}

// Sub-component: Candidate Table with filtering
function CandidateTable({ candidates, onSelectCandidate, isHistorical }) {
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [proxyFilter, setProxyFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

  if (isHistorical) {
    return (
      <div className="bg-white rounded-lg p-8 text-center border border-rule">
        <h2 className="font-serif text-2xl font-bold text-ink mb-2">Candidate Details</h2>
        <p className="text-ink-muted">Candidate-level data for historical audits is not available in this view. Run a new audit to see individual candidate details.</p>
      </div>
    );
  }

  const filtered = candidates.filter(c => {
    if (decisionFilter !== 'all' && c.decision !== decisionFilter) return false;
    if (proxyFilter === 'flagged' && !c.flagged) return false;
    if (tierFilter !== 'all' && c.collegeTier !== parseInt(tierFilter)) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <div className="p-6 border-b border-rule">
        <h2 className="font-serif text-2xl font-bold text-ink mb-4">Candidate Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="px-4 py-2 border border-rule rounded-lg text-sm"
          >
            <option value="all">All Decisions</option>
            <option value="hired">Hired</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={proxyFilter}
            onChange={(e) => setProxyFilter(e.target.value)}
            className="px-4 py-2 border border-rule rounded-lg text-sm"
          >
            <option value="all">All</option>
            <option value="flagged">Proxy Flagged Only</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-4 py-2 border border-rule rounded-lg text-sm"
          >
            <option value="all">All College Tiers</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rule bg-paper">
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">Name</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">Decision</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">Skill Score</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">Proxy Risk</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">College</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-ink-muted">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((candidate) => {
              const skillColor = candidate.skillScore >= 70 ? 'text-success' :
                candidate.skillScore >= 50 ? 'text-warn' : 'text-accent';
              const riskBadge = candidate.flagged ? 'bg-accent text-white' :
                candidate.proxyRisk === 'high' ? 'bg-accent text-white' :
                candidate.proxyRisk === 'medium' ? 'bg-warn text-white' :
                'bg-success text-white';

              return (
                <tr key={candidate.id} className="border-b border-rule hover:bg-paper-warm">
                  <td className="px-6 py-4 text-sm text-ink">{candidate.name}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${
                      candidate.decision === 'hired' ? 'bg-success text-white' : 'bg-accent text-white'
                    }`}>
                      {candidate.decision.toUpperCase()}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-sm font-mono font-bold ${skillColor}`}>
                    {candidate.skillScore}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${riskBadge}`}>
                      {candidate.proxyRisk?.toUpperCase() || 'NONE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-ink">Tier {candidate.collegeTier}</td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => onSelectCandidate(candidate)}
                      className="text-accent hover:text-accent2 flex items-center gap-1"
                    >
                      View Details <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Sub-component: Candidate Detail Panel
function CandidateDetailPanel({ candidate, onClose, auditMetrics }) {
  const [loadingNarrative, setLoadingNarrative] = useState(false);
  const [localCounterfactual, setLocalCounterfactual] = useState(candidate?.counterfactual || null);

  useEffect(() => {
    if (!candidate) return;
    setLocalCounterfactual(candidate.counterfactual || null);
    
    if (!candidate.counterfactual && candidate.decision === 'rejected') {
      const getCF = async () => {
        setLoadingNarrative(true);
        try {
          // Dynamic import of gemini to avoid initial load block
          const { generateCounterfactualNarrative } = await import('../services/gemini.js');
          const res = await generateCounterfactualNarrative(candidate, auditMetrics);
          setLocalCounterfactual(res);
          candidate.counterfactual = res;
        } catch (e) {
          console.error(e);
          // Use a simple fallback sentence if Gemini import/call fails
          const topProxyEntry = auditMetrics?.proxyRankings?.[0];
          const topProxy = normalizeProxyRankingEntry(topProxyEntry).proxy || 'background profile';
          const proxyDescriptions = {
            college: 'college was classified as Tier 1',
            city: 'home city was a Tier 1 metropolitan area',
            surname: 'surname did not trigger the proxy correlation flag',
            company: 'previous employer was a Tier 1 company',
            gap: 'career history had no employment gaps'
          };
          const description = proxyDescriptions[topProxy] || 'background profile matched the advantaged group';
          setLocalCounterfactual(`${candidate.name} would have been selected if their ${description}, because their skill score of ${candidate.skillScore} was above the selection threshold — meaning skill was not the deciding factor.`);
        }
        setLoadingNarrative(false);
      };
      getCF();
    }
  }, [candidate, auditMetrics]);

  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>

      <div className="absolute right-0 top-0 bottom-0 w-full md:w-2/3 lg:w-1/2 bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-rule p-6 flex items-start justify-between z-10">
          <div className="flex-1">
            <h2 className="font-serif text-2xl font-bold text-ink mb-2">{candidate.name}</h2>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 text-xs font-bold rounded ${
                candidate.decision === 'hired' ? 'bg-success text-white' : 'bg-accent text-white'
              }`}>
                {candidate.decision.toUpperCase()}
              </span>
              <span className="font-mono text-lg font-bold text-ink">Score: {candidate.skillScore}/100</span>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-medium text-ink mb-3">Skills Assessment</h3>
            <div className="space-y-2">
              {candidate.skills?.map((skill, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span className="text-sm text-ink">{skill}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-ink mb-3">Background Signals</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-ink-muted">College</span>
                <span className="text-xs font-bold px-2 py-1 rounded bg-rule text-ink">
                  Tier {candidate.collegeTier}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-ink-muted">City</span>
                <span className="text-xs font-bold px-2 py-1 rounded bg-rule text-ink">
                  Tier {candidate.cityTier}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-ink-muted">Employment Gaps</span>
                <span className="text-xs font-bold px-2 py-1 rounded bg-rule text-ink">
                  {candidate.gapScore === 1.0 ? 'None' : 'Present'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-2 border-accent2 rounded-lg p-4 bg-accent2-light">
            <h3 className="font-medium text-ink-muted mb-2 text-sm">Counterfactual Analysis</h3>
            {candidate.decision === 'hired' ? (
              <p className="text-sm text-ink mb-3">This candidate was selected. Counterfactual analysis is only generated for rejected candidates.</p>
            ) : localCounterfactual ? (
              <p className="text-sm text-ink mb-3">{localCounterfactual}</p>
            ) : loadingNarrative ? (
              <div>
                <div className="skeleton w-full h-6 mb-3"></div>
                <p className="text-sm text-ink-muted">Gemini is generating a counterfactual analysis for this candidate...</p>
              </div>
            ) : (
              <p className="text-sm text-ink mb-3 text-ink-muted">Analysis unavailable.</p>
            )}
          </div>

          {candidate.featureContributions ? (
            <div>
              <h3 className="font-medium text-ink mb-3 text-sm">Feature Importance</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={
                    Object.entries(candidate.featureContributions)
                      .map(([feature, val]) => ({ feature, value: val }))
                      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
                  } margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="feature" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
                      {Object.entries(candidate.featureContributions)
                        .map(([feature, val]) => ({ feature, value: val }))
                        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#1a6b3a' : '#c9400a'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Feature contribution data not available for this candidate.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function Dashboard() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const location = useLocation();
  const requestedAuditId = location.state?.auditId;

  useEffect(() => {
    if (!organization || !user) return;

    const fetchAudit = async () => {
      // Historical mode
      if (requestedAuditId && ['demo-audit-001', 'demo-audit-002', 'demo-audit-003'].includes(requestedAuditId)) {
        const histAudit = DEMO_AUDITS.find(a => a.auditId === requestedAuditId);
        setAudit({ ...histAudit, isHistorical: true });
        setLoading(false);
        return;
      }

      // Mock mode
      if (organization.id === 'demo-org-001' || user.uid.includes('demo-')) {
        const mockDataStr = sessionStorage.getItem('fairlens_last_audit');
        if (mockDataStr) {
          try {
            const parsed = JSON.parse(mockDataStr);
            setAudit({ ...parsed.audit, candidates: parsed.candidates, isHistorical: false });
          } catch(e) {
            console.error('Failed to parse mock data', e);
          }
        }
        setLoading(false);
        return;
      }

      // Real Firebase mode
      try {
        const q = query(
          collection(db, 'organizations', user.uid, 'audits'),
          where('status', '==', 'completed'),
          orderBy('createdAt', 'desc'),
          limit(1)
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.docs.length > 0) {
          const auditDoc = querySnapshot.docs[0];
          const auditData = auditDoc.data();
          
          const candsSnapshot = await getDocs(collection(db, 'organizations', user.uid, 'audits', auditDoc.id, 'candidates'));
          const candsData = candsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          
          setAudit({ ...auditData, candidates: candsData, isHistorical: false });
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching audit:', error);
        setLoading(false);
      }
    };

    fetchAudit();
  }, [organization, user, requestedAuditId]);

  const candidates = audit?.candidates || [];
  
  const collegeTierChartData = useMemo(() => {
    return [1, 2, 3, 4].map(tier => {
      const inTier = candidates.filter(c => c.collegeTier === tier);
      if (inTier.length === 0) return { tier: `Tier ${tier}`, rate: 0, count: 0 };
      const hired = inTier.filter(c => c.decision === 'hired').length;
      return {
        tier: `Tier ${tier}`,
        rate: Math.round((hired / inTier.length) * 100),
        count: inTier.length
      };
    }).filter(d => d.count > 0);
  }, [candidates]);

  const cityTierChartData = useMemo(() => {
    return [1, 2, 3].map(tier => {
      const inTier = candidates.filter(c => c.cityTier === tier);
      if (inTier.length === 0) return { tier: `Tier ${tier}`, rate: 0, count: 0 };
      const hired = inTier.filter(c => c.decision === 'hired').length;
      return {
        tier: `Tier ${tier}`,
        rate: Math.round((hired / inTier.length) * 100),
        count: inTier.length
      };
    }).filter(d => d.count > 0);
  }, [candidates]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton: Score + Metric Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="flex flex-col items-center justify-center p-8">
            <div className="skeleton-circle w-32 h-32 mb-4"></div>
            <div className="skeleton w-24 h-4"></div>
          </div>
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-lg p-6 border border-rule">
              <div className="flex justify-between mb-4">
                <div className="skeleton w-28 h-4"></div>
                <div className="skeleton w-16 h-5 rounded-full"></div>
              </div>
              <div className="skeleton w-20 h-8 mb-3"></div>
              <div className="skeleton w-full h-3 mb-2"></div>
              <div className="skeleton w-3/4 h-3"></div>
            </div>
          ))}
        </div>
        {/* Skeleton: Candidate Table */}
        <div className="bg-white rounded-lg p-6 border border-rule">
          <div className="skeleton w-40 h-6 mb-6"></div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-rule last:border-b-0">
              <div className="skeleton w-40 h-4"></div>
              <div className="skeleton w-16 h-4 ml-auto"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="font-serif text-2xl font-bold text-accent">FL</span>
          </div>
          <h2 className="font-serif text-3xl font-bold text-ink mb-3">No audits yet</h2>
          <p className="text-ink-muted mb-8 leading-relaxed">
            Upload your first batch of resumes to see fairness metrics, bias patterns, and compliance status for your hiring AI.
          </p>
          <div className="flex flex-col gap-4 items-center">
            <Link
              to="/new-audit"
              className="inline-block px-8 py-3 bg-accent text-white rounded-lg font-medium hover:shadow-lg transition-shadow w-full sm:w-auto"
            >
              Start Your First Audit
            </Link>
            <Link to="/audit-history" className="text-sm font-medium text-ink hover:text-accent transition-colors">
              View Audit History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Parse audit metrics
  const metrics = audit.metrics || {};

  // Determine status colors
  const score = metrics.fairnessHealthScore || 0;
  const getHealthColor = (s) => {
    if (s >= 80) return '#1A6B3A';
    if (s >= 60) return '#8A5A00';
    return '#C9400A';
  };

  const disparateImpacts = {
    college: metrics.disparateImpactByCollege,
    city: metrics.disparateImpactByCity,
    surname: metrics.disparateImpactBySurname
  };

  // Check if no bias detected
  const noBiasDetected = Object.values(disparateImpacts).every(di => di?.status === 'pass' || !di?.violation);
  const smallBatch = metrics.totalCandidates < 50;

  return (
    <div className="space-y-6">
        {/* Status Banners */}
        {noBiasDetected && (
          <div className="bg-success-light border-l-4 border-success rounded p-4">
            <p className="text-success font-medium">
              ✅ This hiring cycle shows no statistically significant bias
            </p>
          </div>
        )}

        {smallBatch && (
          <div className="bg-warn-light border-l-4 border-warn rounded p-4">
            <p className="text-warn font-medium">
              ⚠️ Small batch warning — results have lower confidence ({metrics.totalCandidates} candidates)
            </p>
          </div>
        )}

        {/* Section 1: Fairness Health Score */}
        <div className="bg-white rounded-lg p-8 shadow-sm border border-rule">
          <div className="flex flex-col items-center">
            <div style={{ width: 200, height: 200 }} className="mb-4">
              <CircularProgressbar
                value={score}
                text={`${Math.round(score)}`}
                strokeWidth={4}
                styles={buildStyles({
                  rotation: 0.25,
                  strokeLinecap: 'round',
                  textSize: '20px',
                  pathTransitionDuration: 0.5,
                  pathColor: getHealthColor(score),
                  textColor: getHealthColor(score),
                  trailColor: '#e0dbd3',
                  backgroundColor: '#faf9f6'
                })}
              />
            </div>
            <h3 className="font-sans text-center text-ink-muted mb-1">Fairness Health Score</h3>
            <p className="text-sm text-ink-muted">Based on {metrics.totalCandidates} candidates</p>
          </div>
        </div>

        {/* Section 2: Four Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MetricCard
            title="Disparate Impact Ratio"
            value={metrics.disparateImpactByCollege?.ratio?.toFixed(2) || '—'}
            status={metrics.disparateImpactByCollege?.status || 'compliant'}
            explanation={generateProxySentence('college', metrics.disparateImpactByCollege?.ratio || 1)}
            threshold="Legal threshold: 0.80 (four-fifths rule)"
          />
          <MetricCard
            title="Equal Opportunity Difference"
            value={(metrics.equalOpportunityDiff || 0).toFixed(3)}
            status={(metrics.equalOpportunityDiff || 0) < 0.1 ? 'compliant' : (metrics.equalOpportunityDiff || 0) < 0.15 ? 'warning' : 'violation'}
            explanation={`Selection rate difference between groups: ${((metrics.equalOpportunityDiff || 0) * 100).toFixed(1)}%`}
            threshold="Acceptable: below 0.10"
          />
          <MetricCard
            title="False Positive Rate Difference"
            value={(metrics.falsePositiveRateDiff || 0).toFixed(3)}
            status={(metrics.falsePositiveRateDiff || 0) < 0.1 ? 'compliant' : (metrics.falsePositiveRateDiff || 0) < 0.15 ? 'warning' : 'violation'}
            explanation={`Rejection rate difference for qualified candidates: ${((metrics.falsePositiveRateDiff || 0) * 100).toFixed(1)}%`}
            threshold="Acceptable: below 0.10"
          />
          <MetricCard
            title="Proxy Correlation Score"
            value={(metrics.proxyCorrelations?.average || 0).toFixed(3)}
            status={(metrics.proxyCorrelations?.average || 0) < 0.2 ? 'compliant' : (metrics.proxyCorrelations?.average || 0) < 0.3 ? 'warning' : 'violation'}
            explanation={`Average correlation between background proxies and hiring decisions`}
            threshold="Flagged: above 0.30"
          />
        </div>

        {/* Section 3: Proxy Rankings */}
        <ProxyRankingsTable
          rankings={metrics.proxyRankings || []}
          disparateImpacts={disparateImpacts}
          proxyCorrelations={metrics.proxyCorrelations}
        />

        {/* Section 4: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* College Tier Chart */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-rule">
            <h3 className="font-medium text-ink mb-4">Selection Rate by College Tier</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collegeTierChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0dbd3" />
                <XAxis dataKey="tier" />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={80} stroke="#c9400a" strokeDasharray="5 5" label="Legal Threshold" />
                <Bar dataKey="rate" fill="#1a6b3a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* City Tier Chart */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-rule">
            <h3 className="font-medium text-ink mb-4">Selection Rate by City Tier</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cityTierChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0dbd3" />
                <XAxis dataKey="tier" />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={80} stroke="#c9400a" strokeDasharray="5 5" label="Legal Threshold" />
                <Bar dataKey="rate" fill="#1a4d7a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 5: Candidate Table */}
        <CandidateTable
          candidates={candidates}
          onSelectCandidate={setSelectedCandidate}
          isHistorical={audit.isHistorical}
        />

      {/* Candidate Detail Panel */}
      {selectedCandidate && (
        <CandidateDetailPanel
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          auditMetrics={metrics}
        />
      )}
    </div>
  );
}
