const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const nunjucks = require('nunjucks');
const { Camp, Victim, DisasterReliefSystem } = require('./src/services/disasterReliefSystem');
const { connectMongo, isMongoConnected } = require('./src/db/mongo');
const { MongoReliefService } = require('./src/services/mongoReliefService');

nunjucks.installJinjaCompat();

const app = express();
const system = new DisasterReliefSystem();
const mongoService = new MongoReliefService();

connectMongo().then(async (connected) => {
    if (!connected) {
        return;
    }

    try {
        await mongoService.seedIfEmpty(system.camps, system.victims);
    } catch (error) {
        console.warn('MongoDB seed skipped:', error.message);
    }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, '../frontend/static')));

app.use(
    session({
        secret: 'disaster_relief_secret_key_2026',
        resave: false,
        saveUninitialized: false
    })
);
app.use(flash());

const routeMap = {
    index: '/',
    dashboard: '/dashboard',
    camps: '/camps',
    add_camp: '/add_camp',
    manage_resources: '/manage_resources',
    camp_victims: '/camp_victims',
    victims: '/victims',
    register_victim: '/register_victim',
    distribute_resources: '/distribute_resources',
    reports: '/reports',
    search_victim: '/search_victim',
    my_camp_victims: '/my_camp_victims',
    react_console: '/react'
};

const env = nunjucks.configure(path.join(__dirname, '../frontend/templates'), {
    autoescape: true,
    express: app,
    watch: false,
    noCache: true
});

env.addGlobal('url_for', (endpoint, kwargs = {}) => {
    if (endpoint === 'static') {
        return `/static/${kwargs.filename || ''}`;
    }

    if (endpoint === 'edit_victim') {
        return `/edit_victim/${kwargs.victim_id || kwargs.victimId || ''}`;
    }

    if (endpoint === 'delete_victim') {
        return `/delete_victim/${kwargs.victim_id || kwargs.victimId || ''}`;
    }

    if (endpoint === 'manage_resources') {
        return `/manage_resources/${kwargs.campId || kwargs.camp_id || ''}`;
    }

    if (endpoint === 'camp_victims') {
        return `/camp_victims/${kwargs.campId || kwargs.camp_id || ''}`;
    }

    return routeMap[endpoint] || '/';
});

env.addFilter('title', function(value) {
    if (value == null) return '';
    return String(value)
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
});

env.addFilter('statusClass', function(value) {
    const status = String(value || '').toLowerCase();
    if (status === 'pending') return 'bg-warning';
    if (status === 'approved') return 'bg-success';
    return 'bg-danger';
});

env.addFilter('date', function(value, format = 'M/d/Y H:i') {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    const pad = (num) => String(num).padStart(2, '0');
    const replacements = {
        M: date.getMonth() + 1,
        d: pad(date.getDate()),
        Y: date.getFullYear(),
        H: pad(date.getHours()),
        i: pad(date.getMinutes())
    };

    return String(format).replace(/M|d|Y|H|i/g, (match) => replacements[match] ?? match);
});

app.use((req, res, next) => {
    const grouped = req.flash();
    const messages = [];

    Object.keys(grouped).forEach((category) => {
        grouped[category].forEach((message) => {
            messages.push({ category, message });
        });
    });

    res.locals.messages = messages;
    next();
});

async function getReactCamps() {
    if (isMongoConnected()) {
        return mongoService.getCamps();
    }

    system.reloadData();
    return system.camps;
}

async function getReactVictims() {
    if (isMongoConnected()) {
        return mongoService.getVictims();
    }

    system.reloadData();
    return system.victims;
}

async function getReactReport() {
    if (isMongoConnected()) {
        return mongoService.generateReport();
    }

    system.reloadData();
    return system.generateReport();
}

async function getReactVictim(victimId) {
    if (isMongoConnected()) {
        return mongoService.getVictim(victimId);
    }

    system.reloadData();
    return system.searchVictim(victimId);
}

async function updateReactVictim(victimId, victim) {
    if (isMongoConnected()) {
        return mongoService.updateVictim(victimId, victim);
    }

    system.reloadData();
    return system.updateVictim(victimId, victim.name, victim.age, victim.health_condition, victim.assigned_camp);
}

