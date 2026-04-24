/*
IMPORTANT: Surname mapping is probabilistic and based on demographic patterns.
Regional variation exists and context matters significantly.
Low confidence surnames are EXCLUDED from all metric calculations.

This is NOT a definitive determination of any individual's community.
The system is designed to detect patterns in hiring, not to classify individuals.
*/

// Upper caste surnames (0.9-1.0 score)
const UPPER_CASTE_SURNAMES = new Set([
  'Sharma', 'Verma', 'Gupta', 'Agarwal', 'Agrawal',
  'Iyer', 'Iyengar', 'Nair', 'Menon', 'Pillai',
  'Reddy', 'Rao', 'Naidu', 'Joshi', 'Tiwari',
  'Pandey', 'Mishra', 'Shukla', 'Trivedi', 'Dwivedi',
  'Srivastava', 'Banerjee', 'Chatterjee',
  'Mukherjee', 'Bose', 'Bhattacharya',
  'Patel', 'Shah', 'Mehta', 'Desai', 'Parekh',
  'Kapoor', 'Khanna', 'Malhotra', 'Sethi',
  'Tandon', 'Anand', 'Bhat', 'Kamath'
]);

// Singh - context dependent (0.7 in upper caste context)
const SINGH_SURNAME = 'Singh';

// SC/ST associated surnames (0.0-0.2 score)
const SC_ST_SURNAMES = new Set([
  'Chamar', 'Dhobi', 'Mahar', 'Mang', 'Paswan',
  'Musahar', 'Khatik', 'Balmiki', 'Valmiki',
  'Parmar', 'Solanki'
]);

// Ambiguous surnames (0.5 score, confidence 0.3, flagged true)
const AMBIGUOUS_SURNAMES = new Set([
  'Kumar', 'Kumari', 'Devi', 'Lal', 'Ram', 'Das'
]);

export function getSurnameScore(surname) {
  if (!surname || surname.trim() === '') {
    return {
      score: 0.5,
      confidence: 0.0,
      flagged: true
    };
  }

  const cleanName = surname.trim();
  const lowerName = cleanName.toLowerCase();

  // Check if ambiguous surname
  if (AMBIGUOUS_SURNAMES.has(cleanName) || 
      (cleanName.length < 4 && !UPPER_CASTE_SURNAMES.has(cleanName) && !SC_ST_SURNAMES.has(cleanName))) {
    return {
      score: 0.5,
      confidence: 0.3,
      flagged: true
    };
  }

  // Check upper caste surnames
  if (UPPER_CASTE_SURNAMES.has(cleanName)) {
    return {
      score: 0.95,
      confidence: 0.85,
      flagged: false
    };
  }

  // Check Singh (context dependent)
  if (lowerName === SINGH_SURNAME.toLowerCase()) {
    return {
      score: 0.7,
      confidence: 0.5,
      flagged: true // Flagged as ambiguous
    };
  }

  // Check SC/ST surnames
  if (SC_ST_SURNAMES.has(cleanName)) {
    return {
      score: 0.1,
      confidence: 0.8,
      flagged: false
    };
  }

  // Default: ambiguous/unknown
  return {
    score: 0.5,
    confidence: 0.35,
    flagged: true
  };
}
