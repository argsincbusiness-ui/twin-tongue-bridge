export interface Language {
  /** BCP-47 tag used by Web Speech APIs */
  code: string;
  /** Two-letter base, useful for matching TTS voices */
  base: string;
  name: string;
  nativeName: string;
  flag: string;
}

/**
 * Comprehensive list of languages supported for speech recognition,
 * translation, and synthesis. BCP-47 tags with a representative region.
 */
export const LANGUAGES: Language[] = [
  // English variants
  { code: "en-US", base: "en", name: "English (US)", nativeName: "English", flag: "🇺🇸" },
  { code: "en-GB", base: "en", name: "English (UK)", nativeName: "English", flag: "🇬🇧" },
  { code: "en-AU", base: "en", name: "English (Australia)", nativeName: "English", flag: "🇦🇺" },
  { code: "en-CA", base: "en", name: "English (Canada)", nativeName: "English", flag: "🇨🇦" },
  { code: "en-IN", base: "en", name: "English (India)", nativeName: "English", flag: "🇮🇳" },
  { code: "en-IE", base: "en", name: "English (Ireland)", nativeName: "English", flag: "🇮🇪" },
  { code: "en-NZ", base: "en", name: "English (NZ)", nativeName: "English", flag: "🇳🇿" },
  { code: "en-ZA", base: "en", name: "English (SA)", nativeName: "English", flag: "🇿🇦" },

  // Spanish variants
  { code: "es-ES", base: "es", name: "Spanish (Spain)", nativeName: "Español", flag: "🇪🇸" },
  { code: "es-MX", base: "es", name: "Spanish (Mexico)", nativeName: "Español", flag: "🇲🇽" },
  { code: "es-AR", base: "es", name: "Spanish (Argentina)", nativeName: "Español", flag: "🇦🇷" },
  { code: "es-CO", base: "es", name: "Spanish (Colombia)", nativeName: "Español", flag: "🇨🇴" },
  { code: "es-CL", base: "es", name: "Spanish (Chile)", nativeName: "Español", flag: "🇨🇱" },
  { code: "es-US", base: "es", name: "Spanish (US)", nativeName: "Español", flag: "🇺🇸" },

  // French variants
  { code: "fr-FR", base: "fr", name: "French (France)", nativeName: "Français", flag: "🇫🇷" },
  { code: "fr-CA", base: "fr", name: "French (Canada)", nativeName: "Français", flag: "🇨🇦" },
  { code: "fr-BE", base: "fr", name: "French (Belgium)", nativeName: "Français", flag: "🇧🇪" },
  { code: "fr-CH", base: "fr", name: "French (Switzerland)", nativeName: "Français", flag: "🇨🇭" },

  // German variants
  { code: "de-DE", base: "de", name: "German (Germany)", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "de-AT", base: "de", name: "German (Austria)", nativeName: "Deutsch", flag: "🇦🇹" },
  { code: "de-CH", base: "de", name: "German (Switzerland)", nativeName: "Deutsch", flag: "🇨🇭" },

  // Portuguese
  { code: "pt-BR", base: "pt", name: "Portuguese (Brazil)", nativeName: "Português", flag: "🇧🇷" },
  { code: "pt-PT", base: "pt", name: "Portuguese (Portugal)", nativeName: "Português", flag: "🇵🇹" },

  // Chinese
  { code: "zh-CN", base: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳" },
  { code: "zh-TW", base: "zh", name: "Chinese (Traditional)", nativeName: "繁體中文", flag: "🇹🇼" },
  { code: "zh-HK", base: "zh", name: "Chinese (Cantonese)", nativeName: "廣東話", flag: "🇭🇰" },

  // Arabic variants
  { code: "ar-SA", base: "ar", name: "Arabic (Saudi Arabia)", nativeName: "العربية", flag: "🇸🇦" },
  { code: "ar-EG", base: "ar", name: "Arabic (Egypt)", nativeName: "العربية", flag: "🇪🇬" },
  { code: "ar-AE", base: "ar", name: "Arabic (UAE)", nativeName: "العربية", flag: "🇦🇪" },
  { code: "ar-MA", base: "ar", name: "Arabic (Morocco)", nativeName: "العربية", flag: "🇲🇦" },
  { code: "ar-DZ", base: "ar", name: "Arabic (Algeria)", nativeName: "العربية", flag: "🇩🇿" },
  { code: "ar-IQ", base: "ar", name: "Arabic (Iraq)", nativeName: "العربية", flag: "🇮🇶" },
  { code: "ar-JO", base: "ar", name: "Arabic (Jordan)", nativeName: "العربية", flag: "🇯🇴" },
  { code: "ar-LB", base: "ar", name: "Arabic (Lebanon)", nativeName: "العربية", flag: "🇱🇧" },
  { code: "ar-TN", base: "ar", name: "Arabic (Tunisia)", nativeName: "العربية", flag: "🇹🇳" },
  { code: "ar-KW", base: "ar", name: "Arabic (Kuwait)", nativeName: "العربية", flag: "🇰🇼" },
  { code: "ar-QA", base: "ar", name: "Arabic (Qatar)", nativeName: "العربية", flag: "🇶🇦" },

  // European
  { code: "it-IT", base: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "nl-NL", base: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱" },
  { code: "nl-BE", base: "nl", name: "Dutch (Belgium)", nativeName: "Vlaams", flag: "🇧🇪" },
  { code: "sv-SE", base: "sv", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪" },
  { code: "no-NO", base: "no", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴" },
  { code: "da-DK", base: "da", name: "Danish", nativeName: "Dansk", flag: "🇩🇰" },
  { code: "fi-FI", base: "fi", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮" },
  { code: "is-IS", base: "is", name: "Icelandic", nativeName: "Íslenska", flag: "🇮🇸" },
  { code: "pl-PL", base: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱" },
  { code: "cs-CZ", base: "cs", name: "Czech", nativeName: "Čeština", flag: "🇨🇿" },
  { code: "sk-SK", base: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰" },
  { code: "sl-SI", base: "sl", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮" },
  { code: "hu-HU", base: "hu", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺" },
  { code: "ro-RO", base: "ro", name: "Romanian", nativeName: "Română", flag: "🇷🇴" },
  { code: "bg-BG", base: "bg", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬" },
  { code: "hr-HR", base: "hr", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷" },
  { code: "sr-RS", base: "sr", name: "Serbian", nativeName: "Српски", flag: "🇷🇸" },
  { code: "bs-BA", base: "bs", name: "Bosnian", nativeName: "Bosanski", flag: "🇧🇦" },
  { code: "mk-MK", base: "mk", name: "Macedonian", nativeName: "Македонски", flag: "🇲🇰" },
  { code: "sq-AL", base: "sq", name: "Albanian", nativeName: "Shqip", flag: "🇦🇱" },
  { code: "el-GR", base: "el", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷" },
  { code: "tr-TR", base: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "mt-MT", base: "mt", name: "Maltese", nativeName: "Malti", flag: "🇲🇹" },
  { code: "ga-IE", base: "ga", name: "Irish", nativeName: "Gaeilge", flag: "🇮🇪" },
  { code: "cy-GB", base: "cy", name: "Welsh", nativeName: "Cymraeg", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { code: "eu-ES", base: "eu", name: "Basque", nativeName: "Euskara", flag: "🇪🇸" },
  { code: "ca-ES", base: "ca", name: "Catalan", nativeName: "Català", flag: "🇪🇸" },
  { code: "gl-ES", base: "gl", name: "Galician", nativeName: "Galego", flag: "🇪🇸" },
  { code: "lb-LU", base: "lb", name: "Luxembourgish", nativeName: "Lëtzebuergesch", flag: "🇱🇺" },

  // Slavic & East European
  { code: "ru-RU", base: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "uk-UA", base: "uk", name: "Ukrainian", nativeName: "Українська", flag: "🇺🇦" },
  { code: "be-BY", base: "be", name: "Belarusian", nativeName: "Беларуская", flag: "🇧🇾" },
  { code: "lt-LT", base: "lt", name: "Lithuanian", nativeName: "Lietuvių", flag: "🇱🇹" },
  { code: "lv-LV", base: "lv", name: "Latvian", nativeName: "Latviešu", flag: "🇱🇻" },
  { code: "et-EE", base: "et", name: "Estonian", nativeName: "Eesti", flag: "🇪🇪" },

  // Middle East & Central Asia
  { code: "he-IL", base: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱" },
  { code: "fa-IR", base: "fa", name: "Persian (Farsi)", nativeName: "فارسی", flag: "🇮🇷" },
  { code: "ps-AF", base: "ps", name: "Pashto", nativeName: "پښتو", flag: "🇦🇫" },
  { code: "ku-TR", base: "ku", name: "Kurdish", nativeName: "Kurdî", flag: "🇹🇷" },
  { code: "az-AZ", base: "az", name: "Azerbaijani", nativeName: "Azərbaycanca", flag: "🇦🇿" },
  { code: "hy-AM", base: "hy", name: "Armenian", nativeName: "Հայերեն", flag: "🇦🇲" },
  { code: "ka-GE", base: "ka", name: "Georgian", nativeName: "ქართული", flag: "🇬🇪" },
  { code: "kk-KZ", base: "kk", name: "Kazakh", nativeName: "Қазақша", flag: "🇰🇿" },
  { code: "ky-KG", base: "ky", name: "Kyrgyz", nativeName: "Кыргызча", flag: "🇰🇬" },
  { code: "uz-UZ", base: "uz", name: "Uzbek", nativeName: "Oʻzbekcha", flag: "🇺🇿" },
  { code: "tg-TJ", base: "tg", name: "Tajik", nativeName: "Тоҷикӣ", flag: "🇹🇯" },
  { code: "tk-TM", base: "tk", name: "Turkmen", nativeName: "Türkmençe", flag: "🇹🇲" },
  { code: "mn-MN", base: "mn", name: "Mongolian", nativeName: "Монгол", flag: "🇲🇳" },

  // South Asia
  { code: "hi-IN", base: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "ur-PK", base: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰" },
  { code: "bn-IN", base: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳" },
  { code: "bn-BD", base: "bn", name: "Bengali (Bangladesh)", nativeName: "বাংলা", flag: "🇧🇩" },
  { code: "pa-IN", base: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "ta-IN", base: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "te-IN", base: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "kn-IN", base: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml-IN", base: "ml", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳" },
  { code: "mr-IN", base: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
  { code: "gu-IN", base: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
  { code: "or-IN", base: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", flag: "🇮🇳" },
  { code: "as-IN", base: "as", name: "Assamese", nativeName: "অসমীয়া", flag: "🇮🇳" },
  { code: "sd-PK", base: "sd", name: "Sindhi", nativeName: "سنڌي", flag: "🇵🇰" },
  { code: "si-LK", base: "si", name: "Sinhala", nativeName: "සිංහල", flag: "🇱🇰" },
  { code: "ne-NP", base: "ne", name: "Nepali", nativeName: "नेपाली", flag: "🇳🇵" },
  { code: "dv-MV", base: "dv", name: "Dhivehi", nativeName: "ދިވެހި", flag: "🇲🇻" },

  // East & Southeast Asia
  { code: "ja-JP", base: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "ko-KR", base: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "th-TH", base: "th", name: "Thai", nativeName: "ไทย", flag: "🇹🇭" },
  { code: "vi-VN", base: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳" },
  { code: "id-ID", base: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ms-MY", base: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "fil-PH", base: "fil", name: "Filipino", nativeName: "Filipino", flag: "🇵🇭" },
  { code: "tl-PH", base: "tl", name: "Tagalog", nativeName: "Tagalog", flag: "🇵🇭" },
  { code: "km-KH", base: "km", name: "Khmer", nativeName: "ខ្មែរ", flag: "🇰🇭" },
  { code: "lo-LA", base: "lo", name: "Lao", nativeName: "ລາວ", flag: "🇱🇦" },
  { code: "my-MM", base: "my", name: "Burmese", nativeName: "မြန်မာ", flag: "🇲🇲" },
  { code: "jv-ID", base: "jv", name: "Javanese", nativeName: "Basa Jawa", flag: "🇮🇩" },
  { code: "su-ID", base: "su", name: "Sundanese", nativeName: "Basa Sunda", flag: "🇮🇩" },

  // Africa
  { code: "sw-KE", base: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇰🇪" },
  { code: "sw-TZ", base: "sw", name: "Swahili (Tanzania)", nativeName: "Kiswahili", flag: "🇹🇿" },
  { code: "am-ET", base: "am", name: "Amharic", nativeName: "አማርኛ", flag: "🇪🇹" },
  { code: "ti-ET", base: "ti", name: "Tigrinya", nativeName: "ትግርኛ", flag: "🇪🇹" },
  { code: "om-ET", base: "om", name: "Oromo", nativeName: "Afaan Oromoo", flag: "🇪🇹" },
  { code: "so-SO", base: "so", name: "Somali", nativeName: "Soomaali", flag: "🇸🇴" },
  { code: "ha-NG", base: "ha", name: "Hausa", nativeName: "Hausa", flag: "🇳🇬" },
  { code: "yo-NG", base: "yo", name: "Yoruba", nativeName: "Yorùbá", flag: "🇳🇬" },
  { code: "ig-NG", base: "ig", name: "Igbo", nativeName: "Igbo", flag: "🇳🇬" },
  { code: "zu-ZA", base: "zu", name: "Zulu", nativeName: "isiZulu", flag: "🇿🇦" },
  { code: "xh-ZA", base: "xh", name: "Xhosa", nativeName: "isiXhosa", flag: "🇿🇦" },
  { code: "af-ZA", base: "af", name: "Afrikaans", nativeName: "Afrikaans", flag: "🇿🇦" },
  { code: "st-ZA", base: "st", name: "Sesotho", nativeName: "Sesotho", flag: "🇿🇦" },
  { code: "tn-ZA", base: "tn", name: "Setswana", nativeName: "Setswana", flag: "🇿🇦" },
  { code: "sn-ZW", base: "sn", name: "Shona", nativeName: "ChiShona", flag: "🇿🇼" },
  { code: "rw-RW", base: "rw", name: "Kinyarwanda", nativeName: "Kinyarwanda", flag: "🇷🇼" },
  { code: "mg-MG", base: "mg", name: "Malagasy", nativeName: "Malagasy", flag: "🇲🇬" },

  // Americas (indigenous & creole)
  { code: "ht-HT", base: "ht", name: "Haitian Creole", nativeName: "Kreyòl Ayisyen", flag: "🇭🇹" },
  { code: "qu-PE", base: "qu", name: "Quechua", nativeName: "Runa Simi", flag: "🇵🇪" },
  { code: "gn-PY", base: "gn", name: "Guarani", nativeName: "Avañe'ẽ", flag: "🇵🇾" },

  // Pacific / other
  { code: "mi-NZ", base: "mi", name: "Māori", nativeName: "Te Reo Māori", flag: "🇳🇿" },
  { code: "haw-US", base: "haw", name: "Hawaiian", nativeName: "ʻŌlelo Hawaiʻi", flag: "🇺🇸" },
  { code: "sm-WS", base: "sm", name: "Samoan", nativeName: "Gagana Samoa", flag: "🇼🇸" },
  { code: "to-TO", base: "to", name: "Tongan", nativeName: "Lea Faka-Tonga", flag: "🇹🇴" },
  { code: "fj-FJ", base: "fj", name: "Fijian", nativeName: "Vosa Vakaviti", flag: "🇫🇯" },

  // Constructed / classical
  { code: "la-VA", base: "la", name: "Latin", nativeName: "Latina", flag: "🇻🇦" },
  { code: "eo", base: "eo", name: "Esperanto", nativeName: "Esperanto", flag: "🌐" },
  { code: "yi", base: "yi", name: "Yiddish", nativeName: "ייִדיש", flag: "🇮🇱" },
];

/** Sentinel code meaning "let the AI figure out which language was spoken". */
export const AUTO_CODE = "auto";

/** Pseudo-language entry used by the picker for automatic detection. */
export const AUTO_LANGUAGE: Language = {
  code: AUTO_CODE,
  base: AUTO_CODE,
  name: "Auto-detect",
  nativeName: "Auto-detect",
  flag: "🌐",
};

/** True when a language code means "auto-detect". */
export const isAutoLang = (code: string) => code === AUTO_CODE;

export const getLanguage = (code: string) =>
  code === AUTO_CODE
    ? AUTO_LANGUAGE
    : (LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]);

/**
 * Try to map a free-form detected language name back to a known Language.
 * Useful when the model returns "Spanish" and we want a BCP-47 tag for TTS.
 */
export function findLanguageByName(name: string): Language | undefined {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;

  // Exact match first.
  const exact = LANGUAGES.find(
    (l) =>
      l.name.toLowerCase() === normalized ||
      l.nativeName.toLowerCase() === normalized ||
      l.base.toLowerCase() === normalized ||
      l.code.toLowerCase() === normalized,
  );
  if (exact) return exact;

  // Then accept partial English names so "Spanish" maps to Spanish (Spain).
  return LANGUAGES.find((l) => l.name.toLowerCase().startsWith(normalized));
}



