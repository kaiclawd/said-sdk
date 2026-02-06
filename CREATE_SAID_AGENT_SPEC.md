# create-said-agent — Product Spec

## Overview
A CLI tool that scaffolds, registers, and runs a SAID-verified AI agent in one command.

**Goal:** Fastest path from zero to a verified, running AI agent on Solana.

```bash
npx create-said-agent
```

## User Journey
1. User runs `npx create-said-agent`
2. Wizard prompts for basic config (name, description, template)
3. CLI scaffolds agent code
4. CLI generates or imports Solana wallet
5. CLI registers on SAID Protocol (mainnet)
6. CLI starts agent locally
7. **Result:** Running, verified agent in <5 minutes

## Templates

### Tier 1: Starter (default)
- Nanobot-style lightweight agent
- ~2-4K lines of code
- Python 3.10+, 4GB RAM
- LLM: Ollama (local), OpenAI, Anthropic, Groq
- Features: Basic chat, tool calling, SQLite memory, REST API

### Tier 2: Standard
- Everything in Starter + MCP + A2A + x402 payments
- 8GB RAM recommended

### Tier 3: Power
- Integration guide for Clawdbot/Moltbot/OpenClaw
- Config files + registration script

## CLI Wizard Flow

```
$ npx create-said-agent

🤖 create-said-agent v1.0.0

? Project name: my-agent
? Agent description: A helpful assistant
? Template: starter / standard / power
? LLM provider: ollama / openai / anthropic / groq
? Solana wallet: Generate new / Import existing

Creating project... ████████████████ 100%
Registering on SAID... ████████████████ 100%

✅ Agent created and registered!

SAID Identity:
  Wallet: 7xKp...3mNq
  PDA: 9aRt...2vBx
  View: https://saidprotocol.com/agent/7xKp...3mNq

Next steps:
  cd my-agent
  npm start
```

## Project Structure

```
my-agent/
├── package.json
├── .env
├── said.json          # SAID metadata
├── src/
│   ├── index.ts
│   ├── agent.ts
│   ├── llm.ts
│   ├── memory.ts
│   └── tools/
├── scripts/
│   ├── register.ts
│   └── verify.ts
└── data/memory.db
```

## Technical Implementation

**Dependencies:** @solana/web3.js, said-sdk, inquirer, ora, chalk, degit

**Registration:**
```typescript
import { SAID } from 'said-sdk';

const said = new SAID({ network: 'mainnet-beta' });
const result = await said.register({
  wallet: keypair,
  metadata: { name, description, endpoints, capabilities }
});
```

## Competitive Edge

| Feature | create-said-agent | create-8004-agent |
|---------|-------------------|-------------------|
| Scaffolds code | ✅ | ✅ |
| Auto-registers | ✅ | ✅ |
| Runs the agent | ✅ | ❌ |
| Solana mainnet | ✅ | ❌ (devnet) |
| Local LLM | ✅ | ❌ |

**Our edge:** Scaffold + register + RUN.

## Timeline (5-day sprint)
- Day 1: CLI wizard + scaffold
- Day 2: SAID registration + wallet
- Day 3: LLM providers + agent logic
- Day 4: Polish + docs
- Day 5: Launch + announce

## Open Questions
1. TypeScript or Python for starter?
2. Mainnet or devnet default?
3. Same repo or separate?

## References
- github.com/Eversmile12/create-8004-agent
- nanobot (5K stars)
- saidprotocol.com/docs
