#!/usr/bin/env node

const { app, system, Camp } = require('./app');

if (system.camps.length === 0) {
    console.log('Creating sample camp for testing...');
    const sampleCamp = new Camp(1, 'Test Relief Center', 50, 100, 50, 10);
    system.addCamp(sampleCamp);
    console.log('Sample camp created!');
}

console.log(`\nCurrent camps: ${system.camps.length}`);
console.log(`Current victims: ${system.victims.length}`);
console.log('\nStarting Express server...');
console.log('Open your browser to: http://localhost:5000');
console.log('\nPress Ctrl+C to stop the server\n');

app.listen(5000, '0.0.0.0');
