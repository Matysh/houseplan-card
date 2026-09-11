/**
 * Попиксельное сравнение PNG-кадров (#512 §6).
 *
 * Байты двух PNG с одинаковыми пикселями различаются законно: oxipng в CI
 * перепаковывает файл, локальная съёмка — нет. Сравнивать поэтому надо
 * декодированные пиксели, а декодирует их тот же Chromium, что и снимал:
 * `compareInPage` живёт на странице Playwright и исполняет там же
 * `compareDecodedPixels` — чистую функцию над RGBA-буферами, которую тест
 * компаратора гоняет без браузера.
 */

/**
 * @param {{width:number,height:number,data:Uint8Array|Uint8ClampedArray|number[]}} a
 * @param {{width:number,height:number,data:Uint8Array|Uint8ClampedArray|number[]}} b
 * @returns {{identical:boolean, differing:number, sizeMismatch:boolean}}
 */
export function compareDecodedPixels(a, b) {
  if (!a || !b || a.width !== b.width || a.height !== b.height) {
    return { identical: false, differing: Number.POSITIVE_INFINITY, sizeMismatch: true };
  }
  const total = a.width * a.height;
  let differing = 0;
  for (let index = 0; index < total; index += 1) {
    const at = index * 4;
    if (a.data[at] !== b.data[at] || a.data[at + 1] !== b.data[at + 1]
        || a.data[at + 2] !== b.data[at + 2] || a.data[at + 3] !== b.data[at + 3]) differing += 1;
  }
  return { identical: differing === 0, differing, sizeMismatch: false };
}

/**
 * Сравнить одну пару PNG на странице Chromium: декодирование и подсчёт идут
 * внутри страницы, наружу выходит только результат — пиксели двух десятков
 * кадров через границу evaluate не протащить (#512: «Target crashed» на
 * первом же прогоне с сериализацией RGBA).
 * @param {import('playwright').Page} page
 * @param {Buffer} committed
 * @param {Buffer} candidate
 */
export async function compareInPage(page, committed, candidate) {
  return page.evaluate(async ({ a, b, compareSource }) => {
    const compare = new Function(`return (${compareSource});`)();
    const decode = async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0);
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      bitmap.close();
      return { width: bitmap.width, height: bitmap.height, data };
    };
    const result = compare(await decode(a), await decode(b));
    return { ...result, differing: Number.isFinite(result.differing) ? result.differing : -1 };
  }, {
    a: Buffer.from(committed).toString('base64'),
    b: Buffer.from(candidate).toString('base64'),
    compareSource: compareDecodedPixels.toString(),
  }).then((result) => ({ ...result, differing: result.differing < 0 ? Number.POSITIVE_INFINITY : result.differing }));
}

/**
 * Сравнить пары кадров: `pairs[i] = { id, committed: Buffer, candidate: Buffer }`.
 * Компаратор пары инъектируется (в бою — `compareInPage` с Playwright-страницей).
 * @returns {Promise<Array<{id:string, identical:boolean, differing:number, sizeMismatch:boolean}>>}
 */
export async function compareFramePairs(pairs, comparePair) {
  const results = [];
  for (const pair of pairs) results.push({ id: pair.id, ...(await comparePair(pair.committed, pair.candidate)) });
  return results;
}
