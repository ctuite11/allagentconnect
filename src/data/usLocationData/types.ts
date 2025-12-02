export interface LocationEntry {
  state: string;
  stateAbbr: string;
  city: string;
  neighborhood?: string;
  zipCodes: string[];
}

export interface CityData {
  name: string;
  neighborhoods?: string[];
  zipCodes: string[];
}

export interface StateData {
  name: string;
  abbreviation: string;
  cities: CityData[];
}
