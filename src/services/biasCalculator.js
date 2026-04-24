import { getCollegeTier } from '../utils/collegeTiers';
import { getCityTier } from '../utils/cityTiers';
import { getSurnameScore } from '../utils/surnameMapping';

/**
 * Calculates a skill score (0-100) for a candidate based on required skills,
 * experience, projects, and GitHub activity.
 *
 * @param {Object} candidate - Parsed resume object
 * @param {Array<string>} candidate.skills - Array of skills listed on resume
 * @param {number} candidate.years_experience - Years of work experience
 * @param {number} candidate.projects_count - Number of projects listed
 * @param {boolean} candidate.github_active - Whether candidate has active GitHub
 * @param {Array<string>} requiredSkills - Array of required skills for the role
 * @returns {number} Skill score from 0-100
 */
export function calculateSkillScore(candidate, requiredSkills) {
  if (!candidate || !requiredSkills || requiredSkills.length === 0) {
    return 0;
  }

  const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
  const requiredSkillsLower = requiredSkills.map(s => s.toLowerCase());

  // Count matching skills
  const skillMatch = requiredSkillsLower.filter(req =>
    candidateSkills.some(cand => cand.includes(req) || req.includes(cand))
  ).length;

  // Calculate component scores
  const skillPoints = (skillMatch / requiredSkills.length) * 40;
  const expPoints = Math.min((candidate.years_experience || 0) / 5, 1) * 30;
  const projectPoints = Math.min((candidate.projects_count || 0) / 3, 1) * 20;
  const githubPoints = candidate.github_active ? 10 : 0;

  return Math.round(skillPoints + expPoints + projectPoints + githubPoints);
}

/**
 * Classifies a candidate by enriching their profile with tier information
 * and proxy attributes for bias detection.
 *
 * @param {Object} candidate - Candidate object from resume parsing
 * @param {string} candidate.college - College/University name
 * @param {string} candidate.home_city - Hometown city
 * @param {string} candidate.surname - Candidate surname
 * @param {Array<Object>} candidate.work_history - Array of previous employers
 * @param {Array<Object>} candidate.employment_gaps - Array of career gaps
 * @returns {Object} Enriched candidate object with classification fields
 */
export function classifyCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  // Classify college tier
  const collegeTier = getCollegeTier(candidate.college || '');

  // Classify city tier
  const cityTier = getCityTier(candidate.home_city || '');

  // Classify surname
  const surnameScore = getSurnameScore(candidate.surname || '');

  // Calculate gap score (1.0 = no gaps, 0.0 = large gaps)
  let gapScore = 1.0;
  if (candidate.employment_gaps && candidate.employment_gaps.length > 0) {
    const largestGap = Math.max(...candidate.employment_gaps.map(g => g.months || 0));
    if (largestGap >= 6) {
      gapScore = 0.0;
    } else if (largestGap >= 3) {
      gapScore = 0.4;
    } else if (largestGap > 0) {
      gapScore = 0.7;
    }
  }

  // Classify company tier from work history
  const TIER_1_COMPANIES = new Set([
    'Google', 'Amazon', 'Microsoft', 'Facebook', 'Apple', 'Meta',
    'Tesla', 'Uber', 'Airbnb', 'Netflix', 'Stripe', 'TikTok', 'Bytedance',
    'Goldman Sachs', 'JP Morgan', 'Morgan Stanley', 'McKinsey', 'BCG',
    'Flipkart', 'Paytm', 'Swiggy', 'OYO', 'Unacademy'
  ]);

  const TIER_2_COMPANIES = new Set([
    'Accenture', 'Deloitte', 'EY', 'PwC', 'TCS', 'Infosys', 'Wipro',
    'HCL', 'Tech Mahindra', 'Cognizant', 'IBM', 'Oracle', 'Salesforce'
  ]);

  let companyTier = 3; // Default to tier 3
  if (candidate.work_history && candidate.work_history.length > 0) {
    const companies = candidate.work_history.map(w => w.company || '');
    const hasT1 = companies.some(c =>
      TIER_1_COMPANIES.has(c) || TIER_2_COMPANIES.has(c)
    );
    if (hasT1) {
      companyTier = 2;
    }
  }

  return {
    ...candidate,
    collegeTier,
    cityTier,
    surnameScore,
    gapScore,
    companyTier
  };
}

