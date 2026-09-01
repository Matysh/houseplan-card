// Проба #404 AC8: закрытая страница не ломает вердикт.
//
// Round-trip к закрытой странице бросает, и если бы гард этого не проглатывал,
// починка одного дефекта завела бы другой — падение вердикта вместо вердикта.
// Здесь исключений нет вовсе, поэтому файл обязан завершаться НУЛЁМ.
import { launch, finish } from '../serve.mjs';

const { browser, page } = await launch();
await page.close();
await finish(browser, { probe: 'closed page' });
