// Define supported languages
export type SupportedLanguage = "english" | "telugu";

// Language configuration with consistent English prompts
export const LANGUAGE_CONFIG = {
  english: {
    value: "english",
    label: "English",
    outputLanguage: "English",
  },
  telugu: {
    value: "telugu",
    label: "తెలుగు", // Telugu in native script
    outputLanguage: "Telugu",
  },
};

// Export languages for UI
export const SUPPORTED_LANGUAGES = Object.values(LANGUAGE_CONFIG);
