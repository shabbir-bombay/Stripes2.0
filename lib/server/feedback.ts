const MAX_COMMENT = 500;

export type ParsedFeedback = { ok: true; rating: number; comment: string | null } | { ok: false; error: string };

/** A whole rating from 1 to 5, and an optional comment. A blank comment counts as none. */
export function parseFeedback(body: Record<string, unknown> | null): ParsedFeedback {
  const { rating, comment } = body ?? {};
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) return { ok: false, error: "Choose a rating from 1 to 5." };
  if (comment !== undefined && comment !== null && typeof comment !== "string") return { ok: false, error: "The comment must be text." };
  const text = comment?.trim() || null;
  if (text && text.length > MAX_COMMENT) return { ok: false, error: `Keep your comment under ${MAX_COMMENT} characters.` };
  return { ok: true, rating: rating as number, comment: text };
}
