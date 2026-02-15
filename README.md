# said-sdk

SDK for [SAID Protocol](https://saidprotocol.com) - Identity infrastructure for AI agents on Solana.

## Install

```bash
npm install said-sdk
```

## Quick Start

```typescript
import { isVerified, getAgent, getStats } from 'said-sdk';

// Check if an agent is verified
const verified = await isVerified('42xhLbEm5ttwzxW6YMJ2UZStX7M8ytTz7s7bsyrdPxMD');
console.log(verified); // true

// Get full agent data with metadata
const agent = await getAgent('42xhLbEm5ttwzxW6YMJ2UZStX7M8ytTz7s7bsyrdPxMD');
console.log(agent.card.name); // "Kai"
console.log(agent.isVerified); // true

// Get protocol stats
const stats = await getStats();
console.log(stats); // { total: 1, verified: 1 }
```

## API

### Functions

```typescript
// Check if wallet has verified SAID identity
isVerified(wallet: string): Promise<boolean>

// Check if wallet is registered (verified or not)
isRegistered(wallet: string): Promise<boolean>

// Get on-chain agent data
lookup(wallet: string): Promise<AgentIdentity | null>

// Get agent data + AgentCard metadata
getAgent(wallet: string): Promise<AgentIdentity | null>

// Get just the AgentCard metadata
getCard(wallet: string): Promise<AgentCard | null>

// List all registered agents
listAgents(options?: { includeCards?: boolean }): Promise<AgentIdentity[]>

// Get total/verified counts
getStats(): Promise<{ total: number; verified: number }>
```

### Custom RPC

```typescript
import { SAID } from 'said-sdk';

const said = new SAID({
  rpcUrl: 'https://your-rpc.com',
  commitment: 'confirmed'
});

const agent = await said.lookup('...');
```

## Multi-Wallet Support

Link multiple wallets to a single identity for key rotation and recovery:

```typescript
import { linkWallet, unlinkWallet, transferAuthority, getLinkedWallets } from 'said-sdk';
import { Connection, Keypair } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');

// Link a new wallet to your identity (both must sign)
const result = await linkWallet(
  connection,
  currentAuthorityKeypair,  // Must own the identity
  newWalletKeypair          // Wallet to link
);
console.log('Linked wallet:', result.walletLinkPDA);

// Unlink a wallet (authority or wallet itself can unlink)
await unlinkWallet(connection, authorityKeypair, walletToRemove);

// Transfer authority to a linked wallet (recovery)
await transferAuthority(connection, currentAuthority, newAuthority);

// Get all linked wallets for an identity
const linkedWallets = await getLinkedWallets(connection, ownerWallet);
console.log('Linked wallets:', linkedWallets);
```

**Security:** Both wallets must sign when linking to prevent unauthorized access.

### Types

```typescript
interface AgentIdentity {
  pubkey: string;        // Agent PDA
  owner: string;         // Owner wallet
  authority: string;     // Current authority (can differ from owner)
  metadataUri: string;   // AgentCard JSON URL
  registeredAt: number;  // Unix timestamp
  isVerified: boolean;
  verifiedAt: number;    // Unix timestamp (0 if not verified)
  card?: AgentCard;      // Populated by getAgent()
}

interface AgentCard {
  name: string;
  description?: string;
  twitter?: string;
  wallet?: string;
  capabilities?: string[];
  website?: string;
}
```

## REST API

SAID also provides a REST API at `https://saidprotocol.com/api`:

```bash
# Get agent by wallet
GET /api/agent/{wallet}

# Check verification status
GET /api/verify/{wallet}

# List all agents
GET /api/agents

# Get stats
GET /api/stats
```

## Badge

Embed a verification badge:

```html
<img src="https://saidprotocol.com/badge/{wallet}.svg" alt="SAID Verified">
```

## Links

- Website: https://saidprotocol.com
- GitHub: https://github.com/kaiclawd/said
- Twitter: [@saidinfra](https://twitter.com/saidinfra)

## License

MIT

---

## CLI Tools

The SDK includes CLI commands for agent management:

```bash
# Generate a new Solana wallet
npx said wallet generate -o wallet.json

# Register an agent (free off-chain)
npx said register -k wallet.json -n "MyAgent" -d "AI agent description"

# Verify your agent (0.01 SOL)
npx said verify -k wallet.json

# Check verification status
npx said status -w YourWalletAddress

# List all agents
npx said list
```

### CLI Options

```bash
npx said --help

Commands:
  wallet generate  Generate a new Solana wallet
  register         Register your agent with SAID
  verify           Get a verification badge
  status           Check agent verification status
  list             List all registered agents

Options:
  -k, --keypair    Path to wallet keypair file
  -n, --name       Agent name
  -d, --desc       Agent description
  -w, --wallet     Wallet address to query
  --mainnet        Use mainnet (default: devnet)
```

## Examples

### TypeScript Integration

```typescript
import { SAID, getAgent, isVerified } from 'said-sdk';

// Initialize with custom config
const said = new SAID({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  commitment: 'confirmed'
});

// Check verification before processing
async function handleAgentRequest(wallet: string) {
  const verified = await isVerified(wallet);
  
  if (!verified) {
    throw new Error('Agent must be SAID verified');
  }
  
  const agent = await getAgent(wallet);
  console.log(`Processing request from ${agent.card.name}`);
  
  // Your logic here
}

// List verified agents only
const agents = await said.listAgents({ includeCards: true });
const verified = agents.filter(a => a.isVerified);
console.log(`Found ${verified.length} verified agents`);
```

### Python Integration (via API)

```python
import requests

def is_verified(wallet: str) -> bool:
    r = requests.get(f'https://api.saidprotocol.com/api/verify/{wallet}')
    return r.json().get('verified', False)

def get_agent(wallet: str):
    r = requests.get(f'https://api.saidprotocol.com/api/agents/{wallet}')
    return r.json()

# Usage
if is_verified('42xhLbEm...'):
    agent = get_agent('42xhLbEm...')
    print(f"Agent: {agent['card']['name']}")
```

---

## 🏛️ Colosseum Agent Hackathon

Built for the Colosseum AI Agent Hackathon (Feb 2-13, 2026).

**What's New:**
- CLI tools for agent registration (`npx said register`)
- Wallet generation (`npx said wallet generate`)
- Verification badges (`npx said verify`)
- TypeScript SDK for programmatic access
- REST API fallback for non-JS environments

**Stats (Feb 13, 2026):**
- v0.2.0 published to npm
- 18 agents using SAID identity
- Live on Solana mainnet

Part of [SAID Protocol](https://github.com/kaiclawd/said) — Identity Infrastructure for AI Agents.
