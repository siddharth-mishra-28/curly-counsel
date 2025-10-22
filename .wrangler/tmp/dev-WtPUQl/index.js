var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/evaluator.js
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
__name(uuidv4, "uuidv4");
function resolvePath(obj, path) {
  if (!path) return void 0;
  try {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur === null || cur === void 0) return void 0;
      cur = cur[p];
    }
    return cur;
  } catch (e) {
    return void 0;
  }
}
__name(resolvePath, "resolvePath");
function compare(lhs, rhs, operator) {
  const numL = Number(lhs);
  const numR = Number(rhs);
  const bothNum = !Number.isNaN(numL) && !Number.isNaN(numR);
  if ([">", ">=", "<", "<="].includes(operator) && !bothNum) {
    return { pass: false, error: "non-numeric comparison" };
  }
  switch (operator) {
    case ">":
      return { pass: numL > numR };
    case ">=":
      return { pass: numL >= numR };
    case "<":
      return { pass: numL < numR };
    case "<=":
      return { pass: numL <= numR };
    case "==":
      return { pass: String(lhs) === String(rhs) };
    case "!=":
      return { pass: String(lhs) !== String(rhs) };
    default:
      return { pass: false, error: "unknown operator" };
  }
}
__name(compare, "compare");
function evaluateCondition(cond, payload) {
  const left = resolvePath(payload, cond.path);
  const right = cond.valueIsPath ? resolvePath(payload, cond.value) : cond.value;
  const res = compare(left, right, cond.operator);
  let pass = res.pass === true;
  if (cond.negate) pass = !pass;
  const failure = pass ? null : {
    message: res.error ? res.error : `${cond.path} expected ${cond.operator} ${cond.value} but found ${left}`,
    expected: `${cond.operator} ${cond.value}`,
    found: left,
    operator: cond.operator
  };
  return { pass, failure };
}
__name(evaluateCondition, "evaluateCondition");
function evaluateGroup(group, payload, opts) {
  const children = (group.children || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const logic = group.logic || "AND";
  const groupLevelFailures = {};
  const allNestedFailures = {};
  let overall = logic === "AND";
  for (const ch of children) {
    let res;
    if (ch.type === "condition") {
      res = evaluateCondition(ch, payload);
      if (!res.pass) {
        allNestedFailures[ch.id] = res.failure;
      }
    } else {
      res = evaluateGroup(ch, payload, opts);
      if (res.failures) {
        Object.assign(allNestedFailures, res.failures);
      }
    }
    if (!res.pass) {
      groupLevelFailures[ch.id] = res.failure || { message: `node ${ch.id} failed` };
    }
    if (logic === "AND") {
      overall = overall && res.pass;
      if (!overall && opts.stopOnFirstFailure) break;
    } else {
      overall = overall || res.pass;
      if (overall && opts.stopOnFirstFailure) break;
    }
  }
  if (group.negate) overall = !overall;
  const failure = overall ? null : { message: `${logic} group failed`, childrenFailed: Object.keys(groupLevelFailures) };
  return { pass: overall, failure, failures: allNestedFailures };
}
__name(evaluateGroup, "evaluateGroup");
function evaluateRuleset(ruleset, payload, opts = {}) {
  const start = Date.now();
  const rootRules = (ruleset.rules || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const allFailures = {};
  let finalPass = true;
  for (const node of rootRules) {
    const r = node.type === "condition" ? evaluateCondition(node, payload) : evaluateGroup(node, payload, opts);
    if (!r.pass) {
      finalPass = false;
      if (r.failure) allFailures[node.id || "unknown"] = r.failure;
      if (r.failures) Object.assign(allFailures, r.failures);
      if (opts.stopOnFirstFailure) break;
    }
  }
  const elapsedMs = Date.now() - start;
  return {
    ruleTriggerUuid: uuidv4(),
    status: finalPass ? "PASS" : "FAIL",
    validationFailures: finalPass ? {} : allFailures,
    evaluatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    elapsedMs
  };
}
__name(evaluateRuleset, "evaluateRuleset");

// worker/durable_objects.js
var WebSocketHub = class {
  static {
    __name(this, "WebSocketHub");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = /* @__PURE__ */ new Map();
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (req.headers.get("Upgrade") !== "websocket") {
      if (req.method === "POST") {
        const body = await req.text();
        for (const ws of this.clients.values()) {
          try {
            ws.send(body);
          } catch (e) {
          }
        }
        return new Response("ok");
      }
      return new Response("WSHub", { status: 200 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const id = crypto.randomUUID();
    this.clients.set(id, server);
    server.onmessage = (ev) => {
    };
    server.onclose = () => {
      this.clients.delete(id);
    };
    return new Response(null, { status: 101, webSocket: client });
  }
};

// worker/index.js
function validateRulesetSchema(rs) {
  if (!rs || !Array.isArray(rs.rules)) return "rules must be an array";
  const ids = /* @__PURE__ */ new Set();
  function walk(node) {
    if (!node.id) return "node id required";
    if (ids.has(node.id)) return "duplicate id " + node.id;
    ids.add(node.id);
    if (node.type === "group") {
      if (!["AND", "OR"].includes(node.logic)) return "invalid logic";
      for (const c of node.children || []) {
        const err = walk(c);
        if (err) return err;
      }
    } else if (node.type === "condition") {
      if (!node.path || !node.operator) return "condition missing fields";
      if (![">", ">=", "<", "<=", "==", "!="].includes(node.operator)) return "invalid operator";
    } else return "unknown node type";
  }
  __name(walk, "walk");
  for (const n of rs.rules) {
    const e = walk(n);
    if (e) return e;
  }
  return null;
}
__name(validateRulesetSchema, "validateRulesetSchema");
async function handleSaveRuleset(request, env) {
  const data = await request.json();
  const validationError = validateRulesetSchema(data);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const id = "r_" + Math.random().toString(36).slice(2, 10);
  data.id = id;
  data.createdAt = (/* @__PURE__ */ new Date()).toISOString();
  await env.RULES_KV.put(`ruleset:${id}`, JSON.stringify(data));
  const domain = new URL(request.url).origin;
  return new Response(JSON.stringify({
    rulesetId: id,
    evaluateEndpoint: `${domain}/evaluate/${id}`,
    wsEndpoint: `wss://${domain.replace(/^https?:\/\//, "")}/ws/${id}`
  }), { headers: { "content-type": "application/json" } });
}
__name(handleSaveRuleset, "handleSaveRuleset");
async function handleGetRuleset(request, env) {
  const id = request.url.split("/").pop();
  const raw = await env.RULES_KV.get(`ruleset:${id}`);
  if (!raw) return new Response("Not found", { status: 404 });
  return new Response(raw, { headers: { "content-type": "application/json" } });
}
__name(handleGetRuleset, "handleGetRuleset");
async function handleEvaluate(request, env) {
  const id = request.url.split("/").pop();
  const raw = await env.RULES_KV.get(`ruleset:${id}`);
  if (!raw) return new Response("Ruleset not found", { status: 404 });
  const ruleset = JSON.parse(raw);
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response("Invalid JSON payload", { status: 422 });
  }
  const result = evaluateRuleset(ruleset, payload, { stopOnFirstFailure: !!ruleset.stopOnFirstFailure });
  const doId = env.WS_HUB.idFromName(id);
  await env.WS_HUB.get(doId).fetch("https://broadcast/", { method: "POST", body: JSON.stringify(result) });
  return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
}
__name(handleEvaluate, "handleEvaluate");
async function handleWebSocket(request, env) {
  const id = request.url.split("/").pop();
  if (!id) return new Response("Not found", { status: 404 });
  const doId = env.WS_HUB.idFromName(id);
  const stub = env.WS_HUB.get(doId);
  return stub.fetch(request);
}
__name(handleWebSocket, "handleWebSocket");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/rulesets" && request.method === "POST") return handleSaveRuleset(request, env);
    if (url.pathname.startsWith("/rulesets/") && request.method === "GET") return handleGetRuleset(request, env);
    if (url.pathname.startsWith("/evaluate/") && request.method === "POST") return handleEvaluate(request, env);
    if (url.pathname.startsWith("/ws/") && request.method === "GET") return handleWebSocket(request, env);
    return new Response("Not found", { status: 404 });
  }
};

// C:/Users/Admin/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/Admin/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-TZKquX/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// C:/Users/Admin/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-TZKquX/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  WebSocketHub,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
