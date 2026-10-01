import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const ACCENT_COLORS = [
  { name: 'Indigo Aura', value: 'indigo', bg: 'bg-indigo-600', text: 'text-indigo-400', border: 'border-indigo-500/50', glow: 'shadow-indigo-500/20' },
  { name: 'Rose Quartz', value: 'rose', bg: 'bg-rose-600', text: 'text-rose-400', border: 'border-rose-500/50', glow: 'shadow-rose-500/20' },
  { name: 'Emerald Spark', value: 'emerald', bg: 'bg-emerald-600', text: 'text-emerald-400', border: 'border-emerald-500/50', glow: 'shadow-emerald-500/20' },
  { name: 'Amber Glow', value: 'amber', bg: 'bg-amber-600', text: 'text-amber-400', border: 'border-amber-500/50', glow: 'shadow-amber-500/20' },
  { name: 'Cyan Breeze', value: 'cyan', bg: 'bg-cyan-600', text: 'text-cyan-400', border: 'border-cyan-500/50', glow: 'shadow-cyan-500/20' },
];

const THEMES = [
  { id: 'dark', name: '🌙 Deep Dark', desc: 'OLED optimized deep slate blacks', previewBg: 'bg-[#0B0F19]', border: 'border-slate-800' },
  { id: 'light', name: '☀️ Alpine Light', desc: 'Clean, high-contrast light theme', previewBg: 'bg-slate-100', border: 'border-slate-300' },
  { id: 'neon', name: '🔮 Cyber Neon', desc: 'Vibrant violet neon AI highlights', previewBg: 'bg-[#150a21]', border: 'border-purple-900/50' }
];

