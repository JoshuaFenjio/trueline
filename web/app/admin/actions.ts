"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, adminToken, checkPassword, isAdmin, getServiceClient } from "@/lib/admin";

export async function login(formData: FormData) {
  const pw = String(formData.get("password") || "");
  if (!checkPassword(pw)) redirect("/admin?error=1");
  cookies().set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // allow http on localhost
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  redirect("/admin");
}

export async function logout() {
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin");
}

// Bound with the row id in the page: setStatus.bind(null, id, "approved").
export async function setStatus(id: number, status: "approved" | "rejected") {
  if (!isAdmin()) redirect("/admin");
  const sb = getServiceClient();
  if (sb) await sb.from("submissions").update({ status }).eq("id", id);
  revalidatePath("/admin");
}
