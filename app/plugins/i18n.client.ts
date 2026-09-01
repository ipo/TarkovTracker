import { SUPPORTED_LOCALES, type SupportedLocale } from '@/utils/locales';
export default defineNuxtPlugin(({ $i18n }) => {
  const savedLocale = window.localStorage.getItem('tt:locale');
  if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale as SupportedLocale)) {
    $i18n.setLocale(savedLocale as SupportedLocale);
  }
  watch(
    () => $i18n.locale.value,
    (locale) => window.localStorage.setItem('tt:locale', locale),
    { immediate: true }
  );
});
