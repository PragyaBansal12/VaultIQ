import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const CATEGORY_ICONS = {
  Food: '🍔', Shopping: '🛍️', Transport: '🚗',
  Entertainment: '🎬', Health: '💊', Education: '📚',
  Bills: '📄', Other: '📦',
};

const AIAssistant = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };

  // AI & Chat state
  const [messages, setMessages] = useState([
    { id: 1, text: "Hi there! I am FinTrack AI, your intelligent financial coach. Ask me anything about your budgets, category trends, or savings goals!", sender: 'advisor', time: 'Just now' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Insights / Dashboard widgets state
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Simulation state
  const [simCategory, setSimCategory] = useState('Food');
  const [simPercent, setSimPercent] = useState(20);
  const [simResult, setSimResult] = useState({ monthlySavings: 0, yearlySavings: 0, tip: '' });
  const [simLoading, setSimLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const chatBoxRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch all insights
  const fetchInsights = async () => {
    try {
      const res = await fetch('/api/ai/insights', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setInsights(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  // Scroll to bottom of chat container internally (prevents page from scrolling down)
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, chatLoading]);

  // Run Scenario simulation whenever values change
  useEffect(() => {
    const runSimulation = async () => {
      setSimLoading(true);
      try {
        const res = await fetch('/api/ai/simulate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ category: simCategory, reductionPercent: simPercent })
        });
        const data = await res.json();
        if (res.ok) {
          setSimResult(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSimLoading(false);
      }
    };

    const timer = setTimeout(runSimulation, 500);
    return () => clearTimeout(timer);
  }, [simCategory, simPercent]);

  // Send message to Gemini
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const userMsg = { id: Date.now(), text, sender: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: text, history: messages })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          text: data.reply,
          sender: 'advisor',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } else {
        showToast(data.message || 'Error communicating with AI', 'error');
      }
    } catch {
      showToast('Connection error', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  // Voice Assistant (Web Speech API)
  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Browser Speech API not supported', 'error');
      return;
    }
    
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = 'en-IN';
    rec.interimResults = false;

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onerror = () => {
      setIsListening(false);
      showToast('Microphone error or access denied', 'error');
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInputMessage(transcript);
      handleSendMessage(transcript);
    };

    rec.start();
  };

  // Apply Budget Optimization suggestion natively to Mongo!
  const applyBudgetSuggestion = async (category, recommendedLimit) => {
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ category, limit: recommendedLimit })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Applied! ${category} budget lowered to ₹${recommendedLimit.toLocaleString()}`);
        fetchInsights(); // refresh
      } else {
        showToast(data.message || 'Could not apply suggestion', 'error');
      }
    } catch {
      showToast('Failed to connect', 'error');
    }
  };

  // Action pills triggers
  const triggerQuickAction = (question) => {
    handleSendMessage(question);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex relative">
      
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'
        }`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
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
            <Link to="/ai-assistant" className="flex items-center space-x-3 text-indigo-400 font-medium p-2.5 bg-slate-800/50 rounded-xl">
              <span>🤖</span><span>AI Assistant</span>
            </Link>
            <Link to="/reports" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
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

      {/* Main Container */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
              🤖 AI Financial Coaching Suite
            </h1>
            <p className="text-slate-400 text-sm mt-1">Intelligent insights, scenario simulations, and personalized AI strategies</p>
          </div>
          <Link to="/dashboard" className="btn-gradient text-xs px-4 py-2">
            ← Back to Dashboard
          </Link>
        </header>

        {insightsLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400">Assembling your custom financial intelligence layer...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Top row - health dials and forecasting */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Health score card */}
              <div className="glass-card p-6 flex flex-col items-center text-center justify-center border-l-4 border-l-indigo-500">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Financial Health Score</h3>
                <div className="relative w-36 h-36 flex items-center justify-center mb-4">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                    <circle cx="50" cy="50" r="40" stroke="url(#healthGrad)" strokeWidth="8" fill="transparent"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * (insights?.healthScore || 75)) / 100}
                      strokeLinecap="round" />
                    <defs>
                      <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute text-center">
                    <div className="text-3xl font-extrabold text-white">{insights?.healthScore || 75}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">/ 100</div>
                  </div>
                </div>
                
                <div className="w-full grid grid-cols-3 gap-2 mt-2 pt-4 border-t border-slate-800 text-[10px] text-slate-400">
                  <div>
                    <div className="text-white font-bold text-xs">{insights?.breakdown?.savingsDiscipline || 85}</div>
                    <div>Savings</div>
                  </div>
                  <div>
                    <div className="text-white font-bold text-xs">{insights?.breakdown?.budgetManagement || 72}</div>
                    <div>Budgets</div>
                  </div>
                  <div>
                    <div className="text-white font-bold text-xs">{insights?.breakdown?.subscriptionControl || 64}</div>
                    <div>Subscriptions</div>
                  </div>
                </div>
              </div>

              {/* Coach insights bullet items */}
              <div className="glass-card p-6 lg:col-span-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-xl">💡</span>
                    <h3 className="text-base font-bold text-white">AI Coach Insights</h3>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed italic bg-slate-900/40 p-4 rounded-xl border border-indigo-500/20">
                    "{insights?.coachRecommendation || "Lowering dining limits and optimizing your recurring bills is expected to save you ₹3,500/month."}"
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400 uppercase">Predicted Month-End Spends</div>
                    <div className="text-xl font-bold text-pink-400">₹{insights?.forecast?.monthEndExpenses?.toLocaleString() || '0'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 uppercase">Estimated Savings Potential</div>
                    <div className="text-xl font-bold text-emerald-400">₹{insights?.forecast?.expectedSavings?.toLocaleString() || '0'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chatbot area + Trigger Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Chat Column */}
              <div className="glass-card p-0 lg:col-span-2 flex flex-col h-[460px] overflow-hidden border border-slate-800/80">
                {/* Header */}
                <div className="px-5 py-3.5 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center shrink-0">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-semibold text-sm">FinTrack Coach AI</span>
                  </div>
                  <span className="text-xs text-slate-500">Gemini 1.5 Assistant</span>
                </div>

                {/* Messages Box */}
                <div ref={chatBoxRef} className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-950/20">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-md transition-all ${
                        msg.sender === 'user' 
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none' 
                          : 'bg-slate-800/80 text-slate-100 rounded-tl-none border border-slate-700/30'
                      }`}>
                        <div className="leading-relaxed">{msg.text}</div>
                        <div className="text-[9px] text-slate-400 mt-1 text-right">{msg.time}</div>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800/50 rounded-2xl rounded-tl-none px-4 py-3 border border-slate-700/20 max-w-[80%]">
                        <div className="flex items-center space-x-1.5">
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Controls */}
                <div className="p-4 bg-slate-900/40 border-t border-slate-800 shrink-0">
                  <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="flex items-center space-x-2">
                    <input
                      type="text"
                      className="flex-1 glass-input py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                      placeholder="Ask where you overspent, how to save ₹5000..."
                      value={inputMessage}
                      onChange={e => setInputMessage(e.target.value)}
                    />
                    
                    {/* Voice Assistant Mic button */}
                    <button
                      type="button"
                      onClick={startVoiceInput}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        isListening 
                          ? 'bg-red-600 animate-pulse text-white' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                      title="Voice Command Assistant"
                    >
                      🎤
                    </button>
                    
                    <button type="submit" disabled={chatLoading} className="btn-gradient px-4 py-2 shrink-0 text-sm font-semibold">
                      Send
                    </button>
                  </form>
                </div>
              </div>

              {/* Quick AI Trigger actions panel */}
              <div className="glass-card p-6 flex flex-col justify-between h-[460px]">
                <div>
                  <h3 className="text-base font-bold text-white mb-3">Quick AI Action Triggers</h3>
                  <p className="text-xs text-slate-400 mb-4">Click any option to run instant AI queries against your financial ledger</p>
                  
                  <div className="space-y-2">
                    {[
                      { text: "Where did I overspend this month?", q: "Summarize exactly where I overspent this month, flagging large expenses." },
                      { text: "Can I save ₹10,000 this month?", q: "Can I realistically save ₹10,000 this month based on my income and current spending trends?" },
                      { text: "Analyze my subscriptions.", q: "List and analyze all my active subscriptions and identify rarely used or wasteful recurring items." },
                      { text: "Forecast my expenses.", q: "Provide an expense forecasting trend prediction for the next two weeks based on my transactions." },
                      { text: "Identify duplicate anomalies.", q: "Detect any duplicate payments or transaction anomalies inside my recent expenses list." }
                    ].map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          triggerQuickAction(act.q);
                        }}
                        className="w-full text-left bg-slate-800/40 hover:bg-indigo-600/20 border border-slate-700/80 hover:border-indigo-500/80 p-2.5 rounded-xl text-xs text-slate-300 hover:text-white transition-all cursor-pointer relative z-10 hover:scale-[1.01] active:scale-[0.99] font-medium"
                      >
                        ⚡ {act.text}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Dashboard mood indicator */}
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-850 flex items-center justify-between text-xs mt-4">
                  <div>
                    <div className="text-slate-500">Spend Mood</div>
                    <div className="font-bold text-white mt-0.5">Moderate ⚖️</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Savings Streak</div>
                    <div className="font-bold text-indigo-400 mt-0.5">12 Days 🔥</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Risk Profile</div>
                    <div className="font-bold text-emerald-400 mt-0.5">Low Alert ✅</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Simulations + Anomalies widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Category Scenario Simulation */}
              <div className="glass-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      🎯 AI Scenario Simulator
                    </h3>
                    <span className="text-[10px] bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Predictive</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">Drag sliders to forecast potential yearly and monthly compound savings rates</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Target Category</label>
                      <select 
                        className="w-full glass-input text-xs"
                        value={simCategory}
                        onChange={e => setSimCategory(e.target.value)}
                      >
                        <option>Food</option>
                        <option>Shopping</option>
                        <option>Transport</option>
                        <option>Entertainment</option>
                        <option>Bills</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Reduction Percentage</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="range"
                          min="10"
                          max="80"
                          step="5"
                          className="w-full accent-indigo-500"
                          value={simPercent}
                          onChange={e => setSimPercent(Number(e.target.value))}
                        />
                        <span className="text-xs font-bold text-indigo-400 w-8">{simPercent}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="border-r border-slate-900">
                      <div className="text-[10px] text-slate-500 uppercase">Monthly Savings</div>
                      <div className="text-lg font-bold text-white">₹{simResult.monthlySavings?.toLocaleString() || '₹0'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Yearly Combined Savings</div>
                      <div className="text-lg font-bold text-indigo-400">₹{simResult.yearlySavings?.toLocaleString() || '₹0'}</div>
                    </div>
                  </div>
                  
                  {simLoading ? (
                    <div className="text-center text-xs text-slate-500 py-1">Running compound calculations...</div>
                  ) : (
                    simResult.tip && (
                      <div className="text-xs text-slate-400 text-center border-t border-slate-905 pt-2 italic">
                        💡 {simResult.tip}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Anomaly Detection Alerts center */}
              <div className="glass-card p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                    🚨 Real-Time Anomaly Audit
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">AI identifies duplicates, spikes, and high-risk expense behaviors instantly</p>
                  
                  <div className="space-y-2">
                    {insights?.anomalies && insights.anomalies.length > 0 ? (
                      insights.anomalies.map((anom, idx) => (
                        <div key={idx} className="flex items-start space-x-3 bg-red-950/20 border border-red-500/20 p-3 rounded-xl">
                          <span className="text-xl shrink-0 mt-0.5">{anom.icon}</span>
                          <div>
                            <div className="text-xs font-semibold text-red-400">{anom.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{anom.message}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center space-x-3 bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl">
                        <span className="text-xl shrink-0">✅</span>
                        <div>
                          <div className="text-xs font-semibold text-emerald-400">Ledger Audited</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">No duplicate bills or highly atypical spend patterns identified. Good job!</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 mt-4 text-right">
                  Audited live at {new Date().toLocaleTimeString()}
                </div>
              </div>

            </div>

            {/* Live active budget recommendations & Subscriptions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Budget Optimization Engine recommendations with [ Apply ] buttons */}
              <div className="glass-card p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white mb-2">🎯 Budget Optimization Recommendations</h3>
                  <p className="text-xs text-slate-400 mb-4">Direct AI actions: Click Apply Suggestion to lower limits directly in MongoDB Atlas</p>
                  
                  <div className="space-y-3">
                    {insights?.budgetPerformance && insights.budgetPerformance.length > 0 ? (
                      insights.budgetPerformance.map((bud, idx) => {
                        const recommendedLimit = Math.max(Math.round(bud.spent * 0.85), 2000);
                        if (recommendedLimit >= bud.limit) return null;
                        
                        return (
                          <div key={idx} className="bg-slate-900/50 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold text-white">{CATEGORY_ICONS[bud.category]} {bud.category} Budget</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Current: ₹{bud.limit.toLocaleString()} | Suggestion: <strong className="text-indigo-400">₹{recommendedLimit.toLocaleString()}</strong>
                              </div>
                            </div>
                            <button
                              onClick={() => applyBudgetSuggestion(bud.category, recommendedLimit)}
                              className="btn-gradient text-[10px] font-bold px-3 py-1.5 rounded-lg transition-transform hover:scale-105 shrink-0"
                            >
                              Apply Suggestion
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <div className="text-3xl mb-2">🎯</div>
                        <p className="text-xs">No budgets set yet. Add budgets to get AI optimization tips!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Subscription Cost tracker */}
              <div className="glass-card p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white mb-2">🔄 Subscription Cost Tracker</h3>
                  <p className="text-xs text-slate-400 mb-4">Continuous auditing of monthly recurring subscription billing</p>
                  
                  <div className="divide-y divide-slate-800/50">
                    {insights?.subscriptions && insights.subscriptions.length > 0 ? (
                      insights.subscriptions.map((sub, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center space-x-3">
                            <div className="text-xl font-bold">💳</div>
                            <div>
                              <div className="text-xs font-semibold text-white">{sub.name}</div>
                              <div className="text-[10px] text-slate-500">Last billing active | Used: {sub.lastUsed}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-white">₹{sub.cost}</div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                              sub.usage === 'Unused' ? 'bg-red-950 text-red-400' : 'bg-indigo-950 text-indigo-400'
                            }`}>
                              {sub.usage}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <div className="text-3xl mb-2">🔁</div>
                        <p className="text-xs">No subscriptions yet. Add them in the Subscriptions page!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default AIAssistant;