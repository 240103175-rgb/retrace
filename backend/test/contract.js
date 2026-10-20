// Validates HTTP responses against /openapi.yml.
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fileURLToPath } from 'node:url';

const SPEC = fileURLToPath(new URL('../../openapi.yml', import.meta.url));

export async function loadContract() {
  const spec = await SwaggerParser.dereference(SPEC);
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const routes = Object.entries(spec.paths).map(([path, ops]) => ({
    path,
    regex: new RegExp(`^/api/v1${path.replace(/\{[^}]+\}/g, '[^/]+')}$`),
    ops,
  }));
  const seen = new Set();

  return {
    /** Throws if the response status or body does not match the contract. */
    check(method, url, status, body) {
      const pathname = new URL(url, 'http://x').pathname;
      const route = routes.find((r) => r.regex.test(pathname));
      if (!route) throw new Error(`No contract path for ${pathname}`);
      const op = route.ops[method.toLowerCase()];
      if (!op) throw new Error(`No contract operation ${method} ${route.path}`);
      const response = op.responses[String(status)];
      if (!response) throw new Error(`${method} ${route.path}: status ${status} is not in the contract`);
      seen.add(`${method.toUpperCase()} ${route.path} ${status}`);
      const schema = response.content?.['application/json']?.schema;
      if (!schema) {
        if (body !== undefined && body !== '') throw new Error(`${method} ${route.path} ${status}: unexpected body`);
        return;
      }
      const validate = ajv.compile(schema);
      if (!validate(body)) {
        throw new Error(`${method} ${route.path} ${status}: ${ajv.errorsText(validate.errors)}\n${JSON.stringify(body).slice(0, 300)}`);
      }
    },
    operations: () =>
      routes.flatMap((r) =>
        Object.keys(r.ops)
          .filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
          .map((m) => `${m.toUpperCase()} ${r.path}`),
      ),
    seen: () => [...seen],
  };
}
