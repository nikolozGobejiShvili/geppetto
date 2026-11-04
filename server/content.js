// Every piece of text a visitor reads. `group` organises the admin form.
export const SITE_TEXT = [
  { key: 'nav_home', group: 'ნავიგაცია', label: 'მთავარი გვერდის ბმული', ka: 'მთავარი', en: 'Home' },
  { key: 'nav_toys', group: 'ნავიგაცია', label: 'სათამაშოების ბმული', ka: 'სათამაშოები', en: 'Toys' },
  { key: 'nav_contact', group: 'ნავიგაცია', label: 'კონტაქტის ბმული', ka: 'კონტაქტი', en: 'Contact' },

  { key: 'hero_brand', group: 'მთავარი გვერდი', label: 'ბრენდის სახელი (ლოგოს წარწერა)', ka: 'Geppetto', en: 'Geppetto' },
  { key: 'hero_tagline', group: 'მთავარი გვერდი', label: 'სლოგანი', ka: 'ყველა მშობელი ცოტათი ჯეპეტოა', en: 'Every parent is a little bit Geppetto' },
  { key: 'hero_subtitle', group: 'მთავარი გვერდი', label: 'ქვესათაური', ka: 'ხის განმავითარებელი სათამაშოები', en: 'Wooden educational toys' },
  { key: 'hero_link', group: 'მთავარი გვერდი', label: 'ღილაკი სათამაშოებზე', ka: 'სათამაშოების ნახვა', en: 'See the toys' },
  { key: 'hero_image_alt', group: 'მთავარი გვერდი', label: 'მთავარი ფოტოს აღწერა', ka: 'ხის სათამაშოები მაგიდაზე', en: 'Wooden toys on a table' },
  { key: 'trust_badge', group: 'მთავარი გვერდი', label: 'ნდობის ნიშანი', ka: 'ევროპული სტანდარტი - EN 71', en: 'European standard - EN 71' },
  { key: 'featured_title', group: 'მთავარი გვერდი', label: 'რჩეულების სათაური', ka: 'რჩეული სათამაშოები', en: 'Featured toys' },
  { key: 'featured_link', group: 'მთავარი გვერდი', label: 'ბმული ყველა სათამაშოზე', ka: 'ყველა სათამაშოს ნახვა', en: 'See all toys' },
  { key: 'about_title', group: 'მთავარი გვერდი', label: '„ჩვენ შესახებ“ სათაური', ka: 'ჩვენ შესახებ', en: 'About us' },
  { key: 'about_text', group: 'მთავარი გვერდი', label: '„ჩვენ შესახებ“ ტექსტი (ცარიელი ტექსტით სექცია არ ჩანს)', multiline: true, ka: '', en: '' },

  { key: 'toys_title', group: 'სათამაშოების გვერდები', label: 'სიის სათაური', ka: 'სათამაშოები', en: 'Toys' },
  { key: 'toys_empty', group: 'სათამაშოების გვერდები', label: 'ტექსტი, როცა სათამაშო არ არის', ka: 'სათამაშოები მალე დაემატება.', en: 'Toys will be added soon.' },
  { key: 'toy_age_label', group: 'სათამაშოების გვერდები', label: 'ასაკის წარწერა', ka: 'ასაკი', en: 'Age' },
  { key: 'toy_back_link', group: 'სათამაშოების გვერდები', label: 'ბმული სიაში დასაბრუნებლად', ka: 'ყველა სათამაშო', en: 'All toys' },

  { key: 'order_button', group: 'შეკვეთა', label: 'ღილაკი სათამაშოს გვერდზე', ka: 'შეკვეთა', en: 'Order' },
  { key: 'order_hint', group: 'შეკვეთა', label: 'განმარტება ლოგოების ზემოთ', ka: 'შესაკვეთად მოგვწერეთ იქ, სადაც გირჩევნიათ.', en: 'To order, message us wherever you prefer.' },
  { key: 'order_note', group: 'შეკვეთა', label: 'მინიშნება ლოგოების ქვემოთ', ka: 'დაჭერისას სათამაშოს ბმული დაკოპირდება. თუ ჩატში თავად არ ჩაიწერა, ჩასვით მესიჯში.', en: 'Choosing an app copies the toy link. If it is not already in the chat, paste it into your message.' },
  { key: 'order_copied', group: 'შეკვეთა', label: 'წარწერა კოპირების შემდეგ', ka: 'ბმული დაკოპირდა.', en: 'Link copied.' },
  { key: 'order_message', group: 'შეკვეთა', label: 'მესიჯის ტექსტი ({name} არის სათამაშოს სახელი, {link} არის მისი ბმული)', multiline: true, ka: 'გამარჯობა! მინდა შევუკვეთო ეს სათამაშო: {name}\n{link}', en: 'Hello! I would like to order this toy: {name}\n{link}' },

  { key: 'contact_title', group: 'კონტაქტის გვერდი', label: 'გვერდის სათაური', ka: 'კონტაქტი', en: 'Contact' },
  { key: 'contact_intro', group: 'კონტაქტის გვერდი', label: 'შესავალი ტექსტი (ცარიელი არ ჩანს)', multiline: true, ka: '', en: '' },
  { key: 'contact_phone_label', group: 'კონტაქტის გვერდი', label: 'ტელეფონის წარწერა', ka: 'ტელეფონი', en: 'Phone' },
  { key: 'contact_email_label', group: 'კონტაქტის გვერდი', label: 'ელფოსტის წარწერა', ka: 'ელფოსტა', en: 'Email' },
  { key: 'contact_address_label', group: 'კონტაქტის გვერდი', label: 'მისამართის წარწერა', ka: 'მისამართი', en: 'Address' },
  { key: 'contact_hours_label', group: 'კონტაქტის გვერდი', label: 'სამუშაო საათების წარწერა', ka: 'სამუშაო საათები', en: 'Working hours' },
  { key: 'contact_whatsapp_label', group: 'კონტაქტის გვერდი', label: 'WhatsApp-ის წარწერა', ka: 'WhatsApp', en: 'WhatsApp' },
  { key: 'contact_instagram_label', group: 'კონტაქტის გვერდი', label: 'Instagram ბმულის წარწერა', ka: 'Instagram', en: 'Instagram' },
  { key: 'contact_facebook_label', group: 'კონტაქტის გვერდი', label: 'Facebook ბმულის წარწერა', ka: 'Facebook', en: 'Facebook' },

  { key: 'footer_note', group: 'Footer', label: 'მოკლე ტექსტი', ka: 'ხის განმავითარებელი სათამაშოები', en: 'Wooden educational toys' },
  { key: 'footer_contact_title', group: 'Footer', label: 'კონტაქტის სათაური', ka: 'დაგვიკავშირდით', en: 'Get in touch' },
  { key: 'footer_copyright', group: 'Footer', label: 'საავტორო ხაზი', ka: '© Geppetto', en: '© Geppetto' },

  { key: 'meta_title', group: 'ძიების სისტემებისთვის', label: 'გვერდის სათაური (title)', ka: 'ჯეპეტო • ხის სათამაშოები', en: 'Geppetto wooden toys' },
  { key: 'meta_description', group: 'ძიების სისტემებისთვის', label: 'გვერდის აღწერა (description)', multiline: true, ka: 'ხის განმავითარებელი სათამაშოები. ევროპული სტანდარტი - EN 71.', en: 'Wooden educational toys. European standard - EN 71.' },

  { key: 'contact_address', group: 'contact-data', label: 'მისამართი', multiline: true, ka: '', en: '' },
  { key: 'contact_hours', group: 'contact-data', label: 'სამუშაო საათები', multiline: true, ka: '', en: '' },
];

// These two live on the contact form rather than the text form.
export const CONTACT_TEXT_KEYS = ['contact_address', 'contact_hours'];

export const EDITABLE_TEXT = SITE_TEXT.filter(({ key }) => !CONTACT_TEXT_KEYS.includes(key));

export function ensureSiteText(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO site_text (key, value_ka, value_en) VALUES (?, ?, ?)');
  for (const { key, ka, en } of SITE_TEXT) insert.run(key, ka, en);
}

export function readSiteText(db) {
  const texts = {};
  for (const row of db.prepare('SELECT key, value_ka, value_en FROM site_text').all()) {
    texts[row.key] = { ka: row.value_ka, en: row.value_en };
  }
  return texts;
}

export function saveSiteText(db, key, ka, en) {
  db.prepare('UPDATE site_text SET value_ka = ?, value_en = ? WHERE key = ?').run(ka, en, key);
}

// Reads the English value with a fallback to Georgian.
export function translator(texts, lang) {
  return (key) => {
    const entry = texts[key];
    if (!entry) return '';
    return entry[lang] || entry.ka;
  };
}