/**
 * Calculates disparate impact ratio between two groups.
 * Compares hiring rates to detect potential discrimination.
 *
 * @param {Array<Object>} candidates - Array of classified candidates with decision field
 * @param {Function} groupingFn - Function that returns "advantaged" or "disadvantaged"
 * @param {number} threshold - DI threshold (default 0.8 = 80% rule)
 * @returns {Object} Disparate impact metrics and violation status
 */
export function calculateDisparateImpact(candidates, groupingFn, threshold = 0.8) {
  if (!candidates || candidates.length === 0 || !groupingFn) {
    return {
      ratio: null,
      advantagedHireRate: null,
      disadvantagedHireRate: null,
      advantagedCount: 0,
      disadvantagedCount: 0,
      insufficientData: true,
      status: 'insufficient_data',
      violation: false,
      confidenceNote: 'Insufficient candidate data'
    };
  }

  // Separate into groups
  const advantaged = candidates.filter(c => groupingFn(c) === 'advantaged');
  const disadvantaged = candidates.filter(c => groupingFn(c) === 'disadvantaged');

  // Check for insufficient data
  if (advantaged.length < 10 || disadvantaged.length < 10) {
    return {
      ratio: null,
      advantagedHireRate: null,
      disadvantagedHireRate: null,
      advantagedCount: advantaged.length,
      disadvantagedCount: disadvantaged.length,
      insufficientData: true,
      status: 'insufficient_data',
      violation: false,
      confidenceNote: `Limited data: ${advantaged.length} advantaged, ${disadvantaged.length} disadvantaged`
    };
  }

  // Calculate hire rates
  const advantagedHired = advantaged.filter(c => c.decision === 'hired').length;
  const disadvantagedHired = disadvantaged.filter(c => c.decision === 'hired').length;

  const advantagedHireRate = advantagedHired / advantaged.length;
  const disadvantagedHireRate = disadvantagedHired / disadvantaged.length;

  // Calculate ratio
  const ratio = disadvantagedHireRate > 0 
    ? advantagedHireRate / disadvantagedHireRate 
    : advantagedHireRate > 0 ? Infinity : 1.0;

  // Determine status
  let status = 'compliant';
  let violation = false;
  if (ratio < threshold) {
    status = 'violation';
    violation = true;
  } else if (ratio < threshold + 0.1) {
    status = 'warning';
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    advantagedHireRate: Math.round(advantagedHireRate * 10000) / 100,
    disadvantagedHireRate: Math.round(disadvantagedHireRate * 10000) / 100,
    advantagedCount: advantaged.length,
    disadvantagedCount: disadvantaged.length,
    status,
    violation,
    confidenceNote: `Based on ${advantaged.length + disadvantaged.length} candidates`
  };
}

/**
 * Calculates equal opportunity difference between groups.
 * Measures difference in true positive rates for selected candidates.
 *
 * @private
 * @param {Array<Object>} candidates - Classified candidates with decision field
 * @param {Function} groupingFn - Function that returns "advantaged" or "disadvantaged"
 * @returns {number} Difference in true positive rates (0-1)
 */
function calculateEqualOpportunityDifference(candidates, groupingFn) {
  if (!candidates || candidates.length === 0) return 0;

  const advantaged = candidates.filter(c => groupingFn(c) === 'advantaged');
  const disadvantaged = candidates.filter(c => groupingFn(c) === 'disadvantaged');

  if (advantaged.length === 0 || disadvantaged.length === 0) return 0;

  const advTPR = advantaged.filter(c => c.decision === 'hired').length / advantaged.length;
  const disTPR = disadvantaged.filter(c => c.decision === 'hired').length / disadvantaged.length;

  return Math.abs(advTPR - disTPR);
}

/**
 * Calculates false positive rate difference between groups.
 * Measures difference in false positive rates (rejected but qualified).
 *
 * @private
 * @param {Array<Object>} candidates - Classified candidates with skillScore field
 * @param {Function} groupingFn - Function that returns "advantaged" or "disadvantaged"
 * @param {number} qualificationThreshold - Score threshold (default 70)
 * @returns {number} Difference in false positive rates (0-1)
 */
function calculateFalsePositiveRateDifference(candidates, groupingFn, qualificationThreshold = 70) {
  if (!candidates || candidates.length === 0) return 0;

  const advantaged = candidates.filter(c => groupingFn(c) === 'advantaged');
  const disadvantaged = candidates.filter(c => groupingFn(c) === 'disadvantaged');

  if (advantaged.length === 0 || disadvantaged.length === 0) return 0;

  // False positives: rejected despite qualified
  const advQualified = advantaged.filter(c => (c.skillScore || 0) >= qualificationThreshold);
  const disQualified = disadvantaged.filter(c => (c.skillScore || 0) >= qualificationThreshold);

  if (advQualified.length === 0 || disQualified.length === 0) return 0;

  const advFPR = advQualified.filter(c => c.decision !== 'hired').length / advQualified.length;
  const disFPR = disQualified.filter(c => c.decision !== 'hired').length / disQualified.length;

  return Math.abs(advFPR - disFPR);
}

