const fs = require('fs');
const path = require('path');

class Camp {
    constructor(campId, location, maxCapacity, foodPackets, medicalKits, volunteers) {
        this.camp_id = campId;
        this.location = location;
        this.max_capacity = maxCapacity;
        this.food_packets = foodPackets;
        this.medical_kits = medicalKits;
        this.volunteers = volunteers || [];
        this.victims = [];
        this.food_packets_distributed = 0;
        this.medical_kits_distributed = 0;
        this.volunteers_assigned = 0; // Track assigned volunteers
    }

    isFull() {
        return this.victims.length >= this.max_capacity;
    }

    getOccupancyPercentage() {
        return this.max_capacity > 0 ? Math.round((this.victims.length / this.max_capacity) * 100) : 0;
    }

    assignVolunteer(volunteerName) {
        if (this.volunteers_assigned < this.volunteers.length) {
            this.volunteers_assigned++;
            return true;
        }
        return false;
    }
}

class Victim {
    constructor(victimId, name, age, healthCondition, assignedCamp) {
        this.victim_id = victimId;
        this.name = name;
        this.age = age;
        this.health_condition = healthCondition;
        this.assigned_camp = assignedCamp;
        this.resources_received = false;
        this.priority = healthCondition === 'critical' ? 1 : 2; // 1 = high priority
        this.distributed_by = null; // Track which volunteer distributed resources
        this.distribution_date = null;
    }
}

class DisasterReliefSystem {
    constructor(campsFile = 'camps.json', victimsFile = 'victims.json') {
        // Use paths relative to the backend directory
        const baseDir = path.dirname(path.dirname(__dirname)); // Go up from src/services to backend
        this.campsFile = path.join(baseDir, campsFile);
        this.victimsFile = path.join(baseDir, victimsFile);
        this.camps = this.loadCamps();
        this.victims = this.loadVictims();
    }

    loadCamps() {
        try {
            const camps = JSON.parse(fs.readFileSync(this.campsFile, 'utf-8'));
            camps.forEach((camp) => {
                if (!Array.isArray(camp.victims)) {
                    camp.victims = [];
                }
                camp.food_packets_distributed = typeof camp.food_packets_distributed === 'number' ? camp.food_packets_distributed : 0;
                camp.medical_kits_distributed = typeof camp.medical_kits_distributed === 'number' ? camp.medical_kits_distributed : 0;
                camp.volunteers_assigned = typeof camp.volunteers_assigned === 'number' ? camp.volunteers_assigned : 0;
                if (!Array.isArray(camp.volunteers)) {
                    camp.volunteers = [];
                }
            });
            return camps;
        } catch (error) {
            console.error('Error loading camps:', error.message);
            return [];
        }
    }

    loadVictims() {
        try {
            const victims = JSON.parse(fs.readFileSync(this.victimsFile, 'utf-8'));
            victims.forEach((victim) => {
                if (typeof victim.resources_received !== 'boolean') {
                    victim.resources_received = false;
                }
                if (typeof victim.priority !== 'number') {
                    victim.priority = victim.health_condition === 'critical' ? 1 : 2;
                }
                if (!victim.distributed_by) {
                    victim.distributed_by = null;
                }
                if (!victim.distribution_date) {
                    victim.distribution_date = null;
                }
            });
            return victims;
        } catch (error) {
            console.error('Error loading victims:', error.message);
            return [];
        }
    }

    saveCamps() {
        try {
            fs.writeFileSync(this.campsFile, JSON.stringify(this.camps, null, 4));
            return true;
        } catch (error) {
            console.error('Error saving camps:', error.message);
            return false;
        }
    }

    saveVictims() {
        try {
            fs.writeFileSync(this.victimsFile, JSON.stringify(this.victims, null, 4));
            return true;
        } catch (error) {
            console.error('Error saving victims:', error.message);
            return false;
        }
    }

    validateDataConsistency() {
        const errors = [];
        const campIds = new Set(this.camps.map(c => c.camp_id));

        this.victims.forEach(victim => {
            if (!campIds.has(victim.assigned_camp)) {
                errors.push(`Victim ${victim.victim_id} (${victim.name}) assigned to non-existent camp ${victim.assigned_camp}`);
            }
        });

        this.camps.forEach(camp => {
            camp.victims.forEach(victim => {
                const globalVictim = this.victims.find(v => v.victim_id === victim.victim_id);
                if (!globalVictim) {
                    errors.push(`Camp ${camp.camp_id} has victim ${victim.victim_id} not in global victims list`);
                }
            });
        });

        return errors;
    }

