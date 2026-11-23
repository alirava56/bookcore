'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const expected='3da3f894ff4a55c20ef3ff1ae666169c1461f6fb7f0230dee55be8a22e8efcab';
const bytes=fs.readFileSync('reference/Phase_02/BookCore-Phase-02-Technical-Spike-Final-Verified.zip');
const actual=crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(actual,expected,'Phase02 reference archive integrity mismatch');
console.log('PASS authentic Phase02 archive SHA256',actual);