async function deleteReactVictim(victimId) {
    if (isMongoConnected()) {
        return mongoService.deleteVictim(victimId);
    }

    system.reloadData();
    return system.deleteVictim(victimId);
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.role) {
        res.locals.role = req.session.role;
        return next();
    }
    res.redirect('/login');
}

// Role-based middleware
function requireRole(role) {
    return function(req, res, next) {
        if (req.session.role === role) {
            return next();
        }
        req.flash('danger', 'Access denied. Insufficient permissions.');
        res.redirect('/dashboard');
    };
}

app.get('/login', (req, res) => {
    if (req.session.role) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, '../frontend/templates', 'login.html'));
});

app.post('/login', (req, res) => {
    const { role } = req.body;
    if (role === 'management' || role === 'staff') {
        req.session.role = role;
        req.flash('success', `Logged in as ${role === 'management' ? 'Management Authority' : 'Staff Member'}`);
        res.redirect('/');
    } else {
        req.flash('danger', 'Invalid role selected.');
        res.redirect('/login');
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
        }
        res.redirect('/login');
    });
});

app.get('/', requireAuth, (req, res) => {
    system.reloadData();
    const report = system.generateReport() || {};
    const homeStats = {
        total_camps: report.total_camps || 0,
        total_victims: report.total_victims || 0,
        critical_victims: report.critical_victims || 0
    };

    res.render('index.html', { home_stats: homeStats });
});

app.get('/dashboard', requireAuth, (req, res) => {
    system.reloadData();
    const report = system.generateReport() || {};
    res.render('dashboard.html', { report, camps: system.camps, victims: system.victims });
});

app.get('/camps', requireAuth, requireRole('management'), (req, res) => {
    system.reloadData();
    res.render('camps.html', { camps: system.camps });
});

app.get('/manage_resources/:campId', requireAuth, requireRole('management'), async (req, res) => {
    const campId = Number(req.params.campId);
    
    try {
        let camp;
        if (isMongoConnected()) {
            camp = await mongoService.getCamps().then(camps => camps.find(c => c.camp_id === campId));
        } else {
            system.reloadData();
            camp = system.camps.find(c => c.camp_id === campId);
        }
        
        if (!camp) {
            req.flash('danger', 'Camp not found.');
            res.redirect('/camps');
            return;
        }
        
        res.render('manage_resources.html', { camp });
    } catch (error) {
        req.flash('danger', 'Error loading camp data.');
        res.redirect('/camps');
    }
});

app.post('/manage_resources/:campId', requireAuth, requireRole('management'), async (req, res) => {
    const campId = Number(req.params.campId);
    const foodPackets = Number(req.body.food_packets);
    const medicalKits = Number(req.body.medical_kits);
    const volunteers = Number(req.body.volunteers);
    
    if ([foodPackets, medicalKits, volunteers].some(val => Number.isNaN(val) || val < 0)) {
        req.flash('danger', 'Invalid resource values. Must be non-negative numbers.');
        res.redirect(`/manage_resources/${campId}`);
        return;
    }
    
    try {
        let success, message;
        if (isMongoConnected()) {
            [success, message] = await mongoService.updateCampResources(campId, foodPackets, medicalKits, volunteers);
        } else {
            system.reloadData();
            [success, message] = system.updateCampResources(campId, foodPackets, medicalKits, volunteers);
        }
        
        req.flash(success ? 'success' : 'danger', message);
        res.redirect('/camps');
    } catch (error) {
        req.flash('danger', 'Error updating resources.');
        res.redirect('/camps');
    }
});

app.get('/camp_victims/:campId', requireAuth, async (req, res) => {
    const campId = Number(req.params.campId);
    
    try {
        let campData;
        if (isMongoConnected()) {
            const camps = await mongoService.getCampsWithVictims();
            campData = camps.find(c => c.camp_id === campId);
            if (campData) {
                campData = { camp: campData, victims: campData.victims };
            }
        } else {
            system.reloadData();
            campData = system.getCampVictims(campId);
        }
        
        if (!campData) {
            req.flash('danger', 'Camp not found.');
            res.redirect('/dashboard');
            return;
        }
        
        res.render('camp_victims.html', { camp: campData.camp, victims: campData.victims });
    } catch (error) {
        req.flash('danger', 'Error loading camp victims.');
        res.redirect('/dashboard');
    }
});

app.get('/add_camp', requireAuth, requireRole('management'), (req, res) => {
    res.render('add_camp.html');
});

