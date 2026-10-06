import { fail, handleError, ok, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { kbEntryBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { brandId } = await params;
    const store = getStore();
    if (!(await store.getBrand(brandId))) return fail(404, "Brand not found");
    return ok(await store.listKbEntries(brandId));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { brandId } = await params;
    const store = getStore();
    if (!(await store.getBrand(brandId))) return fail(404, "Brand not found");
    const parsed = await readJson(req, kbEntryBodySchema);
    if (!parsed.ok) return parsed.response;
    const entry = await store.createKbEntry({ brandId, ...parsed.data });
    return ok(entry, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
