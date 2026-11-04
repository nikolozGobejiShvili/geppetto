// Fixed public strings. Everything else a visitor reads comes from site_text.
export const LANGUAGES = ['ka', 'en'];

export const FIXED = {
  ka: {
    currency: 'ლარი',
    languageName: 'ქარ',
    skipLink: 'მთავარ შინაარსზე გადასვლა',
    languageSwitchLabel: 'ენის არჩევა',
    mainNavLabel: 'ძირითადი ნავიგაცია',
    logoHomeLabel: 'მთავარი გვერდი',
    photoLabel: 'ფოტო',
    notFoundTitle: 'ეს გვერდი არ არსებობს',
    notFoundText: 'შესაძლოა სათამაშო წაიშალა ან მისამართი შეიცვალა.',
    errorTitle: 'გვერდი ვერ ჩაიტვირთა',
    errorText: 'სერვერზე შეცდომა მოხდა. სცადე ხელახლა.',
    backHome: 'მთავარ გვერდზე დაბრუნება',
  },
  en: {
    currency: 'GEL',
    languageName: 'EN',
    skipLink: 'Skip to main content',
    languageSwitchLabel: 'Choose language',
    mainNavLabel: 'Main navigation',
    logoHomeLabel: 'Home page',
    photoLabel: 'Photo',
    notFoundTitle: 'This page does not exist',
    notFoundText: 'The toy may have been removed or its address may have changed.',
    errorTitle: 'The page did not load',
    errorText: 'The server hit an error. Try again.',
    backHome: 'Back to the home page',
  },
};
