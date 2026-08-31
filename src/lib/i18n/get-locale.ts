import { cookies } from "next/headers";
import { isLocale, defaultLocale, type Locale } from "./config";
import { dictionaries, type Dictionary } from "./dictionaries";

export const LOCALE_COOKIE = "lang";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  return dictionaries[locale];
}