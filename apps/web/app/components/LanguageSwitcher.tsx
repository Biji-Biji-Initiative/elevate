'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
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

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');

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