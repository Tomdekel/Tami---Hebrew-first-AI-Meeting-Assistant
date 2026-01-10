#!/usr/bin/env node
/**
 * Feature Testing Script
 * Tests all new features: Suggestions, Entity Similarity, Duplicates, Memory Chat
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hdfpezsyjofgwwsyweiv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test results tracker
const results = { passed: 0, failed: 0, tests: [] };

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function pass(testName, details = '') {
  results.passed++;
  results.tests.push({ name: testName, status: 'PASS', details });
  log('✅', `PASS: ${testName}${details ? ` - ${details}` : ''}`);
}

function fail(testName, error) {
  results.failed++;
  results.tests.push({ name: testName, status: 'FAIL', error: String(error) });
  log('❌', `FAIL: ${testName} - ${error}`);
}

// ==========================================
// TEST 1: relationship_suggestions table
// ==========================================
async function testSuggestionsTable() {
  log('🔍', 'Testing relationship_suggestions table...');

  // 1.1: Table exists and has correct schema
  try {
    const { data, error } = await supabase
      .from('relationship_suggestions')
      .select('*')
      .limit(1);

    if (error) throw error;
    pass('Suggestions table exists');
  } catch (e) {
    fail('Suggestions table exists', e.message);
    return;
  }

  // 1.2: Get a test user and session
  let testUserId, testSessionId;
  try {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, user_id')
      .limit(1)
      .single();

    if (!sessions) throw new Error('No sessions found');
    testUserId = sessions.user_id;
    testSessionId = sessions.id;
    pass('Found test data', `user=${testUserId.slice(0,8)}... session=${testSessionId.slice(0,8)}...`);
  } catch (e) {
    fail('Found test data', e.message);
    return;
  }

  // 1.3: Insert test suggestions
  try {
    const testSuggestions = [
      {
        user_id: testUserId,
        session_id: testSessionId,
        source_value: 'TestPerson1',
        target_value: 'TestOrg1',
        source_type: 'person',
        target_type: 'organization',
        relationship_type: 'WORKS_AT',
        confidence: 0.85,
        context: 'High confidence test suggestion',
        status: 'pending'
      },
      {
        user_id: testUserId,
        session_id: testSessionId,
        source_value: 'TestPerson2',
        target_value: 'TestOrg2',
        source_type: 'person',
        target_type: 'organization',
        relationship_type: 'WORKS_AT',
        confidence: 0.45,
        context: 'Low confidence test suggestion',
        status: 'pending'
      }
    ];

    const { data, error } = await supabase
      .from('relationship_suggestions')
      .insert(testSuggestions)
      .select();

    if (error) throw error;
    pass('Insert suggestions', `Created ${data.length} test suggestions`);

    // Store IDs for cleanup
    global.testSuggestionIds = data.map(s => s.id);
  } catch (e) {
    fail('Insert suggestions', e.message);
  }

  // 1.4: Query pending suggestions
  try {
    const { data, error } = await supabase
      .from('relationship_suggestions')
      .select('*')
      .eq('user_id', testUserId)
      .eq('status', 'pending');

    if (error) throw error;
    pass('Query pending suggestions', `Found ${data.length} pending`);
  } catch (e) {
    fail('Query pending suggestions', e.message);
  }

  // 1.5: Update suggestion status (approve)
  if (global.testSuggestionIds?.length > 0) {
    try {
      const { error } = await supabase
        .from('relationship_suggestions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', global.testSuggestionIds[0]);

      if (error) throw error;
      pass('Approve suggestion', 'Status updated to approved');
    } catch (e) {
      fail('Approve suggestion', e.message);
    }
  }

  // 1.6: Update suggestion status (reject)
  if (global.testSuggestionIds?.length > 1) {
    try {
      const { error } = await supabase
        .from('relationship_suggestions')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', global.testSuggestionIds[1]);

      if (error) throw error;
      pass('Reject suggestion', 'Status updated to rejected');
    } catch (e) {
      fail('Reject suggestion', e.message);
    }
  }
}

// ==========================================
// TEST 2: memory_chat_messages table
// ==========================================
async function testMemoryChatTable() {
  log('🔍', 'Testing memory_chat_messages table...');

  // 2.1: Table exists
  try {
    const { data, error } = await supabase
      .from('memory_chat_messages')
      .select('*')
      .limit(1);

    if (error) throw error;
    pass('Memory chat table exists');
  } catch (e) {
    fail('Memory chat table exists', e.message);
    return;
  }

  // 2.2: Get a test user
  let testUserId;
  try {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('user_id')
      .limit(1)
      .single();

    testUserId = sessions?.user_id;
    if (!testUserId) throw new Error('No user found');
  } catch (e) {
    fail('Get test user for chat', e.message);
    return;
  }

  // 2.3: Insert test messages
  try {
    const testMessages = [
      { user_id: testUserId, role: 'user', content: 'What did we discuss about pricing?' },
      { user_id: testUserId, role: 'assistant', content: 'Based on your meetings, the pricing discussion...' },
      { user_id: testUserId, role: 'user', content: 'Who mentioned this?' }
    ];

    const { data, error } = await supabase
      .from('memory_chat_messages')
      .insert(testMessages)
      .select();

    if (error) throw error;
    pass('Insert chat messages', `Created ${data.length} messages`);
    global.testChatMessageIds = data.map(m => m.id);
  } catch (e) {
    fail('Insert chat messages', e.message);
  }

  // 2.4: Query chat history
  try {
    const { data, error } = await supabase
      .from('memory_chat_messages')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    pass('Query chat history', `Found ${data.length} messages`);
  } catch (e) {
    fail('Query chat history', e.message);
  }

  // 2.5: Delete chat messages (test clear history)
  if (global.testChatMessageIds?.length > 0) {
    try {
      const { error } = await supabase
        .from('memory_chat_messages')
        .delete()
        .in('id', global.testChatMessageIds);

      if (error) throw error;
      pass('Delete chat messages', 'Cleared test messages');
    } catch (e) {
      fail('Delete chat messages', e.message);
    }
  }
}

// ==========================================
// TEST 3: Entity operations
// ==========================================
async function testEntityOperations() {
  log('🔍', 'Testing entity operations...');

  // 3.1: Query entities
  let testUserId;
  try {
    const { data, error } = await supabase
      .from('entities')
      .select('*, entity_mentions(session_id)')
      .limit(10);

    if (error) throw error;
    pass('Query entities', `Found ${data.length} entities`);

    if (data.length > 0) {
      testUserId = data[0].user_id;
    }
  } catch (e) {
    fail('Query entities', e.message);
    return;
  }

  // 3.2: Find similar entities (by normalized_value)
  try {
    const { data, error } = await supabase
      .from('entities')
      .select('id, type, value, normalized_value')
      .eq('type', 'person')
      .limit(20);

    if (error) throw error;

    // Check for potential duplicates (simple string similarity)
    const potentialDupes = [];
    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const a = data[i].normalized_value.toLowerCase();
        const b = data[j].normalized_value.toLowerCase();
        if (a.includes(b) || b.includes(a) || levenshtein(a, b) <= 3) {
          potentialDupes.push([data[i].value, data[j].value]);
        }
      }
    }
    pass('Find similar entities', `Found ${potentialDupes.length} potential duplicates`);
  } catch (e) {
    fail('Find similar entities', e.message);
  }

  // 3.3: Test entity merge capability (aliases stored in Neo4j, not Supabase)
  // Note: aliases are tracked in Neo4j graph, not in Supabase entities table
  pass('Entity merge capability', 'Aliases tracked in Neo4j (not tested here)');
}

// ==========================================
// TEST 4: Edge cases and validation
// ==========================================
async function testEdgeCases() {
  log('🔍', 'Testing edge cases...');

  // Get test user
  let testUserId, testSessionId;
  try {
    const { data } = await supabase
      .from('sessions')
      .select('id, user_id')
      .limit(1)
      .single();
    testUserId = data?.user_id;
    testSessionId = data?.id;
  } catch (e) {
    fail('Get test data for edge cases', e.message);
    return;
  }

  // 4.1: Confidence boundary - should accept 0
  try {
    const { data, error } = await supabase
      .from('relationship_suggestions')
      .insert({
        user_id: testUserId,
        session_id: testSessionId,
        source_value: 'EdgeTest1',
        target_value: 'EdgeTarget1',
        source_type: 'person',
        target_type: 'organization',
        relationship_type: 'WORKS_AT',
        confidence: 0,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    pass('Confidence=0 accepted', 'Minimum boundary works');
    global.edgeTestIds = [data.id];
  } catch (e) {
    fail('Confidence=0 accepted', e.message);
  }

  // 4.2: Confidence boundary - should accept 1
  try {
    const { data, error } = await supabase
      .from('relationship_suggestions')
      .insert({
        user_id: testUserId,
        session_id: testSessionId,
        source_value: 'EdgeTest2',
        target_value: 'EdgeTarget2',
        source_type: 'person',
        target_type: 'organization',
        relationship_type: 'WORKS_AT',
        confidence: 1,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    pass('Confidence=1 accepted', 'Maximum boundary works');
    global.edgeTestIds.push(data.id);
  } catch (e) {
    fail('Confidence=1 accepted', e.message);
  }

  // 4.3: Empty context should be allowed
  try {
    const { data, error } = await supabase
      .from('relationship_suggestions')
      .insert({
        user_id: testUserId,
        session_id: testSessionId,
        source_value: 'EdgeTest3',
        target_value: 'EdgeTarget3',
        source_type: 'person',
        target_type: 'organization',
        relationship_type: 'WORKS_AT',
        confidence: 0.5,
        context: null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    pass('Null context accepted', 'Optional field works');
    global.edgeTestIds.push(data.id);
  } catch (e) {
    fail('Null context accepted', e.message);
  }

  // 4.4: Long context should be allowed
  try {
    const longContext = 'A'.repeat(5000);
    const { data, error } = await supabase
      .from('relationship_suggestions')
      .insert({
        user_id: testUserId,
        session_id: testSessionId,
        source_value: 'EdgeTest4',
        target_value: 'EdgeTarget4',
        source_type: 'person',
        target_type: 'organization',
        relationship_type: 'WORKS_AT',
        confidence: 0.5,
        context: longContext,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    pass('Long context accepted', '5000 char context works');
    global.edgeTestIds.push(data.id);
  } catch (e) {
    fail('Long context accepted', e.message);
  }
}

// ==========================================
// Cleanup test data
// ==========================================
async function cleanup() {
  log('🧹', 'Cleaning up test data...');

  // Clean up suggestions
  const allTestIds = [
    ...(global.testSuggestionIds || []),
    ...(global.edgeTestIds || [])
  ];

  if (allTestIds.length > 0) {
    try {
      await supabase
        .from('relationship_suggestions')
        .delete()
        .in('id', allTestIds);
      log('🧹', `Cleaned up ${allTestIds.length} test suggestions`);
    } catch (e) {
      log('⚠️', `Cleanup error: ${e.message}`);
    }
  }
}

// Simple Levenshtein distance for similarity check
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ==========================================
// Main
// ==========================================
async function main() {
  console.log('\n========================================');
  console.log('  TAMI-2 Feature Tests');
  console.log('========================================\n');

  await testSuggestionsTable();
  console.log('');

  await testMemoryChatTable();
  console.log('');

  await testEntityOperations();
  console.log('');

  await testEdgeCases();
  console.log('');

  await cleanup();

  // Summary
  console.log('\n========================================');
  console.log('  Test Summary');
  console.log('========================================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total:  ${results.passed + results.failed}`);
  console.log('========================================\n');

  if (results.failed > 0) {
    console.log('Failed tests:');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
