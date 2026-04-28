/**
 * Gemini API service for FairLens
 * Handles resume parsing, bias finding generation, and counterfactual narratives
 */

import { safeFetch, SafeFetchError } from './safeFetch';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const AVAILABLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
];
const MODEL_CACHE_KEY = 'fairlens_gemini_model';
const RESUME_PARSE_API_URL =
  process.env.REACT_APP_RESUME_PARSE_API_URL ||
  process.env.VITE_RESUME_PARSE_API_URL ||
  'http://localhost:5000/api/parse';

function isPlaceholderKey(key) {
  if (!key || typeof key !== 'string') return true;
  const normalized = key.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === 'your_key_here' ||
    normalized === 'your_gemini_api_key_here' ||
    normalized.includes('your_value')
  );
}

export function getGeminiApiKey() {
  const envCandidates = [
    process.env.REACT_APP_GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY
  ];
  const key = envCandidates.find((value) => typeof value === 'string' && value.trim().length > 0) || '';
  return key.trim();
}

export function getResumeParseApiUrl() {
  const raw = (RESUME_PARSE_API_URL || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error('Resume parse API URL must be absolute (e.g. http://localhost:5000/api/parse)');
  }
  return raw;
}

// Try available models in order and cache a working model in localStorage.
async function tryModels(requestBody) {
  const apiKey = getGeminiApiKey();
  if (isPlaceholderKey(apiKey)) throw new Error('Gemini API key not set');
  const cached = (() => { try { return localStorage.getItem(MODEL_CACHE_KEY); } catch(e){return null;} })();
  const models = cached ? [cached, ...AVAILABLE_MODELS.filter(m => m !== cached)] : AVAILABLE_MODELS.slice();

  for (const model of models) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
    try {
      console.log('Trying Gemini model:', model);
      const { data } = await safeFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      console.log('Gemini model succeeded:', model);
      try { localStorage.setItem(MODEL_CACHE_KEY, model); } catch(e){}
      return { model, data };
    } catch (e) {
      if (e instanceof SafeFetchError) {
        console.warn(`Gemini model failed (${model}):`, e.message, e.details);
      }
      console.warn('Error contacting Gemini model', model, e.message || e);
      continue;
    }
  }
  throw new Error('No compatible Gemini model found for this API key');
}

// Internal helper: call Gemini with a text prompt
async function callGeminiText(prompt) {
  const requestBody = { contents: [{ parts: [{ text: prompt }] }] };
  const result = await tryModels(requestBody);
  const data = result.data;
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('No valid response from Gemini API');
  return data.candidates[0].content.parts[0].text.trim();
}

// TASK 1: generateBiasFinding()
function buildBiasFindingFallback(metrics, auditDetails) {
  const score = metrics.fairnessHealthScore;
  const topProxy = metrics.proxyRankings[0]?.proxy || metrics.proxyRankings[0] || 'college';
  const proxyLabels = {
    college: 'college tier',
    city: 'home city tier',
    surname: 'surname patterns',
    company: 'previous employer tier',
    gap: 'employment gaps'
  };
  const urgency = score < 60
    ? 'Immediate remediation is required under the Equal Opportunity Policy 2023.'
    : score < 80
    ? 'Remediation is recommended before the next hiring cycle to prevent threshold breach.'
    : 'Continued monitoring is recommended.';

  return `The ${auditDetails.audit_cycle_name} hiring cycle received a Fairness Health Score of ${score} out of 100, indicating ${score < 60 ? 'significant' : score < 80 ? 'moderate' : 'acceptable'} levels of proxy-driven disparity in the hiring AI's decisions. The strongest driver of unequal outcomes is ${proxyLabels[topProxy] || topProxy}, with candidates from disadvantaged backgrounds being selected at ${Math.round(metrics.disparateImpactByCollege.ratio * 100)}% the rate of candidates from advantaged backgrounds despite equivalent skills. ${urgency}`;
}

