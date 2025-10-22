// worker/index.js
import { evaluateRuleset } from './evaluator.js';

function validateRulesetSchema(rs) {
  if (!rs || !Array.isArray(rs.rules)) return 'rules must be an array';
  const ids = new Set();
  function walk(node) {
    if (!node.id) return 'node id required';
    if (ids.has(node.id)) return 'duplicate id ' + node.id;
    ids.add(node.id);
    if (node.type === 'group') {
      if (!['AND','OR'].includes(node.logic)) return 'invalid logic';
      for (const c of (node.children||[])) {
        const err = walk(c);
        if (err) return err;
      }
    } else if (node.type === 'condition') {
      if (!node.path || !node.operator) return 'condition missing fields';
      if (!['>','>=','<','<=','==','!='].includes(node.operator)) return 'invalid operator';
    } else return 'unknown node type';
  }
  for (const n of rs.rules) {
    const e = walk(n);
    if (e) return e;
  }
  return null;
}

async function handleSaveRuleset(request, env) {
  const data = await request.json();
  const validationError = validateRulesetSchema(data);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const id = 'r_' + Math.random().toString(36).slice(2,10);
  data.id = id;
  data.createdAt = new Date().toISOString();
  // store
  await env.RULES_KV.put(`ruleset:${id}`, JSON.stringify(data));
  const domain = new URL(request.url).origin;
  return new Response(JSON.stringify({
    rulesetId: id,
    evaluateEndpoint: `${domain}/evaluate/${id}`
  }), { headers: {'content-type':'application/json'}});
}

async function handleGetRuleset(request, env) {
  const id = request.url.split('/').pop();
  const raw = await env.RULES_KV.get(`ruleset:${id}`);
  if (!raw) return new Response('Not found', {status:404});
  return new Response(raw, { headers:{'content-type':'application/json'}});
}

async function handleEvaluate(request, env) {
  const id = request.url.split('/').pop();
  const raw = await env.RULES_KV.get(`ruleset:${id}`);
  if (!raw) return new Response('Ruleset not found', {status:404});
  const ruleset = JSON.parse(raw);
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response('Invalid JSON payload', { status: 422 });
  }

  const result = evaluateRuleset(ruleset, payload, { stopOnFirstFailure: !!ruleset.stopOnFirstFailure });

  return new Response(JSON.stringify(result), { headers: {'content-type':'application/json'}});
}

import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/rulesets' && request.method === 'POST') return handleSaveRuleset(request, env);
    if (url.pathname.startsWith('/rulesets/') && request.method === 'GET') return handleGetRuleset(request, env);
    if (url.pathname.startsWith('/evaluate/') && request.method === 'POST') return handleEvaluate(request, env);

    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      if (e.status === 404) {
        // Fallback to index.html for SPA routing
        const indexPath = '/index.html';
        const assetRequest = new Request(new URL(indexPath, request.url), request);
        try {
          return await getAssetFromKV(
            {
              request: assetRequest,
              waitUntil: ctx.waitUntil.bind(ctx),
            },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: assetManifest,
            }
          );
        } catch (e) {
          return new Response('Not found', { status: 404 });
        }
      }
      return new Response('An unexpected error occurred', { status: 500 });
    }
  },
};
