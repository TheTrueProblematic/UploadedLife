#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'public', 'Resources');
const library = JSON.parse(fs.readFileSync(path.join(dataDir, 'library.json'), 'utf8'));

const scenarios = new Map(library.scenarios.map((row) => [row.id, row]));
const randomIds = Array.from(scenarios.values()).filter((row) => row.pool === 'random').map((row) => row.id);
const badEventIds = Array.from(scenarios.values()).filter((row) => row.type === 'badEvent').map((row) => row.id);

const allowedPages = new Set([
    'learnmore',
    'learnmore.html',
    'identitytheft1',
    'identitytheft1.html',
    'identitytheft2',
    'identitytheft2.html',
    'identitytheft3',
    'identitytheft3.html',
    'main',
    'main.html',
    'mobile',
    'mobile.html',
    'nohappiness',
    'nohappiness.html',
]);

const entryPoints = ['a1r7', 'd8k3'];
const visited = new Set();
const queue = [...entryPoints];

while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) {
        continue;
    }
    visited.add(id);
    const def = scenarios.get(id);
    if (!def) {
        throw new Error(`Traverse failed: scenario ${id} missing from library`);
    }
    const destinations = collectDestinations(def);
    destinations.forEach((target) => {
        if (!target || allowedPages.has(target.toLowerCase())) {
            return;
        }
        if (target === 'RANDOM') {
            randomIds.forEach((randomId) => queue.push(randomId));
            return;
        }
        if (target === 'RANDOM_BAD') {
            badEventIds.forEach((badId) => queue.push(badId));
            return;
        }
        const normalized = normalizeTarget(target);
        if (!scenarios.has(normalized)) {
            throw new Error(`Traverse failed: ${id} points to missing scenario ${target}`);
        }
        queue.push(normalized);
    });
}

const missing = Array.from(scenarios.keys()).filter((id) => !visited.has(id) && scenarios.get(id).pool !== 'random');
if (missing.length) {
    throw new Error(`Traverse failed: unreachable scenarios detected -> ${missing.join(', ')}`);
}

console.log('traverse-scenarios.js passed: all links resolve and scenarios reachable.');

function collectDestinations(row) {
    const cfg = row.config || {};
    switch (row.type) {
        case 'jobSelection':
        case 'event':
        case 'incidentChoice':
        case 'promotionOffer':
        case 'relationshipInvite':
        case 'relationshipBreakup':
        case 'hobbyVerification':
            return [cfg.next || 'RANDOM'];
        case 'goodEvent':
        case 'badEvent':
        case 'hobbyOffer':
            return ['RANDOM'];
        case 'static':
        case 'pendingRelationship':
        case 'relationshipOutcome':
            return collectFromChoices(cfg);
        case 'hobbyStarter':
            if (Array.isArray(cfg.options) && cfg.options.length) {
                return cfg.options.map((option) => option.next || 'RANDOM');
            }
            return [cfg.next || 'RANDOM'];
        default:
            return [cfg.next || 'RANDOM'];
    }
}

function collectFromChoices(cfg) {
    const outputs = [];
    (cfg.choices || []).forEach((choice) => outputs.push(choice.next || 'RANDOM'));
    (cfg.successChoices || []).forEach((choice) => outputs.push(choice.next || 'RANDOM'));
    (cfg.failureChoices || []).forEach((choice) => outputs.push(choice.next || 'RANDOM'));
    return outputs;
}

function normalizeTarget(value) {
    return String(value).replace(/^Pages\//i, '').replace(/\.html$/i, '');
}
