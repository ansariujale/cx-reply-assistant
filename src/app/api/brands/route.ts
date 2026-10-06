import { handleError, ok } from "@/lib/http";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getStore().listBrands());
  } catch (err) {
    return handleError(err);
  }
}
