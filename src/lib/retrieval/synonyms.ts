import { normalize, stem, tokenize } from "./tokenize";

/**
 * Concept groups bridge the gap between how customers talk ("the bottle is
 * broken", "didn't like the taste") and how policies are written ("damaged",
 * "change of mind").
 *
 * - Single words trigger on their stem and are added as expansion terms.
 * - Multi-word phrases trigger only when the whole phrase appears in the
 *   normalized query (so "send" alone never implies "return"), but their
 *   content words are still offered as expansion terms so a phrase in a
 *   policy tag such as "change of mind" can be reached from "didn't like".
 */
const GROUPS: string[][] = [
  ["broken", "break", "broke", "cracked", "crack", "shattered", "smashed", "damaged", "damage", "leaking", "leak", "leaked", "spilled", "spill", "defective", "faulty", "dented", "torn", "tampered"],
  ["refund", "money back", "my money", "reimburse", "reimbursement", "chargeback", "return my money", "credit back", "get my money"],
  ["return", "send back", "send it back", "exchange", "replace", "replacement", "swap"],
  ["cancel", "cancellation", "cancelled", "stop the order", "stop my order", "call off"],
  ["shipping", "ship", "shipped", "delivery", "deliver", "delivered", "dispatch", "dispatched", "courier", "tracking", "track", "transit", "arrive", "arrived", "late", "delayed", "delay", "where is my order", "not received", "has not arrived"],
  ["unopened", "sealed", "seal", "intact", "opened", "unsealed"],
  ["store credit", "credit", "voucher", "wallet", "coupon"],
  ["taste", "flavour", "flavor", "did not like", "do not like", "change of mind", "changed my mind", "not for me"],
  ["bottle", "jar", "tub", "container", "packaging", "package", "box", "parcel"],
  ["photo", "picture", "image", "video", "proof"],
  ["payment method", "card", "upi", "bank account", "original payment"],
  ["business days", "working days", "how long", "when will", "timeline"],
];

interface CompiledGroup {
  phrases: string[];
  triggerStems: Set<string>;
  expansionStems: Set<string>;
}

const COMPILED: CompiledGroup[] = GROUPS.map((group) => {
  const phrases: string[] = [];
  const triggerStems = new Set<string>();
  const expansionStems = new Set<string>();
  for (const g of group) {
    if (g.includes(" ")) {
      phrases.push(normalize(g));
      for (const t of tokenize(g)) expansionStems.add(t);
    } else {
      const s = stem(normalize(g));
      triggerStems.add(s);
      expansionStems.add(s);
    }
  }
  return { phrases, triggerStems, expansionStems };
});

/**
 * Returns stems implied by the query that are not literally present in it.
 * Example: "the bottle is broken" -> ["damag", "crack", "leak", ...].
 */
export function expandQuery(text: string, queryStems: Set<string>): string[] {
  const normalized = ` ${normalize(text)} `;
  const extra = new Set<string>();
  for (const group of COMPILED) {
    const phraseHit = group.phrases.some((p) => normalized.includes(` ${p} `));
    const stemHit = [...group.triggerStems].some((s) => queryStems.has(s));
    if (phraseHit || stemHit) {
      for (const s of group.expansionStems) if (!queryStems.has(s)) extra.add(s);
    }
  }
  return [...extra];
}
