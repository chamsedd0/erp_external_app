import { useState, useEffect } from 'react';
import { Loader2, ArrowRight, Calendar, DollarSign, Home, LogOut, Clock, CheckCircle, XCircle } from 'lucide-react';

const API_URL = 'http://localhost:3000';

function App() {
  const [page, setPage] = useState('login');
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!employeeId || !pin) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setUser(data.user);
      setPage('dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setPage('login');
    setEmployeeId('');
    setPin('');
  };

  if (page === 'login') {
    return <LoginPage
      employeeId={employeeId}
      setEmployeeId={setEmployeeId}
      pin={pin}
      setPin={setPin}
      loading={loading}
      error={error}
      handleLogin={handleLogin}
    />;
  }

  return (
    <div style={{ width: '100%', maxWidth: '900px', padding: '20px' }}>
      <Navigation page={page} setPage={setPage} user={user} handleLogout={handleLogout} />

      {page === 'dashboard' && <Dashboard user={user} />}
      {page === 'timeoff' && <TimeOffForm user={user} setPage={setPage} />}
      {page === 'expenses' && <ExpenseForm user={user} setPage={setPage} />}
    </div>
  );
}

function LoginPage({ employeeId, setEmployeeId, pin, setPin, loading, error, handleLogin }) {
  return (
    <div className="glass-card">
      <h1>Shadow Portal</h1>
      <p className="subtitle">Secure Internal Access</p>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleLogin}>
        <div className="input-group">
          <input
            type="text"
            placeholder="Employee ID"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="input-group">
          <input
            type="password"
            placeholder="Security PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading || !employeeId || !pin}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 className="animate-spin" size={20} /> Authenticating...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Access Portal <ArrowRight size={20} />
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

function Navigation({ page, setPage, user, handleLogout }) {
  return (
    <div className="nav-bar">
      <div className="nav-user">
        <div className="nav-avatar">{user?.name?.charAt(0) || 'U'}</div>
        <span>{user?.name?.split(' ')[0]}</span>
      </div>
      <div className="nav-links">
        <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>
          <Home size={18} /> Dashboard
        </button>
        <button className={page === 'timeoff' ? 'active' : ''} onClick={() => setPage('timeoff')}>
          <Calendar size={18} /> Time Off
        </button>
        <button className={page === 'expenses' ? 'active' : ''} onClick={() => setPage('expenses')}>
          <DollarSign size={18} /> Expenses
        </button>
        <button onClick={handleLogout} className="logout-nav">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
}

function Dashboard({ user }) {
  const [leaves, setLeaves] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leavesRes, expensesRes] = await Promise.all([
        fetch(`${API_URL}/time-off?employee_id=${user.id}`),
        fetch(`${API_URL}/expenses?employee_id=${user.id}`)
      ]);

      const leavesData = await leavesRes.json();
      const expensesData = await expensesRes.json();

      setLeaves(leavesData.leaves || []);
      setExpenses(expensesData.expenses || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '100%', padding: '2rem' }}>
      <h2 style={{ marginBottom: '2rem' }}>My Requests</h2>

      <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#a5a5a5' }}>Time Off Requests</h3>
      {loading ? (
        <p style={{ color: '#888' }}>Loading...</p>
      ) : leaves.length === 0 ? (
        <p style={{ color: '#888', marginBottom: '2rem' }}>No time-off requests yet</p>
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          {leaves.map(leave => (
            <div key={leave.id} className="request-card">
              <div>
                <div style={{ fontWeight: '600' }}>{leave.name || 'Time Off'}</div>
                <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>
                  {new Date(leave.date_from).toLocaleDateString()} - {new Date(leave.date_to).toLocaleDateString()}
                </div>
              </div>
              <StatusBadge state={leave.state} />
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#a5a5a5' }}>Expense Reports</h3>
      {loading ? (
        <p style={{ color: '#888' }}>Loading...</p>
      ) : expenses.length === 0 ? (
        <p style={{ color: '#888' }}>No expense reports yet</p>
      ) : (
        <div>
          {expenses.map(expense => (
            <div key={expense.id} className="request-card">
              <div>
                <div style={{ fontWeight: '600' }}>{expense.name}</div>
                <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>
                  {new Date(expense.date).toLocaleDateString()} • ${expense.total_amount?.toFixed(2) || expense.price_unit?.toFixed(2)}
                </div>
              </div>
              <StatusBadge state={expense.state} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ state }) {
  const config = {
    draft: { label: 'Draft', color: '#888', icon: Clock },
    confirm: { label: 'Pending', color: '#f39c12', icon: Clock },
    validate: { label: 'Approved', color: '#27ae60', icon: CheckCircle },
    validate1: { label: 'Approved', color: '#27ae60', icon: CheckCircle },
    refuse: { label: 'Rejected', color: '#e74c3c', icon: XCircle },
    approved: { label: 'Approved', color: '#27ae60', icon: CheckCircle },
    reported: { label: 'Submitted', color: '#3498db', icon: Clock },
  };

  const { label, color, icon: Icon } = config[state] || { label: state, color: '#888', icon: Clock };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      color,
      fontSize: '0.85rem',
      fontWeight: '600'
    }}>
      <Icon size={16} /> {label}
    </div>
  );
}

function TimeOffForm({ user, setPage }) {
  const [types, setTypes] = useState([]);
  const [formData, setFormData] = useState({
    holiday_status_id: '',
    date_from: '',
    date_to: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/time-off/types`)
      .then(res => res.json())
      .then(data => setTypes(data.types || []))
      .catch(err => console.error('Failed to fetch types:', err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/time-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: user.id,
          holiday_status_id: parseInt(formData.holiday_status_id),
          date_from: formData.date_from.replace('T', ' ') + ':00',
          date_to: formData.date_to.replace('T', ' ') + ':00',
          name: formData.name || 'Time Off Request'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      setSuccess(true);
      setTimeout(() => setPage('dashboard'), 1500);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="glass-card" style={{ textAlign: 'center' }}>
        <CheckCircle size={64} color="#27ae60" style={{ margin: '0 auto 1rem' }} />
        <h2>Request Submitted!</h2>
        <p style={{ color: '#888' }}>Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ maxWidth: '600px' }}>
      <h2 style={{ marginBottom: '2rem' }}>Request Time Off</h2>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label style={{ color: '#a5a5a5', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Type</label>
          <select
            value={formData.holiday_status_id}
            onChange={(e) => setFormData({ ...formData, holiday_status_id: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '1rem'
            }}
          >
            <option value="">Select leave type</option>
            {types.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label style={{ color: '#a5a5a5', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>From</label>
          <input
            type="datetime-local"
            value={formData.date_from}
            onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
            required
          />
        </div>

        <div className="input-group">
          <label style={{ color: '#a5a5a5', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>To</label>
          <input
            type="datetime-local"
            value={formData.date_to}
            onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
            required
          />
        </div>

        <div className="input-group">
          <label style={{ color: '#a5a5a5', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Reason (Optional)</label>
          <input
            type="text"
            placeholder="e.g., Family vacation"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}

function ExpenseForm({ user, setPage }) {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    product_id: '',
    price_unit: '',
    date: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/expenses/products`)
      .then(res => res.json())
      .then(data => setProducts(data.products || []))
      .catch(err => console.error('Failed to fetch products:', err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: user.id,
          product_id: parseInt(formData.product_id),
          price_unit: parseFloat(formData.price_unit),
          quantity: 1,
          date: formData.date,
          name: formData.name
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit expense');
      }

      setSuccess(true);
      setTimeout(() => setPage('dashboard'), 1500);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="glass-card" style={{ textAlign: 'center' }}>
        <CheckCircle size={64} color="#27ae60" style={{ margin: '0 auto 1rem' }} />
        <h2>Expense Submitted!</h2>
        <p style={{ color: '#888' }}>Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ maxWidth: '600px' }}>
      <h2 style={{ marginBottom: '2rem' }}>Submit Expense</h2>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label style={{ color: '#a5a5a5', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Category</label>
          <select
            value={formData.product_id}
            onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '1rem'
            }}
          >
            <option value="">Select category</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label style={{ color: '#a5a5a5', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Amount</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.price_unit}
            onChange={(e) => setFormData({ ...formData, price_unit: e.target.value })}
            required
          />
        </div>

        <div className="input-group">
          <label style={{ color: '#a5a5a5', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>

        <div className="input-group">
          <label style={{ color: '#a5a5a5', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Description</label>
          <input
            type="text"
            placeholder="e.g., Team lunch with clients"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Expense'}
        </button>
      </form>
    </div>
  );
}

export default App;
