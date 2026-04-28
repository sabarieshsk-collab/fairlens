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
  (process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/parse` : null);

// Log the API URL on module load
console.log("Using API URL:", process.env.REACT_APP_API_URL);
console.log("Resume parse API URL:", RESUME_PARSE_API_URL);

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
<<<<<<< HEAD
    throw new Error('Resume parse API URL must be absolute (e.g. http://localhost:5000/api/parse)');
=======
    throw new Error('Resume parse API URL must be absolute (e.g. https://fairlens-backend-3m2c.onrender.com/api/parse)');
>>>>>>> 5dbb4d0 (Connected frontend to Render backend)
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
<<<<<<< HEAD
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
=======
>>>>>>> 5dbb4d0 (Connected frontend to Render backend)
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

// Local PDF text extraction + lightweight heuristic parser fallback
async function localParse(pdfFile) {
  const arrayBuffer = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(pdfFile);
  });

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');

  // CRITICAL: Must set workerSrc before calling getDocument.
  // Without this, pdfjs tries to load its worker from a relative URL like
  // /static/js/pdf.worker.js which does not exist in CRA. The dev server
  // returns index.html for unknown routes, and the browser tries to parse
  // that HTML as a Web Worker script, producing:
  //   "Uncaught SyntaxError: Unexpected token '<'"
  // This bypasses all try-catch because it happens inside a Web Worker thread.
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
  }

  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const maxPages = Math.min(3, doc.numPages);
  let fullText = '';
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(it => it.str).join(' ');
    fullText += '\n' + pageText;
  }

  const lines = fullText.split(/\n|\r|\.|;/).map(s => s.trim()).filter(Boolean);
  const firstLine = lines[0] || null;

  const name = firstLine;
  let skills = null;
  let years_experience = null;
  let projects_count = null;
  let college_name = null;
  let home_city = null;

  for (const l of lines) {
    const low = l.toLowerCase();
    if (!skills && (low.includes('skills:') || low.includes('skill:'))) {
      const part = l.split(':').slice(1).join(':').trim();
      skills = part ? part.split(/,|;/).map(s => s.trim()).filter(Boolean) : null;
    }
    if (!years_experience && low.match(/experience:\s*\d+/)) {
      const m = low.match(/experience:\s*(\d+)/);
      if (m) years_experience = Number(m[1]);
    }
    if (!projects_count && low.match(/projects?:\s*\d+/)) {
      const m = low.match(/projects?:\s*(\d+)/);
      if (m) projects_count = Number(m[1]);
    }
    if (!college_name && (low.includes('university') || low.includes('college') || low.match(/iit|nit|bits/i))) {
      college_name = l;
    }
    if (!home_city && low.includes('city')) {
      const m = l.match(/city[:\-]\s*(.*)/i);
      if (m) home_city = m[1].trim();
    }
  }

  const parsed = {
    full_name: name || null,
    surname: name ? name.split(' ').slice(-1)[0] : null,
    skills: skills || null,
    years_experience: years_experience || null,
    projects_count: projects_count || null,
    github_active: null,
    college_name: college_name || null,
    college_city: null,
    college_state: null,
    degree_type: null,
    previous_companies: null,
    home_city: home_city || null,
    home_state: null,
    career_gaps: null,
    language_complexity_score: null,
    extraction_type: 'normal',
    confidence_scores: {
      full_name: 0.9,
      skills: skills ? 0.6 : 0.3,
      years_experience: years_experience ? 0.6 : 0.3,
      college_name: college_name ? 0.5 : 0.2,
      previous_companies: 0.2,
      home_city: home_city ? 0.4 : 0.2
    }
  };

<<<<<<< HEAD
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



=======
  return {
    ...parsed,
    parsed_data: {
      full_name: parsed.full_name,
      surname: parsed.surname,
      skills: parsed.skills || [],
      years_experience: parsed.years_experience || 0,
      projects_count: parsed.projects_count || 0,
      github_active: parsed.github_active || false,
      college_name: parsed.college_name,
      home_city: parsed.home_city,
      home_state: parsed.home_state,
      previous_companies: parsed.previous_companies || [],
      employment_gaps: parsed.career_gaps || []
    },
    metadata: {
      extraction_type: 'normal',
      average_confidence: 0.5,
      confidence_scores: parsed.confidence_scores || {},
      language_complexity: parsed.language_complexity_score || 0.5,
      source_file: pdfFile.name,
      parsed_at: new Date().toISOString()
    },
    flagged: {
      ocr_needed: false,
      low_confidence: true,
      complex_language: false
    }
  };
}

>>>>>>> 5dbb4d0 (Connected frontend to Render backend)
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

<<<<<<< HEAD
// parseResume calls backend API for all resume parsing (PDF, DOCX, etc.)
=======
// parseResume uses Gemini with fallback and will try available models for PDF input too
>>>>>>> 5dbb4d0 (Connected frontend to Render backend)
export async function parseResume(pdfFile) {
  try {
    const backendData = await parseResumeViaBackend(pdfFile);
    return { success: true, attempt: 1, data: backendData, error: null };
  } catch (backendError) {
<<<<<<< HEAD
    return {
      success: false,
      data: null,
      error: backendError?.message || 'Backend parse failed',
      attempt: 1
    };
=======
    console.error('Backend resume parse failed; using local fallback:', backendError);
    try {
      const local = await localParse(pdfFile);
      return { success: true, attempt: 0, data: local, error: null };
    } catch (localError) {
      return {
        success: false,
        data: null,
        error: `${backendError?.message || 'Backend parse failed'} | local parse failed: ${localError?.message || localError}`,
        attempt: 0
      };
    }
>>>>>>> 5dbb4d0 (Connected frontend to Render backend)
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
