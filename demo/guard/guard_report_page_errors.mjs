// Probe #421: reportPageErrors() owns a separate delivery round-trip from finish().
//
// The page error is scheduled at the tail of the browser turn and there is no
// page interaction afterwards. The verdict must therefore flush the page by
// itself. This probe deliberately never calls finish(): doing so would prove
// the older branch while leaving reportPageErrors() blind.
import { launch, reportPageErrors } from '../serve.mjs';

const { browser, page } = await launch();
await page.evaluate(() => {
  setTimeout(() => { throw new Error('guard-report-page-errors'); }, 0);
});
await reportPageErrors();
await browser.close();
