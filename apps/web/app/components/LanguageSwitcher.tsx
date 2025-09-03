'use client';

import { useRouter, usePathname } from 'next/navigation';

import { useLocale } from 'next-intl';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@elevate/ui';

import { locales, type Locale } from '../../i18n';

const languageNames: Record<Locale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia'
};

const languageNamesNative: Record<Locale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia'
};

function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export default function LanguageSwitcher() {
  const currentLocale = useLocale();
  const locale = isValidLocale(currentLocale) ? currentLocale : 'en';
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === locale) return;

    // Remove current locale from pathname if it exists
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';
    
    // Add new locale prefix only if it's not the default locale
    const newPath = newLocale === 'en' 
      ? pathWithoutLocale 
      : `/${newLocale}${pathWithoutLocale}`;
    
    router.push(newPath);
    router.refresh();
  };

  return (
    <Select value={locale} onValueChange={handleLocaleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {locale.toUpperCase()}
            </span>
            <span className="text-sm text-muted-foreground">
              {languageNamesNative[locale]}
            </span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            <div className="flex items-center justify-between w-full">
              <span className="font-medium">{languageNames[loc]}</span>
              <span className="text-sm text-muted-foreground ml-2">
                {loc.toUpperCase()}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
