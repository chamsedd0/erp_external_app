import { useState } from 'react';
import { Loader2, ArrowRight, User, KeyRound, Building2 } from 'lucide-react';

const API_URL = 'https://erp-external-app.vercel.app/auth/login';

function App() {
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
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setEmployeeId('');
    setPin('');
  };

  if (user) {
    return (
      <div className="glass-card">
        <div className="profile-header">
          <div className="avatar-placeholder">
            {user.name.charAt(0)}
          </div>
          <h2>Welcome back,</h2>
          <h1>{user.name.split(' ')[0]}</h1>
        </div>

        <div className="info-item">
          <span className="label">Job Title</span>
          <span className="value">{user.job_title}</span>
        </div>

        <div className="info-item">
          <span className="label">Department</span>
          <span className="value">{user.department || 'N/A'}</span>
        </div>

        <div className="info-item">
          <span className="label">Employee ID</span>
          <span className="value">{user.employee_id}</span> {/* Using local state or user obj if returned */}
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    );
  }

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

      {/* Debug UI Section */}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Debug Tools
        </h3>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch(`${API_URL.replace('/auth/login', '')}/auth/debug`);
                const data = await res.json();
                alert(JSON.stringify(data, null, 2));
              } catch (e) {
                alert('Debug Error: ' + e.message);
              }
            }}
            style={{ padding: '8px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)' }}
          >
            ⚡ Test Connection
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch(`${API_URL.replace('/auth/login', '')}/auth/employees`);
                const data = await res.json();
                console.log('Employees:', data);
                alert(`Found ${data.count} employees. Check Console for raw JSON.`);
              } catch (e) {
                alert('Fetch Error: ' + e.message);
              }
            }}
            style={{ padding: '8px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)' }}
          >
            👥 List Employees
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
