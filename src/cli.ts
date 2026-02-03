#!/usr/bin/env node

import { Command } from 'commander';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { SAID, said } from './index';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('said')
  .description('SAID Protocol CLI - Solana Agent Identity')
  .version('0.2.1');

// ============ REGISTER ============
program
  .command('register')
  .description('Register a new agent identity (~0.003 SOL rent)')
  .requiredOption('-k, --keypair <path>', 'Path to wallet keypair JSON file')
  .requiredOption('-n, --name <name>', 'Agent name')
  .option('-t, --twitter <handle>', 'Twitter handle (e.g., @kaiclawd)')
  .option('-d, --description <desc>', 'Agent description')
  .option('-w, --website <url>', 'Website URL')
  .option('--rpc <url>', 'Custom RPC URL', 'https://api.mainnet-beta.solana.com')
  .action(async (options) => {
    try {
      console.log('🔐 Loading keypair...');
      const keypairData = JSON.parse(fs.readFileSync(options.keypair, 'utf-8'));
      const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
      console.log(`   Wallet: ${wallet.publicKey.toString()}`);

      // Check if already registered
      console.log('\n📡 Checking registration status...');
      const existing = await said.lookup(wallet.publicKey);
      if (existing) {
        console.log('⚠️  This wallet is already registered!');
        console.log(`   PDA: ${existing.pubkey}`);
        console.log(`   Verified: ${existing.isVerified}`);
        process.exit(1);
      }

      // Build metadata
      const metadata = {
        name: options.name,
        description: options.description || `${options.name} - AI Agent on SAID Protocol`,
        twitter: options.twitter || undefined,
        website: options.website || undefined,
        wallet: wallet.publicKey.toString(),
        created: new Date().toISOString().split('T')[0],
        verified: false,
      };

      // Host metadata on SAID API
      console.log('\n📝 Creating agent card...');
      
      let metadataUri: string;
      try {
        const uploadRes = await fetch('https://api.saidprotocol.com/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: wallet.publicKey.toString(),
            name: options.name,
            description: options.description,
            twitter: options.twitter,
            website: options.website,
          })
        });
        
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          metadataUri = data.cardUri;
          console.log(`   ✓ Card hosted at: ${metadataUri}`);
        } else {
          // Fallback to saidprotocol.com hosted cards
          metadataUri = `https://www.saidprotocol.com/agents/${wallet.publicKey.toString()}.json`;
          console.log(`   ⚠️ API unavailable, using fallback URI`);
        }
      } catch (e) {
        metadataUri = `https://www.saidprotocol.com/agents/${wallet.publicKey.toString()}.json`;
        console.log(`   ⚠️ Could not reach API, using fallback URI`);
      }

      // Register on-chain
      console.log('\n⛓️  Registering on-chain...');
      const saidClient = new SAID({ rpcUrl: options.rpc });
      const result = await saidClient.registerAgent(wallet, metadataUri);
      
      console.log('\n✅ Registration successful!');
      console.log(`   Agent PDA: ${result.agentPDA}`);
      console.log(`   Transaction: ${result.txSignature}`);
      console.log(`   Explorer: https://solscan.io/tx/${result.txSignature}`);
      
      console.log('\n📋 Next steps to get verified:');
      console.log('   1. Add your wallet address to your Twitter bio (or website/.well-known/said.json)');
      console.log('   2. Run: said verify --keypair <path> --method twitter');
      console.log('   3. Pay 0.01 SOL verification fee');
      console.log('   4. Get your verified badge! ✓');
      
    } catch (error: any) {
      console.error('\n❌ Registration failed:', error.message);
      process.exit(1);
    }
  });

