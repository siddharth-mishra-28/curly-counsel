document.addEventListener('DOMContentLoaded', () => {
    // Global state
    let rules = [];

    // DOM Elements
    const builder = document.getElementById('builder');
    const saveButton = document.getElementById('saveRuleset');
    const runButton = document.getElementById('run');
    const themeToggle = document.getElementById('themeToggle');
    const copyEndpointsButton = document.getElementById('copyEndpoints');
    const endpointsPre = document.getElementById('endpoints');
    const responsePre = document.getElementById('response');
    const payloadTextarea = document.getElementById('payload');

    // Ruleset Modal Elements
    const previewRulesetButton = document.getElementById('previewRuleset');
    const rulesetModal = document.getElementById('rulesetModal');
    const closeRulesetModalButton = document.getElementById('closeRulesetModal');
    const rulesetJsonDisplay = document.getElementById('rulesetJsonDisplay');
    const copyRulesetJsonButton = document.getElementById('copyRulesetJson');

    // Condition Modal Elements
    const modal = document.getElementById('conditionModal');
    const modalTitle = document.getElementById('modalTitle');
    const closeModalButton = document.getElementById('closeModal');
    const cancelConditionButton = document.getElementById('cancelCondition');
    const conditionForm = document.getElementById('conditionForm');
    const editingNodeIdInput = document.getElementById('editingNodeId');
    const parentNodeIdInput = document.getElementById('parentNodeId');
    const conditionPathInput = document.getElementById('conditionPath');
    const conditionOperatorInput = document.getElementById('conditionOperator');
    const conditionValueInput = document.getElementById('conditionValue');
    const conditionNegateInput = document.getElementById('conditionNegate');

    // --- Data Model ---
    const createNode = (type) => {
        const base = { id: `${type.charAt(0)}-${Math.random().toString(36).slice(2, 9)}` };
        if (type === 'group') {
            return { ...base, type, logic: 'AND', children: [] };
        }
        return { ...base, type, path: '', operator: '==', value: '', negate: false };
    };

    const findNode = (id, searchRules = rules) => {
        for (const node of searchRules) {
            if (node.id === id) return node;
            if (node.type === 'group') {
                const found = findNode(id, node.children);
                if (found) return found;
            }
        }
        return null;
    };

    const findParent = (childId, searchRules = rules, parent = null) => {
        for (const node of searchRules) {
            if (node.id === childId) return parent;
            if (node.type === 'group') {
                const found = findParent(childId, node.children, node);
                if (found) return found;
            }
        }
        return null;
    };

    // --- Rendering ---
    const renderNode = (node) => {
        if (node.type === 'group') return renderGroup(node);
        if (node.type === 'condition') return renderCondition(node);
        return '';
    };

    const renderGroup = (group) => {
        return `
            <div class="rule-group" id="${group.id}" data-id="${group.id}">
                <div class="rule-group-header">
                    <select class="logic-select" data-id="${group.id}">
                        <option value="AND" ${group.logic === 'AND' ? 'selected' : ''}>AND</option>
                        <option value="OR" ${group.logic === 'OR' ? 'selected' : ''}>OR</option>
                    </select>
                    <button class="btn btn-outline btn-sm add-condition" data-parent-id="${group.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Condition
                    </button>
                    <button class="btn btn-outline btn-sm add-group" data-parent-id="${group.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="3" y1="9" x2="21" y2="9"></line>
                            <line x1="9" y1="21" x2="9" y2="9"></line>
                        </svg>
                        Group
                    </button>
                    <button class="btn btn-outline btn-sm btn-danger remove-node" data-id="${group.id}" style="margin-left: auto;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Remove
                    </button>
                </div>
                ${group.children.length > 0 ? `
                    <div class="rule-group-children">
                        ${group.children.map(renderNode).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    };

    const renderCondition = (cond) => {
        return `
            <div class="rule-condition" id="${cond.id}" data-id="${cond.id}">
                <div class="condition-details">
                    <span class="condition-path">${cond.path || '...'}</span>
                    <span class="condition-operator">${cond.operator}</span>
                    <span class="condition-value">${cond.value || '...'}</span>
                    ${cond.negate ? '<span class="negate-badge">NOT</span>' : ''}
                </div>
                <div class="condition-actions">
                    <button class="btn btn-outline action-button edit-condition" data-id="${cond.id}" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-outline action-button btn-danger remove-node" data-id="${cond.id}" title="Remove">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    };

    const render = () => {
        if (rules.length === 0) {
            builder.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </div>
                    <h3>Your ruleset is empty</h3>
                    <p>Start building your rules by adding a rule group</p>
                    <button id="addInitialGroup" class="btn btn-primary">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Rule Group
                    </button>
                </div>
            `;
            document.getElementById('addInitialGroup').onclick = () => {
                rules.push(createNode('group'));
                render();
            };
        } else {
            builder.innerHTML = rules.map(renderNode).join('');
        }
    };

    // --- Modal Logic ---
    const openModal = (mode, data) => {
        conditionForm.reset();
        modalTitle.textContent = mode === 'add' ? 'Add New Condition' : 'Edit Condition';
        editingNodeIdInput.value = data.id || '';
        parentNodeIdInput.value = data.parentId || '';
        if (mode === 'edit') {
            const node = findNode(data.id);
            if (node) {
                conditionPathInput.value = node.path;
                conditionOperatorInput.value = node.operator;
                conditionValueInput.value = node.value;
                conditionNegateInput.checked = node.negate;
            }
        }
        modal.style.display = 'flex';
    };

    const closeModal = () => {
        modal.style.display = 'none';
    };

    conditionForm.onsubmit = (e) => {
        e.preventDefault();
        const id = editingNodeIdInput.value;
        const parentId = parentNodeIdInput.value;
        const data = {
            path: conditionPathInput.value,
            operator: conditionOperatorInput.value,
            value: conditionValueInput.value,
            negate: conditionNegateInput.checked,
        };

        if (id) { // Editing existing
            const node = findNode(id);
            if (node) Object.assign(node, data);
        } else { // Adding new
            const parent = findNode(parentId);
            const newNode = createNode('condition');
            Object.assign(newNode, data);
            if (parent && parent.type === 'group') {
                parent.children.push(newNode);
            }
        }
        render();
        closeModal();
    };

    // --- API & Functions ---
    const saveRuleset = async () => {
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Saving...';
        saveButton.disabled = true;
        
        const payload = { name: 'My Ruleset', rules };
        try {
            const res = await fetch('/rulesets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to save');

            endpointsPre.textContent = JSON.stringify({ evaluateEndpoint: json.evaluateEndpoint }, null, 2);
            showToast('Ruleset saved successfully!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to save ruleset', 'error');
        } finally {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }
    };

    const runEvaluation = async () => {
        let payload;
        try {
            payload = JSON.parse(payloadTextarea.value);
        } catch {
            showToast('Invalid JSON payload', 'error');
            return;
        }

        let endpoints;
        try {
            endpoints = JSON.parse(endpointsPre.textContent);
        } catch {
            showToast('Please save a ruleset first', 'error');
            return;
        }

        try {
            const res = await fetch(endpoints.evaluateEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            responsePre.textContent = JSON.stringify(json, null, 2);
            showToast('Evaluation completed', 'success');
        } catch (err) {
            showToast('Evaluation failed', 'error');
        }
    };

    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    // --- Event Listeners ---
    builder.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.dataset.id;
        const parentId = target.dataset.parentId;

        if (target.matches('.add-condition')) {
            openModal('add', { parentId });
        }
        if (target.matches('.add-group')) {
            const parent = findNode(parentId);
            if (parent) {
                parent.children.push(createNode('group'));
                render();
            }
        }
        if (target.matches('.edit-condition')) {
            openModal('edit', { id });
        }
        if (target.matches('.remove-node')) {
            const parent = findParent(id);
            if (parent) {
                parent.children = parent.children.filter(child => child.id !== id);
            } else {
                rules = rules.filter(rule => rule.id !== id);
            }
            render();
        }
    });

    builder.addEventListener('change', (e) => {
        if(e.target.matches('.logic-select')) {
            const group = findNode(e.target.dataset.id);
            if(group) group.logic = e.target.value;
        }
    });

    themeToggle.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    };

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    saveButton.onclick = saveRuleset;
    runButton.onclick = runEvaluation;
    closeModalButton.onclick = closeModal;
    cancelConditionButton.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    copyEndpointsButton.onclick = () => {
        try {
            const endpoints = JSON.parse(endpointsPre.textContent);
            navigator.clipboard.writeText(endpoints.evaluateEndpoint)
                .then(() => {
                    copyEndpointsButton.classList.add('copied');
                    setTimeout(() => copyEndpointsButton.classList.remove('copied'), 2000);
                    showToast('Evaluation endpoint copied to clipboard!', 'success');
                })
                .catch(() => showToast('Failed to copy endpoint', 'error'));
        } catch (e) {
            showToast('No endpoint to copy. Save a ruleset first.', 'error');
        }
    };

    // Ruleset Preview Modal
    previewRulesetButton.onclick = () => {
        rulesetJsonDisplay.textContent = JSON.stringify({ rules }, null, 2);
        rulesetModal.style.display = 'flex';
    };

    closeRulesetModalButton.onclick = () => {
        rulesetModal.style.display = 'none';
    };

    rulesetModal.onclick = (e) => {
        if (e.target === rulesetModal) closeRulesetModalButton.onclick();
    };

    copyRulesetJsonButton.onclick = () => {
        navigator.clipboard.writeText(rulesetJsonDisplay.textContent)
            .then(() => showToast('Ruleset JSON copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy ruleset JSON', 'error'));
    };

    // --- Init ---
    render();
});
