'use client'

import React from 'react'

import { Button } from './ui/button.js'

interface Language {
  code: string
  name: string
  flag: string
}

interface LanguageSwitcherProps {
  locale?: string
  languages?: Language[]
  onLanguageChange?: (locale: string) => void
  className?: string
  variant?: 'select' | 'buttons' | 'dropdown'
}

const defaultLanguages = [
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
]

export function LanguageSwitcher({
  locale = 'id',
  languages = defaultLanguages,
  onLanguageChange,
  className = '',
  variant = 'select'
}: LanguageSwitcherProps) {
  const currentLanguage = languages.find(lang => lang.code === locale) || languages[0]!

  const handleLanguageChange = (newLocale: string) => {
    if (onLanguageChange) {
      onLanguageChange(newLocale)
    }
  }

  if (variant === 'select') {
    return (
      <div className={`relative ${className}`}>
        <select 
          value={locale}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="appearance-none bg-transparent border border-gray-300 rounded-md px-3 py-1 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {languages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.flag} {language.name}
            </option>
          ))}
        </select>
        <svg 
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    )
  }

  if (variant === 'buttons') {
    return (
      <div className={`flex bg-gray-100 rounded-lg p-1 ${className}`}>
        {languages.map((language) => (
          <button
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              locale === language.code
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {language.flag} {language.name}
          </button>
        ))}
      </div>
    )
  }

  // Default dropdown variant - simplified version
  return (
    <div className={`relative ${className}`}>
      <Button 
        variant="ghost" 
        className="flex items-center space-x-2"
        onClick={() => {
          // Toggle between languages (simple implementation)
          const currentIndex = languages.findIndex(lang => lang.code === locale)
          const nextIndex = (currentIndex + 1) % languages.length
          handleLanguageChange(languages[nextIndex]!.code)
        }}
      >
        <span>{currentLanguage.flag}</span>
        <span className="hidden sm:inline">{currentLanguage.name}</span>
      </Button>
    </div>
  )
}

export default LanguageSwitcher