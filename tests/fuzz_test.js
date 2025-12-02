const fs = require('fs');
const path = require('path');

// --- Mock Environment & Utils ---
const utils = {
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    pick(list) {
        if (!list || !list.length) return '';
        return list[Math.floor(Math.random() * list.length)];
    },
    between(min, max) {
        return Math.round(min + Math.random() * (max - min));
    },
    weightedBetween(min, max) {
        const skew = Math.pow(Math.random(), 1.35);
        return Math.round(min + skew * (max - min));
    },
};

const currency = {
    format: (val) => `$${val}`,
};

const COST_MULTIPLIER = 2;
const HAPPINESS_GAIN_MULTIPLIER = 0.5;

function applyCostIncrease(value) {
    const amount = Number(value) || 0;
    return amount > 0 ? amount * COST_MULTIPLIER : amount;
}

function applyHappinessGain(value) {
    const amount = Number(value) || 0;
    return amount > 0 ? amount * HAPPINESS_GAIN_MULTIPLIER : amount;
}

// --- Helper Functions ---
function parseScenarioConfig(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (err) {
        return {};
    }
}

function replacePlaceholders(text, values) {
    if (!text) return '';
    return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
        const replacement = values?.[key];
        return typeof replacement === 'undefined' ? match : replacement;
    });
}

