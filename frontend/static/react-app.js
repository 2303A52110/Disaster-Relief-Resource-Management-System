(() => {
    const { useEffect, useMemo, useState } = React;

    const emptyCampForm = {
        camp_id: '',
        location: '',
        max_capacity: '',
        food_packets: '',
        medical_kits: '',
        volunteers: ''
    };

    const emptyVictimForm = {
        victim_id: '',
        name: '',
        age: '',
        health_condition: 'normal',
        assigned_camp: ''
    };

    const emptyEditForm = {
        victim_id: '',
        name: '',
        age: '',
        health_condition: 'normal',
        assigned_camp: ''
    };

    function MetricCard({ label, value, tone, hint }) {
        return (
            <div className="col-md-6 col-xl-3">
                <div className={`smart-metric smart-metric-${tone}`}>
                    <p className="smart-metric-label">{label}</p>
                    <h3>{value}</h3>
                    <span>{hint}</span>
                </div>
            </div>
        );
    }

    function ResourceBadge({ value, lowText, healthyText, threshold }) {
        const low = value <= threshold;
        return <span className={`badge ${low ? 'text-bg-danger' : 'text-bg-success'}`}>{low ? lowText : healthyText}</span>;
    }

    function SmartReliefPortal() {
        const [status, setStatus] = useState('Checking backend...');
        const [activeRole, setActiveRole] = useState('admin');
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState('');
        const [notice, setNotice] = useState(null);
        const [camps, setCamps] = useState([]);
        const [victims, setVictims] = useState([]);
        const [report, setReport] = useState(null);
        const [campForm, setCampForm] = useState(emptyCampForm);
        const [victimForm, setVictimForm] = useState(emptyVictimForm);
        const [editVictimForm, setEditVictimForm] = useState(emptyEditForm);
        const [distributeId, setDistributeId] = useState('');
        const [lookupId, setLookupId] = useState('');
        const [portalVictim, setPortalVictim] = useState(null);

        async function fetchJson(url, options) {
            const response = await fetch(url, options);
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Request failed.');
            }

            return payload;
        }

        async function loadAll() {
            setLoading(true);
            setError('');

            try {
                const [health, campData, victimData, reportData] = await Promise.all([
                    fetchJson('/api/react/health'),
                    fetchJson('/api/react/camps'),
                    fetchJson('/api/react/victims'),
                    fetchJson('/api/react/report')
                ]);

                setStatus(health.mongodb ? 'MongoDB mode active' : 'JSON fallback mode active');
                setCamps(campData);
                setVictims(victimData);
                setReport(reportData);
            } catch (err) {
                setError(err.message || 'Unable to load data.');
            } finally {
                setLoading(false);
            }
        }

        useEffect(() => {
            loadAll();
        }, []);

        const criticalCount = useMemo(
            () => victims.filter((victim) => victim.health_condition === 'critical').length,
            [victims]
        );

        const availableSlots = useMemo(
            () => camps.reduce((sum, camp) => sum + Math.max(0, camp.max_capacity - (camp.victims || []).length), 0),
            [camps]
        );

        const alertCamps = useMemo(
            () =>
                camps.filter((camp) => {
                    const occupancyRate = camp.max_capacity ? ((camp.victims || []).length / camp.max_capacity) * 100 : 0;
                    return occupancyRate >= 85 || camp.food_packets <= 20 || camp.medical_kits <= 10;
                }),
            [camps]
        );

        const highestCamp = useMemo(() => {
            if (!report || !report.highest_occupancy_camp) {
                return null;
            }

            return camps.find((camp) => camp.camp_id === report.highest_occupancy_camp) || null;
        }, [camps, report]);

        const portalCamp = useMemo(() => {
            if (!portalVictim) {
                return null;
            }

            return camps.find((camp) => camp.camp_id === portalVictim.assigned_camp) || null;
        }, [camps, portalVictim]);

        function pushNotice(type, message) {
            setNotice({ type, message });
        }

        function resetEditVictim() {
            setEditVictimForm(emptyEditForm);
        }

        function selectVictimForEditing(victim) {
            setEditVictimForm({
                victim_id: String(victim.victim_id),
                name: victim.name,
                age: String(victim.age),
                health_condition: victim.health_condition,
                assigned_camp: String(victim.assigned_camp)
            });
            setActiveRole('admin');
            pushNotice('info', `Editing victim ${victim.victim_id}.`);
        }

        async function handleAddCamp(event) {
            event.preventDefault();
            setError('');

            try {
                const payload = {
                    camp_id: Number(campForm.camp_id),
                    location: campForm.location.trim(),
                    max_capacity: Number(campForm.max_capacity),
                    food_packets: Number(campForm.food_packets),
                    medical_kits: Number(campForm.medical_kits),
                    volunteers: Number(campForm.volunteers)
                };

                const result = await fetchJson('/api/react/camps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                setCampForm(emptyCampForm);
                pushNotice('success', result.message);
                await loadAll();
            } catch (err) {
                setError(err.message);
            }
        }

        async function handleRegisterVictim(event) {
            event.preventDefault();
            setError('');

            try {
                const payload = {
                    victim_id: Number(victimForm.victim_id),
                    name: victimForm.name.trim(),
                    age: Number(victimForm.age),
                    health_condition: victimForm.health_condition,
                    assigned_camp: Number(victimForm.assigned_camp)
                };

                const result = await fetchJson('/api/react/victims', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                setVictimForm(emptyVictimForm);
                pushNotice('success', result.message);
                await loadAll();
            } catch (err) {
                setError(err.message);
            }
        }

        async function handleDistribute(event, overrideVictimId) {
            event.preventDefault();
            setError('');

            try {
                const victimId = Number(overrideVictimId || distributeId);
                const result = await fetchJson('/api/react/distribute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ victim_id: victimId })
                });

                setDistributeId('');
                pushNotice('success', result.message);
                await loadAll();

                if (portalVictim && portalVictim.victim_id === victimId) {
                    await handleLookup(null, victimId, false);
                }
            } catch (err) {
                setError(err.message);
            }
        }

        async function handleLookup(event, overrideVictimId, showSuccess = true) {
            if (event) {
                event.preventDefault();
            }

            setError('');

            try {
                const victimId = Number(overrideVictimId || lookupId);
                const victim = await fetchJson(`/api/react/victims/${victimId}`);
                setPortalVictim(victim);
                setLookupId(String(victimId));
                if (showSuccess) {
                    pushNotice('success', `Victim ${victim.victim_id} loaded.`);
                }
            } catch (err) {
                setPortalVictim(null);
                setError(err.message);
            }
        }

        async function handleUpdateVictim(event) {
            event.preventDefault();
            setError('');

            try {
                const victimId = Number(editVictimForm.victim_id);
                const payload = {
                    name: editVictimForm.name.trim(),
                    age: Number(editVictimForm.age),
                    health_condition: editVictimForm.health_condition,
                    assigned_camp: Number(editVictimForm.assigned_camp)
                };

                const result = await fetchJson(`/api/react/victims/${victimId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                pushNotice('success', result.message);
                await loadAll();

                if (portalVictim && portalVictim.victim_id === victimId) {
                    await handleLookup(null, victimId, false);
                }
            } catch (err) {
                setError(err.message);
            }
        }

        async function handleDeleteVictim(victimId) {
            setError('');
            if (!window.confirm(`Delete victim ${victimId}?`)) {
                return;
            }

            try {
                const result = await fetchJson(`/api/react/victims/${victimId}`, {
                    method: 'DELETE'
                });

                pushNotice('success', result.message);
                await loadAll();

                if (portalVictim && portalVictim.victim_id === victimId) {
                    setPortalVictim(null);
                    setLookupId('');
                }

                if (String(victimId) === editVictimForm.victim_id) {
                    resetEditVictim();
                }
            } catch (err) {
                setError(err.message);
            }
        }

        const victimPortalView = (
            <div className="row g-4">
                <div className="col-lg-5">
                    <div className="smart-panel h-100">
                        <div className="smart-panel-header">
                            <div>
                                <p className="smart-eyebrow">Victim access</p>
                                <h4>Find your assignment</h4>
                            </div>
                            <span className="badge text-bg-light">Self-service</span>
                        </div>
                        <form className="d-grid gap-3" onSubmit={handleLookup}>
                            <label className="form-label mb-0">
                                Victim ID
                                <input
                                    className="form-control mt-2"
                                    value={lookupId}
                                    onChange={(event) => setLookupId(event.target.value)}
                                    placeholder="Enter your victim ID"
                                    required
                                />
                            </label>
                            <button className="btn btn-primary" type="submit">Open Victim Portal</button>
                        </form>
                        <div className="smart-tip mt-3">
                            Use your registered victim ID to review your camp, health priority, and support availability.
                        </div>
                    </div>
                </div>
                <div className="col-lg-7">
                    <div className="smart-panel h-100">
                        {!portalVictim ? (
                            <div className="smart-empty-state">
                                <h4>No victim selected</h4>
                                <p>Search with a victim ID to open the personal relief view.</p>
                            </div>
                        ) : (
                            <>
                                <div className="smart-panel-header align-items-start">
                                    <div>
                                        <p className="smart-eyebrow">Current assignment</p>
                                        <h4>{portalVictim.name}</h4>
                                        <p className="text-muted mb-0">Victim ID {portalVictim.victim_id}</p>
                                    </div>
                                    <span className={`badge ${portalVictim.health_condition === 'critical' ? 'text-bg-danger' : 'text-bg-success'}`}>
                                        {portalVictim.health_condition}
                                    </span>
                                </div>
                                <div className="row g-3 mb-4">
                                    <div className="col-md-6">
                                        <div className="smart-info-tile">
                                            <span>Assigned camp</span>
                                            <strong>{portalCamp ? portalCamp.location : `Camp ${portalVictim.assigned_camp}`}</strong>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="smart-info-tile">
                                            <span>Age</span>
                                            <strong>{portalVictim.age}</strong>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="smart-info-tile">
                                            <span>Food stock at camp</span>
                                            <strong>{portalCamp ? portalCamp.food_packets : 'N/A'}</strong>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="smart-info-tile">
                                            <span>Medical kits at camp</span>
                                            <strong>{portalCamp ? portalCamp.medical_kits : 'N/A'}</strong>
                                        </div>
                                    </div>
                                </div>
                                <div className="smart-portal-actions">
                                    <button className="btn btn-warning" onClick={(event) => handleDistribute(event, portalVictim.victim_id)}>
                                        Request Immediate Support
                                    </button>
                                    <button className="btn btn-outline-primary" onClick={(event) => {
                                        setEditVictimForm({
                                            victim_id: String(portalVictim.victim_id),
                                            name: portalVictim.name,
                                            age: String(portalVictim.age),
                                            health_condition: portalVictim.health_condition,
                                            assigned_camp: String(portalVictim.assigned_camp)
                                        });
                                        setActiveRole('admin');
                                        event.preventDefault();
                                    }}>
                                        Open in Admin Editor
                                    </button>
                                </div>
                                <p className="smart-tip mb-0 mt-3">
                                    {portalVictim.health_condition === 'critical'
                                        ? 'Critical cases are prioritized for medical kit allocation.'
                                        : 'Normal cases are prioritized for food packet allocation.'}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );

        const adminView = (
            <>
                <div className="row g-4 mb-4">
                    <div className="col-xl-8">
                        <div className="smart-command-center h-100">
                            <div>
                                <p className="smart-eyebrow text-light">Admin command center</p>
                                <h3>Coordinate camps, victims, and resource dispatch from one screen.</h3>
                                <p className="mb-0 text-light-emphasis">
                                    The portal highlights pressure points across camps so admins can act before shortages escalate.
                                </p>
                            </div>
                            <div className="smart-command-meta">
                                <span>{status}</span>
                                <span>{alertCamps.length} camp alerts</span>
                            </div>
                        </div>
                    </div>
                    <div className="col-xl-4">
                        <div className="smart-panel h-100">
                            <div className="smart-panel-header">
                                <div>
                                    <p className="smart-eyebrow">Live signal</p>
                                    <h4>Top occupancy</h4>
                                </div>
                            </div>
                            {highestCamp ? (
                                <div className="smart-priority-card">
                                    <strong>{highestCamp.location}</strong>
                                    <span>
                                        Camp {highestCamp.camp_id} with {report.highest_occupancy_count} assigned victims
                                    </span>
                                </div>
                            ) : (
                                <p className="text-muted mb-0">No occupancy signal available yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="row g-4 mb-4">
                    <div className="col-lg-4">
                        <div className="smart-panel h-100">
                            <div className="smart-panel-header">
                                <div>
                                    <p className="smart-eyebrow">Operations</p>
                                    <h4>Add relief camp</h4>
                                </div>
                            </div>
                            <form className="row g-3" onSubmit={handleAddCamp}>
                                <div className="col-6">
                                    <input className="form-control" placeholder="Camp ID" value={campForm.camp_id} onChange={(event) => setCampForm({ ...campForm, camp_id: event.target.value })} required />
                                </div>
                                <div className="col-6">
                                    <input className="form-control" placeholder="Volunteers" value={campForm.volunteers} onChange={(event) => setCampForm({ ...campForm, volunteers: event.target.value })} required />
                                </div>
                                <div className="col-12">
                                    <input className="form-control" placeholder="Location" value={campForm.location} onChange={(event) => setCampForm({ ...campForm, location: event.target.value })} required />
                                </div>
                                <div className="col-4">
                                    <input className="form-control" placeholder="Capacity" value={campForm.max_capacity} onChange={(event) => setCampForm({ ...campForm, max_capacity: event.target.value })} required />
                                </div>
                                <div className="col-4">
                                    <input className="form-control" placeholder="Food" value={campForm.food_packets} onChange={(event) => setCampForm({ ...campForm, food_packets: event.target.value })} required />
                                </div>
                                <div className="col-4">
                                    <input className="form-control" placeholder="Medical" value={campForm.medical_kits} onChange={(event) => setCampForm({ ...campForm, medical_kits: event.target.value })} required />
                                </div>
                                <div className="col-12">
                                    <button className="btn btn-primary w-100" type="submit">Create Camp</button>
                                </div>
                            </form>
                        </div>
                    </div>
                    <div className="col-lg-4">
                        <div className="smart-panel h-100">
                            <div className="smart-panel-header">
                                <div>
                                    <p className="smart-eyebrow">Registration</p>
                                    <h4>Add victim</h4>
                                </div>
                            </div>
                            <form className="row g-3" onSubmit={handleRegisterVictim}>
                                <div className="col-6">
                                    <input className="form-control" placeholder="Victim ID" value={victimForm.victim_id} onChange={(event) => setVictimForm({ ...victimForm, victim_id: event.target.value })} required />
                                </div>
                                <div className="col-6">
                                    <input className="form-control" placeholder="Age" value={victimForm.age} onChange={(event) => setVictimForm({ ...victimForm, age: event.target.value })} required />
                                </div>
                                <div className="col-12">
                                    <input className="form-control" placeholder="Full name" value={victimForm.name} onChange={(event) => setVictimForm({ ...victimForm, name: event.target.value })} required />
                                </div>
                                <div className="col-6">
                                    <select className="form-select" value={victimForm.health_condition} onChange={(event) => setVictimForm({ ...victimForm, health_condition: event.target.value })}>
                                        <option value="normal">Normal</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                <div className="col-6">
                                    <select className="form-select" value={victimForm.assigned_camp} onChange={(event) => setVictimForm({ ...victimForm, assigned_camp: event.target.value })} required>
                                        <option value="">Assign camp</option>
                                        {camps.map((camp) => (
                                            <option key={camp.camp_id} value={camp.camp_id}>
                                                {camp.location} ({camp.camp_id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-12">
                                    <button className="btn btn-success w-100" type="submit">Register Victim</button>
                                </div>
                            </form>
                        </div>
                    </div>
                    <div className="col-lg-4">
                        <div className="smart-panel h-100">
                            <div className="smart-panel-header">
                                <div>
                                    <p className="smart-eyebrow">Dispatch</p>
                                    <h4>Allocate resources</h4>
                                </div>
                            </div>
                            <form className="d-grid gap-3" onSubmit={handleDistribute}>
                                <input className="form-control" placeholder="Victim ID" value={distributeId} onChange={(event) => setDistributeId(event.target.value)} required />
                                <button className="btn btn-warning" type="submit">Dispatch Aid</button>
                            </form>
                            <div className="smart-alert-stack mt-4">
                                {alertCamps.length === 0 ? (
                                    <div className="smart-tip mb-0">No critical camp alerts right now.</div>
                                ) : (
                                    alertCamps.slice(0, 4).map((camp) => (
                                        <div key={camp.camp_id} className="smart-alert-item">
                                            <strong>{camp.location}</strong>
                                            <span>
                                                Occupancy {(camp.max_capacity ? (((camp.victims || []).length / camp.max_capacity) * 100).toFixed(0) : 0)}% | Food {camp.food_packets} | Medical {camp.medical_kits}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="row g-4 mb-4">
                    <div className="col-lg-5">
                        <div className="smart-panel h-100">
                            <div className="smart-panel-header">
                                <div>
                                    <p className="smart-eyebrow">Edit victim</p>
                                    <h4>Update placement or health status</h4>
                                </div>
                                {editVictimForm.victim_id ? (
                                    <button className="btn btn-sm btn-outline-secondary" onClick={resetEditVictim}>Clear</button>
                                ) : null}
                            </div>
                            {editVictimForm.victim_id ? (
                                <form className="row g-3" onSubmit={handleUpdateVictim}>
                                    <div className="col-6">
                                        <input className="form-control" value={editVictimForm.victim_id} disabled />
                                    </div>
                                    <div className="col-6">
                                        <input className="form-control" placeholder="Age" value={editVictimForm.age} onChange={(event) => setEditVictimForm({ ...editVictimForm, age: event.target.value })} required />
                                    </div>
                                    <div className="col-12">
                                        <input className="form-control" placeholder="Full name" value={editVictimForm.name} onChange={(event) => setEditVictimForm({ ...editVictimForm, name: event.target.value })} required />
                                    </div>
                                    <div className="col-6">
                                        <select className="form-select" value={editVictimForm.health_condition} onChange={(event) => setEditVictimForm({ ...editVictimForm, health_condition: event.target.value })}>
                                            <option value="normal">Normal</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                    </div>
                                    <div className="col-6">
                                        <select className="form-select" value={editVictimForm.assigned_camp} onChange={(event) => setEditVictimForm({ ...editVictimForm, assigned_camp: event.target.value })} required>
                                            {camps.map((camp) => (
                                                <option key={camp.camp_id} value={camp.camp_id}>
                                                    {camp.location} ({camp.camp_id})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <button className="btn btn-dark w-100" type="submit">Save Victim Changes</button>
                                    </div>
                                </form>
                            ) : (
                                <div className="smart-empty-state compact">
                                    <h4>No victim selected</h4>
                                    <p>Select a victim from the table to edit their details.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="col-lg-7">
                        <div className="smart-panel h-100">
                            <div className="smart-panel-header">
                                <div>
                                    <p className="smart-eyebrow">Camp status</p>
                                    <h4>Capacity and stock overview</h4>
                                </div>
                            </div>
                            <div className="table-responsive">
                                <table className="table align-middle smart-table">
                                    <thead>
                                        <tr>
                                            <th>Camp</th>
                                            <th>Occupancy</th>
                                            <th>Food</th>
                                            <th>Medical</th>
                                            <th>Volunteers</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {camps.map((camp) => {
                                            const occupancyCount = (camp.victims || []).length;
                                            const occupancyRate = camp.max_capacity ? (occupancyCount / camp.max_capacity) * 100 : 0;

                                            return (
                                                <tr key={camp.camp_id}>
                                                    <td>
                                                        <strong>{camp.location}</strong>
                                                        <div className="text-muted small">Camp {camp.camp_id}</div>
                                                    </td>
                                                    <td>
                                                        <div className="smart-occupancy-bar">
                                                            <div style={{ width: `${Math.min(100, occupancyRate)}%` }} />
                                                        </div>
                                                        <span className="small text-muted">{occupancyCount} / {camp.max_capacity}</span>
                                                    </td>
                                                    <td><ResourceBadge value={camp.food_packets} threshold={20} lowText="Low food" healthyText={`${camp.food_packets} ready`} /></td>
                                                    <td><ResourceBadge value={camp.medical_kits} threshold={10} lowText="Low medical" healthyText={`${camp.medical_kits} ready`} /></td>
                                                    <td>{camp.volunteers}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="smart-panel">
                    <div className="smart-panel-header">
                        <div>
                            <p className="smart-eyebrow">Victim registry</p>
                            <h4>Manage assigned victims</h4>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table align-middle smart-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Age</th>
                                    <th>Status</th>
                                    <th>Assigned camp</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {victims.map((victim) => {
                                    const camp = camps.find((item) => item.camp_id === victim.assigned_camp);

                                    return (
                                        <tr key={victim.victim_id}>
                                            <td>{victim.victim_id}</td>
                                            <td>{victim.name}</td>
                                            <td>{victim.age}</td>
                                            <td>
                                                <span className={`badge ${victim.health_condition === 'critical' ? 'text-bg-danger' : 'text-bg-success'}`}>
                                                    {victim.health_condition}
                                                </span>
                                            </td>
                                            <td>{camp ? camp.location : `Camp ${victim.assigned_camp}`}</td>
                                            <td className="text-end">
                                                <div className="smart-actions-inline">
                                                    <button className="btn btn-sm btn-outline-primary" onClick={() => selectVictimForEditing(victim)}>Edit</button>
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteVictim(victim.victim_id)}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );

        return (
            <div className="smart-relief-shell">
                <div className="smart-hero">
                    <div className="smart-hero-copy">
                        <span className="smart-signal-pill">Smart coordination layer</span>
                        <h1>Disaster relief management for admins and victims.</h1>
                        <p>
                            Run camp operations, monitor shortages, and give victims a direct view into their assigned support system from the same full-stack interface.
                        </p>
                    </div>
                    <div className="smart-role-switch" role="tablist" aria-label="Portal role selector">
                        <button className={`smart-role-tab ${activeRole === 'admin' ? 'active' : ''}`} onClick={() => setActiveRole('admin')}>Admin view</button>
                        <button className={`smart-role-tab ${activeRole === 'victim' ? 'active' : ''}`} onClick={() => setActiveRole('victim')}>Victim view</button>
                    </div>
                </div>

                <div className="row g-3 mb-4">
                    <MetricCard label="Relief camps" value={report ? report.total_camps : camps.length} tone="sea" hint={`${availableSlots} open slots across network`} />
                    <MetricCard label="Registered victims" value={report ? report.total_victims : victims.length} tone="sand" hint="Live registry count" />
                    <MetricCard label="Critical cases" value={criticalCount} tone="coral" hint="Requires medical prioritization" />
                    <MetricCard label="Resource alerts" value={alertCamps.length} tone="storm" hint="Camps needing attention" />
                </div>

                {(error || notice) && (
                    <div className={`alert ${error ? 'alert-danger' : notice.type === 'success' ? 'alert-success' : 'alert-info'} border-0 shadow-sm`}>
                        {error || notice.message}
                    </div>
                )}

                <div className="smart-toolbar mb-4">
                    <div>
                        <strong>{status}</strong>
                        <span className="d-block text-muted small">The interface uses the same APIs for MongoDB and local fallback storage.</span>
                    </div>
                    <div className="smart-toolbar-metrics">
                        <span>Food remaining: {report ? report.total_food_remaining : camps.reduce((sum, camp) => sum + camp.food_packets, 0)}</span>
                        <span>Medical remaining: {report ? report.total_medical_remaining : camps.reduce((sum, camp) => sum + camp.medical_kits, 0)}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="smart-loading-state">
                        <div className="spinner-border text-primary" role="status" />
                        <p className="mb-0">Loading live relief data...</p>
                    </div>
                ) : activeRole === 'admin' ? adminView : victimPortalView}
            </div>
        );
    }

    const rootElement = document.getElementById('react-root');
    if (rootElement) {
        ReactDOM.createRoot(rootElement).render(<SmartReliefPortal />);
    }
})();
