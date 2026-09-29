/**
 * Part manufacturers for the seed (reference data, `source: "seed"`). Quality defaults:
 * Original VAG = original; established OE suppliers = oem; the rest = aftermarket.
 * The owner confirms the list and quality levels (docs/HUMAN-TODO.md §6).
 */

export type SeedManufacturer = {
  slug: string;
  name: string;
  aliases: string[];
  isVagGenuine: boolean;
  defaultQuality: "original" | "oem" | "aftermarket";
};

const oem = (slug: string, name: string, aliases: string[] = []): SeedManufacturer => ({
  slug,
  name,
  aliases: [name.toLowerCase(), ...aliases],
  isVagGenuine: false,
  defaultQuality: "oem",
});

const aftermarket = (slug: string, name: string, aliases: string[] = []): SeedManufacturer => ({
  slug,
  name,
  aliases: [name.toLowerCase(), ...aliases],
  isVagGenuine: false,
  defaultQuality: "aftermarket",
});

export const MANUFACTURERS: SeedManufacturer[] = [
  {
    slug: "original-vag",
    name: "Original VAG",
    aliases: ["vag", "original", "vw original", "orginal"],
    isVagGenuine: true,
    defaultQuality: "original",
  },
  oem("bosch", "Bosch", ["bos"]),
  oem("valeo", "Valeo"),
  oem("luk", "LuK"),
  oem("sachs", "Sachs", ["saks"]),
  oem("trw", "TRW"),
  oem("ate", "ATE"),
  oem("brembo", "Brembo"),
  aftermarket("febi-bilstein", "Febi Bilstein", ["febi"]),
  aftermarket("meyle", "Meyle", ["majle"]),
  oem("lemforder", "Lemförder", ["lemforder", "lemferder"]),
  oem("mann-filter", "Mann-Filter", ["mann", "man filter"]),
  oem("mahle", "Mahle", ["knecht"]),
  oem("garrett", "Garrett"),
  oem("ngk", "NGK"),
  oem("gates", "Gates"),
  oem("contitech", "ContiTech", ["conti"]),
  oem("ina", "INA"),
  oem("skf", "SKF"),
  oem("hella", "Hella"),
  oem("pierburg", "Pierburg"),
  aftermarket("nissens", "Nissens"),
  oem("kyb", "KYB", ["kayaba"]),
  oem("bilstein", "Bilstein"),
  oem("varta", "Varta"),
  aftermarket("castrol", "Castrol"),
  oem("continental", "Continental"),
  oem("borgwarner", "BorgWarner", ["borg warner", "kkk"]),
  oem("denso", "Denso"),
  aftermarket("walker", "Walker"),
];