function cloneData(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

function parseProviders(value) {
    if (!value) return [];
    return String(value).split('|').map(s => s.trim()).filter(Boolean);
}

function createMap(rows, normalize) {
    return rows.reduce((acc, row) => {
        const entry = normalize ? normalize(row) : row;
        if (entry && entry.id) acc[entry.id] = entry;
        return acc;
    }, {});
}

function requireRows(rows, label, validator) {
    if (rows && rows.length && (!validator || rows.every(validator))) {
        return rows;
    }
    throw new Error(`Uploaded Life: ${label} missing or invalid`);
}

// --- Main Test Logic ---
async function runFuzzTest() {
    console.log('Starting obscenely robust fuzz test...');

    const libraryPath = path.join(__dirname, '..', 'public', 'Resources', 'library.json');
    const dataset = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));

    const scenarioRows = requireRows(dataset?.scenarios, 'scenario data', row => row?.id && row?.type);
    const jobRows = requireRows(dataset?.jobs, 'job data', row => row?.group && row?.label && row?.effect);
    const incidentRows = requireRows(dataset?.incidentEvents, 'incident events', row => row?.story);
    const goodEventRows = requireRows(dataset?.goodEvents, 'good events', row => row?.id && row?.text);
    const badEventRows = requireRows(dataset?.badEvents, 'bad events', row => row?.id && row?.text);
    const hobbyOfferRows = requireRows(dataset?.hobbyOffers, 'hobby offers', row => row?.id && row?.provider);

    const jobsByGroup = jobRows.reduce((acc, job) => {
        const group = (job.group || '').trim();
        if (group) {
            acc[group] = acc[group] || [];
            acc[group].push({ label: job.label || '', effect: job.effect || '' });
        }
        return acc;
    }, {});

    const incidentEvents = incidentRows.map(row => ({
        id: row.id || '',
        story: row.story || '',
        money: [toNumber(row.moneyMin), toNumber(row.moneyMax)],
        happiness: [toNumber(row.happinessMin), toNumber(row.happinessMax)],
    })).filter(e => e.story);

    const datasetCollections = { incidentEvents };

    const goodEventMap = createMap(goodEventRows, row => ({
        id: row.id || '',
        text: row.text || '',
        providers: parseProviders(row.providers),
        cost: [toNumber(row.costMin), toNumber(row.costMax)],
        happiness: [toNumber(row.happinessMin), toNumber(row.happinessMax)],
    }));

    const badEventMap = createMap(badEventRows, row => ({
        id: row.id || '',
        text: row.text || '',
        money: [toNumber(row.moneyMin), toNumber(row.moneyMax)],
        happiness: [toNumber(row.happinessMin), toNumber(row.happinessMax)],
    }));

    const hobbyOfferMap = createMap(hobbyOfferRows, row => ({
        id: row.id || '',
        text: row.text || '',
        provider: row.provider || '',
        cost: [toNumber(row.costMin), toNumber(row.costMax)],
        happiness: [toNumber(row.happinessMin), toNumber(row.happinessMax)],
        requiresId: parseBoolean(row.requiresId),
    }));
    const hobbyOfferList = Object.values(hobbyOfferMap);

    // --- Scenario Builder ---
    function createScenarioDefinition(row, config) {
        const type = (row.type || '').trim();
        const generateRangeValue = (range, fallback = 0) => {
            if (!Array.isArray(range) || range.length < 2) return fallback;
            return utils.weightedBetween(Number(range[0]), Number(range[1]));
        };

        const selectJobEntries = (entries, limit = 2) => {
            if (!entries || !entries.length) return [];
            const pool = entries.slice();
            const picks = [];
            while (pool.length && picks.length < limit) {
                const index = Math.floor(Math.random() * pool.length);
                picks.push(pool.splice(index, 1)[0]);
            }
            return picks;
        };

        const selectRandomEntries = (entries, limit = 2) => {
            if (!entries || !entries.length) return [];
            const pool = entries.slice();
            const picks = [];
            while (pool.length && picks.length < limit) {
                const index = Math.floor(Math.random() * pool.length);
                picks.push(pool.splice(index, 1)[0]);
            }
            return picks;
        };

        let definition = null;

        switch (type) {
            case 'jobSelection':
                definition = {
                    build: () => {
                        const jobEntries = jobsByGroup[config.jobGroup] || [];
                        const picks = selectJobEntries(jobEntries, 2);
                        const choices = picks.map(job => ({
                            label: job.label,
                            next: config.next || 'RANDOM',
                            econEffect: { name: job.effect, amount: 1000 },
                            meta: { economyMeta: { markJob: true } },
                        }));
                        return { text: row.text, details: row.details, choices };
                    }
                };
                break;
            case 'event':
                definition = {
                    build: () => ({
                        text: row.text,
                        details: row.details,
                        choices: [{ label: 'Keep going', next: config.next || 'RANDOM' }]
                    })
                };
                break;
            case 'static':
                definition = {
                    build: () => ({
                        text: row.text,
                        details: row.details,
                        choices: cloneData(config.choices || [])
                    })
                };
                break;
            case 'hobbyStarter':
                definition = {
                    build: () => {
                        let options = Array.isArray(config.options) ? config.options : [];
                        if ((config.dataSource || '').toLowerCase() === 'hobbyoffers') {
                            const count = Number(config.optionCount) || 2;
                            const entries = selectRandomEntries(hobbyOfferList, count);
                            options = entries.map(entry => ({
                                key: entry.id,
                                label: entry.provider || entry.text || entry.id,
                                description: entry.text || '',
                                next: config.next || 'RANDOM',
                                costRange: entry.cost,
                                happinessRange: entry.happiness,
                                hobby: {
                                    hobbyId: entry.id,
                                    provider: entry.provider || entry.id,
                                    requiresId: entry.requiresId,
                                }
                            }));
                        }
                        const placeholders = {};
                        const choices = options.map((option, index) => {
                            const cost = applyCostIncrease(generateRangeValue(option.costRange));
                            const key = option.key ? `${option.key}Cost` : `option${index + 1}Cost`;
                            if (key) placeholders[key] = currency.format(cost);

                            const labelText = option.description
                                ? replacePlaceholders(option.description, { cost: currency.format(cost) })
                                : option.label;

                            return {
                                label: labelText || option.label || 'Pick this hobby',
                                next: option.next || config.next || 'RANDOM',
                            };
                        });
                        return {
                            text: replacePlaceholders(row.text, placeholders),
                            details: row.details ? replacePlaceholders(row.details, placeholders) : undefined,
                            choices
                        };
                    }
                };
                break;
            case 'incidentChoice':
                definition = {
                    build: () => {
                        const datasetName = config.dataSource || 'incidentEvents';
                        const events = datasetCollections[datasetName] || incidentEvents;
                        const hit = utils.pick(events);
                        if (!hit) return { text: row.text || '', details: row.details, choices: [] };

                        const replacements = { story: hit.story || '' };
                        const template = row.text || '{{story}}';
                        return {
                            text: replacePlaceholders(template, replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [{ label: 'Handle it', next: config.next || 'RANDOM' }]
                        };
                    }
                };
                break;
            case 'datingApp':
                definition = {
                    build: () => {
                        const apps = Array.isArray(config.apps) ? config.apps : [];
                        const app = utils.pick(apps) || 'App';
                        const replacements = { app };
                        return {
                            text: replacePlaceholders(row.text, replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [{ label: 'Upload ID', next: config.next || 'RANDOM' }]
                        };
                    }
                };
                break;
            case 'relationshipOutcome':
                definition = {
                    build: (state = {}) => {
                        const method = state.datingMethod || 'inperson';
                        const chance = method === 'app' ? 0.75 : 0.25;
                        const success = Math.random() < chance;
                        if (success) {
                            const text = method === 'app' ? config.successTextApp : config.successTextInperson;
                            return {
                                text: text || '',
                                details: row.details,
                                choices: cloneData(config.successChoices || [])
                            };
                        }
                        return {
                            text: config.failureText || '',
                            details: row.details,
                            choices: cloneData(config.failureChoices || [])
                        };
                    }
                };
                break;
            case 'pendingRelationship':
                definition = {
                    build: () => ({
                        text: row.text,
                        details: row.details,
                        choices: cloneData(config.choices || [])
                    })
                };
                break;
            case 'goodEvent':
                definition = {
                    build: () => {
                        const entry = goodEventMap[config.dataId || row.id];
                        if (!entry) return { text: row.text || '', details: row.details, choices: [] };
                        const cost = applyCostIncrease(generateRangeValue(entry.cost));
                        const replacements = { cost: currency.format(cost) };
                        return {
                            text: replacePlaceholders(entry.text || row.text || '', replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [{ label: 'Join', next: 'RANDOM' }]
                        };
                    }
                };
                break;
            case 'badEvent':
                definition = {
                    build: () => {
                        const entry = badEventMap[config.dataId || row.id];
                        const text = entry?.text || row.text || '';
                        return {
                            text,
                            details: row.details,
                            choices: [{ label: 'Pay', next: 'RANDOM' }]
                        };
                    }
                };
                break;
            case 'hobbyOffer':
                definition = {
                    build: () => {
                        const entry = hobbyOfferMap[config.dataId || row.id];
                        if (!entry) return { text: row.text || '', details: row.details, choices: [] };
                        const cost = applyCostIncrease(generateRangeValue(entry.cost));
                        const replacements = { cost: currency.format(cost) };
                        return {
                            text: replacePlaceholders(entry.text || row.text || '', replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [{ label: 'Join', next: 'RANDOM' }]
                        };
                    }
                };
                break;
            case 'relationshipBreakup':
                definition = {
                    build: () => ({
                        text: row.text,
                        details: row.details,
                        choices: [{ label: 'Lean on friends', next: 'RANDOM' }]
                    })
                };
                break;
            case 'relationshipInvite':
                definition = {
                    build: () => ({
                        text: row.text,
                        details: row.details,
                        choices: [{ label: 'See where it goes', next: config.next || 'RANDOM' }]
                    })
                };
                break;
            case 'promotionOffer':
                definition = {
                    build: () => {
                        const raise = generateRangeValue(config.raiseRange);
                        const replacements = { raise: currency.format(raise) };
                        return {
                            text: replacePlaceholders(row.text, replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [{ label: 'Accept', next: 'RANDOM' }]
                        };
                    }
                };
                break;
            case 'hobbyVerification':
                definition = {
                    build: (state) => {
                        const hobby = (state.hobbies || []).find(h => h.requiresId && !h.idSubmitted);
                        if (!hobby) return { text: row.text, details: row.details, choices: [] };
                        const replacements = { hobbyName: hobby.name || '' };
                        return {
                            text: replacePlaceholders(row.text, replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [{ label: 'Submit ID', next: 'RANDOM' }]
                        };
                    }
                };
                break;
            default:
                definition = null;
                break;
        }

        if (definition) {
            definition.id = row.id;
            definition.scenarioType = type;
            definition.config = config;
        }
        return definition;
    }

    // --- Fuzzing Logic ---
    const failures = [];
    const iterations = 5000;

    function generateRandomState() {
        return {
            money: Math.random() * 10000,
            happiness: Math.random() * 10,
            hobbies: Math.random() > 0.5 ? [{ id: 'test', requiresId: true, idSubmitted: false, name: 'Test Hobby' }] : [],
            relationship: Math.random() > 0.5 ? { id: 'test' } : null,
            datingMethod: Math.random() > 0.5 ? 'app' : 'inperson',
        };
    }

    const library = scenarioRows.map(row => {
        const config = parseScenarioConfig(row.config);
        return createScenarioDefinition(row, config);
    }).filter(Boolean);

    console.log(`Fuzzing ${library.length} scenarios with ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
        const def = utils.pick(library);
        const state = generateRandomState();

        try {
            const view = def.build(state);

            if (!view.text || !view.text.trim()) {
                failures.push({
                    id: def.id,
                    reason: `Empty text in iteration ${i}`,
                    state: JSON.stringify(state)
                });
            }

            // Extra robustness check: Ensure choices are valid if present
            if (view.choices && view.choices.length > 0) {
                view.choices.forEach((c, idx) => {
                    if (!c.label) failures.push({ id: def.id, reason: `Missing label in choice ${idx}`, state: JSON.stringify(state) });
                });
            }

        } catch (err) {
            failures.push({
                id: def.id,
                reason: `Crash: ${err.message}`,
                state: JSON.stringify(state)
            });
        }

        if (failures.length > 50) break; // Stop if too many failures
    }

    if (failures.length > 0) {
        console.error(`\nFAILED: ${failures.length} issues detected.`);
        failures.slice(0, 10).forEach(f => console.error(`[${f.id}] ${f.reason} (State: ${f.state})`));
        process.exit(1);
    } else {
        console.log(`\nSUCCESS: Passed ${iterations} fuzz iterations.`);
        process.exit(0);
    }
}

runFuzzTest().catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});
