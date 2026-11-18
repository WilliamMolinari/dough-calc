export interface OvenProfile {
  id: string;
  name: string;
  short: string;
  /** Stone / deck temperature in °C. */
  tempC: number;
  preheatMin: number;
  bakeMin: number;
  turnMin: number;
  note: string;
  /** Matching label used by the bake journal. */
  logName: string;
}

export const OVEN_PROFILES: OvenProfile[] = [
  {
    id: "home-steel",
    name: "Home oven + steel",
    short: "Steel · 275°C · 7 min",
    tempC: 275,
    preheatMin: 50,
    bakeMin: 7,
    turnMin: 3.5,
    note: "Preheat the steel for a full 50 minutes at max. Switch to broil for the last 90 seconds for char.",
    logName: "Home oven + steel",
  },
  {
    id: "ooni-gas",
    name: "Ooni / gas",
    short: "Gas · 430°C · 90 s",
    tempC: 430,
    preheatMin: 25,
    bakeMin: 1.5,
    turnMin: 0.6,
    note: "Launch at 430–450°C and rotate every 20–30 seconds. The floor cools between pies — give it a minute to recover.",
    logName: "Ooni / gas",
  },
  {
    id: "wood-fired",
    name: "Wood-fired",
    short: "Wood · 470°C · 80 s",
    tempC: 470,
    preheatMin: 45,
    bakeMin: 1.3,
    turnMin: 0.4,
    note: "Build a live flame to one side, keep the floor at ~470°C, and dome each pie for the last 15 seconds.",
    logName: "Wood-fired",
  },
  {
    id: "coal",
    name: "Coal oven",
    short: "Coal · 380°C · 6 min",
    tempC: 380,
    preheatMin: 60,
    bakeMin: 6,
    turnMin: 3,
    note: "Coal runs hot and dry: rotate once at the halfway mark. Apizza should be spotted and charred, not blackened — give the deck a few minutes to recover between pies.",
    logName: "Coal oven",
  },
  {
    id: "electric-deck",
    name: "Electric deck",
    short: "Deck · 350°C · 5 min",
    tempC: 350,
    preheatMin: 30,
    bakeMin: 5,
    turnMin: 2.5,
    note: "A deck recovers slowly. Leave 3–4 minutes between launches and rotate at the halfway mark.",
    logName: "Electric deck",
  },
  {
    id: "pan-detroit",
    name: "Pan / Detroit",
    short: "Pan · 230°C · 14 min",
    tempC: 230,
    preheatMin: 30,
    bakeMin: 14,
    turnMin: 9,
    note: "Bake low and slow for a crisp cheese edge. Rotate the pan once and finish on the bottom rack if needed.",
    logName: "Pan / Detroit",
  },
  {
    id: "other",
    name: "Other oven",
    short: "Generic · 250°C · 8 min",
    tempC: 250,
    preheatMin: 35,
    bakeMin: 8,
    turnMin: 4,
    note: "Use the hottest setting your oven allows and preheat a stone or steel thoroughly.",
    logName: "Other",
  },
];

export const DEFAULT_OVEN_ID = "home-steel";

export function getOvenProfile(id: string | undefined): OvenProfile {
  return OVEN_PROFILES.find((profile) => profile.id === id) ?? OVEN_PROFILES[0];
}
