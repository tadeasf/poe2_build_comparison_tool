// Normalized Path of Building 2 (PoB2) build model.
// PoB2 inherits PoB1's XML schema; we normalize it into these types so the rest
// of the app never touches raw XML.

export interface PobGem {
  /** Display name as written in the export (e.g. "Fireball", "Added Fire Damage"). */
  nameSpec?: string;
  skillId?: string;
  gemId?: string;
  level?: number;
  quality?: number;
  enabled: boolean;
  /** True for support gems, false for active skill gems. */
  isSupport: boolean;
}

export interface PobSkillGroup {
  /** Optional user label for the group. */
  label?: string;
  /** Slot the group is socketed in (e.g. "Weapon 1"), if any. */
  slot?: string;
  enabled: boolean;
  /** Index (1-based) of the active gem PoB treats as the group's main skill. */
  mainActiveSkill?: number;
  gems: PobGem[];
}

export interface PobTreeSpec {
  /** PoB's tree data version, e.g. "0_2". */
  treeVersion?: string;
  classId?: number;
  ascendClassId?: number;
  /** Allocated passive node ids (the full union: common + both weapon sets). */
  nodes: number[];
  /**
   * Nodes that apply only with Weapon Set I equipped. A disjoint subset of
   * `nodes`; absent on builds parsed before weapon-set support landed.
   */
  weaponSet1Nodes?: number[];
  /** Nodes that apply only with Weapon Set II equipped. Disjoint subset of `nodes`. */
  weaponSet2Nodes?: number[];
  /** Jewel/socket assignments: which item sits in which tree socket node. */
  sockets: { nodeId: number; itemId: number }[];
  /** The pathofexile.com tree URL, if present. */
  url?: string;
}

export interface PobItem {
  /** PoB internal item id, referenced by item-set slots. */
  id: number;
  /** Raw item text block exactly as PoB stored it. */
  text: string;
  // Fields below are populated by item-text.ts.
  rarity?: string;
  name?: string;
  base?: string;
  itemLevel?: number;
  quality?: number;
  sockets?: string;
  implicits?: string[];
  affixes?: string[];
}

export interface PobItemSlot {
  /** Slot name, e.g. "Weapon 1", "Helmet", "Body Armour". */
  name: string;
  itemId: number;
}

export interface PobBuild {
  level: number;
  /** Base class name, e.g. "Warrior", "Witch". */
  className: string;
  /** Ascendancy name, e.g. "Warbringer", "Infernalist". */
  ascendClassName: string;
  mainSocketGroup?: number;
  /** Active tree spec (the one PoB has selected). */
  tree: PobTreeSpec;
  /** All tree specs present in the build (PoB supports multiple). */
  treeSpecs: PobTreeSpec[];
  items: PobItem[];
  /** Slot -> item mapping for the active item set. */
  slots: PobItemSlot[];
  skills: PobSkillGroup[];
  notes?: string;
  /** Original decoded XML, kept for debugging/fixtures. */
  raw?: { xml: string };
}