app.post('/add_camp', requireAuth, requireRole('management'), (req, res) => {
    const campId = Number(req.body.camp_id);
    const location = req.body.location;
    const maxCapacity = Number(req.body.max_capacity);
    const foodPackets = Number(req.body.food_packets);
    const medicalKits = Number(req.body.medical_kits);
    const volunteers = Number(req.body.volunteers);

    if ([campId, maxCapacity, foodPackets, medicalKits, volunteers].some((value) => Number.isNaN(value)) || !location) {
        req.flash('danger', 'Invalid input. Please enter valid numeric values.');
        res.redirect('/add_camp');
        return;
    }

    if (system.camps.some((camp) => camp.camp_id === campId)) {
        req.flash('danger', 'Camp ID already exists!');
        res.redirect('/add_camp');
        return;
    }

    const camp = new Camp(campId, location, maxCapacity, foodPackets, medicalKits, volunteers);
    system.addCamp(camp);
    req.flash('success', 'Camp added successfully!');
    res.redirect('/camps');
});

app.get('/edit_camp/:campId', requireAuth, requireRole('management'), (req, res) => {
    system.reloadData();
    const campId = Number(req.params.campId);
    const camp = system.camps.find(c => c.camp_id === campId);

    if (!camp) {
        req.flash('danger', 'Camp not found.');
        res.redirect('/camps');
        return;
    }

    res.render('edit_camp.html', { camp });
});

app.post('/edit_camp/:campId', requireAuth, requireRole('management'), (req, res) => {
    system.reloadData();

    const campId = Number(req.params.campId);
    const location = req.body.location;
    const maxCapacity = Number(req.body.max_capacity);
    const foodPackets = Number(req.body.food_packets);
    const medicalKits = Number(req.body.medical_kits);
    const volunteers = req.body.volunteers ? req.body.volunteers.split(',').map(v => v.trim()) : [];

    if ([maxCapacity, foodPackets, medicalKits].some((value) => Number.isNaN(value)) || !location) {
        req.flash('danger', 'Invalid input. Please enter valid values.');
        res.redirect(`/edit_camp/${campId}`);
        return;
    }

    const [success, message] = system.updateCamp(campId, location, maxCapacity, foodPackets, medicalKits, volunteers);
    req.flash(success ? 'success' : 'danger', message);
    res.redirect(success ? '/camps' : `/edit_camp/${campId}`);
});

app.post('/delete_camp/:campId', requireAuth, requireRole('management'), (req, res) => {
    system.reloadData();
    const campId = Number(req.params.campId);
    const [success, message] = system.deleteCamp(campId);
    req.flash(success ? 'success' : 'danger', message);
    res.redirect('/camps');
});

app.get('/victims', requireAuth, requireRole('management'), (req, res) => {
    system.reloadData();
    res.render('victims.html', { victims: system.victims });
});

app.get('/my_camp_victims', requireAuth, requireRole('staff'), async (req, res) => {
    try {
        let camps;
        if (isMongoConnected()) {
            camps = await mongoService.getCampsWithVictims();
        } else {
            system.reloadData();
            camps = system.camps;
        }
        
        // For staff, show all camps with their victims
        res.render('staff_camp_victims.html', { camps });
    } catch (error) {
        req.flash('danger', 'Error loading camp data.');
        res.redirect('/dashboard');
    }
});

app.post('/update_victim_status/:victimId', requireAuth, requireRole('staff'), async (req, res) => {
    const victimId = Number(req.params.victimId);
    const healthCondition = String(req.body.health_condition || '').toLowerCase();

    if (!['normal', 'critical'].includes(healthCondition)) {
        req.flash('danger', 'Invalid health condition. Please select normal or critical.');
        res.redirect('/my_camp_victims');
        return;
    }

    try {
        let success, message;
        if (isMongoConnected()) {
            // Get current victim data
            const victim = await mongoService.getVictim(victimId);
            if (!victim) {
                req.flash('danger', 'Victim not found.');
                res.redirect('/my_camp_victims');
                return;
            }
            
            // Update only health condition
            [success, message] = await mongoService.updateVictim(victimId, {
                name: victim.name,
                age: victim.age,
                health_condition: healthCondition,
                assigned_camp: victim.assigned_camp
            });
        } else {
            system.reloadData();
            const victim = system.searchVictim(victimId);
            if (!victim) {
                req.flash('danger', 'Victim not found.');
                res.redirect('/my_camp_victims');
                return;
            }
            
            // Update only health condition
            [success, message] = system.updateVictim(victimId, victim.name, victim.age, healthCondition, victim.assigned_camp);
        }
        
        req.flash(success ? 'success' : 'danger', message);
        res.redirect('/my_camp_victims');
    } catch (error) {
        req.flash('danger', 'Error updating victim status.');
        res.redirect('/my_camp_victims');
    }
});

