// tests/evaluator.test.js
import { expect } from 'chai';
import { evaluateRuleset } from '../worker/evaluator.js';

describe('evaluator', () => {
  it('fails age >=18', () => {
    const ruleset = {
      rules: [{ id:'c1', type:'condition', order:1, path:'user.age', operator:'>=', value:18 }]
    };
    const payload = { user:{ age:16 } };
    const r = evaluateRuleset(ruleset, payload);
    expect(r.status).to.equal('FAIL');
    expect(r.validationFailures).to.have.property('c1');
  });

  it('passes nested OR', () => {
    const ruleset = {
      rules:[{
        id:'g1', type:'group', logic:'AND', order:1, children:[
          { id:'c1', type:'condition', order:1, path:'user.age', operator:'>=', value:18 },
          { id:'g1-1', type:'group', order:2, logic:'OR', children:[
              { id:'c2', type:'condition', order:1, path:'user.tier', operator:'==', value:'gold' },
              { id:'c3', type:'condition', order:2, path:'user.tier', operator:'==', value:'platinum' }
          ]}
        ]
      }]
    };
    const payload = { user:{ age:20, tier:'silver' } };
    const r = evaluateRuleset(ruleset, payload);
    expect(r.status).to.equal('FAIL'); // because OR child failed
    expect(r.validationFailures).to.have.property('c2');
  });
});