export async function generateBiasFinding(metrics, auditDetails) {
  const prompt = `You are an AI fairness analyst for FairLens, an HR compliance tool used by Indian companies. Write a professional 3 to 4 sentence narrative summary of the following hiring bias analysis findings. Write for an HR compliance officer who has no data science background. Use plain English. Map the findings to Indian legal context where relevant. Do not use bullet points. Do not use technical terms like disparate impact ratio — instead say "selection rate gap" or "hiring rate difference."\n\nAudit name: ${auditDetails.audit_cycle_name}\nJob role: ${auditDetails.job_role}\nTotal candidates reviewed: ${metrics.totalCandidates}\nFairness Health Score: ${metrics.fairnessHealthScore} out of 100\nCollege tier selection rate gap: ${metrics.disparateImpactByCollege.ratio}\n(below 0.80 means a legal threshold has been crossed)\nCity tier selection rate gap: ${metrics.disparateImpactByCity.ratio}\nSurname-based selection rate gap: ${metrics.disparateImpactBySurname.ratio}\nStrongest proxy driver: ${metrics.proxyRankings[0]?.proxy || metrics.proxyRankings[0] || 'college'}\nEqual opportunity difference: ${metrics.equalOpportunityDiff}%\n\nWrite a paragraph that covers: what was found in plain terms, which proxy variable is the primary driver, whether any legal thresholds under India's Equal Opportunity Policy 2023 have been crossed or are being approached, and what the urgency level is.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await callGeminiText(prompt);
    } catch (error) {
      console.error(`generateBiasFinding attempt ${attempt} failed:`, error);
      if (attempt === 1) await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return buildBiasFindingFallback(metrics, auditDetails);
}

// TASK 2: generateCounterfactualNarrative()
function buildCounterfactualFallback(candidate, auditMetrics) {
  const topProxy = auditMetrics.proxyRankings[0]?.proxy || auditMetrics.proxyRankings[0] || 'college';
  const proxyDescriptions = {
    college: 'college was classified as Tier 1',
    city: 'home city was a Tier 1 metropolitan area',
    surname: 'surname did not trigger the proxy correlation flag',
    company: 'previous employer was a Tier 1 company',
    gap: 'career history had no employment gaps'
  };
  const description = proxyDescriptions[topProxy] || 'background profile matched the advantaged group';
  return `${candidate.name} would have been selected if their ${description}, because their technical skill score of ${candidate.skillScore} was above the selection threshold — meaning skill was not the deciding factor in their rejection.`;
}

export async function generateCounterfactualNarrative(candidate, auditMetrics) {
  const prompt = `You are an AI fairness analyst. A hiring AI has rejected a job candidate. Based on the information below, write exactly one sentence explaining what single non-skill background change would have resulted in the candidate being selected.\n\nUse this exact format:\n"[Candidate name] would have been selected if [specific background change], because their [skill metric] of [value] [was/were] [above/at] the selection threshold — meaning [their skill] was not the deciding factor."\n\nCandidate name: ${candidate.name}\nAI decision: rejected\nTechnical skill score: ${candidate.skillScore} out of 100\nYears of experience: ${candidate.yearsExperience}\nNumber of projects: ${candidate.projectsCount || 'not specified'}\nCollege name: ${candidate.collegeName}\nCollege tier: ${candidate.collegeTier} out of 4\n(Tier 1 = IIT/NIT, Tier 4 = regional state college)\nHome city: ${candidate.homeCity}, Tier ${candidate.cityTier}\nSurname proxy flag: ${candidate.flagged ? 'yes' : 'no'}\nCareer gap in years: ${candidate.gapScore || 0}\nStrongest proxy variable in this hiring cycle: ${auditMetrics.proxyRankings[0]?.proxy || auditMetrics.proxyRankings[0] || "college"}\nProxy correlation for that variable: ${auditMetrics.proxyCorrelations?.[auditMetrics.proxyRankings[0]?.proxy || auditMetrics.proxyRankings[0]] ?? "unknown"}\n\nWrite only the one sentence. No introduction. No explanation. No bullet points.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await callGeminiText(prompt);
    } catch (error) {
      console.error(`generateCounterfactualNarrative attempt ${attempt} failed:`, error);
      if (attempt === 1) await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return buildCounterfactualFallback(candidate, auditMetrics);
}



async function parseResumeViaBackend(pdfFile) {
  const apiUrl = getResumeParseApiUrl();
  if (!apiUrl) return null;
  console.log('Uploading PDF to backend parser:', { fileName: pdfFile?.name, apiUrl });
  const formData = new FormData();
  formData.append('resume', pdfFile, pdfFile.name);

  const { data } = await safeFetch(apiUrl, {
    method: 'POST',
    body: formData
  });

  if (!data || typeof data !== 'object') {
    throw new Error('Backend parse endpoint returned an invalid payload');
  }
  if (!data.success) {
    throw new Error(data.error || 'Backend parse endpoint reported failure');
  }
  if (!data.candidate || typeof data.candidate !== 'object') {
    throw new Error('Backend parse endpoint did not return candidate JSON');
  }
  return data.candidate;
}

// parseResume calls backend API for all resume parsing (PDF, DOCX, etc.)
export async function parseResume(pdfFile) {
  try {
    const backendData = await parseResumeViaBackend(pdfFile);
    return { success: true, attempt: 1, data: backendData, error: null };
  } catch (backendError) {
    return {
      success: false,
      data: null,
      error: backendError?.message || 'Backend parse failed',
      attempt: 1
    };
  }
}

// Decision CSV matching
export function matchDecisions(decisions, parsedResumes) {
  const matched = [];
  const unmatched = [];

  decisions.forEach(decision => {
    const match = parsedResumes.find(resume =>
      resume.parsed_data?.full_name?.toLowerCase() === decision.name.toLowerCase() ||
      resume.metadata?.source_file?.includes(decision.name.split(' ')[0])
    );

    if (match) matched.push({ ...match, decision: decision.decision.toLowerCase() });
    else unmatched.push(decision.name);
  });

  return { matched, unmatched, matchRate: matched.length / decisions.length };
}

const geminiService = { parseResume, parseResumesBatch: async function(files,onProgress){
  const results=[];const errors=[];for(let i=0;i<files.length;i++){const file=files[i];onProgress?.(i+1,files.length,file.name);const r=await parseResume(file);if(r.success)results.push({success:true,data:r.data,filename:file.name});else{errors.push({filename:file.name,error:r.error});results.push({success:false,error:r.error,filename:file.name});}}return{results,errors,successCount:results.filter(r=>r.success).length,errorCount:errors.length};}, matchDecisions, generateBiasFinding, generateCounterfactualNarrative };

export default geminiService;
