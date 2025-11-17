// Official Boston neighborhoods from City of Boston Open Data
// Source: Boston Neighborhood Boundaries Approximated by 2020 Census Block Groups

export const bostonNeighborhoods = [
  "Allston",
  "Back Bay",
  "Beacon Hill",
  "Brighton",
  "Charlestown",
  "Chinatown",
  "Dorchester",
  "Downtown",
  "East Boston",
  "Fenway",
  "Harbor Islands",
  "Hyde Park",
  "Jamaica Plain",
  "Longwood",
  "Mattapan",
  "Mission Hill",
  "North End",
  "Roslindale",
  "Roxbury",
  "South Boston",
  "South Boston Waterfront",
  "South End",
  "West End",
  "West Roxbury"
] as const;

export type BostonNeighborhood = typeof bostonNeighborhoods[number];
