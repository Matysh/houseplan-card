import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REVIEW_TOOLS, executeReadTool, validateReport } from './review.mjs';

// A small stdio adapter over the existing analytical tools, not an execution auditor.
export function reviewMcpHandler(context, submit) {
  let submitted = false;
  return request => {
    const respond = result => ({ jsonrpc: '2.0', id: request.id, result });
    if (request.id === undefined) return null;
    switch (request.method) {
      case 'initialize': return respond({ protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'houseplan-review', version: '1.0.0' } });
      case 'ping': return respond({});
      case 'tools/list': return respond({ tools: REVIEW_TOOLS.map(({ input_schema, ...tool }) => ({ ...tool, inputSchema: input_schema })) });
      case 'tools/call': {
        const { name, arguments: input = {} } = request.params ?? {};
        try {
          if (submitted) throw Error('Review already submitted');
          if (!REVIEW_TOOLS.some(tool => tool.name === name)) throw Error('Unavailable analytical tool');
          let value;
          if (name === 'submit_review') { submit(validateReport(input)); submitted = true; value = { submitted: true }; }
          else value = executeReadTool(context, name, input);
          return respond({ content: [{ type: 'text', text: JSON.stringify(value) }] });
        } catch (error) { return respond({ isError: true, content: [{ type: 'text', text: error.message }] }); }
      }
      default: return { jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } };
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = resolve(process.argv[2]);
  const handler = reviewMcpHandler(JSON.parse(readFileSync(join(directory, 'context.json'), 'utf8')),
    report => writeFileSync(join(directory, 'submission.json'), JSON.stringify(report), { flag: 'wx' }));
  for await (const line of createInterface({ input: process.stdin })) {
    let request; try { request = JSON.parse(line); } catch { continue; }
    const response = handler(request);
    if (response) process.stdout.write(JSON.stringify(response) + '\n');
  }
}
