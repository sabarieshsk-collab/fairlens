const audit1 = {
  auditId: 'demo-audit-001',
  audit_cycle_name: 'Software Engineers — January 2026',
  job_role: 'Software Engineer',
  department: 'Engineering',
  start_date: '2026-01-05',
  end_date: '2026-01-31',
  candidate_count: 38,
  status: 'complete',
  org_id: 'demo-org-001',
  createdAt: new Date('2026-01-31T18:30:00'),
  completedAt: new Date('2026-01-31T18:47:00'),
  metrics: {
    fairnessHealthScore: 48,
    disparateImpactByCollege: {
      ratio: 0.52,
      advantagedHireRate: 71,
      disadvantagedHireRate: 37,
      advantagedCount: 14,
      disadvantagedCount: 24,
      status: 'violation'
    },
    disparateImpactByCity: {
      ratio: 0.61,
      advantagedHireRate: 68,
      disadvantagedHireRate: 41,
      advantagedCount: 13,
      disadvantagedCount: 25,
      status: 'violation'
    },
    disparateImpactBySurname: {
      ratio: 0.58,
      advantagedHireRate: 67,
      disadvantagedHireRate: 39,
      advantagedCount: 16,
      disadvantagedCount: 22,
      status: 'violation'
    },
    equalOpportunityDiff: 28.4,
    falsePositiveRateDiff: 31.2,
    proxyCorrelations: {
      college: 0.71,
      city: 0.63,
      surname: 0.67,
      company: 0.44,
      gap: 0.38,
      average: 0.57
    },
    proxyRankings: ['college', 'surname', 'city', 'company', 'gap'],
    totalCandidates: 38,
    insufficientGroups: []
  }
};

const audit2 = {
  auditId: 'demo-audit-002',
  audit_cycle_name: 'Software Engineers — February 2026',
  job_role: 'Senior Software Engineer',
  department: 'Engineering',
  start_date: '2026-02-03',
  end_date: '2026-02-28',
  candidate_count: 41,
  status: 'complete',
  org_id: 'demo-org-001',
  createdAt: new Date('2026-02-28T17:15:00'),
  completedAt: new Date('2026-02-28T17:34:00'),
  metrics: {
    fairnessHealthScore: 61,
    disparateImpactByCollege: {
      ratio: 0.68,
      advantagedHireRate: 72,
      disadvantagedHireRate: 49,
      advantagedCount: 15,
      disadvantagedCount: 26,
      status: 'warning'
    },
    disparateImpactByCity: {
      ratio: 0.74,
      advantagedHireRate: 69,
      disadvantagedHireRate: 51,
      advantagedCount: 14,
      disadvantagedCount: 27,
      status: 'warning'
    },
    disparateImpactBySurname: {
      ratio: 0.71,
      advantagedHireRate: 68,
      disadvantagedHireRate: 48,
      advantagedCount: 17,
      disadvantagedCount: 24,
      status: 'warning'
    },
    equalOpportunityDiff: 18.7,
    falsePositiveRateDiff: 21.3,
    proxyCorrelations: {
      college: 0.58,
      city: 0.51,
      surname: 0.54,
      company: 0.33,
      gap: 0.28,
      average: 0.45
    },
    proxyRankings: ['college', 'surname', 'city', 'company', 'gap'],
    totalCandidates: 41,
    insufficientGroups: []
  }
};

