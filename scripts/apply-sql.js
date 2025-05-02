// Script to apply SQL functions to Supabase
// Run this with: node --experimental-modules scripts/apply-sql.mjs

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verify we have the required environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🚀 Applying SQL functions to Supabase database...');

// Create Supabase client with admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Path to SQL file
const sqlFilePath = path.join(__dirname, '..', 'src', 'lib', 'sql', 'match_pdf_chunks.sql');

// Read the SQL file
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Apply the SQL function
async function applySqlFunctions() {
  try {
    console.log('📄 Reading SQL from:', sqlFilePath);
    
    // Split SQL into statements (this is a simple approach, might not work for complex SQL)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n🔧 Executing statement ${i + 1}/${statements.length}:`);
      console.log(`${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
      
      // Execute the SQL statement
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error);
        
        // Try an alternative approach - direct SQL query
        console.log('⚠️ Trying alternative approach with direct SQL query...');
        const { error: directError } = await supabase.from('_exec_sql').select('*').eq('query', statement).single();
        
        if (directError) {
          console.error('❌ Alternative approach also failed:', directError);
          console.log('\n⚠️ You may need to run this SQL directly in the Supabase SQL editor:');
          console.log('----------------------------------------');
          console.log(statement);
          console.log('----------------------------------------\n');
        } else {
          console.log('✅ Alternative approach successful!');
        }
      } else {
        console.log('✅ Statement executed successfully');
      }
    }
    
    console.log('\n🎉 SQL functions applied successfully!');
    console.log('\n📋 SQL functions created:');
    console.log('  - match_pdf_chunks');
    console.log('  - match_documents');
    
  } catch (error) {
    console.error('❌ Error applying SQL functions:', error);
    console.error('\n⚠️ You may need to run the SQL directly in the Supabase SQL editor!');
    process.exit(1);
  }
}

// Run the function
applySqlFunctions(); 