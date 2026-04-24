/**
 * Gemini API service for resume parsing
 * Extracts structured data from resume PDFs using Google's Gemini 1.5 Pro model
 */

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

/**
 * Converts a PDF file to base64 string for API transmission
 * @param {File} file - PDF file object
 * @returns {Promise<string>} Base64 encoded PDF data
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // Remove data:application/pdf;base64, prefix
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Sends a resume PDF to Gemini API for parsing
 * @param {File} pdfFile - PDF file to parse
 * @returns {Promise<Object>} Parsed resume data
 */
export async function parseResume(pdfFile) {
  if (!GEMINI_API_KEY) {
    throw new Error('REACT_APP_GEMINI_API_KEY environment variable not set');
  }

  try {
    // Convert PDF to base64
    const base64Data = await fileToBase64(pdfFile);

    // Create the request payload
    const requestBody = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data
              }
            },
            {
              text: `Extract the following from this resume and return ONLY valid JSON with no extra text, no markdown, no backticks:
{
  "full_name": string or null,
  "surname": string or null,
  "skills": array of strings or null,
  "years_experience": number or null,
  "projects_count": number or null,
  "github_active": boolean or null,
  "college_name": string or null,
  "college_city": string or null,
  "college_state": string or null,
  "degree_type": string or null,
  "previous_companies": array of strings or null,
  "home_city": string or null,
  "home_state": string or null,
  "career_gaps": array of objects with {duration_months: number, year: number} or null,
  "language_complexity_score": number 0-1 or null,
  "extraction_type": "normal" or "ocr_needed",
  "confidence_scores": {
    "full_name": number 0-1,
    "skills": number 0-1,
    "years_experience": number 0-1,
    "college_name": number 0-1,
    "previous_companies": number 0-1,
    "home_city": number 0-1
  }
}`
            }
          ]
        }
      ]
    };

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract the text response
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('No valid response from Gemini API');
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // Parse JSON from response
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      throw new Error('Invalid JSON response from Gemini API');
    }

    // Calculate average confidence
    const confidenceScores = parsedData.confidence_scores || {};
    const confidenceValues = Object.values(confidenceScores);
    const averageConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
      : 0.5;

    // Add metadata
    return {
      ...parsedData,
      parsed_data: {
        full_name: parsedData.full_name,
        surname: parsedData.surname,
        skills: parsedData.skills || [],
        years_experience: parsedData.years_experience || 0,
        projects_count: parsedData.projects_count || 0,
        github_active: parsedData.github_active || false,
        college_name: parsedData.college_name,
        home_city: parsedData.home_city,
        home_state: parsedData.home_state,
        previous_companies: parsedData.previous_companies || [],
        employment_gaps: parsedData.career_gaps || []
      },
      metadata: {
        extraction_type: parsedData.extraction_type || 'normal',
        average_confidence: averageConfidence,
        confidence_scores: confidenceScores,
        language_complexity: parsedData.language_complexity_score || 0.5,
        source_file: pdfFile.name,
        parsed_at: new Date().toISOString()
      },
      flagged: {
        ocr_needed: parsedData.extraction_type === 'ocr_needed',
        low_confidence: averageConfidence < 0.7,
        complex_language: (parsedData.language_complexity_score || 0) > 0.8
      }
    };
  } catch (error) {
    console.error('Resume parsing error:', error);
    throw error;
  }
}

/**
 * Parses multiple resumes with progress tracking
 * @param {Array<File>} files - Array of PDF files
 * @param {Function} onProgress - Callback with (current, total, file)
 * @returns {Promise<Array>} Array of parsed resume data
 */
export async function parseResumesBatch(files, onProgress) {
  const results = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      onProgress?.(i + 1, files.length, file.name);
      const parsed = await parseResume(file);
      results.push({
        success: true,
        data: parsed,
        filename: file.name
      });
    } catch (error) {
      errors.push({
        filename: file.name,
        error: error.message
      });
      results.push({
        success: false,
        error: error.message,
        filename: file.name
      });
    }
  }

  return {
    results,
    errors,
    successCount: results.filter(r => r.success).length,
    errorCount: errors.length
  };
}

/**
 * Matches decision CSV rows to parsed resumes
 * @param {Array<Object>} decisions - Array of {name, decision} objects
 * @param {Array<Object>} parsedResumes - Array of parsed resume data
 * @returns {Object} Matched decisions and unmatched records
 */
export function matchDecisions(decisions, parsedResumes) {
  const matched = [];
  const unmatched = [];

  decisions.forEach(decision => {
    const match = parsedResumes.find(resume =>
      resume.parsed_data?.full_name?.toLowerCase() === decision.name.toLowerCase() ||
      resume.metadata?.source_file?.includes(decision.name.split(' ')[0])
    );

    if (match) {
      matched.push({
        ...match,
        decision: decision.decision.toLowerCase()
      });
    } else {
      unmatched.push(decision.name);
    }
  });

  return {
    matched,
    unmatched,
    matchRate: matched.length / decisions.length
  };
}

export async function generateBiasFinding(prompt) {
  // Simulated API call to Gemini
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("The hiring data shows potential disparate impact based on candidate background. Candidates from tier 1 locations or institutions are being selected at a higher rate than those with equivalent skills from other backgrounds.");
    }, 1000);
  });
}

const geminiService = {
  fileToBase64,
  parseResume,
  parseResumesBatch,
  matchDecisions,
  generateBiasFinding
};

export default geminiService;