app.get('/register_victim', (req, res) => {
    system.reloadData();
    res.render('register_victim.html', { camps: system.camps });
});

app.post('/register_victim', (req, res) => {
    system.reloadData();

    const victimId = Number(req.body.victim_id);
    const name = req.body.name;
    const age = Number(req.body.age);
    const healthCondition = String(req.body.health_condition || '').toLowerCase();
    const campId = Number(req.body.camp_id);

    if ([victimId, age, campId].some((value) => Number.isNaN(value)) || !name) {
        req.flash('danger', 'Invalid input. Please enter valid values.');
        res.redirect('/register_victim');
        return;
    }

    if (!['normal', 'critical'].includes(healthCondition)) {
        req.flash('danger', 'Invalid health condition. Please select normal or critical.');
        res.redirect('/register_victim');
        return;
    }

    if (system.victims.some((victim) => victim.victim_id === victimId)) {
        req.flash('danger', 'Victim ID already exists!');
        res.redirect('/register_victim');
        return;
    }

    const victim = new Victim(victimId, name, age, healthCondition, campId);
    const [success, message] = system.registerVictim(victim, campId);
    req.flash(success ? 'success' : 'danger', message);
    res.redirect(success ? '/victims' : '/register_victim');
});

app.get('/distribute_resources', (req, res) => {
    system.reloadData();
    const criticalCount = system.victims.filter((victim) => victim.health_condition === 'critical').length;
    const normalCount = system.victims.filter((victim) => victim.health_condition === 'normal').length;
    res.render('distribute_resources.html', {
        victims: system.victims,
        overview: {
            total: system.victims.length,
            critical: criticalCount,
            normal: normalCount
        }
    });
});

app.post('/distribute_resources', (req, res) => {
    system.reloadData();
    const victimId = Number(req.body.victim_id);

    if (Number.isNaN(victimId)) {
        req.flash('danger', 'Invalid victim ID.');
        res.redirect('/distribute_resources');
        return;
    }

    const [success, message] = system.distributeResources(victimId);
    req.flash(success ? 'success' : 'danger', message);
    res.redirect('/distribute_resources');
});

app.post('/distribute_priority', requireAuth, requireRole('staff'), (req, res) => {
    system.reloadData();
    const results = system.distributeResourcesByPriority();
    
    if (results.length === 0) {
        req.flash('info', 'No victims waiting for resource distribution.');
    } else {
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        
        if (successCount > 0) {
            req.flash('success', `Distributed resources to ${successCount} victims by priority.`);
        }
        if (failureCount > 0) {
            req.flash('warning', `${failureCount} distributions failed due to resource shortages.`);
        }
    }
    
    res.redirect('/distribute_resources');
});

app.get('/search_victim', (req, res) => {
    res.render('search_victim.html', { victim: null });
});

app.post('/search_victim', (req, res) => {
    const victimId = Number(req.body.victim_id);

    if (Number.isNaN(victimId)) {
        req.flash('danger', 'Invalid victim ID.');
        res.render('search_victim.html', { victim: null });
        return;
    }

    const victim = system.searchVictim(victimId);
    if (!victim) {
        req.flash('warning', 'Victim not found.');
    }

    res.render('search_victim.html', { victim });
});

app.get('/edit_victim/:victimId', requireAuth, requireRole('management'), (req, res) => {
    system.reloadData();
    const victimId = Number(req.params.victimId);
    const victim = system.searchVictim(victimId);

    if (!victim) {
        req.flash('danger', 'Victim not found.');
        res.redirect('/victims');
        return;
    }

    res.render('edit_victim.html', { victim, camps: system.camps });
});

