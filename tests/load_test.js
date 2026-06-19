import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ─── Load Test Credentials ─────────────────────────────────────────
// Load the 200 sequentially generated test users
const testUsers = new SharedArray('users', function () {
  return JSON.parse(open('./k6_users.json'));
});

// ─── Custom Metrics ────────────────────────────────────────────────
const errorRate = new Rate('errors');
const loginApiDuration = new Trend('api_login_duration', true);
const configApiDuration = new Trend('api_config_duration', true);

// ─── Test Configuration ────────────────────────────────────────────
// Use environment variables or fallback to known URLs
const FRONTEND_URL = __ENV.FRONTEND_URL || 'https://examnew-phi.vercel.app';
const API_BASE = __ENV.API_BASE || 'http://127.0.0.1:8001'; // Default local backend

export const options = {
  // Simulate 200 real students logging in simultaneously
  stages: [
    { duration: '30s', target: 200 },  // Ramp up to 200 users
    { duration: '2m',  target: 200 },  // Hold at 200 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Less than 5% HTTP errors
    api_login_duration: ['p(95)<2000'], // 95% of logins under 2s
  },
};

// ─── Main Test Scenario ────────────────────────────────────────────
export default function () {
  // 1. Assign a unique user from the array to this Virtual User (VU)
  const userIndex = (__VU - 1) % testUsers.length;
  const user = testUsers[userIndex];

  // ── 1. Load Frontend (Simulating Browser Navigation) ──
  group('1. Frontend Initial Load', () => {
    http.get(`${FRONTEND_URL}/login`);
  });

  sleep(Math.random() * 2 + 1); // User taking time to type credentials

  // ── 2. Authenticate (Hit the Backend API directly) ──
  let authToken = '';
  
  group('2. API Authentication', () => {
    const payload = JSON.stringify({
      usn: user.usn,
      password: user.password
    });

    const res = http.post(`${API_BASE}/auth/login`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      tags: { name: 'API_Login' }
    });

    loginApiDuration.add(res.timings.duration);

    const loginOk = check(res, {
      'Login status 200': (r) => r.status === 200,
      'Login returned data': (r) => r.body && r.body.length > 0
    });

    if (!loginOk) {
      errorRate.add(1);
    } else {
      errorRate.add(0);
      try {
        const body = res.json();
        authToken = body.token || body.access_token || '';
      } catch (e) {}
    }
  });

  sleep(Math.random() * 1 + 0.5); // Fast transition to dashboard

  // ── 3. Load Dashboard Data (Simulate Dashboard Fetch) ──
  group('3. Dashboard API Load', () => {
    // Dashboard hits frontend first
    http.get(`${FRONTEND_URL}/dashboard`);

    // Then dashboard fetches public config from backend
    const configRes = http.get(`${API_BASE}/exam/config/public`, {
      tags: { name: 'API_Config_Fetch' }
    });
    
    configApiDuration.add(configRes.timings.duration);
    
    check(configRes, {
      'Config status 200': (r) => r.status === 200,
    });
    
    // If backend requires auth for student status, simulate it
    if (authToken) {
      // Assuming a generic status endpoint based on standard patterns
      http.get(`${API_BASE}/exam/student/status`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        tags: { name: 'API_Student_Status' }
      });
    }
  });

  // Wait before next iteration
  sleep(Math.random() * 3 + 1);
}

// ─── Setup & Teardown ──────────────────────────────────────────────
export function setup() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   ExamGuard Load Test — Real Authenticated Users    ║');
  console.log(`║   Frontend: ${FRONTEND_URL.padEnd(39)}║`);
  console.log(`║   Backend : ${API_BASE.padEnd(39)}║`);
  console.log('║   Users   : 200 Sequential K6TEST accounts           ║');
  console.log('╚══════════════════════════════════════════════════════╝');
}