// ============ VERIFY ============
program
  .command('verify')
  .description('Verify your agent identity (0.01 SOL)')
  .requiredOption('-k, --keypair <path>', 'Path to wallet keypair JSON file')
  .requiredOption('-m, --method <method>', 'Verification method: twitter, domain, github')
  .option('--handle <handle>', 'Twitter handle (for twitter method)')
  .option('--domain <domain>', 'Domain name (for domain method)')
  .option('--repo <repo>', 'GitHub repo (for github method)')
  .option('--rpc <url>', 'Custom RPC URL', 'https://api.mainnet-beta.solana.com')
  .option('--skip-check', 'Skip verification check (for testing)')
  .action(async (options) => {
    try {
      console.log('🔐 Loading keypair...');
      const keypairData = JSON.parse(fs.readFileSync(options.keypair, 'utf-8'));
      const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
      console.log(`   Wallet: ${wallet.publicKey.toString()}`);

      // Check if registered
      console.log('\n📡 Checking registration status...');
      const agent = await said.lookup(wallet.publicKey);
      if (!agent) {
        console.log('❌ This wallet is not registered!');
        console.log('   Run: said register --keypair <path> --name "YourName"');
        process.exit(1);
      }
      
      if (agent.isVerified) {
        console.log('✅ This agent is already verified!');
        process.exit(0);
      }

      // Perform verification check based on method
      if (!options.skipCheck) {
        console.log(`\n🔍 Verifying via ${options.method}...`);
        
        let verified = false;
        
        if (options.method === 'twitter') {
          verified = await verifyTwitter(wallet.publicKey.toString(), options.handle);
        } else if (options.method === 'domain') {
          verified = await verifyDomain(wallet.publicKey.toString(), options.domain);
        } else if (options.method === 'github') {
          verified = await verifyGithub(wallet.publicKey.toString(), options.repo);
        } else {
          console.error(`❌ Unknown verification method: ${options.method}`);
          process.exit(1);
        }
        
        if (!verified) {
          console.log('\n❌ Verification check failed!');
          console.log('   Make sure your wallet address is publicly visible.');
          process.exit(1);
        }
        
        console.log('   ✓ Verification check passed!');
      }

      // Submit verification on-chain (costs 0.01 SOL)
      console.log('\n⛓️  Submitting verification (0.01 SOL)...');
      const saidClient = new SAID({ rpcUrl: options.rpc });
      const result = await saidClient.verifyAgent(wallet);
      
      console.log('\n✅ Verification successful!');
      console.log(`   Transaction: ${result.txSignature}`);
      console.log(`   Explorer: https://solscan.io/tx/${result.txSignature}`);
      console.log('\n🎉 You are now a verified SAID agent!');
      
    } catch (error: any) {
      console.error('\n❌ Verification failed:', error.message);
      process.exit(1);
    }
  });

// ============ LOOKUP ============
program
  .command('lookup <wallet>')
  .description('Look up an agent by wallet address')
  .option('--rpc <url>', 'Custom RPC URL', 'https://api.mainnet-beta.solana.com')
  .action(async (wallet, options) => {
    try {
      console.log(`🔍 Looking up ${wallet}...\n`);
      
      const agent = await said.lookup(wallet);
      if (!agent) {
        console.log('❌ No agent found for this wallet.');
        process.exit(1);
      }
      
      console.log('📋 Agent Identity:');
      console.log(`   PDA: ${agent.pubkey}`);
      console.log(`   Owner: ${agent.owner}`);
      console.log(`   Verified: ${agent.isVerified ? '✅ Yes' : '❌ No'}`);
      console.log(`   Metadata: ${agent.metadataUri}`);
      console.log(`   Registered: ${new Date(agent.registeredAt * 1000).toISOString()}`);
      
      // Fetch card if available
      const card = await said.getCard(wallet);
      if (card) {
        console.log('\n🎴 Agent Card:');
        console.log(`   Name: ${card.name}`);
        if (card.description) console.log(`   Description: ${card.description}`);
        if (card.twitter) console.log(`   Twitter: ${card.twitter}`);
        if (card.website) console.log(`   Website: ${card.website}`);
      }
      
    } catch (error: any) {
      console.error('❌ Lookup failed:', error.message);
      process.exit(1);
    }
  });

// ============ LIST ============
program
  .command('list')
  .description('List all registered agents')
  .option('--verified', 'Only show verified agents')
  .option('--limit <n>', 'Limit results', '20')
  .action(async (options) => {
    try {
      console.log('📋 Fetching agents...\n');
      
      const agents = await said.listAgents({ includeCards: true });
      let filtered = agents;
      
      if (options.verified) {
        filtered = agents.filter(a => a.isVerified);
      }
      
      const limited = filtered.slice(0, parseInt(options.limit));
      
      console.log(`Found ${filtered.length} agent(s)${options.verified ? ' (verified only)' : ''}:\n`);
      
      for (const agent of limited) {
        const name = agent.card?.name || 'Unknown';
        const status = agent.isVerified ? '✅' : '⬜';
        console.log(`${status} ${name}`);
        console.log(`   Wallet: ${agent.owner}`);
        if (agent.card?.twitter) console.log(`   Twitter: ${agent.card.twitter}`);
        console.log('');
      }
      
    } catch (error: any) {
      console.error('❌ List failed:', error.message);
      process.exit(1);
    }
  });

