import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { request } from './api.js';
import {
  IconGraduationCap,
  IconBuilding,
  IconLayers,
  IconCalendar,
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCopy,
  IconCheck,
  IconMail,
  IconPhone,
  IconDownload,
  IconGrid,
  IconList,
  IconSun,
  IconMoon,
  IconClose,
  IconAlertTriangle,
  IconSparkles,
  IconArrowUpRight
} from './icons.jsx';

const emptyStudent = {
  studentId: '',
  name: '',
  email: '',
  department: '',
  section: '',
  semester: '',
  contact: ''
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
  'linear-gradient(135deg, #f97316 0%, #c2410c 100%)'
];

function getAvatarStyle(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('campus_theme') || 'dark');
  const [page, setPage] = useState('overview');
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  
  // Modals & UI states
  const [form, setForm] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [toasts, setToasts] = useState([]);
  
  const searchInputRef = useRef(null);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('campus_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Toast Helper
  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Data Loading
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, dRes] = await Promise.all([
        request('/api/students'),
        request('/api/departments')
      ]);
      setStudents(sRes.data || []);
      setDepartments(dRes.data || []);
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (form && !saving) setForm(null);
        if (deleteModal) setDeleteModal(null);
      }
      if ((e.key === '/' || (e.metaKey && e.key === 'k')) && !form && !deleteModal) {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          if (page !== 'students') setPage('students');
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [form, deleteModal, saving, page]);

  // Derived Department Counts
  const counts = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      const id = s.department?._id;
      if (id) map[id] = (map[id] || 0) + 1;
    });
    return map;
  }, [students]);

  // Filtered & Sorted Students
  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = students.filter((s) => {
      const matchesDept = !deptFilter || s.department?._id === deptFilter;
      const matchesSection = !sectionFilter || s.section === sectionFilter;
      const matchesQuery =
        !q ||
        [s.studentId, s.name, s.email, s.department?.name, s.section, String(s.semester)]
          .join(' ')
          .toLowerCase()
          .includes(q);
      return matchesDept && matchesSection && matchesQuery;
    });

    if (sortBy === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'id') {
      list.sort((a, b) => a.studentId.localeCompare(b.studentId));
    } else if (sortBy === 'semester') {
      list.sort((a, b) => a.semester - b.semester);
    }
    return list;
  }, [students, query, deptFilter, sectionFilter, sortBy]);

  // Form Handlers
  const openStudent = (student = null) => {
    setForm({
      type: 'student',
      student,
      formError: '',
      values: student
        ? {
            studentId: student.studentId,
            name: student.name,
            email: student.email,
            department: student.department?._id || '',
            section: student.section,
            semester: String(student.semester),
            contact: student.contact || ''
          }
        : {
            ...emptyStudent,
            department: deptFilter || departments[0]?._id || ''
          }
    });
  };

  const openDepartment = (department = null) => {
    setForm({
      type: 'department',
      department,
      formError: '',
      values: {
        name: department?.name || '',
        sections: department ? department.sections.join(', ') : ''
      }
    });
  };

  const setField = (k, v, extra = {}) => {
    setForm((f) => ({
      ...f,
      values: { ...f.values, [k]: v, ...extra }
    }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { type, student, department, values } = form;
      if (type === 'student') {
        const path = student
          ? `/api/students/${encodeURIComponent(student.studentId)}`
          : '/api/students';
        await request(path, {
          method: student ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...values,
            semester: Number(values.semester)
          })
        });
        addToast(student ? `Updated record for ${values.name}` : `Student ${values.name} added successfully!`, 'success');
      } else {
        const sections = [
          ...new Set(
            values.sections
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          )
        ];
        await request(
          department ? `/api/departments/${department._id}` : '/api/departments',
          {
            method: department ? 'PUT' : 'POST',
            body: JSON.stringify({ name: values.name, sections })
          }
        );
        addToast(department ? `Department ${values.name} updated` : `Department ${values.name} created`, 'success');
      }
      setForm(null);
      await loadData();
    } catch (e) {
      setForm((f) => ({ ...f, formError: e.message }));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { kind, item } = deleteModal;
    setSaving(true);
    try {
      const path =
        kind === 'student'
          ? `/api/students/${encodeURIComponent(item.studentId)}`
          : `/api/departments/${item._id}`;
      await request(path, { method: 'DELETE' });
      addToast(`Deleted ${item.name}`, 'success');
      setDeleteModal(null);
      await loadData();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast(`Copied ${text} to clipboard`, 'info');
    setTimeout(() => setCopiedId(''), 2000);
  };

  // CSV Export
  const exportCSV = () => {
    if (!visibleStudents.length) {
      addToast('No students to export', 'error');
      return;
    }
    const headers = ['Student ID', 'Full Name', 'Email', 'Department', 'Section', 'Semester', 'Phone'];
    const rows = visibleStudents.map((s) => [
      `"${s.studentId}"`,
      `"${s.name}"`,
      `"${s.email}"`,
      `"${s.department?.name || ''}"`,
      `"${s.section || ''}"`,
      s.semester,
      `"${s.contact || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `campusdesk_students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${visibleStudents.length} student records`, 'success');
  };

  // Stats Calculations
  const sectionsTotal = departments.reduce((n, d) => n + d.sections.length, 0);
  const semestersTotal = new Set(students.map((s) => s.semester)).size;
  const formSections =
    departments.find((d) => d._id === form?.values?.department)?.sections || [];

  return (
    <div className="app-container">
      {/* Navbar */}
      <header className="navbar">
        <div className="nav-content">
          <div className="nav-brand">
            <div className="brand-icon">
              <IconGraduationCap size={22} />
            </div>
            <div className="brand-info">
              <span className="brand-name">CampusDesk</span>
              <span className="brand-badge">
                <span className="status-dot" /> Live Registry
              </span>
            </div>
          </div>

          <nav className="nav-links" aria-label="Main Navigation">
            <button
              className={`nav-tab ${page === 'overview' ? 'active' : ''}`}
              onClick={() => setPage('overview')}
            >
              <IconSparkles size={16} /> Overview
            </button>
            <button
              className={`nav-tab ${page === 'students' ? 'active' : ''}`}
              onClick={() => {
                setDeptFilter('');
                setSectionFilter('');
                setQuery('');
                setPage('students');
              }}
            >
              <IconGraduationCap size={16} /> Students
              <span className="nav-tab-badge">{students.length}</span>
            </button>
            <button
              className={`nav-tab ${page === 'departments' ? 'active' : ''}`}
              onClick={() => setPage('departments')}
            >
              <IconBuilding size={16} /> Departments
              <span className="nav-tab-badge">{departments.length}</span>
            </button>
          </nav>

          <div className="nav-actions">
            <button
              className="theme-btn"
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
            <button
              className="btn-primary"
              onClick={() => openStudent()}
              disabled={!departments.length}
            >
              <IconPlus size={16} /> Add Student
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-wrapper anim-fade" key={page}>
        {/* OVERVIEW PAGE */}
        {page === 'overview' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Institution Overview</h1>
                <p className="page-subtitle">Real-time academic metrics, departmental occupancy, and student records</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={exportCSV} disabled={!students.length}>
                  <IconDownload size={16} /> Export CSV
                </button>
                <button className="btn-primary" onClick={() => openDepartment()}>
                  <IconPlus size={16} /> Add Department
                </button>
              </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon indigo">
                    <IconGraduationCap size={22} />
                  </div>
                  <span className="stat-badge">Active Cohort</span>
                </div>
                <div className="stat-value">{loading ? '—' : students.length}</div>
                <div className="stat-label">Total Enrolled Students</div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon cyan">
                    <IconBuilding size={22} />
                  </div>
                  <span className="stat-badge">{sectionsTotal} Sections</span>
                </div>
                <div className="stat-value">{loading ? '—' : departments.length}</div>
                <div className="stat-label">Academic Departments</div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon emerald">
                    <IconLayers size={22} />
                  </div>
                  <span className="stat-badge">Classrooms</span>
                </div>
                <div className="stat-value">{loading ? '—' : sectionsTotal}</div>
                <div className="stat-label">Active Sections Configured</div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon amber">
                    <IconCalendar size={22} />
                  </div>
                  <span className="stat-badge">Semesters</span>
                </div>
                <div className="stat-value">{loading ? '—' : semestersTotal}</div>
                <div className="stat-label">Academic Terms Active</div>
              </div>
            </div>

            {/* Department Distribution Visualization */}
            {departments.length > 0 && students.length > 0 && (
              <div className="distribution-card">
                <div className="dist-header">
                  <span className="dist-title">Department Enrollment Breakdown</span>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    {students.length} total students
                  </span>
                </div>
                <div className="dist-bar-track">
                  {departments.map((d, i) => {
                    const count = counts[d._id] || 0;
                    const percent = (count / students.length) * 100;
                    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
                    const color = colors[i % colors.length];
                    if (percent === 0) return null;
                    return (
                      <div
                        key={d._id}
                        className="dist-bar-seg"
                        style={{ width: `${percent}%`, backgroundColor: color }}
                        title={`${d.name}: ${count} (${percent.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="dist-legend">
                  {departments.map((d, i) => {
                    const count = counts[d._id] || 0;
                    const percent = students.length ? ((count / students.length) * 100).toFixed(0) : 0;
                    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={d._id} className="dist-item">
                        <span className="dist-dot" style={{ backgroundColor: color }} />
                        <span style={{ fontWeight: 600 }}>{d.name}:</span>
                        <span>{count} ({percent}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Students Table Preview */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '32px 0 16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--heading)' }}>
                Recently Added Students
              </h2>
              {students.length > 5 && (
                <button
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  onClick={() => setPage('students')}
                >
                  View All ({students.length}) <IconArrowUpRight size={14} />
                </button>
              )}
            </div>

            {loading ? (
              <div className="table-container" style={{ padding: '24px' }}>
                <div className="skeleton" style={{ height: '36px', marginBottom: '12px' }} />
                <div className="skeleton" style={{ height: '36px', marginBottom: '12px' }} />
                <div className="skeleton" style={{ height: '36px' }} />
              </div>
            ) : students.length ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Student ID</th>
                      <th>Department</th>
                      <th>Section</th>
                      <th>Semester</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.slice(0, 6).map((s) => (
                      <tr key={s._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="avatar" style={{ background: getAvatarStyle(s.name), width: '36px', height: '36px', fontSize: '13px' }}>
                              {getInitials(s.name)}
                            </div>
                            <div>
                              <div className="table-student-name">{s.name}</div>
                              <div className="table-student-email">{s.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="id-badge">
                            {s.studentId}
                            <button
                              className="id-copy-btn"
                              onClick={() => copyToClipboard(s.studentId, s._id)}
                              title="Copy ID"
                            >
                              {copiedId === s._id ? <IconCheck size={12} /> : <IconCopy size={12} />}
                            </button>
                          </span>
                        </td>
                        <td>
                          <span className="pill pill-dept">{s.department?.name || 'Unassigned'}</span>
                        </td>
                        <td>
                          <span className="pill pill-section">Sec {s.section || '—'}</span>
                        </td>
                        <td>
                          <span className="pill pill-sem">Sem {s.semester}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-action"
                            onClick={() => openStudent(s)}
                            style={{ marginRight: '6px' }}
                          >
                            <IconEdit size={13} /> Edit
                          </button>
                          <button
                            className="btn-action danger"
                            onClick={() => setDeleteModal({ kind: 'student', item: s })}
                          >
                            <IconTrash size={13} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-box">
                <div className="empty-icon"><IconGraduationCap size={28} /></div>
                <div className="empty-title">No Students Registered Yet</div>
                <div className="empty-desc">Get started by creating departments and adding your first student to the system.</div>
                <button className="btn-primary" onClick={() => openStudent()} disabled={!departments.length}>
                  <IconPlus size={16} /> Add First Student
                </button>
              </div>
            )}
          </>
        )}

        {/* STUDENTS PAGE */}
        {page === 'students' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Student Directory</h1>
                <p className="page-subtitle">Search, filter, edit records, and manage cohort enrollments</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={exportCSV} disabled={!visibleStudents.length}>
                  <IconDownload size={16} /> Export ({visibleStudents.length})
                </button>
                <button
                  className="btn-primary"
                  onClick={() => openStudent()}
                  disabled={!departments.length}
                >
                  <IconPlus size={16} /> Add Student
                </button>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="toolbar">
              <div className="search-box">
                <span className="search-icon"><IconSearch size={18} /></span>
                <input
                  ref={searchInputRef}
                  className="search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, ID, email or section... (Press '/' to focus)"
                  aria-label="Search students"
                />
                {query && (
                  <button className="search-clear" onClick={() => setQuery('')}>
                    <IconClose size={14} />
                  </button>
                )}
              </div>

              <div className="filters-group">
                <select
                  className="select-filter"
                  value={deptFilter}
                  onChange={(e) => {
                    setDeptFilter(e.target.value);
                    setSectionFilter('');
                  }}
                  aria-label="Filter by department"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>

                {deptFilter && (
                  <select
                    className="select-filter"
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    aria-label="Filter by section"
                  >
                    <option value="">All Sections</option>
                    {(departments.find((d) => d._id === deptFilter)?.sections || []).map((s) => (
                      <option key={s} value={s}>Section {s}</option>
                    ))}
                  </select>
                )}

                <select
                  className="select-filter"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort by"
                >
                  <option value="recent">Sort: Most Recent</option>
                  <option value="name-asc">Sort: Name (A → Z)</option>
                  <option value="name-desc">Sort: Name (Z → A)</option>
                  <option value="id">Sort: Student ID</option>
                  <option value="semester">Sort: Semester</option>
                </select>

                <div className="view-toggle">
                  <button
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    <IconGrid size={17} />
                  </button>
                  <button
                    className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                    title="Table View"
                  >
                    <IconList size={17} />
                  </button>
                </div>
              </div>
            </div>

            {/* Students List Display */}
            {loading ? (
              <div className="student-grid">
                {[1, 2, 3, 4, 5, 6].map((k) => (
                  <div key={k} className="student-card skeleton" style={{ height: '220px' }} />
                ))}
              </div>
            ) : visibleStudents.length ? (
              viewMode === 'grid' ? (
                <div className="student-grid">
                  {visibleStudents.map((s) => (
                    <div key={s._id} className="student-card anim-fade">
                      <div>
                        <div className="student-card-header">
                          <div className="avatar" style={{ background: getAvatarStyle(s.name) }}>
                            {getInitials(s.name)}
                          </div>
                          <div className="student-card-meta">
                            <div className="student-name" title={s.name}>{s.name}</div>
                            <span className="id-badge">
                              {s.studentId}
                              <button
                                className="id-copy-btn"
                                onClick={() => copyToClipboard(s.studentId, s._id)}
                                title="Copy ID"
                              >
                                {copiedId === s._id ? <IconCheck size={12} /> : <IconCopy size={12} />}
                              </button>
                            </span>
                          </div>
                        </div>

                        <div className="student-details">
                          <div className="detail-row">
                            <IconMail size={14} style={{ color: 'var(--text-muted)' }} />
                            <a href={`mailto:${s.email}`} title={s.email}>{s.email}</a>
                          </div>
                          {s.contact && (
                            <div className="detail-row">
                              <IconPhone size={14} style={{ color: 'var(--text-muted)' }} />
                              <a href={`tel:${s.contact}`}>{s.contact}</a>
                            </div>
                          )}
                          <div className="student-pills">
                            <span className="pill pill-dept">{s.department?.name || 'No Dept'}</span>
                            <span className="pill pill-section">Sec {s.section || '—'}</span>
                            <span className="pill pill-sem">Sem {s.semester}</span>
                          </div>
                        </div>
                      </div>

                      <div className="student-card-actions">
                        <button className="btn-action" onClick={() => openStudent(s)}>
                          <IconEdit size={14} /> Edit
                        </button>
                        <button
                          className="btn-action danger"
                          onClick={() => setDeleteModal({ kind: 'student', item: s })}
                        >
                          <IconTrash size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="table-container anim-fade">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Student ID</th>
                        <th>Department</th>
                        <th>Section</th>
                        <th>Semester</th>
                        <th>Contact</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStudents.map((s) => (
                        <tr key={s._id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div className="avatar" style={{ background: getAvatarStyle(s.name), width: '38px', height: '38px', fontSize: '13px' }}>
                                {getInitials(s.name)}
                              </div>
                              <div>
                                <div className="table-student-name">{s.name}</div>
                                <div className="table-student-email">{s.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="id-badge">
                              {s.studentId}
                              <button
                                className="id-copy-btn"
                                onClick={() => copyToClipboard(s.studentId, s._id)}
                                title="Copy ID"
                              >
                                {copiedId === s._id ? <IconCheck size={12} /> : <IconCopy size={12} />}
                              </button>
                            </span>
                          </td>
                          <td>
                            <span className="pill pill-dept">{s.department?.name || '—'}</span>
                          </td>
                          <td>
                            <span className="pill pill-section">Sec {s.section || '—'}</span>
                          </td>
                          <td>
                            <span className="pill pill-sem">Sem {s.semester}</span>
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {s.contact || '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-action"
                              onClick={() => openStudent(s)}
                              style={{ marginRight: '6px' }}
                            >
                              <IconEdit size={13} /> Edit
                            </button>
                            <button
                              className="btn-action danger"
                              onClick={() => setDeleteModal({ kind: 'student', item: s })}
                            >
                              <IconTrash size={13} /> Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="empty-box">
                <div className="empty-icon"><IconSearch size={28} /></div>
                <div className="empty-title">No Students Match Your Filter</div>
                <div className="empty-desc">Try clearing your search query or department filters to see more results.</div>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setQuery('');
                    setDeptFilter('');
                    setSectionFilter('');
                  }}
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </>
        )}

        {/* DEPARTMENTS PAGE */}
        {page === 'departments' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Departments & Faculties</h1>
                <p className="page-subtitle">Configure academic faculties, manage class sections, and oversee enrollment limits</p>
              </div>
              <button className="btn-primary" onClick={() => openDepartment()}>
                <IconPlus size={16} /> Add Department
              </button>
            </div>

            {loading ? (
              <div className="dept-grid">
                {[1, 2, 3].map((k) => (
                  <div key={k} className="dept-card skeleton" style={{ height: '200px' }} />
                ))}
              </div>
            ) : departments.length ? (
              <div className="dept-grid">
                {departments.map((d) => {
                  const studentCount = counts[d._id] || 0;
                  return (
                    <div key={d._id} className="dept-card anim-fade">
                      <div>
                        <div className="dept-top">
                          <div className="dept-title-group">
                            <div className="dept-icon-box">
                              <IconBuilding size={22} />
                            </div>
                            <div>
                              <div className="dept-name">{d.name}</div>
                              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                {studentCount} enrolled {studentCount === 1 ? 'student' : 'students'}
                              </span>
                            </div>
                          </div>
                          <span className="pill pill-dept">
                            {d.sections.length} {d.sections.length === 1 ? 'Section' : 'Sections'}
                          </span>
                        </div>

                        <div className="dept-sections">
                          <div className="section-label">Configured Sections</div>
                          <div className="section-pills">
                            {d.sections.length ? (
                              d.sections.map((sec) => (
                                <span key={sec} className="section-tag">
                                  Section {sec}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                No sections defined
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '13px' }}
                          onClick={() => {
                            setDeptFilter(d._id);
                            setPage('students');
                          }}
                        >
                          View Students ({studentCount})
                        </button>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-action" onClick={() => openDepartment(d)}>
                            <IconEdit size={14} /> Edit
                          </button>
                          <button
                            className="btn-action danger"
                            onClick={() => setDeleteModal({ kind: 'department', item: d })}
                            disabled={studentCount > 0}
                            title={studentCount > 0 ? 'Cannot delete department with enrolled students' : 'Delete department'}
                          >
                            <IconTrash size={14} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-box">
                <div className="empty-icon"><IconBuilding size={28} /></div>
                <div className="empty-title">No Departments Configured</div>
                <div className="empty-desc">Create your first department with sections to start enrolling students.</div>
                <button className="btn-primary" onClick={() => openDepartment()}>
                  <IconPlus size={16} /> Create Department
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* FORM MODAL (Add / Edit Student or Department) */}
      {form && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setForm(null);
          }}
        >
          <form className="modal-card" onSubmit={submitForm}>
            <div className="modal-header">
              <h2 className="modal-title">
                {form.type === 'student'
                  ? form.student
                    ? 'Edit Student Profile'
                    : 'Register New Student'
                  : form.department
                  ? 'Edit Department Details'
                  : 'Create Academic Department'}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setForm(null)}
                disabled={saving}
              >
                <IconClose size={18} />
              </button>
            </div>

            {form.formError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--danger-light)',
                  border: '1px solid var(--danger)',
                  color: 'var(--danger)',
                  fontSize: '13.5px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <IconAlertTriangle size={18} /> {form.formError}
              </div>
            )}

            {form.type === 'student' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Student ID</label>
                  <input
                    className="form-input"
                    required
                    maxLength="30"
                    placeholder="e.g. CS-2026-042"
                    disabled={Boolean(form.student)}
                    value={form.values.studentId}
                    onChange={(e) => setField('studentId', e.target.value)}
                  />
                  {form.student && (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Student ID is unique and cannot be modified once registered.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="form-input"
                    required
                    maxLength="100"
                    placeholder="e.g. Om Jadhav"
                    value={form.values.name}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Institutional Email</label>
                  <input
                    className="form-input"
                    required
                    type="email"
                    maxLength="254"
                    placeholder="e.g. student@university.edu"
                    value={form.values.email}
                    onChange={(e) => setField('email', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Academic Department</label>
                  <select
                    className="form-select"
                    required
                    value={form.values.department}
                    onChange={(e) => setField('department', e.target.value, { section: '' })}
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Assigned Section</label>
                    <select
                      className="form-select"
                      required={formSections.length > 0}
                      disabled={!formSections.length}
                      value={form.values.section}
                      onChange={(e) => setField('section', e.target.value)}
                    >
                      <option value="" disabled={formSections.length > 0}>
                        {formSections.length ? 'Select Section' : 'No Sections'}
                      </option>
                      {formSections.map((s) => (
                        <option key={s} value={s}>Section {s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Semester (1 - 12)</label>
                    <input
                      className="form-input"
                      required
                      type="number"
                      min="1"
                      max="12"
                      placeholder="e.g. 4"
                      value={form.values.semester}
                      onChange={(e) => setField('semester', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone (Optional)</label>
                  <input
                    className="form-input"
                    type="tel"
                    maxLength="20"
                    placeholder="e.g. +1 555-0199"
                    value={form.values.contact}
                    onChange={(e) => setField('contact', e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Department Name</label>
                  <input
                    className="form-input"
                    required
                    maxLength="80"
                    placeholder="e.g. Computer Science and Engineering"
                    value={form.values.name}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sections (Comma Separated)</label>
                  <input
                    className="form-input"
                    maxLength="500"
                    placeholder="e.g. A, B, C"
                    value={form.values.sections}
                    onChange={(e) => setField('sections', e.target.value)}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Note: Sections that currently have enrolled students cannot be removed.
                  </span>
                </div>
              </>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving Changes...' : form.student || form.department ? 'Save Changes' : 'Create Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setDeleteModal(null);
          }}
        >
          <div className="modal-card danger-modal" style={{ maxWidth: '420px' }}>
            <div className="danger-icon-wrapper">
              <IconAlertTriangle size={30} />
            </div>
            <h2 className="modal-title" style={{ marginBottom: '8px' }}>
              Confirm Deletion
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '24px' }}>
              Are you sure you want to delete{' '}
              <strong style={{ color: 'var(--heading)' }}>
                {deleteModal.item.name}
              </strong>
              ? This action is permanent and cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => setDeleteModal(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={saving}
                onClick={confirmDelete}
                style={{ flex: 1 }}
              >
                {saving ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST STACK */}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-content">
              {t.type === 'success' && <IconCheck size={18} style={{ color: 'var(--accent-emerald)' }} />}
              {t.type === 'error' && <IconAlertTriangle size={18} style={{ color: 'var(--danger)' }} />}
              {t.type === 'info' && <IconSparkles size={18} style={{ color: 'var(--primary)' }} />}
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <IconClose size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