/**
 * Calculates proxy score correlation.
 * Measures how much proxies (college, city, surname) correlate with hiring decisions.
 *
 * @private
 * @param {Array<Object>} candidates - Classified candidates
 * @returns {Object} Correlation scores for each proxy
 */
function calculateProxyCorrelations(candidates) {
  if (!candidates || candidates.length === 0) {
    return { college: 0, city: 0, surname: 0, company: 0, gap: 0 };
  }

  const hiredByCollege = {};
  const totalByCollege = {};
  const hiredByCity = {};
  const totalByCity = {};
  const hiredBySurname = {};
  const totalBySurname = {};
  const hiredByCompany = {};
  const totalByCompany = {};
  const hiredByGap = {};
  const totalByGap = {};

  candidates.forEach(c => {
    if (!c.decision) return;

    const isHired = c.decision === 'hired' ? 1 : 0;

    // College
    const ct = c.collegeTier || 3;
    totalByCollege[ct] = (totalByCollege[ct] || 0) + 1;
    hiredByCollege[ct] = (hiredByCollege[ct] || 0) + isHired;

    // City
    const cit = c.cityTier || 3;
    totalByCity[cit] = (totalByCity[cit] || 0) + 1;
    hiredByCity[cit] = (hiredByCity[cit] || 0) + isHired;

    // Company
    const comp = c.companyTier || 3;
    totalByCompany[comp] = (totalByCompany[comp] || 0) + 1;
    hiredByCompany[comp] = (hiredByCompany[comp] || 0) + isHired;

    // Gap
    const gap = Math.round((c.gapScore || 1.0) * 2) / 2; // Round to nearest 0.5
    totalByGap[gap] = (totalByGap[gap] || 0) + 1;
    hiredByGap[gap] = (hiredByGap[gap] || 0) + isHired;

    // Surname (only if not flagged)
    if (!c.surnameScore?.flagged) {
      const ss = Math.round((c.surnameScore?.score || 0.5) * 10) / 10;
      totalBySurname[ss] = (totalBySurname[ss] || 0) + 1;
      hiredBySurname[ss] = (hiredBySurname[ss] || 0) + isHired;
    }
  });

  // Calculate variance ratios
  const collegeRates = Object.keys(totalByCollege).map(k => hiredByCollege[k] / totalByCollege[k]);
  const cityRates = Object.keys(totalByCity).map(k => hiredByCity[k] / totalByCity[k]);
  const companyRates = Object.keys(totalByCompany).map(k => hiredByCompany[k] / totalByCompany[k]);
  const gapRates = Object.keys(totalByGap).map(k => hiredByGap[k] / totalByGap[k]);
  const surnameRates = Object.keys(totalBySurname).map(k => hiredBySurname[k] / totalBySurname[k]);

  const collegeVariance = collegeRates.length > 1 ? Math.max(...collegeRates) - Math.min(...collegeRates) : 0;
  const cityVariance = cityRates.length > 1 ? Math.max(...cityRates) - Math.min(...cityRates) : 0;
  const companyVariance = companyRates.length > 1 ? Math.max(...companyRates) - Math.min(...companyRates) : 0;
  const gapVariance = gapRates.length > 1 ? Math.max(...gapRates) - Math.min(...gapRates) : 0;
  const surnameVariance = surnameRates.length > 1 ? Math.max(...surnameRates) - Math.min(...surnameRates) : 0;

  return {
    college: Math.round(collegeVariance * 100) / 100,
    city: Math.round(cityVariance * 100) / 100,
    company: Math.round(companyVariance * 100) / 100,
    gap: Math.round(gapVariance * 100) / 100,
    surname: Math.round(surnameVariance * 100) / 100
  };
}

/**
 * Converts plain English description for a disparate impact finding.
 *
 * @param {string} proxyName - Name of the proxy (college, city, surname, etc.)
 * @param {number} ratio - Disparate impact ratio
 * @param {number} advantagedRate - Hiring rate for advantaged group (percent)
 * @param {number} disadvantagedRate - Hiring rate for disadvantaged group (percent)
 * @returns {string} Plain English explanation of the finding
 */
