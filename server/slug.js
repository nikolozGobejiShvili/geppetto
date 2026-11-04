const GEORGIAN_TO_LATIN = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l',
  მ: 'm', ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k',
  ღ: 'gh', ყ: 'q', შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};

export function slugify(name) {
  const latin = Array.from(String(name ?? '').toLowerCase(), (char) => GEORGIAN_TO_LATIN[char] ?? char).join('');
  const slug = latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'toy';
}

export function uniqueSlug(slug, isTaken) {
  if (!isTaken(slug)) return slug;
  let suffix = 2;
  while (isTaken(`${slug}-${suffix}`)) suffix += 1;
  return `${slug}-${suffix}`;
}
