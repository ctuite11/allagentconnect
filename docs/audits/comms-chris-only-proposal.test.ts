import assert from 'node:assert/strict';
import { matchesCommunicationPreferences, EMPTY_PREFERENCES, type AgentPreferences, type PreferenceEvent } from '../../supabase/functions/_shared/communicationPreferencesMatcher.ts';
const ID = '1fc50da1-2664-4931-8cab-64e24dc5ed8c';
const EMAIL = 'chris@allagentconnect.com';
const norm = (v: unknown) => typeof v === 'string' ? v.trim().toLowerCase() : '';
type Criteria = {state?: string; cities?: string[]; counties?: string[]; neighborhoods?: string[]; minPrice?: number; maxPrice?: number; propertyTypes?: string[]};
function baseline(prefs: AgentPreferences, criteria: Criteria) {
  const events: PreferenceEvent[] = [
    ...(criteria.cities ?? []).map(city => ({state:criteria.state, city})),
    ...(criteria.counties ?? []).map(county => ({state:criteria.state, county})),
    ...(criteria.neighborhoods ?? []).map(neighborhood => ({state:criteria.state, neighborhood})),
  ];
  if (!events.length) events.push({state:criteria.state});
  return events.some(ev => matchesCommunicationPreferences(prefs, {...ev, minPrice:criteria.minPrice,maxPrice:criteria.maxPrice,propertyTypes:criteria.propertyTypes}).matches);
}
function proposed(id: string, email: string, prefs: AgentPreferences, criteria: Criteria) {
  const original = baseline(prefs, criteria);
  if (id !== ID || norm(email) !== EMAIL || original) return original;
  if (norm(criteria.state) !== 'ma' || !(criteria.cities ?? []).some(c => norm(c) === 'boston')) return original;
  const counties = (criteria.counties ?? []).map(norm).filter(Boolean);
  if (counties.some(c => c !== 'suffolk')) return original;
  const rows = prefs.geoRows.filter(r => norm(r.state)==='ma' && norm(r.city)==='boston' && norm(r.county)==='suffolk');
  if (!rows.length) return original;
  return matchesCommunicationPreferences({...prefs, geoRows:rows}, {state:'MA',city:'Boston',county:'Suffolk',minPrice:criteria.minPrice,maxPrice:criteria.maxPrice,propertyTypes:criteria.propertyTypes}).matches;
}
const prefs: AgentPreferences = {...EMPTY_PREFERENCES, geoRows:[{state:'MA',county:'Suffolk',city:'Boston'}],minPrice:1_000_000,propertyTypes:['condo']};
const criteria: Criteria = {state:'MA',cities:['Boston'],minPrice:1_000_000,maxPrice:2_000_000,propertyTypes:['condo']};
let passed = 0;
function check(name: string, fn: () => void) {fn();passed++;console.log('PASS',name)}
check('Chris Boston MA missing county matches',()=>{assert.equal(baseline(prefs,criteria),false);assert.equal(proposed(ID,EMAIL,prefs,criteria),true)});
check('Explicit Suffolk matches',()=>assert.equal(proposed(ID,EMAIL,prefs,{...criteria,counties:['Suffolk']}),true));
check('Explicit Norfolk cannot use split Boston branch',()=>assert.equal(proposed(ID,EMAIL,prefs,{...criteria,counties:['Norfolk']}),false));
check('Mixed counties fail closed',()=>assert.equal(proposed(ID,EMAIL,prefs,{...criteria,counties:['Suffolk','Norfolk']}),false));
check('Cambridge remains excluded',()=>assert.equal(proposed(ID,EMAIL,prefs,{...criteria,cities:['Cambridge']}),false));
check('State mismatch excluded',()=>assert.equal(proposed(ID,EMAIL,prefs,{...criteria,state:'NY'}),false));
check('Missing state excluded',()=>assert.equal(proposed(ID,EMAIL,prefs,{...criteria,state:undefined}),false));
check('Under $1M excluded',()=>assert.equal(proposed(ID,EMAIL,prefs,{...criteria,minPrice:500_000,maxPrice:999_999}),false));
check('Property type mismatch excluded',()=>assert.equal(proposed(ID,EMAIL,prefs,{...criteria,propertyTypes:['land']}),false));
check('Neighborhood requirement retained',()=>assert.equal(proposed(ID,EMAIL,{...prefs,geoRows:[{...prefs.geoRows[0],neighborhood:'Back Bay'}]},criteria),false));
check('ZIP requirement retained',()=>assert.equal(proposed(ID,EMAIL,{...prefs,geoRows:[{...prefs.geoRows[0],zip_code:'02116'}]},criteria),false));
check('Wrong UUID same email excluded',()=>assert.equal(proposed('different-id',EMAIL,prefs,criteria),false));
check('Chris UUID wrong email excluded',()=>assert.equal(proposed(ID,'other@example.com',prefs,criteria),false));
check('Statewide gap not broadened',()=>assert.equal(proposed(ID,EMAIL,prefs,{...criteria,cities:[]}),false));
check('Changed saved town not broadened',()=>assert.equal(proposed(ID,EMAIL,{...prefs,geoRows:[{state:'MA',city:'Cambridge',county:'Middlesex'}]},criteria),false));
check('Every other account preserves existing decisions',()=>{
  const agents = [prefs,{...prefs,geoRows:[{state:'MA',city:'Boston'}]},EMPTY_PREFERENCES,{...prefs,geoRows:[{state:'MA',county:'Suffolk'}]}];
  const posts = [criteria,{...criteria,counties:['Norfolk']},{...criteria,cities:['Cambridge']},{...criteria,cities:[]},{...criteria,maxPrice:900_000,minPrice:500_000}];
  for(const p of agents) for(const c of posts) assert.equal(proposed('other-agent','other@example.com',p,c),baseline(p,c));
});
console.log(`${passed} local proposal checks passed; no database or network calls.`);
