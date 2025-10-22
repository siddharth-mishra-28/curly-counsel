---

# ⚙️ CurlyCounsel — No-Code JSON-Based Rule Engine

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare\&logoColor=white)
![Status](https://img.shields.io/badge/status-Active-success)
![Node](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![No Dependencies](https://img.shields.io/badge/frontend-no%20dependencies-lightgrey)

> **CurlyCounsel** is a lightweight, no-code rule engine that runs natively on the **Cloudflare global network**.
> It empowers users to create, test, and deploy complex business logic visually — without writing a single line of code.

---

## 🧩 Use Cases

* 🔒 **Access Control:** Define who can access features or data.
* ✅ **Data Validation:** Ensure incoming data meets specific criteria.
* 💰 **Pricing Engines:** Apply dynamic pricing rules.
* 🕵️ **Fraud Detection:** Identify suspicious or anomalous patterns.
* ⚙️ **Workflow Automation:** Trigger downstream processes conditionally.

---

## 🚀 Key Features

* 🎨 **Visual Rule Builder:** Modern, dependency-free UI for creating and nesting rules.
* ⚖️ **Flexible Conditions:** Supports operators (`>`, `>=`, `<`, `<=`, `==`, `!=`) and negation (`NOT`).
* 🧠 **Nested Logic:** Combine `AND` / `OR` groups to build complex rule trees.
* 💾 **Persistent Storage:** Securely stored via Cloudflare Workers KV.
* ☁️ **Serverless Architecture:** Fully runs on Cloudflare Workers — fast, scalable, cost-efficient.
* 🔗 **Simple REST API:** Create, update, and evaluate rules via HTTP.

---

## 🧱 Tech Stack

| Layer        | Technologies                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**  | [Cloudflare Workers](https://workers.cloudflare.com/), [Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv/), [Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/) |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (no dependencies)                                                                                                                                                                           |
| **Testing**  | [Mocha](https://mochajs.org/), [Chai](https://www.chaijs.com/)                                                                                                                                                              |

---

## 🛠️ Getting Started

Follow these steps to set up the project locally for development or testing.

### 📋 Prerequisites

* [Node.js](https://nodejs.org/) **v18.0.0+**
* [npm](https://www.npmjs.com/)
* [Cloudflare Account](https://dash.cloudflare.com/sign-up)
* [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) **v3.0.0+**

### ⚙️ Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/cf-rules-engine.git
cd cf-rules-engine

# 2. Install dependencies
npm install

# 3. Create a KV namespace for rules
wrangler kv namespace create "RULES_KV"

# 4. Update wrangler.toml with your KV ID
[[kv_namespaces]]
binding = "RULES_KV"
id = "PASTE_YOUR_KV_NAMESPACE_ID_HERE"
```

---

### ▶️ Running Locally

```bash
wrangler dev
```

Then open **[http://localhost:8787](http://localhost:8787)** in your browser to launch the UI.

---

## 🧠 How to Use

### 1️⃣ Build a Ruleset

* **Add Rule Groups:** Choose between `AND` or `OR` logic.
* **Add Conditions:** Each includes:

  * `Path` → key in your JSON (e.g., `user.age`)
  * `Operator` → (`>`, `>=`, `==`, etc.)
  * `Value` → target comparison value
  * `Negate` → optional NOT toggle
* **Nest Groups:** Create multi-level logical structures easily.

### 2️⃣ Save a Ruleset

Click **“Save Ruleset”** in the UI — or save via API:

```bash
curl -X POST http://localhost:8787/rulesets \
     -H "Content-Type: application/json" \
     -d @examples/nested-or.json
```

### 3️⃣ Evaluate a Payload

In the UI, enter your test JSON and hit **Run Evaluation**.
Or use the API directly:

```bash
curl -X POST http://localhost:8787/evaluate/<rulesetId> \
     -H "Content-Type: application/json" \
     -d '{"user":{"age":21,"tier":"gold"}}'
```

---

## 💡 Example: E-Commerce Discount Rule

Offer discounts to users who are either:

* Older than 65, **OR**
* Are “gold”/“platinum” members **AND** have spent more than $100.

```json
{
  "name": "Discount-Ruleset",
  "rules": [
    {
      "id": "g-main",
      "type": "group",
      "logic": "OR",
      "children": [
        { "id": "c-age", "type": "condition", "path": "customer.age", "operator": ">", "value": "65" },
        {
          "id": "g-membership",
          "type": "group",
          "logic": "AND",
          "children": [
            {
              "id": "g-tier",
              "type": "group",
              "logic": "OR",
              "children": [
                { "id": "c-gold", "type": "condition", "path": "customer.tier", "operator": "==", "value": "gold" },
                { "id": "c-platinum", "type": "condition", "path": "customer.tier", "operator": "==", "value": "platinum" }
              ]
            },
            { "id": "c-spent", "type": "condition", "path": "customer.totalSpent", "operator": ">", "value": "100" }
          ]
        }
      ]
    }
  ]
}
```

---

## 🔐 Production Recommendations

### ✅ API Authentication

```bash
wrangler secret put API_KEY
```

```javascript
const apiKey = request.headers.get('X-API-KEY');
if (apiKey !== env.API_KEY) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 🚦 Rate Limiting (KV Example)

```javascript
const ip = request.headers.get('CF-Connecting-IP');
const key = `rl:${ip}:${new Date().getMinutes()}`;
let count = parseInt(await env.RULES_KV.get(key) || '0');

if (count >= 100) return new Response('Rate limit exceeded', { status: 429 });

await env.RULES_KV.put(key, (count + 1).toString(), { expirationTtl: 120 });
```

### 🗃️ Persist Evaluation Logs

```javascript
const logKey = `eval:${id}:${new Date().toISOString()}`;
await env.RULES_KV.put(logKey, JSON.stringify(result));
```

### 🧪 CI Setup (GitHub Actions)

```yaml
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

---

## 📁 Project Structure

```
.
├── worker/
│   ├── index.js           # Main Worker script (routing + API)
│   ├── evaluator.js       # Core rule evaluation logic
│   └── durable_objects.js # WebSocket hub for live updates
├── static/
│   ├── index.html         # UI
│   ├── app.js             # Frontend logic
│   └── app.css            # Styles
├── tests/
│   └── evaluator.test.js  # Test cases
├── examples/              # Sample rulesets & payloads
├── package.json
└── wrangler.toml          # Configuration
```

---

## ⚠️ Limitations

* 🧩 **Minimal UI:** Simple and dependency-free by design (consider React/Vue for drag-drop).
* ⚙️ **Basic Error Handling:** Production deployments should include robust logging.

---

## 🤝 Contributing

Contributions are always welcome!
Feel free to fork, open issues, or submit pull requests.

---

## 📄 License

**CurlyCounsel** is licensed under the **GPLV3 License**.
Made with 💖 and Caffeine By Siddharth Mishra

---
