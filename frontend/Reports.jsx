import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const Reports = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };

  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters & State
  const [reportType, setReportType] = useState('Monthly');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Table Filters
  const [tableSearch, setTableSearch] = useState('');
  const [tableCategory, setTableCategory] = useState('All');
  const [tableSort, setTableSort] = useState('Date (Newest)');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const fetchData = async () => {
    try {
      const [expRes, budRes] = await Promise.all([
        fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/budgets', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (expRes.status === 401) { navigate('/login'); return; }

      const expData = await expRes.json();
      const budData = await budRes.json();

      setExpenses(expData || []);
      setBudgets(budData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReportTypeChange = (e) => {
    const type = e.target.value;
    setReportType(type);

    const now = new Date();
    let start = new Date();

    if (type === 'Weekly') {
      start.setDate(now.getDate() - 7);
    } else if (type === 'Monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (type === 'Yearly') {
      start = new Date(now.getFullYear(), 0, 1);
    }

    if (type !== 'Custom') {
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    }
  };

  // Filter Data for the date range
  const realExpenses = expenses.filter(e => e.type !== 'income');
  const realIncome = expenses.filter(e => e.type === 'income');

  const filteredExpenses = realExpenses.filter(e => {
    const expDate = new Date(e.date).toISOString().slice(0, 10);
    return expDate >= startDate && expDate <= endDate;
  });

  const filteredIncome = realIncome.filter(e => {
    const expDate = new Date(e.date).toISOString().slice(0, 10);
    return expDate >= startDate && expDate <= endDate;
  });

  const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = filteredIncome.reduce((sum, e) => sum + e.amount, 0);
  const savings = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;

  // Category Analysis
  const categoryTotals = {};
  filteredExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  // Top 3 Expenses
  const top3Expenses = [...filteredExpenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Budget Performance
  const budgetPerformance = budgets.map(b => {
    const spent = categoryTotals[b.category] || 0;
    const percentage = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;

    let status = 'Within Limit';
    let statusColor = 'text-emerald-400';
    let barColor = 'bg-emerald-500';

    if (percentage > 100) {
      status = 'Exceeded Limit';
      statusColor = 'text-red-400';
      barColor = 'bg-red-500';
    } else if (percentage >= 80) {
      status = 'Near Limit';
      statusColor = 'text-amber-400';
      barColor = 'bg-amber-500';
    }

    return {
      category: b.category,
      budget: b.limit,
      spent,
      percentage,
      status,
      statusColor,
      barColor
    };
  });

  const exceededBudgets = budgetPerformance.filter(b => b.percentage > 100).map(b => b.category).join(', ') || 'None';

  // Table Filtering and Sorting
  let tableData = [...filteredExpenses];
  if (tableCategory !== 'All') {
    tableData = tableData.filter(e => e.category === tableCategory);
  }
  if (tableSearch) {
    const s = tableSearch.toLowerCase();
    tableData = tableData.filter(e =>
      (e.merchant && e.merchant.toLowerCase().includes(s)) ||
      (e.notes && e.notes.toLowerCase().includes(s))
    );
  }
  if (tableSort === 'Date (Newest)') tableData.sort((a, b) => new Date(b.date) - new Date(a.date));
  else if (tableSort === 'Date (Oldest)') tableData.sort((a, b) => new Date(a.date) - new Date(b.date));
  else if (tableSort === 'Amount (High to Low)') tableData.sort((a, b) => b.amount - a.amount);
  else if (tableSort === 'Amount (Low to High)') tableData.sort((a, b) => a.amount - b.amount);

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date', 'Category', 'Merchant/Title', 'Amount (INR)', 'Note'];
    const rows = filteredExpenses.map(e => [
      new Date(e.date).toLocaleDateString('en-IN'),
      e.category,
      e.merchant || 'Expense',
      e.amount,
      e.notes || ''
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FinTrack_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✅ CSV Report downloaded successfully!');
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.text('FinTrack Financial Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, 14, 28);

    doc.setFontSize(12);
    doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 38);

    doc.text(`Total Income: Rs ${totalIncome}`, 14, 50);
    doc.text(`Total Expenses: Rs ${totalSpent}`, 14, 57);
    doc.text(`Savings: Rs ${savings} (${savingsRate}%)`, 14, 64);

    doc.setFontSize(14);
    doc.text('Category-wise Spending', 14, 78);

    const catData = Object.keys(categoryTotals).map(cat => [cat, `Rs ${categoryTotals[cat]}`]);
    autoTable(doc, {
      startY: 83,
      head: [['Category', 'Amount']],
      body: catData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    const finalY1 = doc.lastAutoTable.finalY + 15;
    doc.text('Budget Performance', 14, finalY1);

    const budData = budgetPerformance.map(b => [b.category, `Rs ${b.budget}`, `Rs ${b.spent}`, b.status]);
    autoTable(doc, {
      startY: finalY1 + 5,
      head: [['Category', 'Budget Limit', 'Amount Spent', 'Status']],
      body: budData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    const finalY2 = doc.lastAutoTable.finalY + 15;
    if (finalY2 > 250) doc.addPage();
    doc.text('Detailed Expenses', 14, finalY2 > 250 ? 20 : finalY2);

    const expData = filteredExpenses.map(e => [
      new Date(e.date).toLocaleDateString('en-IN'),
      e.category,
      e.merchant || 'Expense',
      `Rs ${e.amount}`
    ]);

    autoTable(doc, {
      startY: finalY2 > 250 ? 25 : finalY2 + 5,
      head: [['Date', 'Category', 'Merchant', 'Amount']],
      body: expData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`FinTrack_Report_${startDate}_to_${endDate}.pdf`);
    showToast('✅ PDF Report downloaded successfully!');
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 glass border-r border-slate-800/50 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="mb-10 text-2xl font-bold text-gradient">FinTrack AI</div>
          <div className="flex items-center space-x-3 p-3 bg-slate-900/60 rounded-2xl border border-slate-850 mb-6">
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-extrabold text-white text-sm shadow-md">
                {user.name ? user.name.substring(0, 2).toUpperCase() : 'ME'}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0B0F19] rounded-full animate-pulse" title="Online Client"></span>
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                {user.name || 'Meenakshi'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Premium Master Tier
              </div>
            </div>
          </div>
          <nav className="space-y-1">
            <Link to="/dashboard" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>📊</span><span>Dashboard</span>
            </Link>
            <Link to="/expenses" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>💸</span><span>Expenses</span>
            </Link>
            <Link to="/budgets" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🎯</span><span>Budgets</span>
            </Link>
            <Link to="/analytics" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>📈</span><span>Analytics</span>
            </Link>
            <Link to="/ai-assistant" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🤖</span><span>AI Assistant</span>
            </Link>
            <Link to="/reports" className="flex items-center space-x-3 text-indigo-400 font-medium p-2.5 bg-slate-800/50 rounded-xl">
              <span>📋</span><span>Reports</span>
            </Link>
            <Link to="/subscriptions" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🔁</span><span>Subscriptions</span>
            </Link>
            <Link to="/notifications" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🔔</span><span>Notifications</span>
            </Link>
            <Link to="/settings" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>⚙️</span><span>Settings</span>
            </Link>
            <Link to="/help-center" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>❓</span><span>Help Center</span>
            </Link>
            <a href="#" className="flex items-center space-x-3 text-red-400 hover:text-red-300 p-2.5 hover:bg-red-900/20 rounded-xl transition-all mt-6"
              onClick={e => { e.preventDefault(); handleLogout(); }}>
              <span>🚪</span><span>Logout</span>
            </a>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-white">📋 Financial Reports</h1>
            <p className="text-slate-400 text-sm mt-1">Generate, view, and export your financial summaries</p>
          </div>
          <div className="text-xs text-slate-500">
            Generated on: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="space-y-6">

            {/* Generate Report Controls */}
            <div className="glass-card p-6 flex flex-col lg:flex-row justify-between items-end lg:items-center gap-4 border-l-4 border-l-indigo-500">
              <div className="flex flex-col md:flex-row items-end md:items-center gap-4 w-full lg:w-auto">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Report Duration</label>
                  <div className="flex bg-slate-950/40 p-1 border border-slate-800 rounded-xl space-x-1">
                    {['Weekly', 'Monthly', 'Yearly', 'Custom'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          const mockEvent = { target: { value: type } };
                          handleReportTypeChange(mockEvent);
                        }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          reportType === type
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">From Date</label>
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setReportType('Custom'); }} className="glass-input text-sm px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">To Date</label>
                  <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setReportType('Custom'); }} className="glass-input text-sm px-3 py-2" />
                </div>
              </div>

              <div className="flex gap-3 w-full lg:w-auto">
                <button onClick={exportCSV} className="flex-1 lg:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors border border-slate-700">
                  📥 Export CSV
                </button>
                <button onClick={exportPDF} className="flex-1 lg:flex-none btn-gradient px-4 py-2 flex items-center justify-center space-x-2">
                  <span>📄</span><span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* AI Financial Summary */}
            <div className="glass-card bg-indigo-900/10 border-indigo-500/30 p-6">
              <div className="flex items-center space-x-3 mb-2">
                <div className="text-2xl">🤖</div>
                <h2 className="text-lg font-bold text-white">AI Financial Summary</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mt-2">
                For the selected period, your total expenses amounted to <span className="font-bold text-white">₹{totalSpent.toLocaleString()}</span>.
                {totalSpent > totalIncome && totalIncome > 0 ? (
                  <span className="text-red-400"> You have exceeded your income, resulting in a negative savings rate. </span>
                ) : (
                  <span className="text-emerald-400"> You saved ₹{savings.toLocaleString()} during this timeframe. Excellent work! </span>
                )}
              </p>

              {/* AI Recommendations */}
              <div className="mt-4 pt-4 border-t border-indigo-500/20">
                <div className="text-xs text-indigo-400 font-semibold mb-2 uppercase tracking-wider">💡 AI Recommendations</div>
                <ul className="text-sm text-slate-300 space-y-2">
                  {exceededBudgets !== 'None' && (
                    <li className="flex items-start">
                      <span className="mr-2">⚠️</span>
                      <span>You have exceeded your budget limits in <span className="text-red-400 font-medium">{exceededBudgets}</span>. Consider re-evaluating these limits or cutting back next month.</span>
                    </li>
                  )}
                  {top3Expenses.length > 0 && (
                    <li className="flex items-start">
                      <span className="mr-2">📉</span>
                      <span>Reduce spending on <strong>{top3Expenses[0]?.category}</strong> (specifically "{top3Expenses[0]?.merchant || top3Expenses[0]?.notes || 'General'}") by 10% to significantly improve your monthly savings.</span>
                    </li>
                  )}
                  {savingsRate < 20 && savingsRate > 0 && (
                    <li className="flex items-start">
                      <span className="mr-2">📈</span>
                      <span>Your savings rate is {savingsRate}%. Try the 50/30/20 rule to aim for at least a 20% savings rate.</span>
                    </li>
                  )}
                  {savingsRate === 0 && totalIncome === 0 && (
                    <li className="flex items-start">
                      <span className="mr-2">📝</span>
                      <span>Add your income to unlock accurate savings rate insights and recommendations!</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Overview Stats (Income vs Expense) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-5 border-t-4 border-t-blue-500 flex flex-col justify-between">
                <div className="text-sm text-slate-400 mb-1">Total Income</div>
                <div className="text-3xl font-bold text-white">₹{totalIncome.toLocaleString()}</div>
              </div>
              <div className="glass-card p-5 border-t-4 border-t-pink-500 flex flex-col justify-between">
                <div className="text-sm text-slate-400 mb-1">Total Expenses</div>
                <div className="text-3xl font-bold text-white">₹{totalSpent.toLocaleString()}</div>
              </div>
              <div className="glass-card p-5 border-t-4 border-t-emerald-500 flex flex-col justify-between relative overflow-hidden">
                <div className="z-10 text-sm text-slate-400 mb-1">Savings Rate</div>
                <div className="z-10 flex items-end space-x-2">
                  <div className={`text-3xl font-bold ${savingsRate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{savingsRate}%</div>
                  <div className="text-sm text-slate-400 mb-1">/ ₹{savings.toLocaleString()}</div>
                </div>
                {/* Visual Bar inside card */}
                <div className="absolute bottom-0 left-0 h-1.5 bg-slate-800 w-full">
                  <div className={`h-full ${savingsRate >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Budget Performance */}
              <div className="glass-card p-5 lg:col-span-2">
                <h3 className="text-lg font-bold text-white mb-4">Budget Performance</h3>
                {budgetPerformance.length > 0 ? (
                  <div className="space-y-4">
                    {budgetPerformance.map(b => (
                      <div key={b.category} className="bg-slate-800/30 p-4 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-medium text-white">{b.category}</div>
                          <div className={`text-xs font-bold px-2 py-1 rounded ${b.percentage > 100 ? 'bg-red-900/50 text-red-400' : b.percentage >= 80 ? 'bg-amber-900/50 text-amber-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                            {b.status}
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mb-2">
                          <span>Spent: ₹{b.spent.toLocaleString()}</span>
                          <span>Limit: ₹{b.budget.toLocaleString()}</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div className={`${b.barColor} h-2 rounded-full transition-all`} style={{ width: `${Math.min(b.percentage, 100)}%` }}></div>
                        </div>
                        <div className="text-right text-xs mt-1 font-medium text-slate-300">{b.percentage}% Used</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No budgets set.</p>
                )}
              </div>

              {/* Top 3 Expenses */}
              <div className="glass-card p-5">
                <h3 className="text-lg font-bold text-white mb-4">Top 3 Expenses</h3>
                {top3Expenses.length > 0 ? (
                  <div className="space-y-3">
                    {top3Expenses.map((exp, idx) => (
                      <div key={exp._id} className="flex items-center p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' : idx === 1 ? 'bg-slate-400/20 text-slate-400' : 'bg-orange-700/20 text-orange-400'}`}>
                          #{idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-slate-400">{exp.category}</div>
                          <div className="text-sm font-medium text-white truncate max-w-[120px]">{exp.merchant || exp.notes || 'Expense'}</div>
                        </div>
                        <div className="font-bold text-white">₹{exp.amount.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No expenses found.</p>
                )}
              </div>
            </div>

            {/* Expense Summary Table with Filters */}
            <div className="glass-card p-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h3 className="text-lg font-bold text-white">Detailed Expense Records</h3>

                {/* Table Filters */}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={tableSearch}
                    onChange={e => setTableSearch(e.target.value)}
                    className="glass-input text-xs px-3 py-1.5 w-32"
                  />
                  <select
                    value={tableCategory}
                    onChange={e => setTableCategory(e.target.value)}
                    className="glass-input text-xs px-3 py-1.5 w-28"
                  >
                    <option value="All">All Categories</option>
                    {['Food', 'Shopping', 'Transport', 'Entertainment', 'Health', 'Education', 'Bills', 'Other'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={tableSort}
                    onChange={e => setTableSort(e.target.value)}
                    className="glass-input text-xs px-3 py-1.5 w-36"
                  >
                    <option>Date (Newest)</option>
                    <option>Date (Oldest)</option>
                    <option>Amount (High to Low)</option>
                    <option>Amount (Low to High)</option>
                  </select>
                </div>
              </div>

              {tableData.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-700/50">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/80">
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 font-medium">Category</th>
                        <th className="px-4 py-2.5 font-medium">Description</th>
                        <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {tableData.map(e => (
                        <tr key={e._id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2 text-xs">{new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="px-4 py-2">
                            <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide">{e.category}</span>
                          </td>
                          <td className="px-4 py-2 text-xs truncate max-w-[200px]">{e.merchant || e.notes || 'Expense'}</td>
                          <td className="px-4 py-2 text-xs text-right font-semibold text-white">₹{e.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-900/50 rounded-xl border border-dashed border-slate-700">
                  <div className="text-3xl mb-2">🔍</div>
                  <h3 className="text-white font-medium mb-1">No expenses found</h3>
                  <p className="text-slate-500 text-xs">Try adjusting your filters or date range.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;