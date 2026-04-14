#!/usr/bin/env node

const request = require('supertest');
const { app, system } = require('../app');

console.log('='.repeat(60));
console.log('DISASTER RELIEF SYSTEM - ERROR CHECK');
console.log('='.repeat(60));

const errors = [];

function logPass(message) {
    console.log(`  OK ${message}`);
}

function logFail(message) {
    console.log(`  FAIL ${message}`);
}

(async () => {
    console.log('\n[TEST 1] Checking data loading...');
    try {
        system.reloadData();
        logPass(`Camps loaded: ${system.camps.length}`);
        logPass(`Victims loaded: ${system.victims.length}`);
    } catch (error) {
        errors.push(`Data loading error: ${error.message}`);
        logFail(error.message);
    }

    console.log('\n[TEST 2] Checking camps data structure...');
    try {
        for (const camp of system.camps) {
            ['camp_id', 'location', 'max_capacity', 'food_packets', 'medical_kits', 'volunteers', 'victims'].forEach((key) => {
                if (!(key in camp)) {
                    errors.push(`Camp ${camp.camp_id} missing key: ${key}`);
                    logFail(`Camp ${camp.camp_id} missing key: ${key}`);
                }
            });
        }
        if (!errors.length) {
            logPass('Camp structure valid');
        }
    } catch (error) {
        errors.push(`Camp structure error: ${error.message}`);
        logFail(error.message);
    }

    console.log('\n[TEST 3] Checking victims data structure...');
    try {
        for (const victim of system.victims) {
            ['victim_id', 'name', 'age', 'health_condition', 'assigned_camp'].forEach((key) => {
                if (!(key in victim)) {
                    errors.push(`Victim ${victim.victim_id} missing key: ${key}`);
                    logFail(`Victim ${victim.victim_id} missing key: ${key}`);
                }
            });
        }
        if (!errors.length) {
            logPass('Victim structure valid');
        }
    } catch (error) {
        errors.push(`Victim structure error: ${error.message}`);
        logFail(error.message);
    }

    console.log('\n[TEST 4] Checking report generation...');
    try {
        const report = system.generateReport();
        if (report) {
            logPass(`Report generated: camps=${report.total_camps}, victims=${report.total_victims}`);
        } else {
            logPass('Report is null (no camps)');
        }
    } catch (error) {
        errors.push(`Report generation error: ${error.message}`);
        logFail(error.message);
    }

    console.log('\n[TEST 5] Checking routes...');
    const agent = request.agent(app);
    await agent.post('/login').send({ role: 'management' });

    const routes = ['/', '/camps', '/victims', '/dashboard', '/reports', '/search_victim', '/distribute_resources'];
    for (const route of routes) {
        try {
            const response = await agent.get(route);
            if (response.statusCode === 200) {
                logPass(`${route} -> 200`);
            } else {
                errors.push(`Route ${route} returned ${response.statusCode}`);
                logFail(`${route} -> ${response.statusCode}`);
            }
        } catch (error) {
            errors.push(`Route ${route} error: ${error.message}`);
            logFail(`${route} -> ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    if (errors.length) {
        console.log(`\nFOUND ${errors.length} ERROR(S):\n`);
        errors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error}`);
        });
        process.exit(1);
    }

    console.log('\nALL TESTS PASSED.');
    process.exit(0);
})();
