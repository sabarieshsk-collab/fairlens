import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getProxyPlainEnglish } from '../services/biasCalculator';
import { XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/ui/LoadingSpinner';

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

// Sub-component: Proxy Rankings Table
function ProxyRankingsTable({ rankings, disparateImpacts }) {
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
            {rankings.map((item, idx) => {
              const diData = disparateImpacts[item.proxy];
              const status = diData?.status || 'compliant';
              const rowBg = status === 'violation' ? 'bg-accent-light' : status === 'warning' ? 'bg-warn-light' : '';

              return (
                <tr key={item.proxy} className={`border-b border-rule ${rowBg}`}>
                  <td className="px-6 py-4 text-sm font-semibold text-ink">{idx + 1}</td>
                  <td className="px-6 py-4 text-sm text-ink capitalize">{item.proxy}</td>
                  <td className="px-6 py-4 text-sm font-mono text-ink">{item.score}</td>
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
        {rankings.map((item) => (
          <p key={`finding-${item.proxy}`} className="text-sm text-ink-muted mb-2">
            <strong className="text-ink capitalize">{item.proxy}:</strong> {
              getProxyPlainEnglish(
                item.proxy,
                disparateImpacts[item.proxy]?.ratio,
                disparateImpacts[item.proxy]?.advantagedHireRate,
                disparateImpacts[item.proxy]?.disadvantagedHireRate
              )
            }
          </p>
        ))}
      </div>
    </div>
  );
}

// Sub-component: Candidate Table with filtering
function CandidateTable({ candidates, onSelectCandidate }) {
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [proxyFilter, setProxyFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

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
function CandidateDetailPanel({ candidate, onClose, counterfactual, featureContributions }) {
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>

      {/* Slide-in Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-2/3 lg:w-1/2 bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-rule p-6 flex items-start justify-between">
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Skills Section */}
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

          {/* Background Signals */}
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

          {/* Counterfactual Analysis */}
          {counterfactual && counterfactual.available && (
            <div className="border-2 border-accent2 rounded-lg p-4 bg-accent2-light">
              <h3 className="font-medium text-ink-muted mb-2 text-sm">Counterfactual Analysis</h3>
              <p className="text-sm text-ink mb-3">{counterfactual.explanation}</p>
              {counterfactual.changedFeature && (
                <div className="bg-white rounded p-3 text-xs">
                  <p className="text-ink-muted">Would change: <strong className="text-ink">{counterfactual.changedFeature}</strong></p>
                  <p className="text-ink-muted">From: <strong className="text-ink">{counterfactual.originalValue}</strong></p>
                  <p className="text-ink-muted">To: <strong className="text-ink">{counterfactual.counterfactualValue}</strong></p>
                </div>
              )}
              <p className="text-xs text-ink-muted mt-3 italic">
                Model confidence: {counterfactual.modelAccuracy}% based on {counterfactual.batchSize} candidates
              </p>
            </div>
          )}

          {/* Feature Contributions */}
          {featureContributions && (
            <div>
              <h3 className="font-medium text-ink mb-3 text-sm">Feature Importance</h3>
              <div className="space-y-2">
                {Object.entries(featureContributions).map(([feature, contribution]) => (
                  <div key={feature} className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted capitalize w-24">{feature}</span>
                    <div className="flex-1 mx-3 h-2 bg-rule rounded overflow-hidden">
                      <div
                        className={`h-full ${contribution > 0 ? 'bg-success' : 'bg-accent'}`}
                        style={{ width: `${Math.min(Math.abs(contribution) / 30 * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-bold font-mono w-12 text-right ${
                      contribution > 0 ? 'text-success' : 'text-accent'
                    }`}>
                      {contribution > 0 ? '+' : ''}{contribution}
                    </span>
                  </div>
                ))}
              </div>
            </div>
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
  const [counterfactual, setCounterfactual] = useState(null);

  useEffect(() => {
    if (!organization || !user) return;

    const fetchAudit = async () => {
      if (user.uid === 'mock-user-123') {
        setAudit({
          metrics: {
            totalCandidates: 120,
            fairnessHealthScore: 85,
            disparateImpactByCollege: { ratio: 0.85, status: 'compliant', advantagedHireRate: 40, disadvantagedHireRate: 34 },
            disparateImpactByCity: { ratio: 0.92, status: 'compliant', advantagedHireRate: 38, disadvantagedHireRate: 35 },
            disparateImpactBySurname: { ratio: 1.15, status: 'warning', advantagedHireRate: 42, disadvantagedHireRate: 36 },
            equalOpportunityDiff: 0.08,
            falsePositiveRateDiff: 0.05,
            proxyCorrelations: { average: 0.18 },
            proxyRankings: [
              { proxy: 'surname', score: 0.25, status: 'warning' },
              { proxy: 'college', score: 0.15, status: 'compliant' },
              { proxy: 'city', score: 0.12, status: 'compliant' }
            ]
          },
          candidates: [
            { id: 1, name: 'Aarav M.', decision: 'hired', skillScore: 88, collegeTier: 1, cityTier: 1, proxyRisk: 'none', flagged: false },
            { id: 2, name: 'Priya K.', decision: 'rejected', skillScore: 72, collegeTier: 3, cityTier: 2, proxyRisk: 'medium', flagged: true },
            { id: 3, name: 'Rahul S.', decision: 'hired', skillScore: 91, collegeTier: 2, cityTier: 1, proxyRisk: 'none', flagged: false }
          ],
          chartData: {
            collegeTier: [ { tier: 'Tier 1', rate: 40 }, { tier: 'Tier 2', rate: 36 }, { tier: 'Tier 3', rate: 34 } ],
            cityTier: [ { tier: 'Tier 1', rate: 38 }, { tier: 'Tier 2', rate: 36 }, { tier: 'Tier 3', rate: 35 } ]
          }
        });
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'organizations', user.uid, 'audits'),
          where('status', '==', 'completed'),
          orderBy('createdAt', 'desc'),
          limit(1)
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.docs.length > 0) {
          setAudit(querySnapshot.docs[0].data());
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching audit:', error);
        setLoading(false);
      }
    };

    fetchAudit();
  }, [organization, user]);

  if (loading) return <LoadingSpinner />;

  if (!audit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-bold text-ink mb-3">No audits yet</h2>
          <p className="text-ink-muted mb-6">
            Start your first hiring audit to see fairness metrics.
          </p>
          <a
            href="/new-audit"
            className="inline-block px-6 py-3 bg-accent text-white rounded-lg font-medium hover:shadow-lg transition-shadow"
          >
            Start New Audit
          </a>
        </div>
      </div>
    );
  }

  // Parse audit metrics
  const metrics = audit.metrics || {};
  const candidates = audit.candidates || [];

  // Determine status colors
  const getHealthColor = (score) => {
    if (score >= 75) return '#1a6b3a';
    if (score >= 50) return '#8a5a00';
    return '#c9400a';
  };

  const disparateImpacts = {
    college: metrics.disparateImpactByCollege,
    city: metrics.disparateImpactByCity,
    surname: metrics.disparateImpactBySurname
  };

  // Check if no bias detected
  const noBiasDetected = Object.values(disparateImpacts).every(di => di?.status === 'compliant' || !di?.violation);
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
        <div className="bg-white rounded-lg p-8">
          <div className="flex flex-col items-center">
            <div style={{ width: 200, height: 200 }} className="mb-4">
              <CircularProgressbar
                value={metrics.fairnessHealthScore || 0}
                strokeWidth={4}
                styles={buildStyles({
                  rotation: 0.25,
                  strokeLinecap: 'round',
                  textSize: '16px',
                  pathTransitionDuration: 0.5,
                  pathColor: getHealthColor(metrics.fairnessHealthScore || 0),
                  textColor: '#0f0e0d',
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
            explanation={getProxyPlainEnglish(
              'college tier',
              metrics.disparateImpactByCollege?.ratio,
              metrics.disparateImpactByCollege?.advantagedHireRate,
              metrics.disparateImpactByCollege?.disadvantagedHireRate
            )}
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
        />

        {/* Section 4: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* College Tier Chart */}
          <div className="bg-white rounded-lg p-6">
            <h3 className="font-medium text-ink mb-4">Selection Rate by College Tier</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={audit.chartData?.collegeTier || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0dbd3" />
                <XAxis dataKey="tier" />
                <YAxis />
                <Tooltip />
                <ReferenceLine y={80} stroke="#c9400a" strokeDasharray="5 5" label="Legal Threshold" />
                <Bar dataKey="rate" fill="#1a6b3a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* City Tier Chart */}
          <div className="bg-white rounded-lg p-6">
            <h3 className="font-medium text-ink mb-4">Selection Rate by City Tier</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={audit.chartData?.cityTier || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0dbd3" />
                <XAxis dataKey="tier" />
                <YAxis />
                <Tooltip />
                <ReferenceLine y={80} stroke="#c9400a" strokeDasharray="5 5" label="Legal Threshold" />
                <Bar dataKey="rate" fill="#1a4d7a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 5: Candidate Table */}
        <CandidateTable
          candidates={candidates.map(c => ({
            id: c.id,
            name: c.name,
            decision: c.decision,
            skillScore: c.skillScore,
            collegeTier: c.collegeTier,
            cityTier: c.cityTier,
            gapScore: c.gapScore,
            skills: c.skills,
            proxyRisk: c.proxyRisk,
            flagged: c.flagged
          }))}
          onSelectCandidate={setSelectedCandidate}
        />

      {/* Candidate Detail Panel */}
      {selectedCandidate && (
        <CandidateDetailPanel
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          counterfactual={counterfactual}
          featureContributions={selectedCandidate.featureContributions}
        />
      )}
    </div>
  );
}
