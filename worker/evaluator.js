// worker/evaluator.js
function uuidv4(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=> {
    const r = Math.random()*16|0, v = c==='x'? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function resolvePath(obj, path) {
  if (!path) return undefined;
  // support a.b[0].c
  try {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[p];
    }
    return cur;
  } catch (e) { return undefined; }
}

function compare(lhs, rhs, operator) {
  const numL = Number(lhs);
  const numR = Number(rhs);
  const bothNum = !Number.isNaN(numL) && !Number.isNaN(numR);
  if (['>','>=','<','<='].includes(operator) && !bothNum) {
    return {pass:false, error:'non-numeric comparison'};
  }
  switch(operator){
    case '>': return {pass: numL > numR};
    case '>=': return {pass: numL >= numR};
    case '<': return {pass: numL < numR};
    case '<=': return {pass: numL <= numR};
    case '==': return {pass: String(lhs) === String(rhs)};
    case '!=': return {pass: String(lhs) !== String(rhs)};
    default: return {pass:false, error:'unknown operator'};
  }
}

function evaluateCondition(cond, payload) {
  const left = resolvePath(payload, cond.path);
  const right = cond.valueIsPath ? resolvePath(payload, cond.value) : cond.value;
  const res = compare(left, right, cond.operator);
  let pass = res.pass === true;
  if (cond.negate) pass = !pass;
  const failure = pass ? null : {
    message: (res.error) ? res.error : `${cond.path} expected ${cond.operator} ${cond.value} but found ${left}`,
    expected: `${cond.operator} ${cond.value}`,
    found: left,
    operator: cond.operator
  };
  return { pass, failure };
}

function evaluateGroup(group, payload, opts) {
  const children = (group.children || []).slice().sort((a,b)=> (a.order||0)-(b.order||0));
  const logic = group.logic || 'AND';
  const groupLevelFailures = {}; // For this group's own failure message
  const allNestedFailures = {}; // To bubble up all condition failures
  let overall = (logic === 'AND');

  for (const ch of children) {
    let res;
    if (ch.type === 'condition') {
      res = evaluateCondition(ch, payload);
      if (!res.pass) {
        allNestedFailures[ch.id] = res.failure;
      }
    } else { // type is 'group'
      res = evaluateGroup(ch, payload, opts);
      if (res.failures) {
        Object.assign(allNestedFailures, res.failures);
      }
    }

    if (!res.pass) {
      // Record which direct child failed for this group's failure message
      groupLevelFailures[ch.id] = res.failure || { message: `node ${ch.id} failed` };
    }

    // apply group logic
    if (logic === 'AND') {
      overall = overall && res.pass;
      if (!overall && opts.stopOnFirstFailure) break;
    } else {
      overall = overall || res.pass;
      if (overall && opts.stopOnFirstFailure) break;
    }
  }

  if (group.negate) overall = !overall;

  const failure = overall ? null : { message: `${logic} group failed`, childrenFailed: Object.keys(groupLevelFailures) };

  // The 'failures' object returned should contain all nested condition failures.
  return { pass: overall, failure, failures: allNestedFailures };
}

function evaluateRuleset(ruleset, payload, opts = {}) {
  const start = Date.now();
  const rootRules = (ruleset.rules || []).slice().sort((a,b)=> (a.order||0)-(b.order||0));
  const allFailures = {};
  let finalPass = true;
  for (const node of rootRules) {
    const r = (node.type === 'condition') ? evaluateCondition(node, payload) : evaluateGroup(node, payload, opts);
    if (!r.pass) {
      finalPass = false;
      if (r.failure) allFailures[node.id || 'unknown'] = r.failure;
      if (r.failures) Object.assign(allFailures, r.failures);
      if (opts.stopOnFirstFailure) break;
    }
  }
  const elapsedMs = Date.now() - start;
  return {
    ruleTriggerUuid: uuidv4(),
    status: finalPass ? "PASS" : "FAIL",
    validationFailures: finalPass ? {} : allFailures,
    evaluatedAt: new Date().toISOString(),
    elapsedMs
  };
}

export { resolvePath, compare, evaluateCondition, evaluateGroup, evaluateRuleset };
