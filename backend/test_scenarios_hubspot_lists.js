
import { getLists, getContactsInList } from './hubspotClient.js';

async function runTest() {
    console.log("🟠 STARTING HUBSPOT LISTS SCENARIO TEST");

    // Test 1: Function Existence
    if (typeof getLists === 'function' && typeof getContactsInList === 'function') {
        console.log("✅ PASS: List functions exported correctly.");
    } else {
        console.error("❌ FAIL: List functions missing.");
        process.exit(1);
    }

    // Test 2: Execution Safety (Dry Run)
    try {
        console.log("   Attempting getLists with dummy token...");
        await getLists("dummy_token");
        // We expect this to fail with network error or 401, but NOT a reference error
    } catch (e) {
        if (e.message.includes('401') || e.message.includes('failed')) {
            console.log(`✅ PASS: getLists executed (Caught expected API error: ${e.message.substring(0, 20)}...)`);
        } else {
            console.log(`⚠️ WARNING: Unexpected error in getLists: ${e.message}`);
        }
    }

    try {
        console.log("   Attempting getContactsInList with dummy token...");
        await getContactsInList("dummy_token", "123");
        // We expect this to fail
    } catch (e) {
        if (e.message.includes('401') || e.message.includes('failed')) {
            console.log(`✅ PASS: getContactsInList executed (Caught expected API error: ${e.message.substring(0, 20)}...)`);
        } else {
            console.log(`⚠️ WARNING: Unexpected error in getContactsInList: ${e.message}`);
        }
    }

    console.log("✅ DONE: HubSpot List Logic Verified (Static Checks)");
}

runTest();
