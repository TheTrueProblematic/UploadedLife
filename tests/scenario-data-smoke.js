#!/usr/bin/env node
/**
 * Smoke-test for JSON-backed scenario data.
 * Ensures all core datasets load and contain key narrative entries so the
 * runtime never silently swaps in fallback text.
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'public', 'Resources');
const library = readJson('library.json');

const scenarios = ensureArray(library.scenarios, 'scenario list');
const scenarioIds = new Set(scenarios.map((row) => row.id));

const introScenario = scenarios.find((row) => row.id === 'a1r7');
assertCondition(introScenario, 'Intro scenario (a1r7) missing.');
assertCondition(
    String(introScenario.text || '').includes('Welcome to Alex’s world'),
    'Intro scenario text does not match expected narrative.'
);

const jobs = ensureArray(library.jobs, 'jobs list');
assertCondition(jobs.length >= 10, 'Jobs dataset unexpectedly small.');
const jobGroups = new Set(jobs.map((job) => job.group));
['first-month-a', 'first-month-b'].forEach((group) => {
    assertCondition(jobGroups.has(group), `Missing job group: ${group}`);
});

const incidentEvents = ensureArray(library.incidentEvents, 'incident events');
assertCondition(incidentEvents.every((row) => row.story), 'Incident events missing story text.');

const goodEvents = ensureArray(library.goodEvents, 'good events');
assertCondition(goodEvents.every((row) => row.text && row.id), 'Good events missing text/id.');

const badEvents = ensureArray(library.badEvents, 'bad events');
assertCondition(badEvents.every((row) => row.text && row.id), 'Bad events missing text/id.');

const hobbyOffers = ensureArray(library.hobbyOffers, 'hobby offers');
assertCondition(hobbyOffers.every((row) => row.provider && row.id), 'Hobby offers missing provider/id.');

const hobbyStarterScenarios = scenarios.filter((row) => row.type === 'hobbyStarter');
assertCondition(hobbyStarterScenarios.length > 0, 'No hobbyStarter scenarios found.');
hobbyStarterScenarios.forEach((row) => {
    const cfg = row?.config || {};
    if ((cfg.dataSource || '').toLowerCase() === 'hobbyoffers') {
        return;
    }
    const options = cfg.options;
    assertCondition(Array.isArray(options) && options.length >= 2, `Hobby starter ${row.id} missing option definitions.`);
});

validateNavigationTargets(scenarios, scenarioIds);

console.log('Scenario data smoke-test passed:');
console.log(`  ${scenarios.length} scenarios, intro text: ${introScenario.text.slice(0, 70)}…`);
console.log(`  ${jobs.length} jobs across ${jobGroups.size} groups.`);
console.log(`  Incident events: ${incidentEvents.length}, good events: ${goodEvents.length}, bad events: ${badEvents.length}.`);
console.log(`  Hobby offers: ${hobbyOffers.length}.`);

function assertCondition(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function readJson(filename) {
    const fullPath = path.join(dataDir, filename);
    const raw = fs.readFileSync(fullPath, 'utf8');
    try {
        return JSON.parse(raw);
    } catch (err) {
        throw new Error(`Failed to parse ${filename}: ${err.message}`);
    }
}

function ensureArray(value, label) {
    assertCondition(Array.isArray(value) && value.length > 0, `${label} missing or empty.`);
    return value;
}

function validateNavigationTargets(rows, idSet) {
    const allowedPages = new Set([
        'learnmore.html',
        'identitytheft1.html',
        'identitytheft2.html',
        'identitytheft3.html',
        'main.html',
        'mobile.html',
        'nohappiness.html',
    ]);
    rows.forEach((row) => {
        const record = (value, context) => validateDestination(value, context, idSet, allowedPages);
        const cfg = row.config || {};
        switch (row.type) {
            case 'jobSelection':
            case 'event':
            case 'incidentChoice':
            case 'promotionOffer':
            case 'relationshipInvite':
            case 'relationshipBreakup':
            case 'hobbyVerification':
                record(cfg.next, `${row.id}.config.next`);
                break;
            case 'static':
            case 'pendingRelationship':
                (cfg.choices || []).forEach((choice, idx) => record(choice.next, `${row.id}.choices[${idx}]`));
                break;
            case 'hobbyStarter':
                (cfg.options || []).forEach((option, idx) => record(option.next, `${row.id}.options[${idx}]`));
                break;
            case 'relationshipOutcome':
                (cfg.successChoices || []).forEach((choice, idx) => record(choice.next, `${row.id}.successChoices[${idx}]`));
                (cfg.failureChoices || []).forEach((choice, idx) => record(choice.next, `${row.id}.failureChoices[${idx}]`));
                break;
            default:
                record(cfg.next, `${row.id}.config.next`);
                break;
        }
    });
}

function validateDestination(value, context, idSet, allowedPages) {
    if (!value || value === 'RANDOM' || value === 'RANDOM_BAD') {
        return;
    }
    let normalized = String(value).replace(/^Pages\//i, '');
    const lower = normalized.toLowerCase();
    if (allowedPages.has(lower)) {
        return;
    }
    if (normalized.endsWith('.html')) {
        normalized = normalized.slice(0, -5);
    }
    assertCondition(
        idSet.has(normalized),
        `Scenario destination missing: ${context} targets "${value}", which has no scenario definition.`,
    );
}
