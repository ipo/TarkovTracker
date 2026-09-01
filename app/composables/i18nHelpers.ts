export const useSafeLocale = () => {
  const { locale } = useI18n({ useScope: 'global' });
  return locale;
};
export const extractLanguageCode = (locale: string, supported: string[]): string => {
  const code = locale.toLowerCase().split('-')[0] ?? 'en';
  return supported.includes(code) ? code : 'en';
};