app.post('/edit_victim/:victimId', requireAuth, requireRole('management'), (req, res) => {
    system.reloadData();

    const victimId = Number(req.params.victimId);
    const name = req.body.name;
    const age = Number(req.body.age);
    const healthCondition = String(req.body.health_condition || '').toLowerCase();
    const campId = Number(req.body.camp_id);

    if ([age, campId].some((value) => Number.isNaN(value)) || !name) {
        req.flash('danger', 'Invalid input. Please enter valid values.');
        res.redirect(`/edit_victim/${victimId}`);
        return;
    }

    if (!['normal', 'critical'].includes(healthCondition)) {
        req.flash('danger', 'Invalid health condition. Please select normal or critical.');
        res.redirect(`/edit_victim/${victimId}`);
        return;
    }

    const [success, message] = system.updateVictim(victimId, name, age, healthCondition, campId);
    req.flash(success ? 'success' : 'danger', message);
    res.redirect(success ? '/victims' : `/edit_victim/${victimId}`);
});

app.post('/delete_victim/:victimId', requireAuth, requireRole('management'), (req, res) => {
    system.reloadData();
    const victimId = Number(req.params.victimId);
    const [success, message] = system.deleteVictim(victimId);
    req.flash(success ? 'success' : 'danger', message);
    res.redirect('/victims');
});

app.get('/reports', requireAuth, async (req, res) => {
    try {
        let reports = [];
        let report = null;
        if (isMongoConnected()) {
            reports = await mongoService.getReports();
            report = await mongoService.generateReport();
        } else {
            system.reloadData();
            report = system.generateReport();
        }

        res.render('reports.html', { reports, role: req.session.role, report });
    } catch (error) {
        req.flash('danger', 'Error loading reports.');
        res.redirect('/dashboard');
    }
});

app.post('/reports', requireAuth, async (req, res) => {
    const { title, description } = req.body;
    if (!title || !description) {
        req.flash('danger', 'Title and description are required.');
        return res.redirect('/reports');
    }

    try {
        if (isMongoConnected()) {
            await mongoService.addReport(req.session.role, title, description);
            req.flash('success', 'Report submitted successfully.');
        } else {
            req.flash('danger', 'Database not available. Cannot submit report.');
        }
    } catch (error) {
        req.flash('danger', 'Error submitting report.');
    }
    res.redirect('/reports');
});

app.post('/reports/:id/respond', requireAuth, requireRole('management'), async (req, res) => {
    const reportId = Number(req.params.id);
    const { status, response } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        req.flash('danger', 'Invalid status.');
        return res.redirect('/reports');
    }

    try {
        if (isMongoConnected()) {
            await mongoService.updateReportStatus(reportId, status, response);
            req.flash('success', 'Report response updated.');
        } else {
            req.flash('danger', 'Database not available.');
        }
    } catch (error) {
        req.flash('danger', 'Error updating report.');
    }
    res.redirect('/reports');
});

app.get('/react', (req, res) => {
    res.render('react.html');
});

app.get('/api/camps', requireAuth, (req, res) => {
    res.json(system.camps);
});

app.get('/api/victims', requireAuth, (req, res) => {
    res.json(system.victims);
});

app.get('/api/report', requireAuth, (req, res) => {
    res.json(system.generateReport());
});

app.get('/api/react/health', requireAuth, (req, res) => {
    res.json({ mongodb: isMongoConnected() });
});

