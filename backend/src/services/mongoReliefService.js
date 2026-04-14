const { mongoose } = require('../db/mongo');

const campSchema = new mongoose.Schema(
    {
        camp_id: { type: Number, required: true, unique: true },
        location: { type: String, required: true },
        max_capacity: { type: Number, required: true },
        food_packets: { type: Number, required: true },
        medical_kits: { type: Number, required: true },
        volunteers: { type: Number, required: true },
        victims: [{ type: Number }],
        food_packets_distributed: { type: Number, default: 0 },
        medical_kits_distributed: { type: Number, default: 0 }
    },
    { versionKey: false }
);

const victimSchema = new mongoose.Schema(
    {
        victim_id: { type: Number, required: true, unique: true },
        name: { type: String, required: true },
        age: { type: Number, required: true },
        health_condition: { type: String, enum: ['normal', 'critical'], required: true },
        assigned_camp: { type: Number, required: true },
        resources_received: { type: Boolean, default: false }
    },
    { versionKey: false }
);

const reportSchema = new mongoose.Schema(
    {
        report_id: { type: Number, required: true, unique: true },
        submitted_by: { type: String, enum: ['staff', 'management'], required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        response: { type: String, default: '' },
        submitted_at: { type: Date, default: Date.now },
        responded_at: { type: Date }
    },
    { versionKey: false }
);

const CampModel = mongoose.models.Camp || mongoose.model('Camp', campSchema);
const VictimModel = mongoose.models.Victim || mongoose.model('Victim', victimSchema);
const ReportModel = mongoose.models.Report || mongoose.model('Report', reportSchema);

class MongoReliefService {
    async getCampsWithVictims() {
        const camps = await CampModel.find().sort({ camp_id: 1 }).lean();
        const victims = await VictimModel.find().lean();
        
        // Populate victims for each camp
        return camps.map(camp => ({
            ...camp,
            victims: victims.filter(victim => camp.victims && camp.victims.includes(victim.victim_id))
        }));
    }

    async getCamps() {
        return CampModel.find().sort({ camp_id: 1 }).lean();
    }

    async getVictims() {
        return VictimModel.find().sort({ victim_id: 1 }).lean();
    }

    async getVictim(victimId) {
        return VictimModel.findOne({ victim_id: victimId }).lean();
    }

    async seedIfEmpty(camps, victims) {
        const [campCount, victimCount] = await Promise.all([CampModel.countDocuments(), VictimModel.countDocuments()]);
        if (campCount > 0 || victimCount > 0) {
            return;
        }

        if (Array.isArray(camps) && camps.length > 0) {
            await CampModel.insertMany(
                camps.map((camp) => ({
                    camp_id: camp.camp_id,
                    location: camp.location,
                    max_capacity: camp.max_capacity,
                    food_packets: camp.food_packets,
                    medical_kits: camp.medical_kits,
                    volunteers: camp.volunteers,
                    victims: Array.isArray(camp.victims) ? camp.victims.map((v) => v.victim_id || v) : [],
                    food_packets_distributed: camp.food_packets_distributed || 0,
                    medical_kits_distributed: camp.medical_kits_distributed || 0
                }))
            );
        }

        if (Array.isArray(victims) && victims.length > 0) {
            await VictimModel.insertMany(victims.map((victim) => ({
                ...victim,
                resources_received: typeof victim.resources_received === 'boolean' ? victim.resources_received : false
            })));
        }
    }

    async addCamp(data) {
        const exists = await CampModel.exists({ camp_id: data.camp_id });
        if (exists) {
            return [false, 'Camp ID already exists!'];
        }

        await CampModel.create({ ...data, victims: [] });
        return [true, 'Camp added successfully!'];
    }

    async registerVictim(data) {
        const victimExists = await VictimModel.exists({ victim_id: data.victim_id });
        if (victimExists) {
            return [false, 'Victim ID already exists!'];
        }

        data.resources_received = false;
        const camp = await CampModel.findOne({ camp_id: data.assigned_camp });
        if (!camp) {
            return [false, 'Camp not found.'];
        }

        if ((camp.victims || []).length >= camp.max_capacity) {
            return [false, 'Camp is full. Cannot register victim.'];
        }

        await VictimModel.create(data);
        camp.victims.push(data.victim_id);
        await camp.save();
        return [true, `Victim ${data.name} registered successfully to camp ${data.assigned_camp}.`];
    }

    async updateVictim(victimId, data) {
        const victim = await VictimModel.findOne({ victim_id: victimId });
        if (!victim) {
            return [false, 'Victim not found.'];
        }

        const nextCampId = Number(data.assigned_camp);
        if (victim.assigned_camp !== nextCampId) {
            const newCamp = await CampModel.findOne({ camp_id: nextCampId });
            if (!newCamp) {
                return [false, 'New camp not found.'];
            }

            if ((newCamp.victims || []).length >= newCamp.max_capacity) {
                return [false, 'New camp is full. Cannot transfer victim.'];
            }

            const oldCamp = await CampModel.findOne({ camp_id: victim.assigned_camp });
            if (oldCamp) {
                oldCamp.victims = (oldCamp.victims || []).filter((item) => item !== victimId);
                await oldCamp.save();
            }

            newCamp.victims = [...(newCamp.victims || []), victimId];
            await newCamp.save();
        }

        victim.name = data.name;
        victim.age = data.age;
        victim.health_condition = data.health_condition;
        victim.assigned_camp = nextCampId;
        await victim.save();

        return [true, 'Victim updated successfully.'];
    }

    async deleteVictim(victimId) {
        const victim = await VictimModel.findOne({ victim_id: victimId });
        if (!victim) {
            return [false, 'Victim not found.'];
        }

        const camp = await CampModel.findOne({ camp_id: victim.assigned_camp });
        if (camp) {
            camp.victims = (camp.victims || []).filter((item) => item !== victimId);
            await camp.save();
        }

        await VictimModel.deleteOne({ victim_id: victimId });
        return [true, 'Victim deleted successfully.'];
    }

    async distributeResources(victimId) {
        const victim = await VictimModel.findOne({ victim_id: victimId });
        if (!victim) {
            return [false, 'Victim not found.'];
        }

        const camp = await CampModel.findOne({ camp_id: victim.assigned_camp });
        if (!camp) {
            return [false, 'Camp not found.'];
        }

        if (victim.resources_received) {
            return [false, 'Resources have already been distributed to this victim.'];
        }

        if (victim.health_condition === 'critical') {
            if (camp.medical_kits <= 0 || camp.food_packets <= 0) {
                const missing = [];
                if (camp.medical_kits <= 0) missing.push('medical kits');
                if (camp.food_packets <= 0) missing.push('food packets');
                return [false, `Insufficient resources for critical victim. Missing: ${missing.join(' and ')}.`];
            }
            camp.medical_kits -= 1;
            camp.food_packets -= 1;
            camp.medical_kits_distributed = (camp.medical_kits_distributed || 0) + 1;
            camp.food_packets_distributed = (camp.food_packets_distributed || 0) + 1;
            victim.resources_received = true;
            await Promise.all([camp.save(), victim.save()]);
            return [true, `Food packet and medical kit allocated to critical victim ${victim.name}.`];
        }

        if (camp.food_packets <= 0) {
            return [false, 'No food packets available.'];
        }

        camp.food_packets -= 1;
        camp.food_packets_distributed = (camp.food_packets_distributed || 0) + 1;
        victim.resources_received = true;
        await Promise.all([camp.save(), victim.save()]);
        return [true, `Food packet allocated to victim ${victim.name}.`];
    }

    async generateReport() {
        const [camps, victims] = await Promise.all([this.getCamps(), this.getVictims()]);

        if (camps.length === 0) {
            return null;
        }

        const totalCamps = camps.length;
        const totalVictims = victims.length;
        const highestCamp = camps.reduce((best, camp) => {
            if (!best || (camp.victims || []).length > (best.victims || []).length) {
                return camp;
            }
            return best;
        }, null);

        return {
            total_camps: totalCamps,
            total_victims: totalVictims,
            highest_occupancy_camp: highestCamp ? highestCamp.camp_id : null,
            highest_occupancy_count: highestCamp ? (highestCamp.victims || []).length : 0,
            total_food_remaining: camps.reduce((sum, camp) => sum + camp.food_packets, 0),
            total_medical_remaining: camps.reduce((sum, camp) => sum + camp.medical_kits, 0),
            total_food_distributed: camps.reduce((sum, camp) => sum + (camp.food_packets_distributed || 0), 0),
            total_medical_distributed: camps.reduce((sum, camp) => sum + (camp.medical_kits_distributed || 0), 0),
            critical_victims: victims.filter((victim) => victim.health_condition === 'critical').length
        };
    }

    async getReports() {
        return ReportModel.find().sort({ submitted_at: -1 }).lean();
    }

    async getReport(reportId) {
        return ReportModel.findOne({ report_id: reportId }).lean();
    }

    async updateReportStatus(reportId, status, response) {
        const report = await ReportModel.findOne({ report_id: reportId });
        if (!report) {
            return [false, 'Report not found.'];
        }

        report.status = status;
        report.response = response;
        report.responded_at = new Date();
        await report.save();
        return [true, 'Report status updated successfully.'];
    }

    async addReport(submittedBy, title, description) {
        const lastReport = await ReportModel.findOne().sort({ report_id: -1 }).lean();
        const reportId = lastReport ? lastReport.report_id + 1 : 1;
        const report = new ReportModel({
            report_id: reportId,
            submitted_by: submittedBy,
            title,
            description
        });
        await report.save();
        return report;
    }

    async updateCampResources(campId, foodPackets, medicalKits, volunteers) {
        const camp = await CampModel.findOne({ camp_id: campId });
        if (!camp) {
            return [false, 'Camp not found.'];
        }
        
        camp.food_packets = foodPackets;
        camp.medical_kits = medicalKits;
        camp.volunteers = volunteers;
        await camp.save();
        return [true, 'Resources updated successfully!'];
    }

    async getCampVictims(campId) {
        const camp = await CampModel.findOne({ camp_id: campId }).lean();
        if (!camp) {
            return null;
        }
        
        const victims = await VictimModel.find({ victim_id: { $in: camp.victims || [] } }).lean();
        return { camp, victims };
    }
}

module.exports = {
    MongoReliefService
};
