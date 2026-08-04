import React, { useState, useEffect } from 'react';
import { api } from '../api';

const sysadminNavigation = [
  { label: 'Home', icon: 'fa-solid fa-house' },
  { label: 'Users Management', icon: 'fa-solid fa-user-shield' },
  { label: 'Member Roster & Data', icon: 'fa-solid fa-address-book' },
  { label: 'Audit Trails', icon: 'fa-solid fa-list-check' },
];

export default function SysAdminDashboard({ token, onLogout, DashboardHeader, showToast }) {
  const [currentTab, setCurrentTab] = useState('Home');
  const [users, setUsers] = useState([]);
  const [auditTrails, setAuditTrails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Forms states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    specialty: '',
    phone: '',
    email: '',
    role: 'doctor',
    change_password_on_next_login: false,
    medical_aid_number: '',
  });

  const [showManageDrawer, setShowManageDrawer] = useState(false);
  const [selectedUserForManage, setSelectedUserForManage] = useState(null);
  const [manageResetForm, setManageResetForm] = useState({
    new_password: '',
    change_password_on_next_login: true,
  });
  const [manageEditForm, setManageEditForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    specialty: '',
    phone: '',
    email: '',
    role: '',
    change_password_on_next_login: false,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [memberEntrySubTab, setMemberEntrySubTab] = useState('directory'); // 'directory', 'single', or 'bulk'
  const [membersList, setMembersList] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({
    id: '',
    membership_number: '',
    first_name: '',
    last_name: '',
    insurer: 'Premium USD',
    plan: '',
    id_number: '',
    date_joined: '',
    date_of_birth: '',
    phone: '',
    email: '',
    address: '',
  });

  const [showDeleteMemberModal, setShowDeleteMemberModal] = useState(false);
  const [selectedMemberForDelete, setSelectedMemberForDelete] = useState(null);

  const [singleMemberForm, setSingleMemberForm] = useState({
    membership_number: '',
    first_name: '',
    last_name: '',
    insurer: 'Premium USD',
    plan: '',
    id_number: '',
    date_joined: '',
    date_of_birth: '',
    phone: '',
    email: '',
    address: '',
  });


  const [csvFile, setCsvFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);


  // Search/Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (currentTab === 'Users Management') {
      fetchUsers();
    } else if (currentTab === 'Audit Trails') {
      fetchAuditTrails();
    } else if (currentTab === 'Member Roster & Data' || currentTab === 'Upload Member Data') {
      fetchMembersList(memberSearchQuery);
    }
  }, [currentTab, memberSearchQuery]);

  async function fetchMembersList(search = '') {
    setLoadingMembers(true);
    try {
      const data = await api.sysadminGetMembers(token, search);
      setMembersList(data);
    } catch (err) {
      console.error('Failed to fetch members list', err);
    } finally {
      setLoadingMembers(false);
    }
  }

  function handleOpenEditMemberModal(member) {
    setSelectedMemberForEdit(member);
    setEditMemberForm({
      id: member.id,
      membership_number: member.membership_number || '',
      first_name: member.first_name || '',
      last_name: member.last_name || '',
      insurer: member.insurer || 'Premium USD',
      plan: member.plan || '',
      id_number: member.id_number || '',
      date_joined: member.date_joined || '',
      date_of_birth: member.date_of_birth || '',
      phone: member.phone || '',
      email: member.email || '',
      address: member.address || '',
    });
    setShowEditMemberModal(true);
  }

  async function handleUpdateMemberSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.sysadminUpdateMember(token, editMemberForm);
      const msg = res.detail || 'Member record updated successfully.';
      setSuccessMsg(msg);
      if (showToast) showToast(msg, 'success');
      setShowEditMemberModal(false);
      fetchMembersList(memberSearchQuery);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleOpenDeleteMemberModal(member) {
    setSelectedMemberForDelete(member);
    setShowDeleteMemberModal(true);
  }

  async function handleDeleteMemberSubmit() {
    if (!selectedMemberForDelete) return;
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.sysadminDeleteMember(token, selectedMemberForDelete.id);
      const msg = res.detail || 'Member record deleted successfully.';
      setSuccessMsg(msg);
      if (showToast) showToast(msg, 'success');
      setShowDeleteMemberModal(false);
      fetchMembersList(memberSearchQuery);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadDashboardData() {
    setLoading(true);
    try {
      await fetchUsers();
      await fetchAuditTrails();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const data = await api.sysadminGetUsers(token);
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function fetchAuditTrails() {
    try {
      const data = await api.sysadminGetAuditTrails(token);
      setAuditTrails(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateUserSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      await api.sysadminCreateUser(token, createUserForm);
      const msg = `Successfully registered new user: ${createUserForm.username}`;
      setSuccessMsg(msg);
      if (showToast) showToast(msg, 'success');
      setShowCreateModal(false);
      setCreateUserForm({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        specialty: '',
        phone: '',
        role: 'doctor',
        change_password_on_next_login: false,
      });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleOpenManageDrawer(userProfile) {
    setSelectedUserForManage(userProfile);
    const firstName = userProfile.user.first_name || '';
    const lastName = userProfile.user.last_name || '';
    
    setManageEditForm({
      first_name: firstName,
      last_name: lastName,
      username: userProfile.user.username || '',
      specialty: userProfile.specialty || '',
      phone: userProfile.phone || '',
      email: userProfile.user.email || '',
      role: userProfile.role || '',
      change_password_on_next_login: !!userProfile.change_password_on_next_login
    });
    setManageResetForm({
      new_password: '',
      change_password_on_next_login: true
    });
    setShowDeleteConfirm(false);
    setShowManageDrawer(true);
  }

  async function handleUpdateUserSubmit(e) {
    e.preventDefault();
    if (!selectedUserForManage) return;
    setError('');
    setSuccessMsg('');
    try {
      await api.sysadminUpdateUser(token, {
        user_id: selectedUserForManage.id,
        first_name: manageEditForm.first_name,
        last_name: manageEditForm.last_name,
        username: manageEditForm.username,
        specialty: manageEditForm.specialty,
        phone: manageEditForm.phone,
        email: manageEditForm.email,
        role: manageEditForm.role,
        change_password_on_next_login: manageEditForm.change_password_on_next_login
      });
      const msg = `User profile successfully updated for ${manageEditForm.first_name} ${manageEditForm.last_name}`;
      setSuccessMsg(msg);
      if (showToast) showToast('User profile updated successfully', 'success');
      setShowManageDrawer(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
      if (showToast) showToast(err.message || 'Failed to update user profile', 'error');
    }
  }

  async function handleManageResetPasswordSubmit(e) {
    e.preventDefault();
    if (!selectedUserForManage) return;
    setError('');
    setSuccessMsg('');
    try {
      await api.sysadminResetPassword(
        token,
        selectedUserForManage.id,
        manageResetForm.new_password,
        manageResetForm.change_password_on_next_login
      );
      const msg = `Password successfully reset for ${selectedUserForManage.title}`;
      setSuccessMsg(msg);
      if (showToast) showToast('Password reset successfully', 'success');
      setManageResetForm({ new_password: '', change_password_on_next_login: true });
      setShowManageDrawer(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
      if (showToast) showToast(err.message || 'Failed to reset password', 'error');
    }
  }

  async function handleDeleteUserSubmit() {
    if (!selectedUserForManage) return;
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.sysadminDeleteUser(token, selectedUserForManage.id);
      setSuccessMsg(res.detail || `User account successfully deleted.`);
      if (showToast) showToast('User account deleted successfully', 'success');
      setShowManageDrawer(false);
    } catch (err) {
      setError(err.message);
      if (showToast) showToast(err.message || 'Failed to delete user account', 'error');
    }
  }

  async function handleSingleMemberSubmit(e) {

    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await api.sysadminAddMember(token, singleMemberForm);
      setSuccessMsg(res.detail);
      if (showToast) showToast(res.detail, 'success');
      setSingleMemberForm({
        membership_number: '',
        first_name: '',
        last_name: '',
        insurer: 'Premium USD',
        plan: '',
        id_number: '',
        date_joined: '',
        date_of_birth: '',
        phone: '',
        email: '',
        address: '',
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadCsv(e) {

    e.preventDefault();
    if (!csvFile) return;
    setError('');
    setUploadResult(null);
    setLoading(true);
    try {
      const res = await api.sysadminUploadMembers(token, csvFile);
      setUploadResult(res);
      setSuccessMsg(res.detail);
      if (showToast) showToast('Member list updated successfully', 'success');
      setCsvFile(null);
      const fileInput = document.getElementById('csv-file-input');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Derived dashboard statistics
  const totalDoctors = users.filter(u => u.role === 'doctor').length;
  const totalAdmins = users.filter(u => u.role === 'admin').length;
  const totalTrailsCount = auditTrails.length;

  const filteredUsers = users.filter(u => {
    const matchesSearch = !userSearch || 
      u.user.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.title.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.specialty && u.specialty.toLowerCase().includes(userSearch.toLowerCase()));
    
    if (userRoleFilter !== 'all') {
      return matchesSearch && u.role === userRoleFilter;
    }
    return matchesSearch;
  });

  return (
    <div className="dashboard-app topnav-layout">
      <DashboardHeader
        role="sysadmin"
        navigation={sysadminNavigation}
        activeLabel={currentTab}
        onNavigate={setCurrentTab}
        name="System Administrator"
        avatar="SA"
        notifications={[]}
        onLogout={onLogout}
      />

      <main className="dashboard-main admin-main" style={{ padding: '32px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        {error && (
          <div className="auth3-error-box" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            background: 'rgba(33, 178, 111, 0.08)',
            border: '1px solid var(--success)',
            color: 'var(--success)',
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <i className="fa-solid fa-circle-check"></i>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'var(--success)' }}>×</button>
          </div>
        )}

        {/* ── HOME TAB ── */}
        {currentTab === 'Home' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text)' }}>System Administrator Terminal</h2>
              <p style={{ color: 'var(--muted)', margin: '4px 0 0 0' }}>Configure doctor practitioners, administrator privileges, audit actions, and CellMed datasets.</p>
            </div>

            <section className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              <article className="stat-card" style={{ background: 'var(--panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase' }}>Practitioners</p>
                <strong style={{ fontSize: '28px', color: 'var(--text)', display: 'block' }}>{totalDoctors} Registered</strong>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>CellMed Consulting Doctors</span>
              </article>

              <article className="stat-card" style={{ background: 'var(--panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase' }}>Administrators</p>
                <strong style={{ fontSize: '28px', color: 'var(--text)', display: 'block' }}>{totalAdmins} Accounts</strong>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Nectacare Platform Staff</span>
              </article>

              <article className="stat-card" style={{ background: 'var(--panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase' }}>Audit Actions</p>
                <strong style={{ fontSize: '28px', color: 'var(--text)', display: 'block' }}>{totalTrailsCount} Logged</strong>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>System Audit Trail Events</span>
              </article>
            </section>

            <article className="panel" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '32px', borderRadius: '18px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚙️</div>
              <h3 style={{ fontSize: '1.3rem', margin: '0 0 8px 0' }}>Manage System Infrastructure</h3>
              <p style={{ color: 'var(--muted)', maxWIdth: '500px', margin: '0 auto 20px' }}>
                Use the navigation tabs above to add healthcare workers, change passwords, check system security audits, and bulk-load CellMed members.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="cta-button" style={{ height: '36px', fontSize: '13px' }} onClick={() => setCurrentTab('Users Management')}>Manage Users</button>
                <button className="cta-button" style={{ height: '36px', fontSize: '13px' }} onClick={() => setCurrentTab('Upload Member Data')}>Upload Member Data</button>
              </div>
            </article>
          </>
        )}

        {/* ── USERS MANAGEMENT TAB ── */}
        {currentTab === 'Users Management' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Practitioner & Admin Accounts</h3>
                <p style={{ color: 'var(--muted)', margin: '4px 0 0 0', fontSize: '13.5px' }}>Register new staff, switch roles, or trigger forced password updates.</p>
              </div>
              <button
                type="button"
                className="cta-button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  height: '34px',
                  fontSize: '13px',
                  background: 'transparent',
                  border: '1.5px solid var(--accent)',
                  color: 'var(--accent)',
                  borderRadius: '8px',
                  padding: '0 16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i> Add User Account
              </button>
            </div>

            <div className="panel" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '18px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by username, name, or specialty..."
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white' }}
                />
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  style={{ width: '180px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}
                >
                  <option value="all">All Roles</option>
                  <option value="doctor">Doctors</option>
                  <option value="admin">Administrators</option>
                  <option value="sysadmin">System Administrators</option>
                </select>
              </div>

              {loading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>Loading staff records...</div>
              ) : filteredUsers.length === 0 ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px' }}>No user accounts matched the query filters.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', background: 'rgba(29, 44, 72, 0.02)' }}>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>Full Name</th>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>Username</th>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>System Role</th>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>Specialty</th>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>Contact</th>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>Password Rule</th>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '13.5px' }}>
                          <td style={{ padding: '14px 12px', fontWeight: 'bold', color: 'var(--text)' }}>{u.title}</td>
                          <td style={{ padding: '14px 12px' }}>{u.user.username}</td>
                          <td style={{ padding: '14px 12px' }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              color: u.role === 'sysadmin' ? '#ef4444' : u.role === 'admin' ? '#0284c7' : '#15803d'
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '14px 12px', fontStyle: 'italic', color: 'var(--muted)' }}>{u.specialty || 'N/A'}</td>
                          <td style={{ padding: '14px 12px' }}>{u.phone || 'N/A'}</td>
                          <td style={{ padding: '14px 12px' }}>
                            {u.change_password_on_next_login ? (
                              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ Force Update Next Login</span>
                            ) : (
                              <span style={{ color: 'var(--success)' }}>✓ Up to date</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="cta-button compact"
                              onClick={() => handleOpenManageDrawer(u)}
                              style={{
                                height: '30px',
                                fontSize: '12px',
                                background: 'transparent',
                                border: '1.5px solid var(--primary)',
                                color: 'var(--primary)',
                                borderRadius: '6px',
                                padding: '0 12px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              <i className="fa-solid fa-user-gear" style={{ marginRight: '6px' }}></i> Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MEMBER ROSTER & DATA TAB ── */}
        {(currentTab === 'Member Roster & Data' || currentTab === 'Upload Member Data') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.3rem' }}>CellMed Patient Member Roster</h3>
              <p style={{ color: 'var(--muted)', margin: '4px 0 0 0', fontSize: '13.5px' }}>Register individual patient members or upload bulk CSV rosters for instant membership verification.</p>
            </div>

            {/* Sub-Tab Selector */}
            <div style={{ display: 'flex', gap: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setMemberEntrySubTab('directory')}
                style={{
                  padding: '10px 26px',
                  borderRadius: '9999px',
                  border: memberEntrySubTab === 'directory' ? '1.5px solid #f59e0b' : '1.5px solid rgba(29, 44, 72, 0.12)',
                  background: memberEntrySubTab === 'directory' ? '#ffffff' : 'transparent',
                  color: memberEntrySubTab === 'directory' ? '#f59e0b' : '#64748b',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: memberEntrySubTab === 'directory' ? '0 2px 10px rgba(245, 158, 11, 0.12)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="fa-solid fa-address-book"></i> Member Roster Directory ({membersList.length})
              </button>
              <button
                type="button"
                onClick={() => setMemberEntrySubTab('single')}
                style={{
                  padding: '10px 26px',
                  borderRadius: '9999px',
                  border: memberEntrySubTab === 'single' ? '1.5px solid #f59e0b' : '1.5px solid rgba(29, 44, 72, 0.12)',
                  background: memberEntrySubTab === 'single' ? '#ffffff' : 'transparent',
                  color: memberEntrySubTab === 'single' ? '#f59e0b' : '#64748b',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: memberEntrySubTab === 'single' ? '0 2px 10px rgba(245, 158, 11, 0.12)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="fa-solid fa-user-plus"></i> Single Patient Entry
              </button>
              <button
                type="button"
                onClick={() => setMemberEntrySubTab('bulk')}
                style={{
                  padding: '10px 26px',
                  borderRadius: '9999px',
                  border: memberEntrySubTab === 'bulk' ? '1.5px solid #f59e0b' : '1.5px solid rgba(29, 44, 72, 0.12)',
                  background: memberEntrySubTab === 'bulk' ? '#ffffff' : 'transparent',
                  color: memberEntrySubTab === 'bulk' ? '#f59e0b' : '#64748b',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: memberEntrySubTab === 'bulk' ? '0 2px 10px rgba(245, 158, 11, 0.12)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="fa-solid fa-file-csv"></i> Bulk CSV Import
              </button>
            </div>

            {memberEntrySubTab === 'directory' ? (
              <div className="panel" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>Search & Manage CellMed Members</h4>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>View, search, edit details, or remove records from the registered CellMed member database.</p>
                  </div>
                  <div style={{ position: 'relative', width: '320px' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '13px' }}></i>
                    <input
                      type="text"
                      placeholder="Search member #, name, ID, phone..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px 10px 36px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', outline: 'none' }}
                    />
                  </div>
                </div>

                {loadingMembers ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="spinner-circle spinner-circle-lg"></div>
                    <p style={{ marginTop: '14px', fontSize: '14px', color: 'var(--muted)' }}>Loading CellMed member directory...</p>
                  </div>
                ) : membersList.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', background: 'rgba(0,0,0,0.01)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                    <i className="fa-solid fa-users-slash" style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}></i>
                    <p style={{ margin: 0, fontWeight: '600' }}>No CellMed member records found{memberSearchQuery ? ` matching "${memberSearchQuery}"` : ''}.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                          <th style={{ padding: '12px' }}>Membership #</th>
                          <th style={{ padding: '12px' }}>Member Name</th>
                          <th style={{ padding: '12px' }}>Insurer / Plan</th>
                          <th style={{ padding: '12px' }}>National ID</th>
                          <th style={{ padding: '12px' }}>Phone / Email</th>
                          <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {membersList.map((m) => (
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '13.5px' }}>
                            <td style={{ padding: '14px 12px', fontWeight: 'bold', color: 'var(--primary)' }}>{m.membership_number}</td>
                            <td style={{ padding: '14px 12px', fontWeight: '600', color: 'var(--text)' }}>{m.first_name} {m.last_name}</td>
                            <td style={{ padding: '14px 12px' }}>
                              <span style={{ fontWeight: '600', color: '#1e293b' }}>{m.insurer || 'CellMed'}</span>
                              <span style={{ display: 'block', fontSize: '11.5px', color: '#f59e0b', fontWeight: '700' }}>{m.plan || 'Standard'}</span>
                            </td>
                            <td style={{ padding: '14px 12px', fontFamily: 'monospace', fontSize: '12.5px' }}>{m.id_number || 'N/A'}</td>
                            <td style={{ padding: '14px 12px', fontSize: '12.5px' }}>
                              <div>{m.phone || 'N/A'}</div>
                              <div style={{ color: 'var(--muted)', fontSize: '11.5px' }}>{m.email || 'N/A'}</div>
                            </td>
                            <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditMemberModal(m)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--primary)',
                                    background: 'transparent',
                                    color: 'var(--primary)',
                                    fontWeight: '700',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <i className="fa-solid fa-pen-to-square" style={{ marginRight: '4px' }}></i> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteMemberModal(m)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid #ef4444',
                                    background: 'transparent',
                                    color: '#ef4444',
                                    fontWeight: '700',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <i className="fa-solid fa-trash-can" style={{ marginRight: '4px' }}></i> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : memberEntrySubTab === 'single' ? (
              <div className="panel" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '32px', borderRadius: '18px' }}>
                <form onSubmit={handleSingleMemberSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>Add Single CellMed Member Record</h4>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>Input an individual patient's medical aid details so their membership is immediately verified on registration.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Membership Number *</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. CM-12345"
                        value={singleMemberForm.membership_number}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, membership_number: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>First Name *</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Tariro"
                        value={singleMemberForm.first_name}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, first_name: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Last Name *</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Chiwese"
                        value={singleMemberForm.last_name}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, last_name: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Insurer *</label>
                      <select
                        value={singleMemberForm.insurer}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, insurer: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'white' }}
                      >
                        <option value="Premium USD">Premium USD</option>
                        <option value="ZGMF (ZESA GROUP MEDICAL FUND)">ZGMF (ZESA GROUP MEDICAL FUND)</option>
                        <option value="ZIMPLATS">ZIMPLATS</option>
                        <option value="Other">Other Medical Aid</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Plan</label>
                      <input
                        type="text"
                        placeholder="e.g. Manuka, Silver, Diamond, Diaspora"
                        value={singleMemberForm.plan}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, plan: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>National ID Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 63-1234567-A-63"
                        value={singleMemberForm.id_number}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, id_number: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Date Joined</label>
                      <input
                        type="date"
                        value={singleMemberForm.date_joined}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, date_joined: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Date of Birth</label>
                      <input
                        type="date"
                        value={singleMemberForm.date_of_birth}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, date_of_birth: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Phone Number</label>
                      <input
                        type="text"
                        placeholder="e.g. +263 77 123 4567"
                        value={singleMemberForm.phone}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, phone: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Email Address</label>
                      <input
                        type="email"
                        placeholder="e.g. tariro@cellmed.co.zw"
                        value={singleMemberForm.email}
                        onChange={(e) => setSingleMemberForm({ ...singleMemberForm, email: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Home Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 12 Samora Machel Ave, Harare, Zimbabwe"
                      value={singleMemberForm.address}
                      onChange={(e) => setSingleMemberForm({ ...singleMemberForm, address: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '12px 32px',
                        background: '#ffffff',
                        color: loading ? '#94a3b8' : '#f59e0b',
                        border: loading ? '1.5px solid #cbd5e1' : '1.5px solid #f59e0b',
                        borderRadius: '9999px',
                        fontWeight: '700',
                        fontSize: '14px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>{loading ? 'Saving Record...' : 'Save CellMed Patient Record'}</span>
                      <i className="fa-solid fa-arrow-right" style={{ fontSize: '13px' }}></i>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
                <form className="panel" onSubmit={handleUploadCsv} style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '32px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '40px 24px', textAlign: 'center', background: 'rgba(29,44,72,0.01)', position: 'relative' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                    <strong style={{ display: 'block', fontSize: '15px', color: 'var(--text)' }}>Choose CellMed CSV Data Roster</strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '6px' }}>Select a .csv data file exported from Excel</span>
                    
                    <input
                      type="file"
                      id="csv-file-input"
                      accept=".csv"
                      required
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      style={{ marginTop: '20px', cursor: 'pointer', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      type="submit"
                      disabled={loading || !csvFile}
                      style={{
                        padding: '12px 32px',
                        background: '#ffffff',
                        color: loading || !csvFile ? '#94a3b8' : '#f59e0b',
                        border: loading || !csvFile ? '1.5px solid #cbd5e1' : '1.5px solid #f59e0b',
                        borderRadius: '9999px',
                        fontWeight: '700',
                        fontSize: '14px',
                        cursor: loading || !csvFile ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>{loading ? 'Processing...' : 'Upload & Load Dataset'}</span>
                      <i className="fa-solid fa-arrow-right" style={{ fontSize: '13px' }}></i>
                    </button>



                    {csvFile && (
                      <button type="button" className="secondary-button" style={{ height: '36px', borderRadius: '8px' }} onClick={() => { setCsvFile(null); document.getElementById('csv-file-input').value = ''; }}>Cancel</button>
                    )}
                  </div>
                </form>

                <aside className="panel" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '18px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Roster File Requirements</h4>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: '1.5' }}>
                    The uploaded file must be in **Comma-Separated Values (CSV)** encoding. The header row is required and must contain precisely these columns (order does not matter):
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', fontSize: '12px', background: 'rgba(29,44,72,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <code><strong>membership_number</strong> (e.g. CM-12345)</code>
                    <code><strong>first_name</strong> (e.g. Sipho)</code>
                    <code><strong>last_name</strong> (e.g. Ndlovu)</code>
                    <code><strong>insurer</strong> (e.g. Premium USD, ZGMF, ZIMPLATS)</code>
                    <code><strong>plan</strong> (e.g. Manuka, Silver, Diamond, Diaspora)</code>
                    <code><strong>id_number</strong> (e.g. 63-1234567-A-63)</code>
                    <code><strong>date_joined</strong> (e.g. 2024-01-15)</code>
                    <code><strong>date_of_birth</strong> (e.g. 1989-12-05)</code>
                    <code><strong>phone</strong> (e.g. +263 77 123 456)</code>
                    <code><strong>email</strong> (e.g. sipho@cellmed.co.zw)</code>
                    <code><strong>address</strong> (e.g. Harare, Zimbabwe)</code>
                  </div>

                  {uploadResult && (
                    <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(33, 178, 111, 0.05)', border: '1px solid var(--success)', borderRadius: '8px' }}>
                      <h5 style={{ margin: '0 0 6px 0', color: 'var(--success)' }}>Dataset Processed Details</h5>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)' }}>New records created: <strong>{uploadResult.created}</strong></span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)' }}>Existing records updated: <strong>{uploadResult.updated}</strong></span>
                    </div>
                  )}
                </aside>
              </div>
            )}
          </div>
        )}


        {/* ── AUDIT TRAILS TAB ── */}
        {currentTab === 'Audit Trails' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.3rem' }}>System Audit logs</h3>
              <p style={{ color: 'var(--muted)', margin: '4px 0 0 0', fontSize: '13.5px' }}>Check actions, credential resets, and membership upload trails for security monitoring.</p>
            </div>

            <div className="panel" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '18px' }}>
              {loading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>Loading trails...</div>
              ) : auditTrails.length === 0 ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px' }}>No audit trails logged in the database yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', background: 'rgba(29, 44, 72, 0.02)' }}>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>Timestamp</th>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>Account User</th>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>Action Type</th>
                        <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase' }}>Detailed Action Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditTrails.map((trail) => (
                        <tr key={trail.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                            {new Date(trail.timestamp).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 'bold' }}>
                            {trail.user_fullname ? `${trail.user_fullname} (${trail.username})` : trail.username || 'System Daemon'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 'bold',
                              padding: '2.5px 6px',
                              borderRadius: '5px',
                              background: trail.action.includes('Upload') ? '#fef3c7' : trail.action.includes('Reset') ? '#fee2e2' : '#e0f2fe',
                              color: trail.action.includes('Upload') ? '#d97706' : trail.action.includes('Reset') ? '#ef4444' : '#0284c7'
                            }}>
                              {trail.action}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text)' }}>{trail.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Register User Side Drawer (Slide-out panel) */}
      {showCreateModal && (
        <div className="drawer-overlay">
          {/* Overlay click area to close */}
          <div 
            style={{ position: 'absolute', inset: 0, zIndex: -1 }} 
            onClick={() => setShowCreateModal(false)}
          />
          <div className="drawer-panel" style={{ width: '460px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px 24px', 
              borderBottom: '1px solid var(--border)', 
              background: '#f8fafc' 
            }}>
              <h3 style={{ marginTop: 0, margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>Create Doctor / Admin Profile</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <form onSubmit={handleCreateUserSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Role Type</label>
                  <select
                    value={createUserForm.role}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value })}
                    style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'white' }}
                  >
                    <option value="doctor">Healthcare Doctor (Practitioner)</option>
                    <option value="admin">Platform Administrator</option>
                    <option value="sysadmin">System Administrator</option>
                  </select>
                </div>


                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>First Name</label>
                    <input
                      required
                      value={createUserForm.first_name}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, first_name: e.target.value })}
                      placeholder="e.g. Lebo"
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Last Name</label>
                    <input
                      required
                      value={createUserForm.last_name}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, last_name: e.target.value })}
                      placeholder="e.g. Mokoena"
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Username</label>
                    <input
                      required
                      value={createUserForm.username}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, username: e.target.value })}
                      placeholder="e.g. lebo.m"
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Initial Password</label>
                    <input
                      required
                      type="password"
                      value={createUserForm.password}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                      placeholder="Set password"
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                {createUserForm.role === 'doctor' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Specialty Area</label>
                    <input
                      required
                      value={createUserForm.specialty}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, specialty: e.target.value })}
                      placeholder="e.g. Gynaecologist, Pediatrician"
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Email Address (Used for OTP Verification) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="email"
                    required
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                    placeholder="e.g. dr.moyo@nectacare.co.zw"
                    style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Phone Contact</label>
                  <input
                    value={createUserForm.phone}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, phone: e.target.value })}
                    placeholder="e.g. +263..."
                    style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(29,44,72,0.02)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    id="create-force-change"
                    checked={createUserForm.change_password_on_next_login}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, change_password_on_next_login: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="create-force-change" style={{ fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}>
                    Force change password on next login
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                  <button type="submit" className="cta-button" style={{ flex: 1, height: '40px' }}>Save User Profile</button>
                  <button type="button" className="secondary-button" style={{ flex: 1, height: '40px' }} onClick={() => setShowCreateModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manage User Side Drawer (Slide-out panel) */}
      {showManageDrawer && selectedUserForManage && (
        <div className="drawer-overlay">
          {/* Overlay click area to close */}
          <div 
            style={{ position: 'absolute', inset: 0, zIndex: -1 }} 
            onClick={() => setShowManageDrawer(false)}
          />
          <div className="drawer-panel" style={{ width: '480px' }}>
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px 24px', 
              borderBottom: '1px solid var(--border)', 
              background: '#f8fafc' 
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h3 style={{ marginTop: 0, margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>Manage User Account</h3>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {selectedUserForManage.title} ({selectedUserForManage.user.username})
                </span>
              </div>
              <button 
                onClick={() => setShowManageDrawer(false)} 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ×
              </button>
            </div>
            
            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {error && (
                <div className="auth3-error-box" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{error}</span>
                  <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                </div>
              )}
              
              {/* Section 1: Edit Profile details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ margin: '0 0 4px 0', borderBottom: '1px solid var(--border)', paddingBottom: '6px', color: 'var(--primary)' }}>
                  <i className="fa-solid fa-user-pen" style={{ marginRight: '8px' }}></i> Edit Information
                </h4>
                <form onSubmit={handleUpdateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Role Type</label>
                    <select
                      value={manageEditForm.role}
                      onChange={(e) => setManageEditForm({ ...manageEditForm, role: e.target.value })}
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'white' }}
                    >
                      <option value="doctor">Healthcare Doctor (Practitioner)</option>
                      <option value="admin">Platform Administrator</option>
                      <option value="sysadmin">System Administrator</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold' }}>First Name</label>
                      <input
                        required
                        value={manageEditForm.first_name}
                        onChange={(e) => setManageEditForm({ ...manageEditForm, first_name: e.target.value })}
                        placeholder="First name"
                        style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Last Name</label>
                      <input
                        required
                        value={manageEditForm.last_name}
                        onChange={(e) => setManageEditForm({ ...manageEditForm, last_name: e.target.value })}
                        placeholder="Last name"
                        style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Username</label>
                    <input
                      required
                      value={manageEditForm.username}
                      onChange={(e) => setManageEditForm({ ...manageEditForm, username: e.target.value })}
                      placeholder="Username"
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    />
                  </div>

                  {manageEditForm.role === 'doctor' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Specialty Area</label>
                      <input
                        required
                        value={manageEditForm.specialty}
                        onChange={(e) => setManageEditForm({ ...manageEditForm, specialty: e.target.value })}
                        placeholder="e.g. Cardiologist"
                        style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Email Address (Used for OTP Verification)</label>
                    <input
                      type="email"
                      value={manageEditForm.email}
                      onChange={(e) => setManageEditForm({ ...manageEditForm, email: e.target.value })}
                      placeholder="e.g. dr.moyo@nectacare.co.zw"
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Phone Contact</label>
                    <input
                      value={manageEditForm.phone}
                      onChange={(e) => setManageEditForm({ ...manageEditForm, phone: e.target.value })}
                      placeholder="e.g. +27..."
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(29,44,72,0.02)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <input
                      type="checkbox"
                      id="edit-force-change"
                      checked={manageEditForm.change_password_on_next_login}
                      onChange={(e) => setManageEditForm({ ...manageEditForm, change_password_on_next_login: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="edit-force-change" style={{ fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}>
                      Force change password on next login
                    </label>
                  </div>

                  <button type="submit" className="cta-button" style={{ height: '38px', fontWeight: 'bold' }}>
                    Update Information
                  </button>
                </form>
              </div>

              {/* Section 2: Reset Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <h4 style={{ margin: '0 0 4px 0', borderBottom: '1px solid var(--border)', paddingBottom: '6px', color: 'var(--primary)' }}>
                  <i className="fa-solid fa-key" style={{ marginRight: '8px' }}></i> Reset Password
                </h4>
                <form onSubmit={handleManageResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>New Password</label>
                    <input
                      required
                      type="password"
                      value={manageResetForm.new_password}
                      onChange={(e) => setManageResetForm({ ...manageResetForm, new_password: e.target.value })}
                      placeholder="Enter new credentials"
                      style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(29,44,72,0.02)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <input
                      type="checkbox"
                      id="reset-force-change"
                      checked={manageResetForm.change_password_on_next_login}
                      onChange={(e) => setManageResetForm({ ...manageResetForm, change_password_on_next_login: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="reset-force-change" style={{ fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}>
                      Force change password on next login
                    </label>
                  </div>

                  <button type="submit" className="cta-button" style={{ height: '38px', fontWeight: 'bold' }}>
                    Reset Password
                  </button>
                </form>
              </div>

              {/* Section 3: Danger Zone */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '14px', 
                border: '1px solid #fee2e2', 
                padding: '16px', 
                borderRadius: '8px', 
                background: '#fef2f2' 
              }}>
                <h4 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i> Danger Zone
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#991b1b' }}>
                  Deleting this user will permanently remove their records, appointments, and credentials from the system. This action cannot be undone.
                </p>
                
                {showDeleteConfirm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#ef4444' }}>Are you absolutely sure?</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={handleDeleteUserSubmit} 
                        style={{ 
                          flex: 1, 
                          height: '36px', 
                          background: '#ef4444', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px', 
                          cursor: 'pointer',
                          fontWeight: 'bold' 
                        }}
                      >
                        Yes, Delete Account
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(false)} 
                        style={{ 
                          flex: 1, 
                          height: '36px', 
                          background: '#e2e8f0', 
                          color: '#475569', 
                          border: 'none', 
                          borderRadius: '6px', 
                          cursor: 'pointer',
                          fontWeight: 'bold' 
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)} 
                    style={{ 
                      height: '38px', 
                      background: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      fontWeight: 'bold',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                  >
                    Delete User Account
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
      {/* Edit CellMed Member Modal */}
      {showEditMemberModal && selectedMemberForEdit && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="panel" style={{ width: '560px', padding: '28px', background: 'white', borderRadius: '18px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ marginTop: 0, margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                <i className="fa-solid fa-user-pen" style={{ marginRight: '8px', color: '#f59e0b' }}></i> Edit Member Details
              </h3>
              <button onClick={() => setShowEditMemberModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
            </div>
            <form onSubmit={handleUpdateMemberSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Membership # *</label>
                  <input
                    required
                    value={editMemberForm.membership_number}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, membership_number: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Insurer *</label>
                  <input
                    required
                    value={editMemberForm.insurer}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, insurer: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>First Name *</label>
                  <input
                    required
                    value={editMemberForm.first_name}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, first_name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Last Name *</label>
                  <input
                    required
                    value={editMemberForm.last_name}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, last_name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Plan (e.g. Manuka, Silver, Diamond, Diaspora)</label>
                  <input
                    value={editMemberForm.plan}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, plan: e.target.value })}
                    placeholder="e.g. Manuka, Silver, Diamond, Diaspora"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>National ID Number</label>
                  <input
                    value={editMemberForm.id_number}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, id_number: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Phone Number</label>
                  <input
                    value={editMemberForm.phone}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Email Address</label>
                  <input
                    type="email"
                    value={editMemberForm.email}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, email: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Address</label>
                <input
                  value={editMemberForm.address}
                  onChange={(e) => setEditMemberForm({ ...editMemberForm, address: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="submit" className="cta-button" style={{ flex: 1, height: '40px' }}>Save Member Details</button>
                <button type="button" className="secondary-button" style={{ flex: 1, height: '40px' }} onClick={() => setShowEditMemberModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {showDeleteMemberModal && selectedMemberForDelete && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="panel" style={{ width: '420px', padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #fee2e2' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
              <i className="fa-solid fa-triangle-exclamation"></i> Delete CellMed Member Record
            </h4>
            <p style={{ fontSize: '13.5px', color: '#475569', margin: '0 0 20px 0', lineHeight: '1.5' }}>
              Are you sure you want to delete member <strong>{selectedMemberForDelete.first_name} {selectedMemberForDelete.last_name}</strong> ({selectedMemberForDelete.membership_number})? This record will be permanently removed from the roster.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleDeleteMemberSubmit}
                style={{
                  flex: 1,
                  height: '38px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Delete Member
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteMemberModal(false)}
                style={{
                  flex: 1,
                  height: '38px',
                  background: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
