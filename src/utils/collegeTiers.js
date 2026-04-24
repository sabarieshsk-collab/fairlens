// College tier classification for educational background analysis
// Tier 1: Highly prestigious institutions
// Tier 2: Well-established institutions
// Tier 3: General institutions
// Tier 4: Unknown institutions

export const COLLEGE_TIERS = {
  // Tier 1 - IITs
  'IIT Bombay': 1,
  'IIT Delhi': 1,
  'IIT Madras': 1,
  'IIT Kanpur': 1,
  'IIT Kharagpur': 1,
  'IIT Roorkee': 1,
  'IIT Guwahati': 1,
  'IIT Hyderabad': 1,
  'IIT Indore': 1,
  'IIT BHU Varanasi': 1,
  'IIT Patna': 1,
  'IIT Jodhpur': 1,
  'IIT Gandhinagar': 1,
  'IIT Mandi': 1,
  'IIT Palakkad': 1,
  'IIT Tirupati': 1,
  'IIT Dhanbad': 1,
  'ISM Dhanbad': 1,
  'IIT Bhilai': 1,
  'IIT Goa': 1,
  'IIT Jammu': 1,
  'IIT Dharwad': 1,

  // Tier 1 - IISc and IIMs
  'IISc Bangalore': 1,
  'Indian Institute of Science': 1,
  'IIM Ahmedabad': 1,
  'IIM Bangalore': 1,
  'IIM Calcutta': 1,
  'IIM Lucknow': 1,
  'IIM Kozhikode': 1,
  'IIM Indore': 1,
  'IIM Shillong': 1,

  // Tier 1 - NITs
  'NIT Trichy': 1,
  'NIT Tiruchirappalli': 1,
  'NIT Warangal': 1,
  'NIT Surathkal': 1,
  'NIT Calicut': 1,
  'NIT Rourkela': 1,
  'NIT Allahabad': 1,
  'NIT Silchar': 1,
  'NIT Durgapur': 1,

  // Tier 1 - BITS
  'BITS Pilani': 1,
  'BITS Goa': 1,
  'BITS Hyderabad': 1,

  // Tier 2 - Premier colleges
  'VIT Vellore': 2,
  'Vellore Institute of Technology': 2,
  'SRM Chennai': 2,
  'SRM Institute of Science and Technology': 2,
  'Manipal Academy of Higher Education': 2,
  'Manipal University': 2,
  'Thapar University': 2,
  'Thapar Institute of Engineering and Technology': 2,
  'PSG College': 2,
  'PSG College of Technology': 2,

  // Tier 2 - Delhi Universities
  'SRCC': 2,
  'SRCC Delhi': 2,
  'Hindu College': 2,
  'Hindu College Delhi': 2,
  'St Stephens': 2,
  'St Stephens College': 2,
  'Miranda House': 2,
  'Delhi University': 2,
  'University of Delhi': 2,

  // Tier 2 - IIITs
  'IIIT Hyderabad': 2,
  'IIIT Allahabad': 2,
  'International Institute of Information Technology': 2,

  // Tier 2 - Delhi Engineering
  'DTU': 2,
  'Delhi Technological University': 2,
  'NSIT': 2,
  'Netaji Subhas Institute of Technology': 2,

  // Tier 2 - Other top institutions
  'PEC Chandigarh': 2,
  'Punjab Engineering College': 2,
  'BIT Mesra': 2,
  'Birla Institute of Technology': 2,
  'Symbiosis Pune': 2,
  'Symbiosis International University': 2,
  'Christ University': 2,
  'Christ University Bangalore': 2,
  'Pune University': 2,
  'University of Pune': 2,
  'Jadavpur University': 2,
  'Anna University': 2,
  'Anna University Chennai': 2,
  'Mumbai University': 2,
  'University of Mumbai': 2,
};

export function getCollegeTier(collegeName) {
  if (!collegeName || collegeName.trim() === '') {
    return 4; // Unknown
  }

  const name = collegeName.trim();

  // Check for exact match
  if (COLLEGE_TIERS[name]) {
    return COLLEGE_TIERS[name];
  }

  // Check for case-insensitive match with partial string matching
  const lowerInput = name.toLowerCase();
  for (const [college, tier] of Object.entries(COLLEGE_TIERS)) {
    if (college.toLowerCase() === lowerInput) {
      return tier;
    }
  }

  // Check if any college name is included in the input
  for (const [college, tier] of Object.entries(COLLEGE_TIERS)) {
    if (lowerInput.includes(college.toLowerCase())) {
      return tier;
    }
  }

  // Default to tier 3 if not found
  return 3;
}
