const withoutFences = (text) => text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');

export const guideHeadingProfile = (text) => withoutFences(text)
  .split(/\r?\n/)
  .flatMap((line) => {
    const match = line.match(/^(#{2,4})\s+(.+?)\s*#*\s*$/);
    if (!match) return [];
    const section = match[1].length === 2 ? match[2].match(/^(\d+)\./)?.[1] ?? null : null;
    return [{ level: match[1].length, section }];
  });

export const guideVersion = (text, language) => {
  const pattern = language === 'ru'
    ? /^Актуально для \*\*(v[^*]+)\*\*\./m
    : /^Current for \*\*(v[^*]+)\*\*\./m;
  return text.match(pattern)?.[1] ?? null;
};

export const guideParityErrors = (english, russian) => {
  const errors = [];
  const englishProfile = guideHeadingProfile(english);
  const russianProfile = guideHeadingProfile(russian);
  if (JSON.stringify(englishProfile) !== JSON.stringify(russianProfile)) {
    errors.push('docs/USER-GUIDE.md / docs/USER-GUIDE.ru.md: H2-H4 heading profiles differ');
  }

  const englishVersion = guideVersion(english, 'en');
  const russianVersion = guideVersion(russian, 'ru');
  if (!englishVersion || !russianVersion) {
    errors.push('docs/USER-GUIDE.md / docs/USER-GUIDE.ru.md: current-version marker is missing');
  } else if (englishVersion !== russianVersion) {
    errors.push(`docs/USER-GUIDE.md / docs/USER-GUIDE.ru.md: current versions differ (${englishVersion} != ${russianVersion})`);
  }
  return errors;
};