    reloadData() {
        this.camps = this.loadCamps();
        this.victims = this.loadVictims();
    }

    addCamp(camp) {
        if (this.camps.some((existing) => existing.camp_id === camp.camp_id)) {
            return [false, 'Camp ID already exists!'];
        }

        this.camps.push(camp);
        this.saveCamps();
        return [true, 'Camp added successfully!'];
    }

    registerVictim(victim, campId) {
        // Input validation
        if (!victim.name || victim.name.trim() === '') {
            return [false, 'Victim name cannot be empty.'];
        }
        if (victim.age < 0 || victim.age > 150) {
            return [false, 'Invalid age. Must be between 0 and 150.'];
        }
        if (!['normal', 'critical'].includes(victim.health_condition)) {
            return [false, 'Invalid health condition. Must be "normal" or "critical".'];
        }

        if (this.victims.some((existing) => existing.victim_id === victim.victim_id)) {
            return [false, 'Victim ID already exists!'];
        }

        // Validate camp exists
        const camp = this.camps.find(c => c.camp_id === campId);
        if (!camp) {
            return [false, 'Assigned camp does not exist.'];
        }

        if (camp.victims.length >= camp.max_capacity) {
            return [false, 'Camp is full. Cannot register victim.'];
        }

        // Set priority based on health condition
        victim.priority = victim.health_condition === 'critical' ? 1 : 2;

        camp.victims.push(victim);
        this.victims.push(victim);
        
        if (!this.saveCamps() || !this.saveVictims()) {
            return [false, 'Error saving victim data.'];
        }
        
        return [true, `Victim ${victim.name} registered successfully to camp ${campId}.`];
    }

    distributeResources(victimId) {
        const victim = this.victims.find(v => v.victim_id === victimId);
        if (!victim) {
            return [false, 'Victim not found.'];
        }

        if (victim.resources_received) {
            return [false, 'Resources have already been distributed to this victim.'];
        }

        const assignedCamp = this.camps.find(c => c.camp_id === victim.assigned_camp);
        if (!assignedCamp) {
            return [false, 'Assigned camp not found.'];
        }

        let success = false;
        let message = '';

        if (victim.health_condition === 'critical') {
            if (assignedCamp.medical_kits <= 0 || assignedCamp.food_packets <= 0) {
                const missing = [];
                if (assignedCamp.medical_kits <= 0) missing.push('medical kits');
                if (assignedCamp.food_packets <= 0) missing.push('food packets');
                
                // Check if we can distribute partial resources or show warning
                if (assignedCamp.medical_kits <= 0 && assignedCamp.food_packets > 0) {
                    message = `WARNING: Insufficient medical kits for critical victim. Only food packet available. ${missing.join(' and ')} shortage.`;
                } else if (assignedCamp.food_packets <= 0 && assignedCamp.medical_kits > 0) {
                    message = `WARNING: Insufficient food packets for critical victim. Only medical kit available. ${missing.join(' and ')} shortage.`;
                } else {
                    return [false, `Insufficient resources for critical victim. Missing: ${missing.join(' and ')}.`];
                }
            } else {
                assignedCamp.medical_kits -= 1;
                assignedCamp.food_packets -= 1;
                assignedCamp.medical_kits_distributed += 1;
                assignedCamp.food_packets_distributed += 1;
                success = true;
                message = `Food packet and medical kit allocated to critical victim ${victim.name}.`;
            }
        } else {
            if (assignedCamp.food_packets <= 0) {
                return [false, 'WARNING: No food packets available for normal victim. Please restock resources.'];
            }
            assignedCamp.food_packets -= 1;
            assignedCamp.food_packets_distributed += 1;
            success = true;
            message = `Food packet allocated to victim ${victim.name}.`;
        }

        if (success) {
            victim.resources_received = true;
            victim.distribution_date = new Date().toISOString();
            
            // Assign a volunteer if available
            if (assignedCamp.volunteers.length > 0 && assignedCamp.volunteers_assigned < assignedCamp.volunteers.length) {
                const availableVolunteerIndex = assignedCamp.volunteers_assigned;
                victim.distributed_by = assignedCamp.volunteers[availableVolunteerIndex];
                assignedCamp.volunteers_assigned++;
            }
        }

        if (!this.saveCamps() || !this.saveVictims()) {
            return [false, 'Error saving distribution data.'];
        }

        return [success, message];
    }