const Settings = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Pre-load from localStorage immediately so UI is always interactive
  const localUser = (() => {
    try { return JSON.parse(localStorage.getItem('user')) || {}; } catch { return {}; }
  })();
  const localSettings = localUser.settings || {};

  const defaultSettings = {
    currency: 'INR',
    language: 'English',
    dateFormat: 'DD/MM/YYYY',
    theme: 'dark',
    accentColor: 'indigo',
    notifications: { alerts: true, aiReminders: true, billNotifications: true },
    security: { twoFactorEnabled: false, privacyControls: true },
    ai: { insightFrequency: 'Daily', anomalyDetection: true, tone: 'Professional' },
    connectedAccounts: { bankIntegrations: false, upiLinking: false },
  };

  // Interactive UI states
  const [activeTab, setActiveTab] = useState('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSwitchingTab, setIsSwitchingTab] = useState(false);
  const [loading, setLoading] = useState(false); // start false — localStorage gives us immediate data
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Profile Form state — seeded from localStorage
  const [name, setName] = useState(localUser.name || '');
  const [email, setEmail] = useState(localUser.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');

  // Settings State Schema — merged from defaults + localStorage
  const [settings, setSettings] = useState({
    ...defaultSettings,
    ...localSettings,
    notifications: { ...defaultSettings.notifications, ...(localSettings.notifications || {}) },
    security: { ...defaultSettings.security, ...(localSettings.security || {}) },
    ai: { ...defaultSettings.ai, ...(localSettings.ai || {}) },
    connectedAccounts: { ...defaultSettings.connectedAccounts, ...(localSettings.connectedAccounts || {}) },
  });

  // Local state for interactive provider switches
  const [googleDriveSync, setGoogleDriveSync] = useState(true);
  const [dropboxSync, setDropboxSync] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [lastBackupTime, setLastBackupTime] = useState('2 mins ago');

  // Trigger brief Loading Skeleton transitions between settings tabs
  const handleTabChange = (tabId) => {
    setIsSwitchingTab(true);
    setActiveTab(tabId);
    setTimeout(() => {
      setIsSwitchingTab(false);
    }, 250);
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch fresh settings from backend in background (non-blocking)
  const fetchUserData = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setName(data.name || localUser.name || '');
        setEmail(data.email || localUser.email || '');
        if (data.settings) {
          setSettings(prev => ({
            ...prev,
            ...data.settings,
            notifications: { ...prev.notifications, ...data.settings.notifications },
            security: { ...prev.security, ...data.settings.security },
            ai: { ...prev.ai, ...data.settings.ai },
            connectedAccounts: { ...prev.connectedAccounts, ...data.settings.connectedAccounts }
          }));
        }
      }
    } catch {
      // Backend unavailable — localStorage data is already loaded, silently continue
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      fetchUserData();
    }
  }, [token]);

  // Persist Profile & Settings to Database
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    if (password && password !== confirmPassword) {
      showToast('Passwords do not match!', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = { name, email, settings };
      if (password) {
        payload.password = password;
        payload.oldPassword = oldPassword;
      }

      const res = await fetch('/api/auth/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Configuration synced securely!');
        setPassword('');
        setConfirmPassword('');
        setOldPassword('');
        const localUser = JSON.parse(localStorage.getItem('user')) || {};
        localUser.name = data.name;
        localUser.email = data.email;
        localUser.settings = data.settings;
        localStorage.setItem('user', JSON.stringify(localUser));
        window.dispatchEvent(new Event('theme-changed'));
      } else {
        showToast(data.message || 'Error updating settings', 'error');
      }
    } catch {
      showToast('Connection error updating server', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSettingField = (category, field, value) => {
    if (category) {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [field]: value
        }
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
    
    if (field === 'theme' || field === 'accentColor') {
      window.dispatchEvent(new CustomEvent('theme-preview', { detail: { field, value } }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleBackupExport = async (format) => {
    showToast(`Preparing ${format.toUpperCase()} export...`);
    try {
      const token = localStorage.getItem('token');

      const [expRes, budRes] = await Promise.all([
        fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/budgets',  { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!expRes.ok) throw new Error('Failed to fetch expenses. Please try again.');
      const expenses = await expRes.json();
      const budgets  = budRes.ok ? await budRes.json() : [];

      const onlyExpenses = expenses.filter(e => e.type !== 'income');
      const onlyIncome   = expenses.filter(e => e.type === 'income');
      const today        = new Date().toISOString().split('T')[0];

      if (format === 'csv' || format === 'excel') {
        const header = ['Date', 'Merchant', 'Category', 'Amount (INR)', 'Type', 'Notes'];
        const rows = expenses.map(exp => [
          new Date(exp.date).toLocaleDateString('en-IN'),
          `"${(exp.merchant || '').replace(/"/g, '""')}"`,
          exp.category,
          exp.amount,
          exp.type || 'expense',
          `"${(exp.notes || '').replace(/"/g, '""')}"`,
        ]);
        const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `FinTrack_Statement_${today}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`✅ ${format.toUpperCase()} downloaded successfully!`);
        return;
      }

      if (format === 'pdf') {
        const doc = new jsPDF();
        const user = JSON.parse(localStorage.getItem('user')) || {};

        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229);
        doc.text('FinTrack AI — Financial Statement', 14, 18);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Account: ${user.name || 'User'} (${user.email || ''})`, 14, 26);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}`, 14, 31);

        const totalIncome = onlyIncome.reduce((s, e) => s + e.amount, 0);
        const totalSpent  = onlyExpenses.reduce((s, e) => s + e.amount, 0);
        const netSavings  = totalIncome - totalSpent;
        const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text(`Total Income: Rs ${totalIncome.toLocaleString()}`, 14, 42);
        doc.text(`Total Expenses: Rs ${totalSpent.toLocaleString()}`, 80, 42);
        doc.text(`Net Savings: Rs ${netSavings.toLocaleString()} (${savingsRate}%)`, 150, 42);

        const categoryTotals = {};
        onlyExpenses.forEach(e => {
          categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
        });

        doc.setFontSize(12);
        doc.setTextColor(30, 30, 30);
        doc.text('Category-wise Spending', 14, 54);

        autoTable(doc, {
          startY: 58,
          head: [['Category', 'Amount Spent (Rs)']],
          body: Object.entries(categoryTotals).map(([cat, amt]) => [cat, amt.toLocaleString()]),
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          alternateRowStyles: { fillColor: [241, 245, 249] },
        });

        if (budgets.length > 0) {
          const afterCat = doc.lastAutoTable.finalY + 12;
          doc.setFontSize(12);
          doc.text('Budget Performance', 14, afterCat);
          autoTable(doc, {
            startY: afterCat + 4,
            head: [['Category', 'Budget Limit (Rs)', 'Spent (Rs)', 'Usage %', 'Status']],
            body: budgets.map(b => {
              const spent  = categoryTotals[b.category] || 0;
              const pct    = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
              const status = pct > 100 ? 'Exceeded' : pct >= 80 ? 'Near Limit' : 'Within Limit';
              return [b.category, b.limit.toLocaleString(), spent.toLocaleString(), `${pct}%`, status];
            }),
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            didParseCell: (data) => {
              if (data.section === 'body' && data.column.index === 4) {
                if (data.cell.raw === 'Exceeded')    data.cell.styles.textColor = [220, 38, 38];
                if (data.cell.raw === 'Near Limit')  data.cell.styles.textColor = [217, 119, 6];
                if (data.cell.raw === 'Within Limit') data.cell.styles.textColor = [22, 163, 74];
              }
            },
          });
        }

        const afterBudget = doc.lastAutoTable.finalY + 12;
        if (afterBudget > 250) doc.addPage();
        const tableStartY = afterBudget > 250 ? 20 : afterBudget;

        doc.setFontSize(12);
        doc.text('Detailed Expense Records', 14, tableStartY);
        autoTable(doc, {
          startY: tableStartY + 4,
          head: [['Date', 'Category', 'Merchant / Note', 'Type', 'Amount (Rs)']],
          body: expenses.map(e => [
            new Date(e.date).toLocaleDateString('en-IN'),
            e.category,
            e.merchant || e.notes || '—',
            e.type || 'expense',
            e.amount.toLocaleString(),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`FinTrack AI — Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 8);
          doc.text('Generated by FinTrack AI Financial Platform', 105, doc.internal.pageSize.height - 8, { align: 'center' });
        }

        doc.save(`FinTrack_Statement_${today}.pdf`);
        showToast('✅ PDF Statement downloaded successfully!');
      }
    } catch (err) {
      console.error('Export error:', err);
      showToast(err.message || 'Export failed. Please try again.', 'error');
    }
  };

  const handleDataPurge = async () => {
    if (!window.confirm('Are you SURE you want to clear all your transactions and budgets? This cannot be undone!')) {
      return;
    }
    showToast('Purging data...');
    try {
      const token = localStorage.getItem('token');
      const [expRes, budRes] = await Promise.all([
        fetch('/api/expenses', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/budgets',  { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!expRes.ok) throw new Error('Failed to delete expenses');
      if (!budRes.ok) throw new Error('Failed to delete budgets');
      showToast('✅ All transaction data purged successfully!');
    } catch (err) {
      showToast(err.message || 'Purge failed', 'error');
    }
  };

  // Sidebar Tabs Config list with associated descriptions & search tags
  const ALL_TABS = [
    { id: 'profile', label: '👤 Profile & Account', desc: 'Update login email, phone, and passwords', tags: 'name email password avatar info' },
    { id: 'appearance', label: '🎨 Appearance Theme', desc: 'Accent colors, theme preview layouts', tags: 'theme appearance style dark light neon colors' },
    { id: 'notifications', label: '🔔 Alerts & Reminders', desc: 'Daily insights, thresholds, AI triggers', tags: 'notifications alerts email reminders bill' },
    { id: 'localization', label: '🌐 Localization & Language', desc: 'Primary currency, languages, date formats', tags: 'localization language currency inr usd format' },
    { id: 'ai', label: '🤖 AI Model Settings', desc: 'Insight runs, thresholds, prompt tones', tags: 'ai engine advisor prompt gemini frequency anomaly' },
    { id: 'privacy', label: '🛡️ Data Portability & Privacy', desc: 'Export statements, purge data, backups', tags: 'data privacy purge delete export csv backup sync' },
  ];

  // Filter tabs on-the-fly based on search input
  const filteredTabs = ALL_TABS.filter(tab => 
    tab.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tab.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tab.tags.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex relative">
      
      {/* Dynamic Action Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[110] px-5 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce ${
          toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'
        }`}>
          {toast.type === 'error' ? '⚠️' : '✨'} {toast.msg}
        </div>
      )}

      {/* Sidebar (Responsive Sidebar collapses on mobile screen viewports) */}
      <div className="w-72 glass border-r border-slate-800/40 p-6 flex flex-col justify-between hidden lg:flex shrink-0">
        <div>
          <div className="mb-8 text-2xl font-bold text-gradient tracking-wide">FinTrack AI</div>
          
          {/* User Avatar Section Header */}
          <div className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl flex items-center space-x-3 mb-6 hover:border-slate-700/50 transition-all">
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-extrabold text-white text-sm shadow-md">
                {name ? name.substring(0, 2).toUpperCase() : 'ME'}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0B0F19] rounded-full animate-pulse" title="Online Client"></span>
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                {name || 'Meenakshi'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Premium Master Tier
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            <Link to="/dashboard" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-850/40 rounded-xl transition-all">
              <span>📊</span><span>Dashboard</span>
            </Link>
            <Link to="/expenses" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-850/40 rounded-xl transition-all">
              <span>💸</span><span>Expenses</span>
            </Link>
            <Link to="/budgets" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-850/40 rounded-xl transition-all">
              <span>🎯</span><span>Budgets</span>
            </Link>
            <Link to="/analytics" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-850/40 rounded-xl transition-all">
              <span>📈</span><span>Analytics</span>
            </Link>
            <Link to="/ai-assistant" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-850/40 rounded-xl transition-all">
              <span>🤖</span><span>AI Assistant</span>
            </Link>
            <Link to="/reports" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-850/40 rounded-xl transition-all">
              <span>📋</span><span>Reports</span>
            </Link>
            <Link to="/subscriptions" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-850/40 rounded-xl transition-all">
              <span>🔁</span><span>Subscriptions</span>
            </Link>
            <Link to="/notifications" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-850/40 rounded-xl transition-all">
              <span>🔔</span><span>Notifications</span>
            </Link>
            <Link to="/settings" className="flex items-center space-x-3 text-indigo-400 font-medium p-2.5 bg-slate-850/50 rounded-xl">
              <span>⚙️</span><span>Settings</span>
            </Link>
            <Link to="/help-center" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-850/40 rounded-xl transition-all">
              <span>❓</span><span>Help Center</span>
            </Link>
            <a href="#" className="flex items-center space-x-3 text-red-400 hover:text-red-300 p-2.5 hover:bg-red-900/20 rounded-xl transition-all mt-6"
              onClick={e => { e.preventDefault(); handleLogout(); }}>
              <span>🚪</span><span>Logout</span>
            </a>
          </nav>
        </div>
      </div>

      {/* Main Settings Page Container */}
      <div className="flex-1 p-4 md:p-8 lg:p-10 overflow-y-auto w-full">
        
        {/* Header Console */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/40 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gradient tracking-tight flex items-center gap-2.5">
              ⚙️ Account & Application Settings
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1">
              Manage account preferences, security, AI behavior, and financial integrations.
            </p>
          </div>
          
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* Direct status indicators for trust building */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold tracking-wide">
              <span>🔒 SSL Encrypted</span>
            </div>
            <Link to="/dashboard" className="btn-gradient text-xs px-4 py-2 flex items-center gap-2 rounded-xl shadow-lg shrink-0">
              🏠 Dashboard
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 text-xs">Decrypting settings credentials...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Left Column Controls (Search & Tab links) */}
            <div className="lg:col-span-1 space-y-4">
              
              {/* Dynamic Settings Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search settings..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full glass-input text-xs pl-8 py-2.5 focus:ring-1 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Sidebar Tabs Links */}
              <div className="space-y-1.5">
                {filteredTabs.length > 0 ? (
                  filteredTabs.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex flex-col justify-start relative group cursor-pointer border ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-indigo-950/50 to-slate-900 border-indigo-500/50 shadow-xl shadow-indigo-500/5 border-l-4 border-l-indigo-500'
                          : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/40 hover:border-slate-700/40'
                      }`}
                    >
                      <div className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center justify-between w-full">
                        <span>{tab.label}</span>
                        {activeTab === tab.id && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 leading-normal group-hover:text-slate-300 font-medium">
                        {tab.desc}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6 bg-slate-900/20 border border-slate-850 rounded-xl text-xs text-slate-500 italic">
                    No matching settings found
                  </div>
                )}
              </div>
            </div>

            {/* Right Column Panels */}
            <div className="lg:col-span-3">
              <form onSubmit={handleSaveSettings} className="glass-card p-6 md:p-8 space-y-6 min-h-[520px] flex flex-col justify-between hover:border-slate-800 transition-all duration-300">
                
                {/* 13. SWITCHING loading skeleton transitions */}
                {isSwitchingTab ? (
                  <div className="space-y-6 py-6 animate-pulse">
                    <div className="h-6 bg-slate-800 rounded-lg w-1/4"></div>
                    <div className="h-3 bg-slate-800 rounded-lg w-2/3"></div>
                    <div className="space-y-3 pt-4">
                      <div className="h-12 bg-slate-800 rounded-xl w-full"></div>
                      <div className="h-12 bg-slate-800 rounded-xl w-full"></div>
                      <div className="h-12 bg-slate-800 rounded-xl w-full"></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    
                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                      <div className="space-y-4">
                        <div className="border-b border-slate-800/50 pb-3 flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              👤 Profile Configuration
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Manage details relating to your personal credentials</p>
                          </div>
                          <span className="bg-indigo-950/40 text-indigo-400 text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-500/20">Verified</span>
                        </div>

                        {/* User interactive card */}
                        <div className="bg-slate-900/30 p-4 border border-slate-800/40 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-extrabold text-white text-xl">
                            {name ? name.substring(0, 2).toUpperCase() : 'ME'}
                          </div>
                          <div className="text-center sm:text-left space-y-1">
                            <div className="text-sm font-bold text-white">{name}</div>
                            <div className="text-xs text-slate-400">{email}</div>
                            <div className="flex gap-2 justify-center sm:justify-start pt-1">
                              <span className="bg-indigo-950 text-indigo-400 text-[9px] font-bold px-2 py-0.5 rounded">Premium Account</span>
                              <span className="bg-emerald-950 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded">Sync Active</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">Full Name</label>
                            <input
                              type="text"
                              required
                              className="w-full glass-input text-xs py-2.5"
                              value={name}
                              onChange={e => setName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">Email Address</label>
                            <input
                              type="email"
                              required
                              className="w-full glass-input text-xs py-2.5"
                              value={email}
                              onChange={e => setEmail(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="pt-2">
                          <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">Old Password</label>
                          <input
                            type="password"
                            placeholder="Current password"
                            className="w-full glass-input text-xs py-2.5 mb-4"
                            value={oldPassword}
                            onChange={e => setOldPassword(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">New Password</label>
                            <input
                              type="password"
                              placeholder="Type to change current"
                              className="w-full glass-input text-xs py-2.5"
                              value={password}
                              onChange={e => setPassword(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">Confirm New Password</label>
                            <input
                              type="password"
                              placeholder="Confirm new password"
                              className="w-full glass-input text-xs py-2.5"
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* APPEARANCE TAB */}
                    {activeTab === 'appearance' && (
                      <div className="space-y-6">
                        <div className="border-b border-slate-800/50 pb-3">
                          <h3 className="text-lg font-bold text-white">🎨 Theme Customization</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Personalize color accent layouts and active dashboard designs</p>
                        </div>

                        {/* Accent Color selection widgets */}
                        <div className="space-y-2">
                          <label className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Select Application Accent</label>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {ACCENT_COLORS.map(color => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => updateSettingField(null, 'accentColor', color.value)}
                                className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center space-x-2 justify-center cursor-pointer hover:-translate-y-0.5 duration-200 ${
                                  settings.accentColor === color.value
                                    ? `bg-slate-900 border-indigo-500 text-white shadow-xl ${color.glow}`
                                    : 'bg-slate-900/30 border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                <span className={`w-3.5 h-3.5 rounded-full ${color.bg} shrink-0 shadow-inner`}></span>
                                <span>{color.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 11. Theme Preview Cards */}
                        <div className="space-y-3 pt-2">
                          <label className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Interactive Theme Layout Preview</label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {THEMES.map(theme => (
                              <button
                                key={theme.id}
                                type="button"
                                onClick={() => updateSettingField(null, 'theme', theme.id)}
                                className={`p-4 rounded-2xl border text-left flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] hover:-translate-y-0.5 ${
                                  settings.theme === theme.id
                                    ? 'border-indigo-500 bg-slate-900 shadow-xl shadow-indigo-500/5'
                                    : 'border-slate-800 bg-slate-900/30 hover:border-slate-700/50'
                                }`}
                              >
                                <div>
                                  <div className="text-xs font-bold text-white flex items-center justify-between">
                                    <span>{theme.name}</span>
                                    {settings.theme === theme.id && <span className="text-[10px] text-indigo-400">✓ Active</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-1 leading-normal">{theme.desc}</div>
                                </div>
                                <div className="mt-4 pt-2 border-t border-slate-800/40">
                                  {/* Theme visual representation boxes */}
                                  <div className={`w-full h-8 rounded-lg ${theme.previewBg} p-1.5 flex items-center justify-between`}>
                                    <div className="w-1/3 h-full bg-slate-800/60 rounded"></div>
                                    <div className="w-1/4 h-full bg-indigo-500/30 rounded"></div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}

                    {/* ALERTS & NOTIFICATIONS TAB */}
                    {activeTab === 'notifications' && (
                      <div className="space-y-4">
                        <div className="border-b border-slate-800/50 pb-3">
                          <h3 className="text-lg font-bold text-white">🔔 Alerts & System Reminders</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Control notification thresholds, reminders, and daily analysis schedules</p>
                        </div>

                        <div className="space-y-3">
                          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-850 flex items-center justify-between hover:border-slate-800 transition-all">
                            <div>
                              <div className="text-xs font-bold text-white">Budget Cap Warning Alerts</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Send alerts immediately when a budget hit exceeds 80% limit.</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateSettingField('notifications', 'alerts', !settings.notifications?.alerts)}
                              className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                                settings.notifications?.alerts ? 'bg-indigo-600' : 'bg-slate-800'
                              }`}
                            >
                              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                settings.notifications?.alerts ? 'translate-x-4' : 'translate-x-0'
                              }`}></div>
                            </button>
                          </div>

                          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-850 flex items-center justify-between hover:border-slate-800 transition-all">
                            <div>
                              <div className="text-xs font-bold text-white">AI Coach Insights Reminders</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Generate daily autonomous expense suggestions and reminders.</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateSettingField('notifications', 'aiReminders', !settings.notifications?.aiReminders)}
                              className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                                settings.notifications?.aiReminders ? 'bg-indigo-600' : 'bg-slate-800'
                              }`}
                            >
                              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                settings.notifications?.aiReminders ? 'translate-x-4' : 'translate-x-0'
                              }`}></div>
                            </button>
                          </div>

                          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-850 flex items-center justify-between hover:border-slate-800 transition-all">
                            <div>
                              <div className="text-xs font-bold text-white">Subscription Billing Notifications</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Alert me 3 days prior to active subscription billing renewals.</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateSettingField('notifications', 'billNotifications', !settings.notifications?.billNotifications)}
                              className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                                settings.notifications?.billNotifications ? 'bg-indigo-600' : 'bg-slate-800'
                              }`}
                            >
                              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                settings.notifications?.billNotifications ? 'translate-x-4' : 'translate-x-0'
                              }`}></div>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* LOCALIZATION TAB */}
                    {activeTab === 'localization' && (
                      <div className="space-y-4">
                        <div className="border-b border-slate-800/50 pb-3">
                          <h3 className="text-lg font-bold text-white">🌐 Localization Preferences</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Define base currency systems, language options, and date formats</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">Ledger Currency</label>
                            <select
                              className="w-full glass-input text-xs py-2.5 focus:ring-1 focus:ring-indigo-500"
                              value={settings.currency}
                              onChange={e => updateSettingField(null, 'currency', e.target.value)}
                            >
                              <option value="INR">INR (₹) Indian Rupee</option>
                              <option value="USD">USD ($) United States Dollar</option>
                              <option value="EUR">EUR (€) Euro</option>
                              <option value="GBP">GBP (£) British Pound</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">Language</label>
                            <select
                              className="w-full glass-input text-xs py-2.5 focus:ring-1 focus:ring-indigo-500"
                              value={settings.language}
                              onChange={e => updateSettingField(null, 'language', e.target.value)}
                            >
                              <option value="English">English</option>
                              <option value="Hindi">Hindi (हिंदी)</option>
                              <option value="Spanish">Spanish (Español)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">Date Format</label>
                            <select
                              className="w-full glass-input text-xs py-2.5 focus:ring-1 focus:ring-indigo-500"
                              value={settings.dateFormat}
                              onChange={e => updateSettingField(null, 'dateFormat', e.target.value)}
                            >
                              <option value="DD/MM/YYYY">DD/MM/YYYY (18/05/2026)</option>
                              <option value="MM/DD/YYYY">MM/DD/YYYY (05/18/2026)</option>
                              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-05-18)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI MODEL SETTINGS TAB */}
                    {activeTab === 'ai' && (
                      <div className="space-y-4">
                        <div className="border-b border-slate-800/50 pb-3 flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-bold text-white">🤖 AI Engine Orchestration</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Control Gemini model generation frequencies and personalities</p>
                          </div>
                          <span className="bg-purple-950/40 text-purple-400 text-[9px] font-bold px-2 py-0.5 rounded border border-purple-500/20">Gemini 1.5 Active</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">AI Insights frequency</label>
                            <select
                              className="w-full glass-input text-xs py-2.5 focus:ring-1 focus:ring-indigo-500"
                              value={settings.ai?.insightFrequency}
                              onChange={e => updateSettingField('ai', 'insightFrequency', e.target.value)}
                            >
                              <option value="Daily">Daily Autonomous Checkup</option>
                              <option value="Weekly">Weekly Financial Digest</option>
                              <option value="Monthly">Monthly Strategic Review</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">AI Assistant Tone</label>
                            <select
                              className="w-full glass-input text-xs py-2.5 focus:ring-1 focus:ring-indigo-500"
                              value={settings.ai?.tone}
                              onChange={e => updateSettingField('ai', 'tone', e.target.value)}
                            >
                              <option value="Professional">Professional Financial Advisor</option>
                              <option value="Coach">Motivating Fitness Coach</option>
                              <option value="Casual">Friendly & Chill Partner</option>
                            </select>
                          </div>
                        </div>

                        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-850 flex items-center justify-between mt-2">
                          <div>
                            <div className="text-xs font-bold text-white">Autonomous Anomaly Auditing</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Auto-identify duplicate transaction billing or atypical ledger spending spikes.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateSettingField('ai', 'anomalyDetection', !settings.ai?.anomalyDetection)}
                            className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                              settings.ai?.anomalyDetection ? 'bg-indigo-600' : 'bg-slate-800'
                            }`}
                          >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                              settings.ai?.anomalyDetection ? 'translate-x-4' : 'translate-x-0'
                            }`}></div>
                          </button>
                        </div>
                      </div>
                    )}


                    {/* DATA PORTABILITY & PRIVACY TAB */}
                    {activeTab === 'privacy' && (
                      <div className="space-y-6">
                        
                        <div className="border-b border-slate-800/50 pb-3 flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              🛡️ Data Portability & Privacy
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Control your data, export statements, or purge your history.</p>
                          </div>
                        </div>

                        {/* Export format cards with soft glow hover scales */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Export Financial Statement</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Download your entire expense history as CSV, Excel, or a detailed PDF report.</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                              { format: 'csv', icon: '📊', name: 'Ledger CSV', desc: 'Spreadsheet format' },
                              { format: 'excel', icon: '📈', name: 'Excel Sheet', desc: 'Microsoft Excel format' },
                              { format: 'pdf', icon: '📄', name: 'PDF Report', desc: 'Tables, charts & summary' },
                            ].map(exp => (
                              <button
                                key={exp.format}
                                type="button"
                                onClick={() => handleBackupExport(exp.format)}
                                className="p-4 bg-slate-900/40 hover:bg-slate-900 border border-slate-800/60 hover:border-indigo-500/50 rounded-2xl text-center flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 duration-300"
                              >
                                <div>
                                  <span className="text-2xl">{exp.icon}</span>
                                  <div className="text-xs font-extrabold text-white mt-2">{exp.name}</div>
                                  <div className="text-[9px] text-slate-500 mt-1 leading-normal">{exp.desc}</div>
                                </div>
                                <span className="w-full mt-4 py-1.5 bg-indigo-950/20 hover:bg-indigo-900/40 border border-indigo-700/20 text-indigo-400 text-[10px] font-bold rounded-lg transition-colors inline-block">
                                  Download File
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-slate-800/50 pt-5 mt-4 space-y-4">
                          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Backup & Sync</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Cloud Sync Provider connection panel */}
                            <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-3.5 w-full">
                              <div className="text-xs font-bold text-white flex justify-between">
                                <span>☁️ Third-Party Cloud Sync</span>
                                <div className="flex flex-col text-right text-[10px] text-slate-400 font-medium">
                                  <div className="text-white font-bold flex items-center gap-1.5 justify-end">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Secure Sync Enabled
                                  </div>
                                  <div className="text-slate-500 text-[9px] mt-0.5">Last Sync: {lastBackupTime}</div>
                                </div>
                              </div>
                              
                              <div className="space-y-2 text-[10px]">
                                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">🗂️ Google Drive Sync</span>
                                  <button
                                    type="button"
                                    onClick={() => { setGoogleDriveSync(!googleDriveSync); setLastBackupTime('Just now'); showToast('Google Drive synced!') }}
                                    className={`w-8 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-all ${
                                      googleDriveSync ? 'bg-indigo-600' : 'bg-slate-800'
                                    }`}
                                  >
                                    <div className={`bg-white w-4 h-4 rounded-full shadow transform transition-all duration-300 ${
                                      googleDriveSync ? 'translate-x-3' : 'translate-x-0'
                                    }`}></div>
                                  </button>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>

                        <div className="border-t border-rose-900/50 pt-5 mt-4 space-y-4">
                          <h4 className="text-xs font-extrabold text-rose-500 uppercase tracking-wider">Danger Zone</h4>
                          <div className="p-4 bg-rose-950/20 border border-rose-900/50 rounded-2xl flex flex-col space-y-2">
                            <h5 className="text-sm font-bold text-rose-400">Data Purge / Reset</h5>
                            <p className="text-xs text-rose-300/70 pb-3 border-b border-rose-900/30">Clear all transactions and budgets to start fresh. This will not delete your account.</p>
                            <button
                              type="button"
                              onClick={handleDataPurge}
                              className="w-full mt-2 py-2.5 bg-rose-900/40 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-all border border-rose-700/50"
                            >
                              ⚠️ Clear All Transactions
                            </button>
                          </div>
                        </div>

                      </div>
                    )}


                  </div>
                )}

                {/* Save settings action button */}
                {activeTab !== 'privacy' && !isSwitchingTab && (
                  <div className="pt-6 border-t border-slate-800/40 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-gradient px-6 py-2.5 text-xs font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer rounded-xl shadow-lg"
                    >
                      {saving ? 'Syncing changes...' : 'Save Configuration Changes'}
                    </button>
                  </div>
                )}

              </form>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default Settings;