// ============ STATS ============
program
  .command('stats')
  .description('Show protocol statistics')
  .action(async () => {
    try {
      const stats = await said.getStats();
      console.log('📊 SAID Protocol Stats:');
      console.log(`   Total Agents: ${stats.total}`);
      console.log(`   Verified: ${stats.verified}`);
      console.log(`   Unverified: ${stats.total - stats.verified}`);
    } catch (error: any) {
      console.error('❌ Stats failed:', error.message);
      process.exit(1);
    }
  });

// ============ VERIFICATION HELPERS ============

async function verifyTwitter(wallet: string, handle?: string): Promise<boolean> {
  if (!handle) {
    console.log('   ⚠️  No Twitter handle provided. Checking agent card...');
    const card = await said.getCard(wallet);
    handle = card?.twitter;
    if (!handle) {
      console.log('   ❌ No Twitter handle found in agent card.');
      return false;
    }
  }
  
  // Clean handle
  handle = handle.replace('@', '');
  console.log(`   Checking @${handle}'s bio for wallet address...`);
  
  try {
    // Use a Twitter API or scraper to check bio
    // For now, we'll check via API endpoint
    const res = await fetch(`https://api.saidprotocol.com/verify/twitter?handle=${handle}&wallet=${wallet}`);
    if (res.ok) {
      const data = await res.json();
      return data.verified === true;
    }
    
    // Fallback: instruct user
    console.log(`\n   📝 To verify via Twitter:`);
    console.log(`   1. Go to twitter.com/${handle}`);
    console.log(`   2. Add this to your bio: ${wallet}`);
    console.log(`   3. Run this command again`);
    return false;
    
  } catch (e) {
    console.log('   ⚠️  Could not auto-check Twitter. Manual verification needed.');
    return false;
  }
}

async function verifyDomain(wallet: string, domain?: string): Promise<boolean> {
  if (!domain) {
    console.log('   ❌ No domain provided. Use --domain <domain>');
    return false;
  }
  
  console.log(`   Checking ${domain}/.well-known/said.json...`);
  
  try {
    const res = await fetch(`https://${domain}/.well-known/said.json`);
    if (!res.ok) {
      console.log(`   ❌ Could not fetch ${domain}/.well-known/said.json`);
      console.log(`\n   📝 To verify via domain:`);
      console.log(`   1. Create file: .well-known/said.json`);
      console.log(`   2. Contents: {"wallet":"${wallet}"}`);
      console.log(`   3. Run this command again`);
      return false;
    }
    
    const data = await res.json();
    if (data.wallet === wallet) {
      return true;
    }
    
    console.log(`   ❌ Wallet mismatch. Expected ${wallet}, got ${data.wallet}`);
    return false;
    
  } catch (e) {
    console.log(`   ❌ Error fetching domain verification file.`);
    return false;
  }
}

async function verifyGithub(wallet: string, repo?: string): Promise<boolean> {
  if (!repo) {
    console.log('   ❌ No repo provided. Use --repo <owner/repo>');
    return false;
  }
  
  console.log(`   Checking github.com/${repo}/blob/main/SAID.md...`);
  
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/main/SAID.md`);
    if (!res.ok) {
      console.log(`   ❌ Could not fetch SAID.md from ${repo}`);
      console.log(`\n   📝 To verify via GitHub:`);
      console.log(`   1. Create file: SAID.md in your repo root`);
      console.log(`   2. Contents: wallet: ${wallet}`);
      console.log(`   3. Run this command again`);
      return false;
    }
    
    const content = await res.text();
    if (content.includes(wallet)) {
      return true;
    }
    
    console.log(`   ❌ Wallet address not found in SAID.md`);
    return false;
    
  } catch (e) {
    console.log(`   ❌ Error fetching GitHub verification file.`);
    return false;
  }
}

program.parse();
