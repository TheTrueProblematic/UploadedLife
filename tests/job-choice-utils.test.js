#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

const jobChoiceUtils = require(path.join(__dirname, '..', 'public', 'jobChoices.js'));

const mockJobs = Array.from({length: 10}).map((_, idx) => ({label: `Job ${idx}`, effect: `Effect ${idx}`}));

for (let i = 0; i < 25; i += 1) {
    const picks = jobChoiceUtils.selectRandomJobs(mockJobs, 2);
    assert.strictEqual(picks.length, Math.min(2, mockJobs.length), 'Job selection should cap at the requested count');
    const labels = new Set(picks.map((job) => job.label));
    assert.strictEqual(labels.size, picks.length, 'Job selection should not repeat the same job');
}

console.log('job-choice-utils.test.js passed');
