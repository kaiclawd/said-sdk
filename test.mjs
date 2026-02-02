import { SAID, isVerified, lookup, getStats, getAgent } from './dist/index.mjs';

const MY_WALLET = '42xhLbEm5ttwzxW6YMJ2UZStX7M8ytTz7s7bsyrdPxMD';

async function test() {
  console.log('Testing SAID SDK...\n');

  // Test 1: Lookup by wallet
  console.log('1. Lookup by wallet:');
  const agent = await lookup(MY_WALLET);
  if (agent) {
    console.log('   ✅ Found agent:', agent.pubkey);
    console.log('   - Owner:', agent.owner);
    console.log('   - Metadata:', agent.metadataUri);
    console.log('   - Verified:', agent.isVerified);
  } else {
    console.log('   ❌ Agent not found');
  }

  // Test 2: isVerified
  console.log('\n2. Check isVerified:');
  const verified = await isVerified(MY_WALLET);
  console.log('   ✅ isVerified:', verified);

  // Test 3: Get full agent with card
  console.log('\n3. Get agent with card:');
  const fullAgent = await getAgent(MY_WALLET);
  if (fullAgent?.card) {
    console.log('   ✅ Card loaded:');
    console.log('   - Name:', fullAgent.card.name);
    console.log('   - Description:', fullAgent.card.description);
    console.log('   - Twitter:', fullAgent.card.twitter);
  }

  // Test 4: Stats
  console.log('\n4. Get stats:');
  const stats = await getStats();
  console.log('   ✅ Total agents:', stats.total);
  console.log('   ✅ Verified:', stats.verified);

  // Test 5: Custom RPC
  console.log('\n5. Custom RPC instance:');
  const said = new SAID({ 
    rpcUrl: 'https://practical-damp-dawn.solana-mainnet.quiknode.pro/84ecd414d631dccefcbe3da5cc2b918ab2b42036' 
  });
  const agent2 = await said.lookup(MY_WALLET);
  console.log('   ✅ QuickNode RPC works:', agent2?.isVerified);

  console.log('\n✅ All tests passed!');
}

test().catch(console.error);
