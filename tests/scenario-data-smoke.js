#!/usr/bin/env node
/**
 * Smoke-test for JSON-backed scenario data.
 * Ensures all core datasets load and contain key narrative entries so the
 * runtime never silently swaps in fallback text.
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'public', 'Scenarios');
const library = readJson('library.json');

const scenarios = ensureArray(library.scenarios, 'scenario list');

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
