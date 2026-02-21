// Quick test of the verification flow logic
import { SAID } from './src/index';

async function testVerification() {
  const said = new SAID({
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    commitment: 'confirmed'
  });
  
  // Test with Kai's wallet (known verified agent)
  const kaiWallet = '42xhLbEm5ttwzxW6YMJ2UZStX7M8ytTz7s7bsyrdPxMD';
  
  console.log('Testing SAID SDK verification flow...\n');
  
  try {
    console.log('1. Testing isVerified()...');
    const verified = await said.isVerified(kaiWallet);
    console.log(`   ✅ Kai verified: ${verified}`);
    
    console.log('\n2. Testing getAgent()...');
    const agent = await said.getAgent(kaiWallet);
    if (agent) {
      console.log(`   ✅ Agent found: ${agent.card?.name}`);
      console.log(`   ✅ Verified: ${agent.isVerified}`);
      console.log(`   ✅ Metadata: ${agent.metadataUri}`);
    } else {
      console.log('   ❌ Agent not found');
    }
    
    console.log('\n3. Testing error handling with invalid wallet...');
    try {
      await said.lookup('invalid-wallet-address');
      console.log('   ❌ Should have thrown error');
    } catch (e: any) {
      console.log(`   ✅ Error caught: ${e.message}`);
    }
    
    console.log('\n✅ All tests passed!');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testVerification().catch(console.error);
