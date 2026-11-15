// Scan d'ordonnance ou de vignette vaccinale : analyse du texte reconnu (Tesseract.js) pour pré-remplir
// le formulaire. Fonctions pures, sans dépendance. Ne déduit jamais de diagnostic ni de posologie :
// seuls l'intitulé, la date, le numéro de lot et le vétérinaire sont proposés, et l'utilisateur vérifie tout.
import { isValidIsoDate } from "./health-records";

export type ScanSuggestion = Partial<{ title: string; date: string; lotNumber: string; veterinarian: string }>;
export type ScanKind = "vaccin" | "traitement";

/** Noms de vaccins et valences courants (chien, chat, lapin, furet). */
const VACCINE_WORDS = [
  "rage", "rabisin", "rabies", "nobivac", "eurican", "versican", "vanguard", "canigen", "duramune", "virbagen",
  "purevax", "feligen", "leucofeligen", "fevaxyn", "leucogen", "felocell", "quadricat", "tricat",
  "chppil", "chppi", "chpl", "chp", "dhppi", "dhpp", "lepto", "leptospirose", "parvo", "parvovirose", "carré",
  "hépatite", "toux du chenil", "pneumodog", "typhus", "coryza", "leucose", "chlamydiose", "myxomatose",
  "vhd", "filavac", "dercunimix", "piroplasmose", "pirodog", "leishmaniose", "canileish", "letifend",
];

/** Lignes administratives d'une ordonnance : jamais prises pour un nom de médicament. */
const NOT_A_DRUG = /(ordonnance|docteur|\bdr\b|vétérinaire|veterinaire|clinique|cabinet|tél|tel\b|téléphone|adresse|rue|avenue|date|patient|animal|propriétaire|proprietaire|n°\s*ordre|ordre des|signature|siret|rpps|www\.|@|page)/i;

/** Unités et formes galéniques : marquent une ligne de médicament (mais ne sont pas recopiées). */
const DRUG_HINT = /\b(\d+([.,]\d+)?\s?(mg|g|ml|µg|mcg|ui|%)|comprimés?|cp\b|gélules?|sirop|pipette|spot-?on|collyre|gouttes?|pommade|crème|solution|suspension|injectable|sachets?)\b/i;

const clean = (line: string) => line.replace(/[|_~«»"“”]+/g, " ").replace(/\s+/g, " ").trim();

const twoDigitYear = (yy: number) => (yy >= 70 ? 1900 + yy : 2000 + yy);
const pad = (n: number) => String(n).padStart(2, "0");

/** Dates JJ/MM/AAAA, JJ.MM.AA, JJ-MM-AAAA… présentes dans une ligne, au format AAAA-MM-JJ. */
export function findDates(line: string): string[] {
  const found: string[] = [];
  for (const m of line.matchAll(/\b(\d{1,2})\s?[/.\-]\s?(\d{1,2})\s?[/.\-]\s?(\d{4}|\d{2})\b/g)) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3].length === 2 ? twoDigitYear(Number(m[3])) : Number(m[3]);
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    if (isValidIsoDate(iso)) found.push(iso);
  }
  return found;
}

/** Dates de péremption ou de fabrication d'un flacon : ce n'est pas la date de l'acte. */
const PRODUCT_DATE = /(exp|pér|per\.|périm|peremption|à utiliser avant|use by|fab|mfg|prod)/i;

export function parseScannedText(text: string, kind: ScanKind, today: string): ScanSuggestion {
  const lines = text.split(/\r?\n/).map(clean).filter((l) => l.length > 1);
  const result: ScanSuggestion = {};

  // Date de l'acte : la plus récente qui ne soit ni dans le futur ni une date de péremption.
  const dates = lines.filter((l) => !PRODUCT_DATE.test(l)).flatMap(findDates).filter((d) => d <= today && d >= "1990-01-01");
  if (dates.length) result.date = dates.sort().at(-1);

  // Numéro de lot : « Lot : A123B », « N° de lot 4567 », « Batch 89X ».
  for (const line of lines) {
    const m = line.match(/\b(?:n[°o]?\s*(?:de\s*)?)?(?:lot|batch)\s*(?:n[°o]\s*)?[:#.\-]?\s*([A-Z0-9][A-Z0-9\-/]{2,19})\b/i);
    if (m && /\d/.test(m[1])) {
      result.lotNumber = m[1].toUpperCase();
      break;
    }
  }

  // Vétérinaire : « Dr Sami Trabelsi », « Docteur I. Hammami », « Dr. Ben Salah ».
  for (const line of lines) {
    const m = line.match(/\b(?:Dr|Docteur)\.?\s+((?:[A-ZÀ-Ý][\p{L}'’-]*\.?\s*){1,3})/u);
    if (m) {
      const name = m[1].replace(/\s+(Vétérinaire|Veterinaire|DVM)\b.*$/i, "").trim().replace(/[.,;:]$/, "");
      if (name.length >= 2) {
        result.veterinarian = `Dr ${name}`.slice(0, 120);
        break;
      }
    }
  }

  result.title = kind === "vaccin" ? vaccineTitle(lines) : drugTitle(lines);
  if (!result.title) delete result.title;
  return result;
}

/** Ligne qui nomme le vaccin, sans le numéro de lot ni les dates. */
function vaccineTitle(lines: string[]): string | undefined {
  for (const line of lines) {
    const lower = line.toLocaleLowerCase("fr");
    if (!VACCINE_WORDS.some((w) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "u").test(lower))) continue;
    const title = line
      .replace(/\b(?:n[°o]?\s*(?:de\s*)?)?(?:lot|batch)\b.*$/i, "")
      .replace(/\b\d{1,2}\s?[/.\-]\s?\d{1,2}\s?[/.\-]\s?\d{2,4}\b/g, "")
      .replace(/\b(exp|pér)\w*\.?.*$/i, "")
      .replace(/\s+/g, " ")
      .replace(/[\s:,;.\-]+$/, "")
      .trim();
    if (title.length >= 3) return title.slice(0, 120);
  }
  return undefined;
}

/**
 * Nom du médicament : première ligne qui ressemble à un produit (forme ou dosage du produit), sans ce qui suit
 * le premier nombre. La posologie (« 1 comprimé matin et soir ») n'est jamais recopiée.
 */
function drugTitle(lines: string[]): string | undefined {
  for (const line of lines) {
    if (NOT_A_DRUG.test(line) || !DRUG_HINT.test(line) || findDates(line).length) continue;
    const name = line
      .replace(/^[\s\-•*\d.)]+/, "") // puces et numérotation « 1) »
      .split(/\s\d|\s(?:comprimés?|cp|gélules?|sirop|pipette|gouttes?|matin|soir|pendant|par jour|\/j)\b/i)[0]
      .replace(/[\s:,;.\-]+$/, "")
      .trim();
    if (/^\p{L}[\p{L}\s'’-]{2,}$/u.test(name)) return name.slice(0, 120);
  }
  return undefined;
}
