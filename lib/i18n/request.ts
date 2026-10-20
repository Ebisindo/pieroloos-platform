import "server-only";

import { cookies } from "next/headers";
import { getLocale, LOCALE_COOKIE } from "./config";
import { createTranslator } from "./messages";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  return getLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}

export async function getRequestTranslator() {
  return createTranslator(await getRequestLocale());
}
