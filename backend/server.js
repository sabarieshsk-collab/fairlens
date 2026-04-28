const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: '../.env' });
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.REACT_APP_GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  '';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODELS = [
  'models/gemini-2.5-flash',
  'models/gemini-2.0-flash',
  'models/gemini-1.5-pro',
  'models/gemini-1.5-flash'
];

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const MIN_EXTRACTED_TEXT_LENGTH = 40;

function isPlaceholderKey(key) {
  const normalized = (key || '').trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'your_key_here' ||
    normalized === 'your_gemini_api_key_here' ||
    normalized.includes('your_value')
  );
}

function normalizeSkills(rawSkills) {
  if (Array.isArray(rawSkills)) return rawSkills.filter(Boolean);
  if (typeof rawSkills === 'string') {
    return rawSkills
      .split(/,|;|\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function cleanGeminiText(rawText) {
  return String(rawText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJsonFromText(rawText) {
  const cleaned = cleanGeminiText(rawText);
  console.log('Cleaned Gemini JSON candidate text:', cleaned.slice(0, 2000));
  try {
    return { parsed: JSON.parse(cleaned), cleaned };
  } catch (error) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Gemini response did not contain a JSON object');
    }
    const jsonBlock = cleaned.slice(start, end + 1);
    console.log('Extracted Gemini JSON block:', jsonBlock.slice(0, 2000));
    return { parsed: JSON.parse(jsonBlock), cleaned: jsonBlock };
  }
}

function parseYearsExperience(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  if (typeof value === 'string') {
    const match = value.match(/\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return 0;
}

function fallbackStructuredFromText(extractedText) {
  const lines = extractedText.split(/\n|\r/).map((s) => s.trim()).filter(Boolean);
  const firstLine = lines[0] || 'Unknown Candidate';
  let college = null;
  let city = null;
  let experience = 0;
  let skills = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!college && /college|university|iit|nit|bits/.test(lower)) college = line;
    if (!city && /city[:\-\s]/.test(lower)) {
      const m = line.match(/city[:\-]?\s*(.*)/i);
      city = m?.[1]?.trim() || line;
    }
    if (!experience && /experience/.test(lower)) {
      experience = parseYearsExperience(line);
    }
    if (skills.length === 0 && /skills?[:\-\s]/.test(lower)) {
      const m = line.split(':').slice(1).join(':').trim();
      if (m) skills = normalizeSkills(m);
    }
  }

  return {
    name: firstLine,
    skills,
    college,
    experience,
    home_city: city,
    previous_companies: []
  };
}

function validateAndNormalizeSchema(parsedJson, extractedText) {
  const fallback = fallbackStructuredFromText(extractedText);
  const normalized = { ...(parsedJson || {}) };

  normalized.name = normalized.name || normalized.full_name || fallback.name || 'Unknown Candidate';
  normalized.full_name = normalized.full_name || normalized.name;
  normalized.skills = normalizeSkills(normalized.skills);
  if (normalized.skills.length === 0) normalized.skills = fallback.skills;
  normalized.college = normalized.college || normalized.college_name || fallback.college || 'Unknown College';
  normalized.college_name = normalized.college_name || normalized.college;
  normalized.experience = parseYearsExperience(normalized.experience ?? normalized.years_experience);
  if (!normalized.experience) normalized.experience = fallback.experience;
  normalized.years_experience = normalized.years_experience ?? normalized.experience;
  normalized.home_city = normalized.home_city || fallback.home_city || 'Unknown City';
  normalized.previous_companies = Array.isArray(normalized.previous_companies)
    ? normalized.previous_companies
    : [];

  const missingFields = ['name', 'skills', 'college', 'experience'].filter((field) => {
    const value = normalized[field];
    if (field === 'skills') return !Array.isArray(value) || value.length === 0;
    if (field === 'experience') return !Number.isFinite(Number(value));
    return !value;
  });

  if (missingFields.length > 0) {
    console.warn('Schema fields missing from Gemini output; applied fallback values:', missingFields);
  }

  return normalized;
}

function buildPrompt(extractedText) {
  return [
    'Extract the following fields from this resume:',
    '- Full name',
    '- College',
    '- Skills',
    '- Years of experience',
    '- City',
    '- Previous companies',
    '',
    'Return ONLY valid JSON in this shape:',
    '{',
    '  "full_name": string,',
    '  "surname": string,',
    '  "college_name": string,',
    '  "skills": string[],',
    '  "years_experience": number,',
    '  "home_city": string,',
    '  "previous_companies": string[]',
    '}',
    '',
    'Resume:',
    extractedText
  ].join('\n');
}

function detectFileType(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  return 'unknown';
}

async function extractResumeText(file) {
  const fileType = detectFileType(file);
  let extractedText = '';

  if (fileType === 'pdf') {
    const parsedPdf = await pdfParse(file.buffer);
    extractedText = (parsedPdf.text || '').trim();
  } else if (fileType === 'docx') {
    const docxResult = await mammoth.extractRawText({ buffer: file.buffer });
    extractedText = (docxResult.value || '').trim();
  } else {
    throw new Error('Unsupported file type. Please upload .pdf or .docx files.');
  }

  return { fileType, extractedText };
}

async function callGeminiWithFallback(prompt) {
  if (isPlaceholderKey(GEMINI_API_KEY)) {
    throw new Error('Gemini API key is not configured on backend');
  }

  const failures = [];

  for (const modelName of GEMINI_MODELS) {
    const url = `${GEMINI_API_BASE}/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
    console.log('Trying Gemini model:', modelName);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const rawBody = await response.text();
      const contentType = (response.headers.get('content-type') || '').toLowerCase();

      console.log('Gemini request status:', {
        modelName,
        status: response.status,
        contentType
      });
      console.log('Gemini raw response:', rawBody);

      if (!contentType.includes('application/json')) {
        failures.push(`${modelName}: non-JSON response (${contentType || 'unknown'})`);
        continue;
      }

      const payload = rawBody ? JSON.parse(rawBody) : {};
      const modelText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!modelText) {
        failures.push(`${modelName}: missing text candidate in response`);
        continue;
      }

      console.log('Gemini model succeeded:', modelName);
      return { modelName, rawText: modelText };
    } catch (error) {
      console.error('Gemini model failed:', modelName, error.message || error);
      failures.push(`${modelName}: ${error.message || String(error)}`);
    }
  }

  throw new Error(`All Gemini model attempts failed. ${failures.join(' | ')}`);
}

function toCandidate(parsedJson, filename) {
  const fullName = parsedJson.full_name || parsedJson.name || null;
  const surname = parsedJson.surname || (fullName ? fullName.split(' ').slice(-1)[0] : null);
  const skills = normalizeSkills(parsedJson.skills);
  const previousCompanies = Array.isArray(parsedJson.previous_companies)
    ? parsedJson.previous_companies.filter(Boolean)
    : [];
  const yearsExperience = Number.isFinite(Number(parsedJson.years_experience))
    ? Number(parsedJson.years_experience)
    : 0;

  const confidenceScores = {
    full_name: fullName ? 0.9 : 0.2,
    college_name: parsedJson.college_name ? 0.8 : 0.3,
    skills: skills.length ? 0.8 : 0.3,
    years_experience: yearsExperience > 0 ? 0.7 : 0.3,
    home_city: parsedJson.home_city ? 0.7 : 0.3,
    previous_companies: previousCompanies.length ? 0.7 : 0.3
  };

  return {
    full_name: fullName,
    surname,
    skills,
    years_experience: yearsExperience,
    projects_count: Number.isFinite(Number(parsedJson.projects_count)) ? Number(parsedJson.projects_count) : 0,
    github_active: Boolean(parsedJson.github_active),
    college_name: parsedJson.college_name || null,
    college_city: parsedJson.college_city || null,
    college_state: parsedJson.college_state || null,
    degree_type: parsedJson.degree_type || null,
    previous_companies: previousCompanies,
    home_city: parsedJson.home_city || null,
    home_state: parsedJson.home_state || null,
    career_gaps: Array.isArray(parsedJson.career_gaps) ? parsedJson.career_gaps : [],
    language_complexity_score: Number.isFinite(Number(parsedJson.language_complexity_score))
      ? Number(parsedJson.language_complexity_score)
      : 0.5,
    extraction_type: 'normal',
    confidence_scores: confidenceScores,
    parsed_data: {
      full_name: fullName,
      surname,
      skills,
      years_experience: yearsExperience,
      projects_count: Number.isFinite(Number(parsedJson.projects_count)) ? Number(parsedJson.projects_count) : 0,
      github_active: Boolean(parsedJson.github_active),
      college_name: parsedJson.college_name || null,
      home_city: parsedJson.home_city || null,
      home_state: parsedJson.home_state || null,
      previous_companies: previousCompanies,
      employment_gaps: Array.isArray(parsedJson.career_gaps) ? parsedJson.career_gaps : []
    },
    metadata: {
      extraction_type: 'normal',
      average_confidence:
        Object.values(confidenceScores).reduce((sum, value) => sum + value, 0) / Object.keys(confidenceScores).length,
      confidence_scores: confidenceScores,
      language_complexity: Number.isFinite(Number(parsedJson.language_complexity_score))
        ? Number(parsedJson.language_complexity_score)
        : 0.5,
      source_file: filename,
      parsed_at: new Date().toISOString()
    },
    flagged: {
      ocr_needed: false,
      low_confidence: false,
      complex_language: false
    }
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.post('/api/parse', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No resume file was uploaded (field: resume).' });
    }

    console.log('Uploaded file name:', req.file.originalname);
    const { fileType, extractedText } = await extractResumeText(req.file);
    console.log('Resume file type:', fileType);
    console.log('Extracted resume text length:', extractedText.length);

    if (!extractedText) {
      return res.status(422).json({ success: false, error: `Unable to extract readable text from ${fileType.toUpperCase()} file.` });
    }

    if (extractedText.length < MIN_EXTRACTED_TEXT_LENGTH) {
      return res.status(422).json({
        success: false,
        error: `Extracted text is too short (${extractedText.length} chars). Please upload a clearer text-based PDF or DOCX resume.`
      });
    }

    const trimmedText = extractedText.slice(0, 12000);
    console.log('Trimmed text length sent to Gemini:', trimmedText.length);
    const prompt = buildPrompt(trimmedText);
    const { modelName, rawText } = await callGeminiWithFallback(prompt);
    console.log('Raw Gemini model text response:', rawText);

    let structured = null;
    try {
      const jsonResult = extractJsonFromText(rawText);
      structured = jsonResult.parsed;
      console.log('Parsed Gemini JSON object:', structured);
    } catch (parseError) {
      console.error('Gemini JSON parsing error:', parseError);
      structured = {};
    }

    const normalizedStructured = validateAndNormalizeSchema(structured, trimmedText);
    console.log('Normalized schema JSON:', normalizedStructured);
    const candidate = toCandidate(normalizedStructured, req.file.originalname);

    console.log('Final parsed JSON:', candidate);

    return res.json({
      success: true,
      model: modelName,
      candidate
    });
  } catch (error) {
    console.error('Parse route error:', error);
    console.error('Resume parse failure details:', {
      fileName: req.file?.originalname,
      message: error.message || String(error)
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse resume'
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`FairLens backend running on http://localhost:${PORT}`);
});

