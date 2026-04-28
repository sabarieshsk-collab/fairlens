const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');

async function localParseBuffer(buffer, filename) {
  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;
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
      source_file: filename,
      parsed_at: new Date().toISOString()
    },
    flagged: {
      ocr_needed: false,
      low_confidence: true,
      complex_language: false
    }
  };
}

(async function(){
  try{
    const demo = path.resolve(__dirname, '..','demo-resumes','Priya_Kumari.pdf');
    const buf = fs.readFileSync(demo);
    const parsed = await localParseBuffer(buf, 'Priya_Kumari.pdf');
    console.log(JSON.stringify(parsed, null, 2));
  }catch(e){
    console.error('Error running local parse:', e);
    process.exit(1);
  }
})();
