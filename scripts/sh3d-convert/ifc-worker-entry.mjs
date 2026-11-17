import { readIfc, convertIfcModel, ifcFloorContents } from './ifc.mjs';
import { MAX_IFC_BYTES } from './ifc-errors.mjs';
let model = null;
self.onmessage = async ({ data }) => {
  const { generation, action } = data;
  const send = payload => self.postMessage({ generation, ...payload });
  try {
    if (action === 'read') {
      model = null;
      if (data.file.size > MAX_IFC_BYTES) throw Object.assign(Error('IFC limit'), { code: 'ifc_file_too_large' });
      send({ phase: 'reading' });
      const bytes = new Uint8Array(await data.file.arrayBuffer());
      send({ phase: 'parsing' });
      model = await readIfc(bytes);
      send({ phase: 'catalog', floors: model.floors.map(f => {
        const { owned, wallEntities } = ifcFloorContents(model,f);
        return { id: f.id, title: f.title, building: f.building, elevation: f.elevation,
          count: owned.filter(e=>e.outcome!=='skipped').length + wallEntities.filter(e=>e.floorId!==f.id&&e.outcome!=='skipped').length };
      }) });
    } else if (action === 'convert' && model) {
      send({ phase: 'converting' });
      send({ phase: 'result', result: convertIfcModel(model, data.options || {}) });
      model = null;
      self.close();
    }
  } catch (error) {
    model = null;
    send({ phase: 'error', code: error.code || 'ifc_engine_error', detail: String(error.message || '') });
    self.close();
  }
};
