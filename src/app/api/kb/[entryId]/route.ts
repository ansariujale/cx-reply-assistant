import { fail, handleError, ok, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { kbEntryPatchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ entryId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { entryId } = await params;
    const entry = await getStore().getKbEntry(entryId);
    return entry ? ok(entry) : fail(404, "Knowledge entry not found");
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { entryId } = await params;
    const parsed = await readJson(req, kbEntryPatchSchema);
    if (!parsed.ok) return parsed.response;
    const entry = await getStore().updateKbEntry(entryId, parsed.data);
    return entry ? ok(entry) : fail(404, "Knowledge entry not found");
  } catch (err) {
    return handleError(err);
  }
}

export const PATCH = PUT;

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { entryId } = await params;
    const deleted = await getStore().deleteKbEntry(entryId);
    return deleted ? ok({ deleted: true }) : fail(404, "Knowledge entry not found");
  } catch (err) {
    return handleError(err);
  }
}
