import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Custom Metrics ────────────────────────────────────────────────
const errorRate = new Rate('errors');
const dashboardDuration = new Trend('dashboard_duration', true);
const loginDuration = new Trend('login_duration', true);
const examDuration = new Trend('exam_duration', true);
const failedRequests = new Counter('failed_requests');

// ─── Test Configuration ────────────────────────────────────────────
const BASE_URL = 'https://examnew-phi.vercel.app';

export const options = {
  // Simulate 200 students hitting the site over 3 minutes
  stages: [
    { duration: '30s', target: 200 },  // Ramp up: 0 → 200 virtual users
    { duration: '2m',  target: 200 },  // Steady state: hold 200 users for 2 min
    { duration: '30s', target: 0 },    // Ramp down: 200 → 0 users
  ],

  // Performance thresholds — test FAILS if these are breached
  thresholds: {
    http_req_duration: [
      'p(95)<2000',   // 95% of requests must complete within 2s
      'p(99)<5000',   // 99% of requests must complete within 5s
    ],
    http_req_failed: ['rate<0.05'],  // Less than 5% of requests should fail
    errors: ['rate<0.1'],            // Custom error rate below 10%
  },
};

// ─── Main Test Scenario ────────────────────────────────────────────
export default function () {
  // ── 1. Dashboard Page (main landing for students) ──
  group('Dashboard Page', () => {
    const dashRes = http.get(`${BASE_URL}/dashboard`, {
      tags: { page: 'dashboard' },
    });

    dashboardDuration.add(dashRes.timings.duration);

    const dashOk = check(dashRes, {
      'Dashboard — status is 200': (r) => r.status === 200,
      'Dashboard — response time < 500ms': (r) => r.timings.duration < 500,
      'Dashboard — response time < 2s': (r) => r.timings.duration < 2000,
      'Dashboard — body is not empty': (r) => r.body && r.body.length > 0,
    });

    if (!dashOk) {
      failedRequests.add(1);
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }
  });

  // Simulate student "thinking" time (1–3 seconds)
  sleep(Math.random() * 2 + 1);

  // ── 2. Login Page ──
  group('Login Page', () => {
    const loginRes = http.get(`${BASE_URL}/login`, {
      tags: { page: 'login' },
    });

    loginDuration.add(loginRes.timings.duration);

    const loginOk = check(loginRes, {
      'Login — status is 200': (r) => r.status === 200,
      'Login — response time < 500ms': (r) => r.timings.duration < 500,
      'Login — response time < 2s': (r) => r.timings.duration < 2000,
    });

    if (!loginOk) {
      failedRequests.add(1);
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }
  });

  // Simulate reading/thinking
  sleep(Math.random() * 2 + 1);

  // ── 3. Exam Page ──
  group('Exam Page', () => {
    const examRes = http.get(`${BASE_URL}/exam`, {
      tags: { page: 'exam' },
    });

    examDuration.add(examRes.timings.duration);

    const examOk = check(examRes, {
      'Exam — status is 200': (r) => r.status === 200,
      'Exam — response time < 500ms': (r) => r.timings.duration < 500,
      'Exam — response time < 2s': (r) => r.timings.duration < 2000,
    });

    if (!examOk) {
      failedRequests.add(1);
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }
  });

  // ── 4. Admin Page (occasional check) ──
  if (Math.random() < 0.1) {
    // Only 10% of users hit admin (realistic)
    group('Admin Page', () => {
      const adminRes = http.get(`${BASE_URL}/admin`, {
        tags: { page: 'admin' },
      });

      check(adminRes, {
        'Admin — status is 200 or 302': (r) => r.status === 200 || r.status === 302,
        'Admin — response time < 2s': (r) => r.timings.duration < 2000,
      });
    });
  }

  // Final think time before next iteration
  sleep(Math.random() * 3 + 1);
}

// ─── Setup (runs once before the test) ─────────────────────────────
export function setup() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   ExamGuard Load Test — 200 Concurrent Students     ║');
  console.log('║   Target: ' + BASE_URL.padEnd(42) + '║');
  console.log('║   Duration: 3 minutes (30s ramp + 2m steady + 30s) ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // Verify the site is reachable before running the full test
  const smokeRes = http.get(`${BASE_URL}/dashboard`);
  if (smokeRes.status !== 200) {
    console.warn(`⚠️  WARNING: Smoke check returned status ${smokeRes.status}`);
    console.warn(`   The site may be down or returning errors.`);
  } else {
    console.log(`✅ Smoke check passed — site is reachable (${smokeRes.timings.duration.toFixed(0)}ms)`);
  }
}

// ─── Teardown (runs once after the test) ───────────────────────────
export function teardown(data) {
  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  Load test completed. Review the summary above.');
  console.log('══════════════════════════════════════════════════════');
}
