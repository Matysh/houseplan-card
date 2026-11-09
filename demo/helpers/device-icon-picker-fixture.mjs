/** Product picker runs without any HA picker registration. */
import {launchHaDialogFixture} from './ha-dialog-fixture.mjs';
import {watchPage} from '../serve.mjs';
export async function launchDeviceIconPickerFixture(options={}) {
 const {authentic=false,...rest}=options;
 const f=await launchHaDialogFixture({...rest,authentic});
 try {watchPage(f.page);await f.page.goto(f.url+'/product.html');await f.page.waitForFunction(()=>window.__card?._model?.length&&!window.__card._booting);return f;}
 catch(error){await f.close();throw error;}
}
