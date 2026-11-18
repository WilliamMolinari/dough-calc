export type Unit = "g" | "oz";
export type TempUnit = "c" | "f";

export type SizingMode = "flour" | "balls";
export type LeavenMode = "sourdough" | "yeast" | "preferment";
export type YeastType = "idy" | "ady" | "fresh";
export type PrefermentKind = "poolish" | "biga";
export type SweetenerKind = "none" | "sugar" | "honey" | "malt";

export interface Formula {
  /** What the baker anchors the batch to. */
  sizing: SizingMode;
  /** Grams of total flour (used when sizing === "flour"). */
  flourWeight: number;
  /** Optional name for the main flour, e.g. "Caputo Pizzeria". Empty = "Flour". */
  baseFlourName: string;
  /** Share of the total flour that is a second flour, in percent. 0 = single flour. */
  flour2Pct: number;
  /** Flour id from lib/flours.ts for that second flour, or "custom". */
  flour2Type: string;
  /** Name used when flour2Type is "custom". */
  flour2Name: string;
  ballCount: number;
  /** Grams per dough ball. */
  ballWeight: number;

  /** Baker's percentages, all relative to total flour. */
  hydration: number;
  salt: number;
  /** Baker's % of diastatic malt powder, relative to total flour. */
  diastaticMalt: number;

  leavenMode: LeavenMode;
  starterPct: number;
  yeastType: YeastType;
  yeastPct: number;
  /** When true the yeast/starter dose follows the fermentation schedule. */
  autoLeaven: boolean;

  prefermentKind: PrefermentKind;
  prefermentPct: number;
  prefermentHydration: number;

  sweetener: SweetenerKind;
  sweetenerPct: number;
  oil: number;

  /** Environment + schedule. */
  roomTemp: number;
  fridgeTemp: number;
  bulkHours: number;
  retardHours: number;
  temperHours: number;
  /** Local start time, "HH:MM". */
  startTime: string;

  styleId: string;
  /** Oven profile id, see lib/ovens.ts. */
  ovenProfile: string;
}

export interface Ratings {
  crust: number;
  crumb: number;
  extensibility: number;
  flavor: number;
  overall: number;
}

export interface BakeActuals {
  /** Measured dough temperature after mixing. */
  doughTempC?: number;
  /** Kitchen temperature on the day. */
  roomTempC?: number;
  /** Actual time on the steel/stone, in minutes. */
  bakeMinutes?: number;
}

export interface BakeEntry {
  id: string;
  createdAt: string;
  /** Set when the baker edits the log after saving. */
  updatedAt?: string;
  name: string;
  styleId: string;
  styleName: string;
  formula: Formula;
  unit: Unit;
  ratings: Ratings;
  notes: string;
  flourBrand: string;
  oven: string;
  tags: string[];
  /** Downscaled data URLs kept in localStorage. */
  photos: string[];
  totalDough: number;
  /** Bake this trial was forked from, when the bake belongs to a family. */
  parentId?: string;
  /** Head of the family. Originals point at themselves; forks inherit it. */
  rootId?: string;
  /** What to change on the next bake — duplicated into the next trial. */
  nextTimeNotes?: string;
  /**
   * Set when the baker confirms an unscored trial was really baked. Ratings
   * imply it too, but this keeps "dough made" honest when a trial goes unscored.
   */
  bakedAt?: string;
  /** The single change a planned trial is testing. */
  hypothesis?: string;
  /** Keys from lib/outcomes.ts, for aggregating what a bake was actually like. */
  outcomeTags?: string[];
  /** Measured conditions, as opposed to the formula's planned ones. */
  actuals?: BakeActuals;
}

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
  action?: ToastAction;
}