    generateReport() {
        const totalCamps = this.camps.length;
        const totalVictims = this.victims.length;

        if (totalCamps === 0) {
            return null;
        }

        const campOccupancy = {};
        const campResourceUsage = {};
        this.camps.forEach((camp) => {
            campOccupancy[camp.camp_id] = camp.victims.length;
            const totalResourcesDistributed = camp.food_packets_distributed + camp.medical_kits_distributed;
            campResourceUsage[camp.camp_id] = totalResourcesDistributed;
        });

        const highestOccupancyCamp = Object.keys(campOccupancy).reduce((best, key) => {
            if (!best || campOccupancy[key] > campOccupancy[best]) {
                return key;
            }
            return best;
        }, null);

        const mostResourceUsedCamp = Object.keys(campResourceUsage).reduce((best, key) => {
            if (!best || campResourceUsage[key] > campResourceUsage[best]) {
                return key;
            }
            return best;
        }, null);

        const criticalVictims = this.victims.filter((victim) => victim.health_condition === 'critical').length;
        const totalFoodDistributed = this.camps.reduce((sum, camp) => sum + (camp.food_packets_distributed || 0), 0);
        const totalMedicalDistributed = this.camps.reduce((sum, camp) => sum + (camp.medical_kits_distributed || 0), 0);
        const totalVolunteersAssigned = this.camps.reduce((sum, camp) => sum + (camp.volunteers_assigned || 0), 0);

        // Calculate occupancy percentages
        const occupancyPercentages = {};
        this.camps.forEach(camp => {
            occupancyPercentages[camp.camp_id] = camp.max_capacity > 0 ? Math.round((camp.victims.length / camp.max_capacity) * 100) : 0;
        });

        return {
            total_camps: totalCamps,
            total_victims: totalVictims,
            highest_occupancy_camp: highestOccupancyCamp ? Number(highestOccupancyCamp) : null,
            highest_occupancy_count: highestOccupancyCamp ? campOccupancy[highestOccupancyCamp] : 0,
            highest_occupancy_percentage: highestOccupancyCamp ? occupancyPercentages[highestOccupancyCamp] : 0,
            most_resource_used_camp: mostResourceUsedCamp ? Number(mostResourceUsedCamp) : null,
            most_resource_used_count: mostResourceUsedCamp ? campResourceUsage[mostResourceUsedCamp] : 0,
            total_food_remaining: this.camps.reduce((sum, camp) => sum + camp.food_packets, 0),
            total_medical_remaining: this.camps.reduce((sum, camp) => sum + camp.medical_kits, 0),
            total_food_distributed: totalFoodDistributed,
            total_medical_distributed: totalMedicalDistributed,
            total_volunteers: this.camps.reduce((sum, camp) => sum + camp.volunteers.length, 0),
            total_volunteers_assigned: totalVolunteersAssigned,
            critical_victims: criticalVictims,
            occupancy_percentages: occupancyPercentages,
            data_consistency_errors: this.validateDataConsistency() || []
        };
    }

    searchVictim(victimId) {
        return this.victims.find((victim) => victim.victim_id === victimId) || null;
    }

    updateVictim(victimId, name, age, healthCondition, campId) {
        const victim = this.victims.find((item) => item.victim_id === victimId);
        if (!victim) {
            return [false, 'Victim not found.'];
        }

        const oldCampId = victim.assigned_camp;
        victim.name = name;
        victim.age = age;
        victim.health_condition = healthCondition;
        victim.assigned_camp = campId;

        if (oldCampId !== campId) {
            const newCamp = this.camps.find((camp) => camp.camp_id === campId);
            if (!newCamp) {
                return [false, 'New camp not found.'];
            }

            if (newCamp.victims.length >= newCamp.max_capacity) {
                return [false, 'New camp is full. Cannot transfer victim.'];
            }

            const oldCamp = this.camps.find((camp) => camp.camp_id === oldCampId);
            if (oldCamp) {
                oldCamp.victims = oldCamp.victims.filter((item) => item.victim_id !== victimId);
            }
            newCamp.victims.push(victim);
        } else {
            const sameCamp = this.camps.find((camp) => camp.camp_id === campId);
            if (sameCamp) {
                const index = sameCamp.victims.findIndex((item) => item.victim_id === victimId);
                if (index !== -1) {
                    sameCamp.victims[index] = victim;
                }
            }
        }

        this.saveVictims();
        this.saveCamps();
        return [true, 'Victim updated successfully.'];
    }