app.get('/api/react/camps', requireAuth, async (req, res) => {
    try {
        const camps = await getReactCamps();
        res.json(camps);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/react/camps', async (req, res) => {
    const camp = {
        camp_id: Number(req.body.camp_id),
        location: req.body.location,
        max_capacity: Number(req.body.max_capacity),
        food_packets: Number(req.body.food_packets),
        medical_kits: Number(req.body.medical_kits),
        volunteers: Number(req.body.volunteers)
    };

    if ([camp.camp_id, camp.max_capacity, camp.food_packets, camp.medical_kits, camp.volunteers].some(Number.isNaN) || !camp.location) {
        res.status(400).json({ error: 'Invalid camp payload.' });
        return;
    }

    try {
        if (isMongoConnected()) {
            const [success, message] = await mongoService.addCamp(camp);
            if (!success) {
                res.status(400).json({ error: message });
                return;
            }

            res.status(201).json({ message });
            return;
        }

        system.reloadData();
        if (system.camps.some((item) => item.camp_id === camp.camp_id)) {
            res.status(400).json({ error: 'Camp ID already exists!' });
            return;
        }

        system.addCamp(new Camp(camp.camp_id, camp.location, camp.max_capacity, camp.food_packets, camp.medical_kits, camp.volunteers));
        res.status(201).json({ message: 'Camp added successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/react/victims', requireAuth, async (req, res) => {
    try {
        const victims = await getReactVictims();
        res.json(victims);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/react/victims/:victimId', requireAuth, async (req, res) => {
    const victimId = Number(req.params.victimId);
    if (Number.isNaN(victimId)) {
        res.status(400).json({ error: 'Invalid victim ID.' });
        return;
    }

    try {
        const victim = await getReactVictim(victimId);
        if (!victim) {
            res.status(404).json({ error: 'Victim not found.' });
            return;
        }

        res.json(victim);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/react/victims', async (req, res) => {
    const victim = {
        victim_id: Number(req.body.victim_id),
        name: req.body.name,
        age: Number(req.body.age),
        health_condition: String(req.body.health_condition || '').toLowerCase(),
        assigned_camp: Number(req.body.assigned_camp)
    };

    if ([victim.victim_id, victim.age, victim.assigned_camp].some(Number.isNaN) || !victim.name) {
        res.status(400).json({ error: 'Invalid victim payload.' });
        return;
    }

    if (!['normal', 'critical'].includes(victim.health_condition)) {
        res.status(400).json({ error: 'Invalid health condition. Use normal or critical.' });
        return;
    }

    try {
        if (isMongoConnected()) {
            const [success, message] = await mongoService.registerVictim(victim);
            if (!success) {
                res.status(400).json({ error: message });
                return;
            }

            res.status(201).json({ message });
            return;
        }

        system.reloadData();
        const [success, message] = system.registerVictim(
            new Victim(victim.victim_id, victim.name, victim.age, victim.health_condition, victim.assigned_camp),
            victim.assigned_camp
        );

        if (!success) {
            res.status(400).json({ error: message });
            return;
        }

        res.status(201).json({ message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/react/victims/:victimId', async (req, res) => {
    const victimId = Number(req.params.victimId);
    const victim = {
        name: req.body.name,
        age: Number(req.body.age),
        health_condition: String(req.body.health_condition || '').toLowerCase(),
        assigned_camp: Number(req.body.assigned_camp)
    };

    if (Number.isNaN(victimId)) {
        res.status(400).json({ error: 'Invalid victim ID.' });
        return;
    }

    if ([victim.age, victim.assigned_camp].some(Number.isNaN) || !victim.name) {
        res.status(400).json({ error: 'Invalid victim payload.' });
        return;
    }

    if (!['normal', 'critical'].includes(victim.health_condition)) {
        res.status(400).json({ error: 'Invalid health condition. Use normal or critical.' });
        return;
    }

    try {
        const [success, message] = await updateReactVictim(victimId, victim);
        if (!success) {
            res.status(400).json({ error: message });
            return;
        }

        res.json({ message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/react/victims/:victimId', async (req, res) => {
    const victimId = Number(req.params.victimId);
    if (Number.isNaN(victimId)) {
        res.status(400).json({ error: 'Invalid victim ID.' });
        return;
    }

    try {
        const [success, message] = await deleteReactVictim(victimId);
        if (!success) {
            res.status(400).json({ error: message });
            return;
        }

        res.json({ message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/react/distribute', async (req, res) => {
    const victimId = Number(req.body.victim_id);
    if (Number.isNaN(victimId)) {
        res.status(400).json({ error: 'Invalid victim ID.' });
        return;
    }

    try {
        if (isMongoConnected()) {
            const [success, message] = await mongoService.distributeResources(victimId);
            if (!success) {
                res.status(400).json({ error: message });
                return;
            }

            res.json({ message });
            return;
        }

        system.reloadData();
        const [success, message] = system.distributeResources(victimId);
        if (!success) {
            res.status(400).json({ error: message });
            return;
        }

        res.json({ message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/react/report', requireAuth, async (req, res) => {
    try {
        const report = await getReactReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

if (require.main === module) {
    app.listen(5000, '0.0.0.0', () => {
        console.log('Server running at http://localhost:5000');
    });
}

module.exports = {
    app,
    system,
    Camp
};