export function getProxyPlainEnglish(proxyName, ratio, advantagedRate, disadvantagedRate) {
  if (ratio === null || ratio === undefined) {
    return `Insufficient data to analyze ${proxyName} proxy`;
  }

  const multiplier = Math.round(ratio * 10) / 10;
  const advRate = Math.round(advantagedRate);
  const disRate = Math.round(disadvantagedRate);

  if (multiplier > 1.25) {
    return `Candidates with advantaged ${proxyName} backgrounds are selected at ${multiplier}x the rate of equally skilled candidates with disadvantaged backgrounds (${advRate}% vs ${disRate}%)`;
  } else if (multiplier < 0.8) {
    return `Candidates with disadvantaged ${proxyName} backgrounds are selected at ${Math.round((1 / multiplier) * 10) / 10}x the rate of those with advantaged backgrounds (${disRate}% vs ${advRate}%)`;
  } else {
    return `Selection rates are similar across ${proxyName} backgrounds (${advRate}% vs ${disRate}%)`;
  }
}

/**
 * Calculates fairness health score from normalized metrics.
 * Combines disparate impact, equal opportunity, false positive rate, and proxy correlation.
 *
 * @param {number} disparateImpactRatio - DI ratio (higher = more fair)
 * @param {number} equalOpportunityDiff - EOD difference (lower = more fair)
 * @param {number} falsePositiveRateDiff - FPRD difference (lower = more fair)
 * @param {number} proxyCorrelationScore - Average proxy correlation (lower = more fair)
 * @returns {number} Health score from 0-100
 */
export function getFairnessHealthScore(disparateImpactRatio, equalOpportunityDiff, falsePositiveRateDiff, proxyCorrelationScore) {
  // Normalize DI (1.0+ is fair, 0.5- is unfair)
  let dirScore = 100;
  if (disparateImpactRatio !== null && disparateImpactRatio !== undefined) {
    if (disparateImpactRatio <= 0.5) {
      dirScore = 0;
    } else if (disparateImpactRatio >= 1.0) {
      dirScore = 100;
    } else {
      dirScore = ((disparateImpactRatio - 0.5) / (1.0 - 0.5)) * 100;
    }
  }

  // Normalize EOD (0.0 is fair, 0.2+ is unfair)
  let eodScore = 100;
  if (equalOpportunityDiff !== null && equalOpportunityDiff !== undefined) {
    if (equalOpportunityDiff >= 0.2) {
      eodScore = 0;
    } else if (equalOpportunityDiff <= 0.0) {
      eodScore = 100;
    } else {
      eodScore = (1 - (equalOpportunityDiff / 0.2)) * 100;
    }
  }

  // Normalize FPRD (same as EOD)
  let fprdScore = 100;
  if (falsePositiveRateDiff !== null && falsePositiveRateDiff !== undefined) {
    if (falsePositiveRateDiff >= 0.2) {
      fprdScore = 0;
    } else if (falsePositiveRateDiff <= 0.0) {
      fprdScore = 100;
    } else {
      fprdScore = (1 - (falsePositiveRateDiff / 0.2)) * 100;
    }
  }

  // Normalize proxy correlation (0.0 is fair, 0.5+ is unfair)
  let pcsScore = 100;
  if (proxyCorrelationScore !== null && proxyCorrelationScore !== undefined) {
    if (proxyCorrelationScore >= 0.5) {
      pcsScore = 0;
    } else if (proxyCorrelationScore <= 0.0) {
      pcsScore = 100;
    } else {
      pcsScore = (1 - (proxyCorrelationScore / 0.5)) * 100;
    }
  }

  // Weighted average
  const healthScore = (dirScore * 0.4) + (eodScore * 0.3) + (fprdScore * 0.2) + (pcsScore * 0.1);
  return Math.round(healthScore);
}

/**
 * Main function that calculates all fairness metrics for a set of candidates.
 * Orchestrates all other calculations and returns comprehensive results.
 *
 * @param {Array<Object>} candidates - Array of candidate objects with resume data
 * @param {Array<string>} requiredSkills - Array of required skills for the role
 * @returns {Object} Complete fairness metrics and analysis
 */
