// City tier classification for geographic background analysis
// Tier 1: Tier 1 metropolitan cities
// Tier 2: Tier 2 developed cities
// Tier 3: Other cities

export const CITY_TIERS = {
  // Tier 1 cities - Major metros
  'Mumbai': 1,
  'Delhi': 1,
  'New Delhi': 1,
  'Bangalore': 1,
  'Bengaluru': 1,
  'Chennai': 1,
  'Hyderabad': 1,
  'Pune': 1,
  'Kolkata': 1,

  // Tier 2 cities
  'Ahmedabad': 2,
  'Jaipur': 2,
  'Lucknow': 2,
  'Chandigarh': 2,
  'Kochi': 2,
  'Cochin': 2,
  'Indore': 2,
  'Nagpur': 2,
  'Surat': 2,
  'Coimbatore': 2,
  'Visakhapatnam': 2,
  'Vizag': 2,
  'Bhubaneswar': 2,
  'Bhopal': 2,
  'Patna': 2,
  'Vadodara': 2,
  'Baroda': 2,
  'Rajkot': 2,
  'Nashik': 2,
  'Aurangabad': 2,
  'Mysore': 2,
  'Mangalore': 2,
  'Hubli': 2,
  'Belgaum': 2,
  'Thiruvananthapuram': 2,
  'Calicut': 2,
  'Kozhikode': 2,
  'Tiruchirappalli': 2,
  'Madurai': 2,
  'Salem': 2,
  'Vellore': 2,
  'Agra': 2,
  'Meerut': 2,
  'Allahabad': 2,
  'Prayagraj': 2,
  'Varanasi': 2,
  'Kanpur': 2,
  'Dehradun': 2,
  'Shimla': 2,
};

export function getCityTier(cityName) {
  if (!cityName || cityName.trim() === '') {
    return 3; // Default tier for unknown
  }

  const name = cityName.trim();
  const lowerInput = name.toLowerCase();

  // Check for exact match (case insensitive)
  for (const [city, tier] of Object.entries(CITY_TIERS)) {
    if (city.toLowerCase() === lowerInput) {
      return tier;
    }
  }

  // Check if any city name is included in the input
  for (const [city, tier] of Object.entries(CITY_TIERS)) {
    if (lowerInput.includes(city.toLowerCase())) {
      return tier;
    }
  }

  // Default to tier 3 if not found
  return 3;
}
