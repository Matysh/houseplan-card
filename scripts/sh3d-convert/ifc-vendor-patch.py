"""Build-time source patches, never edits a generated/minified SDK bundle."""
import hashlib
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
ems = pathlib.Path('/emsdk/upstream/emscripten/src')
expected = {
    'shell.js': '83cda151aa7fab5d1c784dd6b0c5974e6ba3198b2b04187d9114fec92f500a50',
    'web_or_worker_shell_read.js': 'cd90708a2e1f9897f4d3827c37412d4821c9da0277ac7f30127edfac1f23cba0',
}
for name, digest in expected.items():
    if hashlib.sha256((ems / name).read_bytes()).hexdigest() != digest:
        raise SystemExit('Unexpected pinned emsdk source: ' + name)

shell = (ems / 'shell.js').read_text()
# The ES6 require bootstrap is unnecessary: this profile has no runtime files,
# threads or dynamic libraries. Preserve the surrounding preprocessor blocks.
shell = shell.replace("  var fs = require('fs');", "  // Houseplan: embedded WASM; no filesystem loader.")
shell = shell.replace("  scriptDirectory = __dirname + '/';", "  scriptDirectory = '';")
shell = shell.replace('#include "node_shell_read.js"', "  readBinary = () => { throw new Error('IFC embedded bytes missing'); };\n  readAsync = readBinary;")
(ems / 'shell.js').write_text(shell)
(ems / 'web_or_worker_shell_read.js').write_text(
    '// Houseplan embedded-only profile. No transport fallback.\n'
    "readBinary = () => { throw new Error('IFC embedded bytes missing'); };\nreadAsync = readBinary;\n")

cmake = root / 'src/cpp/CMakeLists.txt'
text = cmake.read_text()
if text.count('-sENVIRONMENT=web\n') != 1:
    raise SystemExit('Unexpected pinned web-ifc CMake target')
text = text.replace('-sENVIRONMENT=web\n', '-sENVIRONMENT=web,worker,node\n\t\t-sSINGLE_FILE=1\n\t\t-sSINGLE_FILE_BINARY_ENCODE=0\n\t\t-sFILESYSTEM=0\n\t\t-sMIN_NODE_VERSION=220000\n', 1)
text = text.replace('-fexperimental-library', '-fexperimental-library\n\t\t\t\t-ffile-prefix-map=/source=.')
cmake.write_text(text)

api = root / 'src/ts/web-ifc-api.ts'
text = api.read_text()
if text.count('let WebIFCWasm: any;') != 1 or text.count('  async Init(') != 1:
    raise SystemExit('Unexpected pinned web-ifc API')
text = text.replace('let WebIFCWasm: any;', 'import WebIFCWasm from "./hp-wasm.mjs";')
start = text.index('  async Init(')
end = text.index('  /**\n   * Opens a set of models', start)
text = text[:start] + '''  async Init() {
    if (this.wasmModule !== undefined) return;
    this.wasmModule = await WebIFCWasm({ noInitialRun: true });
    this.SetLogLevel(LogLevel.LOG_LEVEL_ERROR);
  }

''' + text[end:]
api.write_text(text)
