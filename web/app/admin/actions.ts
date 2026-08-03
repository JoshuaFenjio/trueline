"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE, adminToken, checkPassword, isAdmin, getServiceClient,
  loginRate, recordLoginFailure, clearLoginFailures,
} from "@/lib/admin";

function clientIp(): string {
  const h = headers();
  return (h.get("x-forwarded-for")?.split(",")[0].trim()) || h.get("x-real-ip") || "local";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(formData: FormData) {
  const ip = clientIp();

  // Reject fast if already locked out (before doing any work).
  const gate = loginRate(ip);
  if (gate.locked) redirect(`/admin?error=locked&m=${gate.retryMin}`);

  // Small constant delay throttles automated guessing regardless of instance.
  await sleep(400);

  const pw = String(formData.get("password") || "");
  if (!checkPassword(pw)) {
    recordLoginFailure(ip);
    const after = loginRate(ip);
    if (after.locked) redirect(`/admin?error=locked&m=${after.retryMin}`);
    redirect(`/admin?error=1&left=${after.left}`);
  }

  clearLoginFailures(ip);
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
