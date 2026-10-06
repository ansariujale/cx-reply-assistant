/**
 * Lightweight tokenizer + stemmer tuned for short policy documents.
 * It does not try to be Porter; it only needs to map the inflections that
 * actually occur in CX conversations (refund/refunds/refunded, ship/shipping/
 * shipped, deliver/delivery/delivered, damage/damaged, cancel/cancellation,
 * replace/replacement) onto a shared stem so BM25 term matching works.
 */

const STOPWORDS = new Set(
  (
    "a an the and or but if then so to of in on at for with by from as is are was were be been being it its " +
    "this that these those i me my mine we our you your he she they them their can could do does did have has had " +
    "will would shall should may might must what which who whom how when where why not no yes please hi hello hey " +
    "thanks thank want wanted get got just also very really about there here all any some up out into than too am " +
    "ok okay still again now today yesterday tomorrow " +
    // Domain words that appear in every conversation and policy and therefore carry no signal.
    "order orders ordered send sent back stop offer offered offering product products item items like need know " +
    "make sure let us one way use used well much many something anything"
  ).split(" "),
);

const DOUBLE_CONSONANT = /(bb|dd|gg|ll|mm|nn|pp|rr|tt)$/;

export function stem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;

  // plurals
  if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
  else if (w.endsWith("es") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = w.slice(0, -1);

  // derivational / inflectional suffixes
  const SUFFIXES: Array<[suffix: string, minLength: number]> = [
    ["ation", 8],
    ["ment", 7],
    ["ing", 6],
    ["ed", 5],
  ];
  let stripped = false;
  for (const [suffix, minLength] of SUFFIXES) {
    if (w.endsWith(suffix) && w.length >= minLength) {
      w = w.slice(0, -suffix.length);
      stripped = true;
      break;
    }
  }

  // cleanup so "shipp"/"ship", "cancell"/"cancel", "damag"/"damage", "deliver"/"delivery" converge.
  // Doubled consonants are only collapsed after a suffix was removed, so "sell" and "will" are untouched.
  if (stripped && DOUBLE_CONSONANT.test(w)) w = w.slice(0, -1);
  if (w.endsWith("e") && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith("y") && w.length > 4) w = w.slice(0, -1);
  return w;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/n't\b/g, " not")
    .replace(/'s\b/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}
