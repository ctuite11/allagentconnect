// Neighborhoods/Areas by major cities across US states
export const usNeighborhoodsByCityState: Record<string, string[]> = {
  // Massachusetts
  "Boston-MA": ["Aberdeen", "Allston", "Back Bay", "Bay Village", "Beacon Hill", "Brighton", "Brighton's Chestnut Hill", "Charlestown", "Chinatown", "Dorchester", "Downtown", "East Boston", "Fenway", "Hyde Park", "Jamaica Plain", "Mattapan", "Mission Hill", "North End", "Roslindale", "Roxbury", "South Boston", "South End", "West End", "West Roxbury"],
  "Worcester-MA": ["Burncoat", "Cherry Valley", "Crown Hill", "Downtown", "East Side", "Greendale", "Main South", "Tatnuck", "University Park", "Vernon Hill", "West Side"],
  "Springfield-MA": ["Bay", "Boston Road", "Brightwood", "Downtown", "East Forest Park", "Forest Park", "Liberty Heights", "McKnight", "Memorial Square", "Metro Center", "North End", "Old Hill", "Pine Point", "Sixteen Acres", "South End"],
  
  // California
  "Los Angeles-CA": ["Arleta", "Bel Air", "Beverly Crest", "Beverly Grove", "Boyle Heights", "Brentwood", "Century City", "Chatsworth", "Chinatown", "Crenshaw", "Downtown", "Eagle Rock", "Echo Park", "El Sereno", "Encino", "Hollywood", "Hyde Park", "Koreatown", "Leimert Park", "Los Feliz", "Mid-City", "Mid-Wilshire", "Pacific Palisades", "Palms", "San Pedro", "Santa Monica", "Sherman Oaks", "Silver Lake", "South Central", "Studio City", "Sun Valley", "Sylmar", "Toluca Lake", "Van Nuys", "Venice", "West Adams", "West Hills", "West Hollywood", "Westlake", "Westwood", "Wilmington", "Windsor Square"],
  "San Diego-CA": ["Balboa Park", "Bankers Hill", "Bay Ho", "Bay Park", "Carmel Valley", "City Heights", "Clairemont", "College Area", "Del Mar Heights", "Downtown", "East Village", "Gaslamp Quarter", "Golden Hill", "Kearny Mesa", "La Jolla", "Linda Vista", "Little Italy", "Mira Mesa", "Mission Bay", "Mission Beach", "Mission Hills", "Mission Valley", "North Park", "Ocean Beach", "Pacific Beach", "Point Loma", "Rancho Bernardo", "Rancho Penasquitos", "Scripps Ranch", "Sorrento Valley", "Tierrasanta", "University City", "University Heights"],
  "San Francisco-CA": ["Bayview", "Bernal Heights", "Castro", "Chinatown", "Civic Center", "Cole Valley", "Dogpatch", "Downtown", "Embarcadero", "Excelsior", "Financial District", "Fisherman's Wharf", "Glen Park", "Haight-Ashbury", "Hayes Valley", "Inner Richmond", "Inner Sunset", "Japantown", "Lower Haight", "Marina", "Mission", "Nob Hill", "Noe Valley", "North Beach", "Outer Richmond", "Outer Sunset", "Pacific Heights", "Polk Gulch", "Potrero Hill", "Presidio", "Richmond", "Russian Hill", "SOMA", "Sunset", "Tenderloin", "Twin Peaks", "Union Square", "Western Addition"],
  
  // New York
  "New York-NY": ["Battery Park City", "Chelsea", "Chinatown", "East Harlem", "East Village", "Financial District", "Flatiron", "Gramercy", "Greenwich Village", "Harlem", "Hell's Kitchen", "Hudson Yards", "Inwood", "Kips Bay", "Little Italy", "Lower East Side", "Midtown", "Morningside Heights", "Murray Hill", "NoHo", "NoMad", "SoHo", "Stuyvesant Town", "Tribeca", "Tudor City", "Two Bridges", "Upper East Side", "Upper West Side", "Washington Heights", "West Village"],
  
  // Illinois
  "Chicago-IL": ["Albany Park", "Andersonville", "Armour Square", "Ashburn", "Auburn Gresham", "Austin", "Avondale", "Back of the Yards", "Belmont Cragin", "Beverly", "Bridgeport", "Brighton Park", "Bucktown", "Calumet Heights", "Chatham", "Chinatown", "Clearing", "Edgewater", "Englewood", "Forest Glen", "Garfield Park", "Gold Coast", "Grand Boulevard", "Hegewisch", "Hermosa", "Humboldt Park", "Hyde Park", "Irving Park", "Jefferson Park", "Kenwood", "Lakeview", "Lincoln Park", "Lincoln Square", "Logan Square", "Loop", "McKinley Park", "Montclare", "Mount Greenwood", "Near North Side", "Near South Side", "North Center", "Norwood Park", "Pilsen", "Portage Park", "Pullman", "Ravenswood", "River North", "Riverdale", "Rogers Park", "Roseland", "South Chicago", "South Shore", "Streeterville", "Uptown", "West Elsdon", "West Englewood", "West Lawn", "West Loop", "West Ridge", "West Town", "Wicker Park", "Woodlawn"],
  
  // Texas
  "Houston-TX": ["Addicks", "Alief", "Bellaire", "Braeswood", "Clear Lake", "Cottage Grove", "Downtown", "East End", "Fifth Ward", "Fourth Ward", "Galleria", "Greater Heights", "Greenway", "Gulfton", "Heights", "Hobby Area", "Houston Heights", "Independence Heights", "Kashmere Gardens", "Kingwood", "Magnolia Park", "Midtown", "Montrose", "Neartown", "Rice Village", "River Oaks", "Second Ward", "Sharpstown", "Southampton", "Third Ward", "Upper Kirby", "Washington Avenue", "West University", "Westchase"],
  "Dallas-TX": ["Arts District", "Bishop Arts District", "Cityplace", "Deep Ellum", "Design District", "Downtown", "East Dallas", "Fair Park", "Highland Park", "Knox-Henderson", "Lake Highlands", "Lakewood", "Lower Greenville", "North Dallas", "Oak Cliff", "Oak Lawn", "Old East Dallas", "Park Cities", "Preston Hollow", "South Dallas", "Uptown", "Victory Park", "West Dallas", "White Rock Lake"],
  "Austin-TX": ["Barton Hills", "Bouldin Creek", "Brentwood", "Central Austin", "Clarksville", "Crestview", "Downtown", "East Austin", "Hyde Park", "Mueller", "North Loop", "Rosedale", "South Congress", "South Lamar", "Tarrytown", "Travis Heights", "West Campus", "Zilker"],
  
  // Florida
  "Miami-FL": ["Allapattah", "Brickell", "Coconut Grove", "Coral Way", "Design District", "Downtown", "Edgewater", "Flagami", "Little Havana", "Little Haiti", "Midtown", "Model City", "Overtown", "Upper Eastside", "Wynwood"],
  
  // Georgia
  "Atlanta-GA": ["Ansley Park", "Buckhead", "Candler Park", "Castleberry Hill", "Decatur", "Downtown", "Druid Hills", "East Atlanta", "Grant Park", "Inman Park", "Little Five Points", "Midtown", "Old Fourth Ward", "Poncey-Highland", "Sweet Auburn", "Virginia Highland", "West End", "Westview"],
  
  // Washington
  "Seattle-WA": ["Ballard", "Beacon Hill", "Capitol Hill", "Central District", "Columbia City", "Downtown", "Eastlake", "Fremont", "Georgetown", "Green Lake", "Greenwood", "Madison Park", "Magnolia", "Madrona", "Pike Place Market", "Pioneer Square", "Queen Anne", "Ravenna", "South Lake Union", "University District", "Wallingford", "West Seattle"],
  
  // Colorado
  "Denver-CO": ["Capitol Hill", "Cherry Creek", "City Park", "Downtown", "Five Points", "Globeville", "Highland", "LoDo", "Park Hill", "RiNo", "Stapleton", "Union Station", "Uptown", "Washington Park"],
  
  // Pennsylvania
  "Philadelphia-PA": ["Bella Vista", "Center City", "Chestnut Hill", "Chinatown", "East Falls", "Fairmount", "Fishtown", "Germantown", "Graduate Hospital", "Kensington", "Logan Square", "Manayunk", "Northern Liberties", "Old City", "Passyunk Square", "Port Richmond", "Queen Village", "Rittenhouse Square", "Society Hill", "South Philadelphia", "South Street", "University City", "Washington Square West"],
  
  // Arizona
  "Phoenix-AZ": ["Ahwatukee", "Arcadia", "Biltmore", "Central Phoenix", "Desert Ridge", "Downtown", "Encanto", "Maryvale", "Midtown", "Moon Valley", "North Mountain", "Paradise Valley", "South Mountain", "Sunnyslope"],
  
  // Michigan
  "Detroit-MI": ["Corktown", "Downtown", "Eastern Market", "Greektown", "Midtown", "New Center", "Palmer Woods", "Riverfront", "Rosedale Park", "Southwest Detroit", "West Village"],
  
  // Oregon
  "Portland-OR": ["Alberta Arts", "Buckman", "Downtown", "Eastmoreland", "Goose Hollow", "Hawthorne", "Irvington", "Laurelhurst", "Lloyd District", "Mississippi", "Mt. Tabor", "Nob Hill", "Pearl District", "Richmond", "Sellwood", "St. Johns", "West Hills"],
  
  // Minnesota
  "Minneapolis-MN": ["Downtown", "Linden Hills", "Longfellow", "Lowry Hill", "Lyndale", "Northeast", "North Loop", "Phillips", "Powderhorn", "Seward", "Uptown", "Whittier"],
  
  // Nevada
  "Las Vegas-NV": ["Arts District", "Centennial Hills", "Downtown", "Green Valley", "Henderson", "North Las Vegas", "Summerlin", "The Strip", "West Las Vegas"],
  
  // North Carolina
  "Charlotte-NC": ["Dilworth", "Downtown", "Elizabeth", "Myers Park", "NoDa", "Plaza Midwood", "South End", "Uptown"],
  
  // Tennessee
  "Nashville-TN": ["12 South", "Belle Meade", "Belmont-Hillsboro", "Downtown", "East Nashville", "Germantown", "Green Hills", "Gulch", "Music Row", "Sylvan Park", "The Nations", "West End"],
};

// Get all areas for a city-state combination
export function getAreasForCity(city: string, state: string): string[] {
  const key = `${city}-${state}`;
  return usNeighborhoodsByCityState[key] || [];
}

// Check if a city has neighborhood data
export function hasNeighborhoodData(city: string, state: string): boolean {
  const key = `${city}-${state}`;
  return key in usNeighborhoodsByCityState;
}
