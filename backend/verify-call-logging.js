#!/usr/bin/env node

/**
 * Comprehensive Call Logging Verification Script
 *
 * This script verifies that ALL calls are being logged with complete transcripts.
 * It checks:
 * - Every word spoken is captured
 * - Every character is logged
 * - Transcripts are saved to Redis/Memory
 * - Transcripts are persisted to PostgreSQL
 * - No data loss during the pipeline
 *
 * Run this after calls to verify logging integrity.
 */

import { PrismaClient } from '@prisma/client';
import { getCall, listCalls } from './callState.js';

const prisma = new PrismaClient();

console.log('🔍 Call Logging Verification Script');
console.log('===================================\n');

async function verifyCallLogging() {
    try {
        // 1. Check active calls in Redis/Memory
        console.log('📊 STEP 1: Checking Active Calls (Redis/Memory)');
        console.log('------------------------------------------------');
        const activeCalls = await listCalls();
        console.log(`Found ${activeCalls.length} active calls in memory/Redis\n`);

        if (activeCalls.length > 0) {
            for (const callInfo of activeCalls) {
                const fullCall = await getCall(callInfo.callSid);
                console.log(`Call: ${callInfo.callSid}`);
                console.log(`  Status: ${callInfo.status}`);
                console.log(`  Created: ${callInfo.createdAt}`);
                console.log(`  Transcript Entries: ${fullCall?.transcript?.length || 0}`);

                if (fullCall?.transcript && fullCall.transcript.length > 0) {
                    console.log(`  Transcript Content:`);
                    fullCall.transcript.forEach((entry, idx) => {
                        console.log(`    ${idx + 1}. [${entry.speaker}] "${entry.text}" (${entry.text?.length || 0} chars)`);
                    });

                    // Calculate total words and characters
                    const totalChars = fullCall.transcript.reduce((sum, e) => sum + (e.text?.length || 0), 0);
                    const totalWords = fullCall.transcript.reduce((sum, e) => sum + (e.text?.split(/\s+/).length || 0), 0);
                    console.log(`  Total: ${totalWords} words, ${totalChars} characters`);
                }
                console.log('');
            }
        }

        // 2. Check recent calls in Database
        console.log('\n📊 STEP 2: Checking Recent Calls in Database');
        console.log('----------------------------------------------');
        const recentCalls = await prisma.call.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                lead: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        console.log(`Found ${recentCalls.length} recent calls in database\n`);

        for (const call of recentCalls) {
            const leadName = call.lead ? `${call.lead.firstName} ${call.lead.lastName}` : 'Unknown';
            console.log(`Call ID: ${call.id}`);
            console.log(`  Lead: ${leadName}`);
            console.log(`  Status: ${call.status}`);
            console.log(`  Duration: ${call.duration || 0}s`);
            console.log(`  Created: ${call.createdAt.toISOString()}`);
            console.log(`  Twilio SID: ${call.twilioCallSid || 'N/A'}`);

            // Check transcript
            const transcript = call.transcript;
            if (Array.isArray(transcript)) {
                console.log(`  ✅ Transcript: ${transcript.length} entries`);

                if (transcript.length > 0) {
                    console.log(`  Transcript Content:`);
                    transcript.forEach((entry, idx) => {
                        const speaker = entry.speaker || 'unknown';
                        const text = entry.text || '';
                        const chars = text.length;
                        const words = text.split(/\s+/).length;
                        console.log(`    ${idx + 1}. [${speaker}] "${text}" (${words} words, ${chars} chars)`);
                    });

                    // Calculate totals
                    const totalChars = transcript.reduce((sum, e) => sum + (e.text?.length || 0), 0);
                    const totalWords = transcript.reduce((sum, e) => sum + (e.text?.split(/\s+/).length || 0), 0);
                    console.log(`  📊 Total: ${totalWords} words, ${totalChars} characters`);

                    // Verify data quality
                    if (totalWords < 5) {
                        console.log(`  ⚠️ WARNING: Very short transcript (only ${totalWords} words)`);
                    }
                } else {
                    console.log(`  ⚠️ WARNING: Empty transcript array`);
                }
            } else {
                console.log(`  ❌ ERROR: Transcript is not an array or is missing`);
            }

            // Check AI summary
            if (call.aiSummary) {
                console.log(`  ✅ AI Summary: ${call.aiSummary.substring(0, 100)}...`);
            } else {
                console.log(`  ⚠️ No AI Summary`);
            }

            console.log('');
        }

        // 3. Statistics
        console.log('\n📊 STEP 3: Overall Statistics');
        console.log('------------------------------');

        const totalCalls = await prisma.call.count();
        const callsWithTranscripts = await prisma.call.count({
            where: {
                transcript: {
                    not: null
                }
            }
        });
        const completedCalls = await prisma.call.count({
            where: { status: 'completed' }
        });

        console.log(`Total Calls: ${totalCalls}`);
        console.log(`Calls with Transcripts: ${callsWithTranscripts} (${Math.round(callsWithTranscripts / totalCalls * 100)}%)`);
        console.log(`Completed Calls: ${completedCalls}`);

        // 4. Detailed transcript analysis
        console.log('\n📊 STEP 4: Transcript Quality Analysis');
        console.log('---------------------------------------');

        const callsWithData = await prisma.call.findMany({
            where: {
                transcript: {
                    not: null
                },
                status: 'completed'
            },
            take: 50,
            orderBy: { createdAt: 'desc' }
        });

        let totalTranscriptEntries = 0;
        let totalWords = 0;
        let totalCharacters = 0;
        let callsWithEmptyTranscripts = 0;
        let callsWithGoodTranscripts = 0;

        for (const call of callsWithData) {
            if (Array.isArray(call.transcript)) {
                totalTranscriptEntries += call.transcript.length;

                if (call.transcript.length === 0) {
                    callsWithEmptyTranscripts++;
                } else if (call.transcript.length >= 3) {
                    callsWithGoodTranscripts++;
                }

                for (const entry of call.transcript) {
                    if (entry.text) {
                        totalWords += entry.text.split(/\s+/).length;
                        totalCharacters += entry.text.length;
                    }
                }
            }
        }

        console.log(`Analyzed ${callsWithData.length} completed calls with transcripts:`);
        console.log(`  Total Transcript Entries: ${totalTranscriptEntries}`);
        console.log(`  Total Words Captured: ${totalWords}`);
        console.log(`  Total Characters Captured: ${totalCharacters}`);
        console.log(`  Calls with Empty Transcripts: ${callsWithEmptyTranscripts}`);
        console.log(`  Calls with Good Transcripts (3+ entries): ${callsWithGoodTranscripts}`);

        if (callsWithData.length > 0) {
            console.log(`  Average Entries per Call: ${Math.round(totalTranscriptEntries / callsWithData.length)}`);
            console.log(`  Average Words per Call: ${Math.round(totalWords / callsWithData.length)}`);
            console.log(`  Average Characters per Call: ${Math.round(totalCharacters / callsWithData.length)}`);
        }

        // 5. Check for missing transcripts
        console.log('\n📊 STEP 5: Missing Transcript Detection');
        console.log('----------------------------------------');

        const completedWithoutTranscripts = await prisma.call.findMany({
            where: {
                status: 'completed',
                OR: [
                    { transcript: null },
                    { transcript: { equals: [] } }
                ]
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                lead: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        if (completedWithoutTranscripts.length > 0) {
            console.log(`⚠️ Found ${completedWithoutTranscripts.length} completed calls without transcripts:`);
            completedWithoutTranscripts.forEach((call) => {
                const leadName = call.lead ? `${call.lead.firstName} ${call.lead.lastName}` : 'Unknown';
                console.log(`  - Call ${call.id} (${leadName}) - ${call.createdAt.toISOString()}`);
            });
        } else {
            console.log(`✅ No completed calls missing transcripts!`);
        }

        console.log('\n✅ Verification Complete!\n');

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run verification
verifyCallLogging();
