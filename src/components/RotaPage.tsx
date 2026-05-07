'use client';
import { useState, useMemo } from 'react';
import { storeExt } from '@/lib/store';
import { formatDate, formatTime } from '@/lib/ui';

// ── Types ────────────────────────────────────────────────────────────────────

interface AvailabilitySlot {
  staffId: string;
  dayOfWeek: number; // 0=Sun
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
}

interface UnavailableDate {
  staffId: string;
  date: string; // ISO date
  reason: string;
}

// Seed availability data
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

let _availability: AvailabilitySlot[] = [
  { staffId:'st1', dayOfWeek:1, startTime:'09:00', endTime:'17:00' },
  { staffId:'st1', dayOfWeek:2, startTime:'09:00', endTime:'17:00' },
  { staffId:'st1', dayOfWeek:3, startTime:'09:00', endTime:'17:00' },
  { staffId:'st1', dayOfWeek:4, startTime:'09:00', endTime:'17:00' },
  { staffId:'st1', dayOfWeek:5, startTime:'09:00', endTime:'13:00' },
  { staffId:'st2', dayOfWeek:1, startTime:'10:00', endTime:'18:00' },
  { staffId:'st2', dayOfWeek:2, startTime:'10:00', endTime:'18:00' },
  { staffId:'st2', dayOfWeek:3, startTime:'10:00', endTime:'18:00' },
  { staffId:'st2', dayOfWeek:5, startTime:'10:00', endTime:'18:00' },
  { staffId:'st3', dayOfWeek:2, startTime:'09:00', endTime:'17:00' },
  { staffId:'st3', dayOfWeek:3, startTime:'09:00', endTime:'17:00' },
  { staffId:'st3', dayOfWeek:4, startTime:'09:00', endTime:'17:00' },
  { staffId:'st3', dayOfWeek:6, startTime:'09:00', endTime:'14:00' },
];

