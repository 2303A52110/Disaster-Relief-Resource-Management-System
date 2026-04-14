#!/usr/bin/env node

const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { Camp, Victim, DisasterReliefSystem } = require('./src/services/disasterReliefSystem');

const system = new DisasterReliefSystem();
const rl = readline.createInterface({ input, output });

async function askNumber(prompt) {
    const value = Number(await rl.question(prompt));
    if (Number.isNaN(value)) {
        throw new Error('Invalid number input.');
    }
    return value;
}

function printReport() {
    const report = system.generateReport();
    if (!report) {
        console.log('\nNo camps available.');
        return;
    }

    console.log('\n--- Disaster Relief Report ---');
    console.log(`Total Number of Camps: ${report.total_camps}`);
    console.log(`Total Victims Registered: ${report.total_victims}`);
    console.log(`Camp with Highest Occupancy: ${report.highest_occupancy_camp} (${report.highest_occupancy_count} victims)`);
    console.log(`Total Food Packets Remaining: ${report.total_food_remaining}`);
    console.log(`Total Medical Kits Remaining: ${report.total_medical_remaining}`);
    console.log(`Number of Critical Victims: ${report.critical_victims}`);
}

async function main() {
    while (true) {
        console.log('\n=== Smart Disaster Relief Resource Management System ===');
        console.log('1. Add New Camp');
        console.log('2. Register Victim');
        console.log('3. Distribute Resources');
        console.log('4. Search Victim by ID');
        console.log('5. Generate Report');
        console.log('6. Exit');

        const choice = await rl.question('\nEnter your choice (1-6): ');

        try {
            if (choice === '1') {
                const campId = await askNumber('Enter camp ID: ');
                const location = await rl.question('Enter camp location: ');
                const maxCapacity = await askNumber('Enter maximum capacity: ');
                const foodPackets = await askNumber('Enter number of food packets: ');
                const medicalKits = await askNumber('Enter number of medical kits: ');
                const volunteers = await askNumber('Enter number of volunteers: ');

                system.addCamp(new Camp(campId, location, maxCapacity, foodPackets, medicalKits, volunteers));
                console.log('Camp added successfully.');
            } else if (choice === '2') {
                const victimId = await askNumber('Enter victim ID: ');
                const name = await rl.question('Enter victim name: ');
                const age = await askNumber('Enter victim age: ');
                const healthCondition = (await rl.question('Enter health condition (normal/critical): ')).toLowerCase();
                const campId = await askNumber('Enter camp ID to assign: ');

                if (!['normal', 'critical'].includes(healthCondition)) {
                    console.log('Invalid health condition.');
                    continue;
                }

                const [success, message] = system.registerVictim(new Victim(victimId, name, age, healthCondition, campId), campId);
                console.log(message);
                if (!success) {
                    continue;
                }
            } else if (choice === '3') {
                const victimId = await askNumber('Enter victim ID for resource distribution: ');
                const [, message] = system.distributeResources(victimId);
                console.log(message);
            } else if (choice === '4') {
                const victimId = await askNumber('Enter victim ID to search: ');
                const victim = system.searchVictim(victimId);
                if (!victim) {
                    console.log('Victim not found.');
                } else {
                    console.log(victim);
                }
            } else if (choice === '5') {
                printReport();
            } else if (choice === '6') {
                console.log('Goodbye.');
                break;
            } else {
                console.log('Invalid choice. Please enter a number between 1 and 6.');
            }
        } catch (error) {
            console.log(error.message);
        }
    }

    rl.close();
}

main();
