"use server";

import { revalidatePath } from "next/cache";
import { PobDecodeError } from "@/lib/pob/decode";
import { parsePobCode } from "@/lib/pob/parse";
import { requireUser } from "@/lib/supabase/auth";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type CreateBuildState = { error?: string; ok?: boolean } | null;

export async function createBuild(
  _prev: CreateBuildState,
  formData: FormData,
): Promise<CreateBuildState> {
  const user = await requireUser();
  const code = String(formData.get("pob") ?? "").trim();
  const nameInput = String(formData.get("name") ?? "").trim();
  if (!code) return { error: "Paste a Path of Building 2 export code." };

  let build;
  try {
    build = parsePobCode(code);
  } catch (e) {
    return {
      error:
        e instanceof PobDecodeError
          ? e.message
          : "Could not parse that export code. Make sure it is a Path of Building 2 export.",
    };
  }

  // Don't persist the bulky raw XML in the jsonb column.
  const stored = { ...build };
  delete stored.raw;

  const supabase = await createClient();
  const { error } = await supabase.from("builds").insert({
    user_id: user.id,
    name: nameInput || `${build.ascendClassName} (lvl ${build.level})`,
    class: build.className,
    ascendancy: build.ascendClassName,
    level: build.level,
    pob_string: code,
    parsed: stored as unknown as Json,
  });
  if (error) return { error: error.message };

  revalidatePath("/builds");
  return { ok: true };
}

export async function renameBuild(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const supabase = await createClient();
  await supabase.from("builds").update({ name }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/builds");
}

export async function deleteBuild(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("builds").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/builds");
}
