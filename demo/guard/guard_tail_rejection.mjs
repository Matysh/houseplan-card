// Проба #404 AC3: необработанное отклонение промиса считается так же, как
// исключение. Связь с #405 (оброненный промис в удалении черновика) держится
// именно этим: там дефект приходит в карточку в виде rejection, а не throw.
import { launch, finish } from '../serve.mjs';

const { browser, page } = await launch();
await page.evaluate(() => { setTimeout(() => { Promise.reject(new Error('guard-tail-rejection')); }, 0); });
await finish(browser, { probe: 'tail rejection' });