    deleteVictim(victimId) {
        const victim = this.victims.find((item) => item.victim_id === victimId);
        if (!victim) {
            return [false, 'Victim not found.'];
        }

        this.victims = this.victims.filter((item) => item.victim_id !== victimId);
        const camp = this.camps.find((item) => item.camp_id === victim.assigned_camp);
        if (camp) {
            camp.victims = camp.victims.filter((item) => item.victim_id !== victimId);
        }

        this.saveVictims();
        this.saveCamps();
        return [true, 'Victim deleted successfully.'];
    }

    updateCamp(campId, location, maxCapacity, foodPackets, medicalKits, volunteers) {
        const camp = this.camps.find(c => c.camp_id === campId);
        if (!camp) {
            return [false, 'Camp not found.'];
        }

        // Validation
        if (!location || location.trim() === '') {
            return [false, 'Location cannot be empty.'];
        }
        if (maxCapacity < 1 || foodPackets < 0 || medicalKits < 0) {
            return [false, 'Invalid values: max capacity must be positive, resources cannot be negative.'];
        }

        // Check if reducing capacity would affect current victims
        if (maxCapacity < camp.victims.length) {
            return [false, 'Cannot reduce capacity below current number of victims in camp.'];
        }

        camp.location = location;
        camp.max_capacity = maxCapacity;
        camp.food_packets = foodPackets;
        camp.medical_kits = medicalKits;
        camp.volunteers = Array.isArray(volunteers) ? volunteers : [];

        if (!this.saveCamps()) {
            return [false, 'Error saving camp data.'];
        }

        return [true, 'Camp updated successfully.'];
    }

    deleteCamp(campId) {
        const campIndex = this.camps.findIndex(c => c.camp_id === campId);
        if (campIndex === -1) {
            return [false, 'Camp not found.'];
        }

        const camp = this.camps[campIndex];

        // Check if camp has victims
        if (camp.victims.length > 0) {
            return [false, 'Cannot delete camp with assigned victims. Please reassign victims first.'];
        }

        this.camps.splice(campIndex, 1);

        if (!this.saveCamps()) {
            return [false, 'Error saving camp data.'];
        }

        return [true, 'Camp deleted successfully.'];
    }

    updateCampResources(campId, foodPackets, medicalKits, volunteers) {
        const camp = this.camps.find(c => c.camp_id === campId);
        if (!camp) {
            return [false, 'Camp not found.'];
        }
        
        // Validation
        if (foodPackets < 0 || medicalKits < 0) {
            return [false, 'Resource quantities cannot be negative.'];
        }
        
        camp.food_packets = foodPackets;
        camp.medical_kits = medicalKits;
        camp.volunteers = Array.isArray(volunteers) ? volunteers : [];
        
        if (!this.saveCamps()) {
            return [false, 'Error saving camp data.'];
        }
        
        return [true, 'Resources updated successfully!'];
    }

    getPriorityVictims() {
        return this.victims
            .filter(v => !v.resources_received)
            .sort((a, b) => a.priority - b.priority); // Lower priority number = higher priority
    }

    distributeResourcesByPriority() {
        const priorityVictims = this.getPriorityVictims();
        const results = [];

        for (const victim of priorityVictims) {
            const [success, message] = this.distributeResources(victim.victim_id);
            results.push({ victim_id: victim.victim_id, name: victim.name, success, message });
            
            // Stop if we encounter a failure that indicates resource shortage
            if (!success && (message.includes('Insufficient') || message.includes('No food packets available'))) {
                break;
            }
        }

        return results;
    }
}

module.exports = {
    Camp,
    Victim,
    DisasterReliefSystem
};
