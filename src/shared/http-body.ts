/**
 * Read a JSON request body without letting a malformed payload escape as an
 * unhandled framework error.
 *
 * The wire contracts are the authority on what a body may contain, so the
 * body is parsed here and handed to them as an unknown value. A payload that
 * is not valid JSON is reported the same way as a payload that fails the
 * contract: `INVALID_INPUT`.
 */
export interface ParsedJsonBody {
  ok: boolean;
  value?: unknown;
}

export async function parseJsonBody(request: Request): Promise<ParsedJsonBody> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false };
  }
  if (text.length === 0) {
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
