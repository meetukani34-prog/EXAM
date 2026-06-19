require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedUsers() {
  console.log("Generating 200 test users for k6...");
  const password = "password123";
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  const users = [];
  const credentials = [];

  for (let i = 1; i <= 200; i++) {
    const usn = `K6TEST_${i.toString().padStart(3, '0')}`;
    
    users.push({
      usn: usn,
      roll_number: usn,
      name: `K6 Test Student ${i}`,
      email: `k6test${i}@example.com`,
      password_hash: hash,
      branch: "LOAD_TEST",
      is_active_session: false,
      is_blocked: false
    });

    credentials.push({ usn, password });
  }

  // Clear any existing test users
  await supabase.from('students').delete().like('usn', 'K6TEST_%');
  console.log("Cleared old K6 test users.");

  // Insert in batches of 50
  for (let i = 0; i < users.length; i += 50) {
    const batch = users.slice(i, i + 50);
    const { data, error } = await supabase
      .from('students')
      .insert(batch);
    
    if (error) {
      console.error("Error inserting batch:", error);
    } else {
      console.log(`Inserted batch ${i/50 + 1} of 4`);
    }
  }

  // Write credentials to JSON for k6 to use
  fs.writeFileSync('./tests/k6_users.json', JSON.stringify(credentials, null, 2));
  console.log("Created ./tests/k6_users.json with credentials.");
  console.log("Done.");
}

seedUsers();