let _unavailable: UnavailableDate[] = [
  { staffId:'st2', date: new Date(Date.now() + 3*86400000).toISOString().split('T')[0], reason:'Annual leave' },
  { staffId:'st3', date: new Date(Date.now() + 7*86400000).toISOString().split('T')[0], reason:'Training day' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minsToTime(m: number) {
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}

function getWeekDates(offset = 0) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return Array.from({length:7}, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// Check if staff member is available for a given date + time window
function checkAvailability(staffId: string, date: Date, startTime: string, endTime: string): {
  available: boolean;
  reason?: string;
} {
  const dow = date.getDay();
  const dateStr = date.toISOString().split('T')[0];

  // Check unavailability dates
  const unavail = _unavailable.find(u => u.staffId === staffId && u.date === dateStr);
  if (unavail) return { available: false, reason: unavail.reason };

  // Check regular availability
  const slot = _availability.find(a => a.staffId === staffId && a.dayOfWeek === dow);
  if (!slot) return { available: false, reason: 'Not working this day' };

  const reqStart = timeToMins(startTime);
  const reqEnd   = timeToMins(endTime);
  const avStart  = timeToMins(slot.startTime);
  const avEnd    = timeToMins(slot.endTime);

  if (reqStart < avStart || reqEnd > avEnd) {
    return { available: false, reason: `Works ${slot.startTime}–${slot.endTime} on ${DAY_FULL[dow]}` };
  }

  return { available: true };
}

// Check if staff is already booked for overlapping sessions
function checkDoubleBooking(staffId: string, date: Date, startTime: string, endTime: string, excludeSessionId?: string) {
  const sessions = storeExt.getSessions();
  const dateStr  = date.toISOString().split('T')[0];
  const reqStart = timeToMins(startTime);
  const reqEnd   = timeToMins(endTime);

  return sessions.filter(s => {
    if (s.id === excludeSessionId) return false;
    if ((s as any).supervisor_id !== staffId && s.supervisor !== staffId) return false;
    const sDate = new Date(s.scheduled_start).toISOString().split('T')[0];
    if (sDate !== dateStr) return false;
    const sStart = timeToMins(new Date(s.scheduled_start).toTimeString().slice(0,5));
    const sEnd   = timeToMins(new Date(s.scheduled_end).toTimeString().slice(0,5));
    return reqStart < sEnd && reqEnd > sStart;
  });
}

// Check DBS status
function checkDBS(staffId: string): { valid: boolean; reason?: string; daysLeft?: number } {
  const dbs = storeExt.getDBSRecords().find(d => d.staff_id === staffId);
  if (!dbs) return { valid: false, reason: 'No DBS record on file' };
  if (dbs.status === 'expired') return { valid: false, reason: `DBS expired (${formatDate(dbs.expiry_date)})` };
  if (dbs.status === 'expiring_soon') return { valid: true, reason: `DBS expires in ${dbs.days_until_expiry} days — renew now`, daysLeft: dbs.days_until_expiry };
  return { valid: true, daysLeft: dbs.days_until_expiry };
}

// ── Availability editor ───────────────────────────────────────────────────────

function AvailabilityEditor({ staffId, staffName, onClose }: { staffId: string; staffName: string; onClose: () => void }) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>(
    _availability.filter(a => a.staffId === staffId)
  );
  const [newUnavail, setNewUnavail] = useState({ date:'', reason:'' });

  const unavailDates = _unavailable.filter(u => u.staffId === staffId);

  function toggleDay(dow: number) {
    const exists = slots.find(s => s.dayOfWeek === dow);
    if (exists) {
      setSlots(slots.filter(s => s.dayOfWeek !== dow));
    } else {
      setSlots([...slots, { staffId, dayOfWeek: dow, startTime:'09:00', endTime:'17:00' }]);
    }
  }

  function updateTime(dow: number, field: 'startTime'|'endTime', val: string) {
    setSlots(slots.map(s => s.dayOfWeek === dow ? { ...s, [field]: val } : s));
  }

  function save() {
    _availability = [..._availability.filter(a => a.staffId !== staffId), ...slots];
    if (newUnavail.date) {
      _unavailable = [..._unavailable, { staffId, date: newUnavail.date, reason: newUnavail.reason || 'Unavailable' }];
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: 560 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <h2 style={{ fontSize:16, fontWeight:600, color:'var(--text)' }}>Availability — {staffName}</h2>
            <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Set regular working hours and mark specific dates unavailable.</p>
          </div>
          <button className="btn-ghost" style={{ padding:'5px 8px' }} onClick={onClose}>✕</button>
        </div>

        <div className="section-label">Regular working hours</div>
        {[1,2,3,4,5,6,0].map(dow => {
          const slot = slots.find(s => s.dayOfWeek === dow);
          return (
            <div key={dow} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, width:48, cursor:'pointer', fontSize:13, color:'var(--text)', fontWeight:500 }}>
                <input type="checkbox" checked={!!slot} onChange={() => toggleDay(dow)} style={{ accentColor:'#3B82F6' }} />
                {DAY_NAMES[(dow+7)%7]}
              </label>
              {slot ? (
                <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
                  <input type="time" className="field" style={{ width:100, padding:'4px 8px', fontSize:12 }}
                    value={slot.startTime} onChange={e => updateTime(dow, 'startTime', e.target.value)} />
                  <span style={{ fontSize:12, color:'var(--text3)' }}>to</span>
                  <input type="time" className="field" style={{ width:100, padding:'4px 8px', fontSize:12 }}
                    value={slot.endTime} onChange={e => updateTime(dow, 'endTime', e.target.value)} />
                  <span style={{ fontSize:11, color:'var(--text3)' }}>
                    {Math.round((timeToMins(slot.endTime) - timeToMins(slot.startTime))/60 * 10)/10}h
                  </span>
                </div>
              ) : (
                <span style={{ fontSize:12, color:'var(--text3)' }}>Not working</span>
              )}
            </div>
          );
        })}

        <div style={{ marginTop:16 }}>
          <div className="section-label">Specific unavailable dates</div>
          {unavailDates.map((u, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
              <span style={{ color:'var(--text)', fontFamily:'DM Mono, monospace', fontSize:12 }}>{u.date}</span>
              <span style={{ color:'var(--text3)', flex:1 }}>{u.reason}</span>
              <button className="btn-ghost" style={{ padding:'2px 8px', fontSize:11, color:'#F87171' }}
                onClick={() => { _unavailable = _unavailable.filter((_, j) => j !== i); }}>Remove</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <input type="date" className="field" style={{ width:140 }}
              value={newUnavail.date} onChange={e => setNewUnavail(p => ({ ...p, date: e.target.value }))} />
            <input className="field" style={{ flex:1 }} placeholder="Reason (optional)"
              value={newUnavail.reason} onChange={e => setNewUnavail(p => ({ ...p, reason: e.target.value }))} />
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16, paddingTop:12, borderTop:'1px solid var(--border)' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save availability</button>
        </div>
      </div>
    </div>
  );
}

// ── Session assignment checker ────────────────────────────────────────────────

export function StaffAssignmentChecker({ sessionDate, startTime, endTime, currentSupervisorId, onAssign }: {
  sessionDate: string; // ISO date
  startTime: string;
  endTime: string;
  currentSupervisorId?: string;
  onAssign: (staffId: string) => void;
}) {
  const date = new Date(sessionDate);
  const staff = storeExt.getStaffMembers().filter(s => s.active && s.role === 'supervisor');

  return (
    <div>
      <div className="section-label">Available supervisors for this session</div>
      <div style={{ display:'grid', gap:8 }}>
        {staff.map(s => {
          const avail = checkAvailability(s.id, date, startTime, endTime);
          const conflicts = checkDoubleBooking(s.id, date, startTime, endTime);
          const dbs = checkDBS(s.id);
          const blocked = !avail.available || conflicts.length > 0 || !dbs.valid;

          return (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background: s.id === currentSupervisorId ? 'rgba(59,130,246,0.08)' : 'var(--surface2)', border:`1px solid ${s.id === currentSupervisorId ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`, borderRadius:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:3 }}>{s.full_name}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {!avail.available && (
                    <span style={{ fontSize:11, color:'#F87171', background:'#EF444415', padding:'1px 7px', borderRadius:4, border:'1px solid #EF444430' }}>
                      ✗ {avail.reason}
                    </span>
                  )}
                  {conflicts.length > 0 && (
                    <span style={{ fontSize:11, color:'#F87171', background:'#EF444415', padding:'1px 7px', borderRadius:4, border:'1px solid #EF444430' }}>
                      ✗ Double-booked ({conflicts[0].family_name} family)
                    </span>
                  )}
                  {!dbs.valid && (
                    <span style={{ fontSize:11, color:'#F87171', background:'#EF444415', padding:'1px 7px', borderRadius:4, border:'1px solid #EF444430' }}>
                      ✗ {dbs.reason}
                    </span>
                  )}
                  {avail.available && conflicts.length === 0 && dbs.valid && (
                    <span style={{ fontSize:11, color:'#10B981', background:'#10B98115', padding:'1px 7px', borderRadius:4, border:'1px solid #10B98130' }}>
                      ✓ Available
                    </span>
                  )}
                  {dbs.valid && dbs.daysLeft && dbs.daysLeft <= 60 && (
                    <span style={{ fontSize:11, color:'#F59E0B', background:'#F59E0B15', padding:'1px 7px', borderRadius:4, border:'1px solid #F59E0B30' }}>
                      ⚠ DBS expires in {dbs.daysLeft}d
                    </span>
                  )}
                </div>
              </div>
              <button
                className={blocked ? 'btn-ghost' : 'btn-primary'}
                style={{ fontSize:12, opacity: blocked ? 0.4 : 1 }}
                disabled={blocked}
                onClick={() => !blocked && onAssign(s.id)}
              >
                {s.id === currentSupervisorId ? 'Assigned ✓' : 'Assign'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main rota page ────────────────────────────────────────────────────────────

export default function RotaPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingStaff, setEditingStaff] = useState<{id:string;name:string}|null>(null);
  const [view, setView] = useState<'week'|'staff'>('week');

  const weekDates = getWeekDates(weekOffset);
  const staff = storeExt.getStaffMembers().filter(s => s.active);
  const sessions = storeExt.getSessions();

  const HOURS = Array.from({length:10}, (_, i) => i + 8); // 8am-5pm

  // Get sessions for a specific day
  function getSessionsForDay(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    return sessions.filter(s => new Date(s.scheduled_start).toISOString().split('T')[0] === dateStr);
  }

  // Get staff availability for a day
  function getStaffForDay(date: Date) {
    return staff.map(s => {
      const dow = date.getDay();
      const dateStr = date.toISOString().split('T')[0];
      const unavail = _unavailable.find(u => u.staffId === s.id && u.date === dateStr);
      const slot = _availability.find(a => a.staffId === s.id && a.dayOfWeek === dow);
      return { ...s, slot, unavail };
    });
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fade-in">
      {editingStaff && (
        <AvailabilityEditor
          staffId={editingStaff.id}
          staffName={editingStaff.name}
          onClose={() => setEditingStaff(null)}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button className="btn-ghost" style={{ padding:'5px 10px' }} onClick={() => setWeekOffset(w => w-1)}>←</button>
          <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>
            {weekDates[0].toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {weekDates[6].toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
          </span>
          <button className="btn-ghost" style={{ padding:'5px 10px' }} onClick={() => setWeekOffset(w => w+1)}>→</button>
          <button className="btn-ghost" style={{ fontSize:12, padding:'4px 10px' }} onClick={() => setWeekOffset(0)}>Today</button>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {(['week','staff'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding:'5px 12px', fontSize:12, borderRadius:6, border:'1px solid var(--border)', background: view===v ? '#3B82F6' : 'var(--surface2)', color: view===v ? 'white' : 'var(--text2)', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              {v === 'week' ? 'Week view' : 'Staff view'}
            </button>
          ))}
        </div>
      </div>

      {view === 'week' && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'60px repeat(7, 1fr)', borderBottom:'1px solid var(--border)' }}>
            <div style={{ padding:'10px 8px', background:'var(--surface2)' }} />
            {weekDates.map(d => {
              const ds = d.toISOString().split('T')[0];
              const isToday = ds === today;
              return (
                <div key={ds} style={{ padding:'10px 8px', textAlign:'center', background: isToday ? 'rgba(59,130,246,0.08)' : 'var(--surface2)', borderLeft:'1px solid var(--border)' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>{DAY_NAMES[d.getDay()]}</div>
                  <div style={{ fontSize:16, fontWeight:isToday?700:500, color: isToday?'#3B82F6':'var(--text)', marginTop:2 }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Staff availability rows */}
          {staff.map(s => {
            const dbs = checkDBS(s.id);
            return (
              <div key={s.id} style={{ display:'grid', gridTemplateColumns:'60px repeat(7, 1fr)', borderBottom:'1px solid var(--border)' }}>
                <div style={{ padding:'8px 6px', background:'var(--surface2)', borderRight:'1px solid var(--border)' }}>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text)', lineHeight:1.2 }}>
                    {s.full_name.split(' ')[0]}
                  </div>
                  <div style={{ fontSize:9, color: !dbs.valid ? '#F87171' : dbs.daysLeft && dbs.daysLeft<=60 ? '#F59E0B' : 'var(--text3)', marginTop:2 }}>
                    {!dbs.valid ? '⚠ DBS' : `DBS ${dbs.daysLeft}d`}
                  </div>
                </div>
                {weekDates.map(d => {
                  const dow = d.getDay();
                  const ds  = d.toISOString().split('T')[0];
                  const isToday = ds === today;
                  const slot = _availability.find(a => a.staffId===s.id && a.dayOfWeek===dow);
                  const unavail = _unavailable.find(u => u.staffId===s.id && u.date===ds);
                  const daySessions = getSessionsForDay(d).filter(sess => sess.supervisor === s.full_name);

                  return (
                    <div key={ds} style={{ minHeight:64, padding:4, borderLeft:'1px solid var(--border)', background: isToday ? 'rgba(59,130,246,0.04)' : 'transparent', position:'relative' }}>
                      {unavail ? (
                        <div style={{ fontSize:9, background:'#EF444415', border:'1px solid #EF444430', borderRadius:4, padding:'2px 5px', color:'#F87171' }}>
                          {unavail.reason}
                        </div>
                      ) : slot ? (
                        <div style={{ fontSize:9, background:'#10B98115', border:'1px solid #10B98130', borderRadius:4, padding:'2px 5px', color:'#10B981', marginBottom:3 }}>
                          {slot.startTime}–{slot.endTime}
                        </div>
                      ) : (
                        <div style={{ fontSize:9, color:'var(--text3)', padding:'2px 4px' }}>Off</div>
                      )}
                      {daySessions.map(sess => (
                        <div key={sess.id} style={{ fontSize:9, background:'#3B82F620', border:'1px solid #3B82F640', borderRadius:4, padding:'2px 5px', color:'#60A5FA', marginTop:2 }}>
                          {formatTime(sess.scheduled_start)} {sess.family_name}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {view === 'staff' && (
        <div style={{ display:'grid', gap:12 }}>
          {staff.map(s => {
            const dbs = checkDBS(s.id);
            const workDays = _availability.filter(a => a.staffId===s.id);
            const totalHours = workDays.reduce((acc, a) => acc + (timeToMins(a.endTime)-timeToMins(a.startTime))/60, 0);
            const upcomingUnavail = _unavailable.filter(u => u.staffId===s.id && u.date >= today);

            return (
              <div key={s.id} className="card">
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#3B82F620', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600, color:'#3B82F6' }}>
                      {s.full_name.split(' ').map((n:string) => n[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{s.full_name}</div>
                      <div style={{ fontSize:12, color:'var(--text3)', textTransform:'capitalize' }}>{s.role} · {Math.round(totalHours)}h/week contracted</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {!dbs.valid ? (
                      <span style={{ fontSize:11, color:'#F87171', background:'#EF444415', padding:'3px 10px', borderRadius:6, border:'1px solid #EF444430' }}>⚠ {dbs.reason}</span>
                    ) : dbs.daysLeft && dbs.daysLeft<=60 ? (
                      <span style={{ fontSize:11, color:'#F59E0B', background:'#F59E0B15', padding:'3px 10px', borderRadius:6, border:'1px solid #F59E0B30' }}>DBS {dbs.daysLeft}d left</span>
                    ) : (
                      <span style={{ fontSize:11, color:'#10B981', background:'#10B98115', padding:'3px 10px', borderRadius:6, border:'1px solid #10B98130' }}>DBS valid</span>
                    )}
                    <button className="btn-ghost" style={{ fontSize:12 }} onClick={() => setEditingStaff({id:s.id, name:s.full_name})}>
                      Edit availability
                    </button>
                  </div>
                </div>

                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom: upcomingUnavail.length > 0 ? 10 : 0 }}>
                  {[1,2,3,4,5,6,0].map(dow => {
                    const slot = _availability.find(a => a.staffId===s.id && a.dayOfWeek===dow);
                    return (
                      <div key={dow} style={{ padding:'6px 10px', borderRadius:7, background: slot ? '#3B82F615' : 'var(--surface2)', border:`1px solid ${slot ? '#3B82F640' : 'var(--border)'}`, textAlign:'center', minWidth:52 }}>
                        <div style={{ fontSize:10, fontWeight:600, color: slot ? '#60A5FA' : 'var(--text3)' }}>{DAY_NAMES[(dow+7)%7]}</div>
                        {slot ? (
                          <div style={{ fontSize:9, color:'var(--text3)', marginTop:1 }}>{slot.startTime}<br/>{slot.endTime}</div>
                        ) : (
                          <div style={{ fontSize:9, color:'var(--text3)', marginTop:1 }}>Off</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {upcomingUnavail.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {upcomingUnavail.map((u, i) => (
                      <span key={i} style={{ fontSize:11, color:'#F59E0B', background:'#F59E0B15', padding:'2px 9px', borderRadius:5, border:'1px solid #F59E0B30' }}>
                        {u.date} — {u.reason}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