export function calculateAllMetrics(candidates, requiredSkills = []) {
  if (!candidates || candidates.length === 0) {
    return {
      fairnessHealthScore: 0,
      disparateImpactByCollege: null,
      disparateImpactByCity: null,
      disparateImpactBySurname: null,
      equalOpportunityDiff: 0,
      falsePositiveRateDiff: 0,
      proxyCorrelations: {},
      proxyRankings: [],
      insufficientGroups: [],
      totalCandidates: 0,
      hiredCount: 0,
      rejectedCount: 0,
      flaggedSurnameCount: 0,
      lowConfidenceCount: 0
    };
  }

  // Enrich candidates with skill scores and classifications
  const enrichedCandidates = candidates.map(c => ({
    ...classifyCandidate(c),
    skillScore: calculateSkillScore(c, requiredSkills),
    decision: c.decision || 'unknown'
  }));

  // Count metadata
  const hiredCount = enrichedCandidates.filter(c => c.decision === 'hired').length;
  const rejectedCount = enrichedCandidates.filter(c => c.decision === 'rejected').length;
  const flaggedSurnameCount = enrichedCandidates.filter(c => c.surnameScore?.flagged).length;
  const lowConfidenceCount = enrichedCandidates.filter(c => (c.surnameScore?.confidence || 0) < 0.65).length;

  // Calculate college tier disparate impact
  const diCollege = calculateDisparateImpact(
    enrichedCandidates,
    c => c.collegeTier <= 2 ? 'advantaged' : 'disadvantaged'
  );

  // Calculate city tier disparate impact
  const diCity = calculateDisparateImpact(
    enrichedCandidates,
    c => c.cityTier <= 1 ? 'advantaged' : 'disadvantaged'
  );

  // Calculate surname disparate impact (only non-flagged)
  const validSurnames = enrichedCandidates.filter(c => !c.surnameScore?.flagged);
  const diSurname = calculateDisparateImpact(
    validSurnames,
    c => (c.surnameScore?.score || 0.5) >= 0.5 ? 'advantaged' : 'disadvantaged'
  );

  // Calculate EOD and FPRD
  const eod = calculateEqualOpportunityDifference(
    enrichedCandidates,
    c => c.collegeTier <= 2 ? 'advantaged' : 'disadvantaged'
  );

  const fprd = calculateFalsePositiveRateDifference(
    enrichedCandidates,
    c => c.collegeTier <= 2 ? 'advantaged' : 'disadvantaged'
  );

  // Calculate proxy correlations
  const proxyCorrelations = calculateProxyCorrelations(enrichedCandidates);
  const avgProxyCorrelation = (
    (proxyCorrelations.college || 0) +
    (proxyCorrelations.city || 0) +
    (proxyCorrelations.surname || 0) +
    (proxyCorrelations.company || 0) +
    (proxyCorrelations.gap || 0)
  ) / 5;

  // Rank proxies by severity
  const proxyRankings = Object.entries(proxyCorrelations)
    .map(([proxy, score]) => ({ proxy, score }))
    .sort((a, b) => b.score - a.score);

  // Collect insufficient groups
  const insufficientGroups = [];
  if (diCollege.insufficientData) insufficientGroups.push('college');
  if (diCity.insufficientData) insufficientGroups.push('city');
  if (diSurname.insufficientData) insufficientGroups.push('surname');

  // Calculate fairness health score
  const fairnessHealthScore = getFairnessHealthScore(
    diCollege.ratio,
    eod,
    fprd,
    avgProxyCorrelation
  );

  return {
    fairnessHealthScore,
    disparateImpactByCollege: diCollege,
    disparateImpactByCity: diCity,
    disparateImpactBySurname: diSurname,
    equalOpportunityDiff: Math.round(eod * 10000) / 100,
    falsePositiveRateDiff: Math.round(fprd * 10000) / 100,
    proxyCorrelations: {
      college: Math.round(proxyCorrelations.college * 100) / 100,
      city: Math.round(proxyCorrelations.city * 100) / 100,
      surname: Math.round(proxyCorrelations.surname * 100) / 100,
      company: Math.round(proxyCorrelations.company * 100) / 100,
      gap: Math.round(proxyCorrelations.gap * 100) / 100,
      average: Math.round(avgProxyCorrelation * 100) / 100
    },
    proxyRankings,
    insufficientGroups,
    totalCandidates: enrichedCandidates.length,
    hiredCount,
    rejectedCount,
    hireRate: Math.round((hiredCount / enrichedCandidates.length) * 10000) / 100,
    flaggedSurnameCount,
    lowConfidenceCount
  };
}

const biasCalculator = {
  calculateSkillScore,
  classifyCandidate,
  calculateDisparateImpact,
  calculateAllMetrics,
  getProxyPlainEnglish,
  getFairnessHealthScore
};

export default biasCalculator;
