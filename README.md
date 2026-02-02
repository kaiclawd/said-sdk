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

### Types

```typescript
interface AgentIdentity {
  pubkey: string;        // Agent PDA
  owner: string;         // Owner wallet
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