const audit3 = {
  auditId: 'demo-audit-003',
  audit_cycle_name: 'Software Engineers — March 2026',
  job_role: 'Senior Software Engineer',
  department: 'Engineering',
  start_date: '2026-03-03',
  end_date: '2026-03-28',
  candidate_count: 44,
  status: 'complete',
  org_id: 'demo-org-001',
  createdAt: new Date('2026-03-28T16:00:00'),
  completedAt: new Date('2026-03-28T16:22:00'),
  metrics: {
    fairnessHealthScore: 74,
    disparateImpactByCollege: {
      ratio: 0.79,
      advantagedHireRate: 73,
      disadvantagedHireRate: 58,
      advantagedCount: 16,
      disadvantagedCount: 28,
      status: 'warning'
    },
    disparateImpactByCity: {
      ratio: 0.83,
      advantagedHireRate: 70,
      disadvantagedHireRate: 58,
      advantagedCount: 15,
      disadvantagedCount: 29,
      status: 'pass'
    },
    disparateImpactBySurname: {
      ratio: 0.81,
      advantagedHireRate: 69,
      disadvantagedHireRate: 56,
      advantagedCount: 18,
      disadvantagedCount: 26,
      status: 'pass'
    },
    equalOpportunityDiff: 11.2,
    falsePositiveRateDiff: 13.8,
    proxyCorrelations: {
      college: 0.41,
      city: 0.34,
      surname: 0.37,
      company: 0.22,
      gap: 0.19,
      average: 0.31
    },
    proxyRankings: ['college', 'surname', 'city', 'company', 'gap'],
    totalCandidates: 44,
    insufficientGroups: []
  }
};

export const DEMO_AUDITS = [audit1, audit2, audit3];

export const DEMO_REMEDIATION = {
  remediationId: 'demo-rem-001',
  auditId: 'demo-audit-003',
  auditName: 'Software Engineers — March 2026',
  status: 'pending_hr',
  createdAt: new Date('2026-03-29T09:00:00'),
  summary: 'Analysis of the March 2026 hiring cycle reveals a ' +
    'Fairness Health Score of 74/100, indicating proxy-driven ' +
    'disparities that approach but have not yet crossed legal ' +
    'thresholds. The college tier variable contributes a 0.41 ' +
    'proxy correlation to hiring outcomes independent of candidate ' +
    'skill scores, and candidates from state universities are being ' +
    'selected at 79% the rate of IIT/NIT graduates with equivalent ' +
    'technical qualifications. Three targeted changes are proposed ' +
    'to bring all disparate impact ratios above the 0.80 legal ' +
    'minimum and prevent regression into violation territory.',
  proposedChanges: [
    {
      id: 'change-001',
      change: 'Reduce college tier weighting in candidate scoring ' +
        'from an estimated 35% contribution to 10% of total score. ' +
        'Skills assessment and work experience to carry proportionally ' +
        'greater weight.',
      projectedImpact: 'Disparate impact ratio for college tier ' +
        'increases from 0.79 to an estimated 0.87, moving from ' +
        'warning to pass status.'
    },
    {
      id: 'change-002',
      change: 'Introduce a skills floor override: any candidate ' +
        'scoring above 70 on the technical skills assessment ' +
        'automatically advances to interview stage regardless of ' +
        'college tier classification.',
      projectedImpact: 'Adds an estimated 7 to 9 additional ' +
        'qualified state-university candidates to the interview ' +
        'pool per hiring cycle of this size.'
    },
    {
      id: 'change-003',
      change: 'Remove home city tier from the scoring model ' +
        'entirely. City tier has no demonstrated predictive ' +
        'validity for software engineering job performance and ' +
        'functions purely as a socio-economic proxy.',
      projectedImpact: 'Disparate impact ratio for city tier ' +
        'improves from 0.83 to an estimated 0.94, and overall ' +
        'fairness health score is projected to reach 86.'
    }
  ],
  projectedMetrics: {
    fairnessHealthScore: 86,
    disparateImpactByCollege: { ratio: 0.87, status: 'pass' },
    disparateImpactByCity: { ratio: 0.94, status: 'pass' },
    disparateImpactBySurname: { ratio: 0.88, status: 'pass' },
    accuracyChange: -1.2
  },
  approvalChain: [
    {
      role: 'hr_officer',
      name: 'Ananya Krishnan',
      status: 'pending',
      approvedAt: null
    },
    {
      role: 'legal_reviewer',
      name: 'Vikram Mehta',
      status: 'pending',
      approvedAt: null
    }
  ]
};
