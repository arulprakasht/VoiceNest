// test-server.js - Simple test script to verify components work
require('dotenv').config();

async function testComponents() {
    console.log('Testing server components...\n');

    // Test 1: Environment Variables
    console.log('1. Environment Variables:');
    console.log('- PORT:', process.env.PORT || '3000 (default)');
    console.log('- NODE_ENV:', process.env.NODE_ENV || 'development (default)');
    console.log('- SUPABASE_URL present:', !!process.env.SUPABASE_URL);
    console.log('- SUPABASE_ANON_KEY present:', !!process.env.SUPABASE_ANON_KEY);
    console.log('- VAPI_API_KEY present:', !!process.env.VAPI_API_KEY);
    console.log();

    // Test 2: VapiService
    try {
        console.log('2. Testing VapiService:');
        const VapiService = require('./server/vapi_integration');
        const vapi = new VapiService();
        
        const health = await vapi.healthCheck();
        console.log('- Health check:', health);
        
        if (health.status === 'healthy') {
            console.log('- VapiService: ✅ OK');
        } else {
            console.log('- VapiService: ⚠️  Warning -', health.message || 'Not fully functional');
        }
    } catch (error) {
        console.log('- VapiService: ❌ Error -', error.message);
    }
    console.log();

    // Test 3: Supabase
    try {
        console.log('3. Testing Supabase:');
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.log('- Supabase: ⚠️  Skipped - Missing configuration');
        } else {
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY,
                {
                    auth: { persistSession: false },
                    db: { schema: 'public' }
                }
            );
            
            // Simple connection test
            const { error } = await supabase.from('properties').select('count', { count: 'exact', head: true });
            if (error) {
                console.log('- Supabase: ⚠️  Warning -', error.message);
            } else {
                console.log('- Supabase: ✅ Connected successfully');
            }
        }
    } catch (error) {
        console.log('- Supabase: ❌ Error -', error.message);
    }
    console.log();

    // Test 4: Required packages
    console.log('4. Testing Required Packages:');
    const requiredPackages = [
        'express',
        'cors',
        'helmet',
        'express-rate-limit',
        'dotenv',
        '@supabase/supabase-js'
    ];

    requiredPackages.forEach(pkg => {
        try {
            require(pkg);
            console.log(`- ${pkg}: ✅ Available`);
        } catch (error) {
            console.log(`- ${pkg}: ❌ Missing - Run: npm install ${pkg}`);
        }
    });

    console.log('\nTest completed! If you see any ❌ errors, please fix them before starting the server.');
}

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('Test error:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('Test rejection:', reason);
    process.exit(1);
});

// Run tests
testComponents().catch(error => {
    console.error('Test failed:', error.message);
    process.exit(1);
});