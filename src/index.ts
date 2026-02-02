import { Connection, PublicKey } from '@solana/web3.js';

// SAID Program on Solana Mainnet
export const SAID_PROGRAM_ID = new PublicKey('5dpw6KEQPn248pnkkaYyWfHwu2nfb3LUMbTucb6LaA8G');
export const TREASURY_PDA = new PublicKey('2XfHTeNWTjNwUmgoXaafYuqHcAAXj8F5Kjw2Bnzi4FxH');

// Default RPC endpoints
const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
const AGENT_ACCOUNT_SIZE = 263;

/**
 * AgentCard metadata structure (hosted JSON)
 */
export interface AgentCard {
  name: string;
  description?: string;
  twitter?: string;
  wallet?: string;
  agentPDA?: string;
  capabilities?: string[];
  website?: string;
  created?: string;
  verified?: boolean;
  verifiedAt?: string;
}

/**
 * On-chain agent identity data
 */
export interface AgentIdentity {
  pubkey: string;
  owner: string;
  metadataUri: string;
  registeredAt: number;
  isVerified: boolean;
  verifiedAt: number;
  reputationScore?: number;
  card?: AgentCard;
}

/**
 * SAID SDK configuration
 */
export interface SAIDConfig {
  rpcUrl?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * SAID SDK - Query and verify AI agent identities on Solana
 */
export class SAID {
  private connection: Connection;
  private config: SAIDConfig;

  constructor(config: SAIDConfig = {}) {
    this.config = config;
    this.connection = new Connection(
      config.rpcUrl || DEFAULT_RPC,
      config.commitment || 'confirmed'
    );
  }

  /**
   * Derive agent PDA from owner wallet
   */
  static deriveAgentPDA(owner: PublicKey | string): [PublicKey, number] {
    const ownerKey = typeof owner === 'string' ? new PublicKey(owner) : owner;
    return PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), ownerKey.toBuffer()],
      SAID_PROGRAM_ID
    );
  }

  /**
   * Parse raw account data into AgentIdentity
   */
  private parseAgentData(pubkey: string, data: Buffer): AgentIdentity {
    // Account layout:
    // 0-8: discriminator
    // 8-40: owner (32 bytes)
    // 40-44: uri_length (4 bytes LE)
    // 44-44+uri_length: metadata_uri
    // +8: registered_at (i64)
    // +1: is_verified (bool)
    // +8: verified_at (i64)
    
    const owner = new PublicKey(data.subarray(8, 40)).toString();
    
    const uriLength = data.readUInt32LE(40);
    const metadataUri = data.subarray(44, 44 + uriLength).toString('utf8');
    
    const offset = 44 + uriLength;
    const registeredAt = Number(data.readBigInt64LE(offset));
    const isVerified = data[offset + 8] === 1;
    const verifiedAt = Number(data.readBigInt64LE(offset + 9));

    return {
      pubkey,
      owner,
      metadataUri,
      registeredAt,
      isVerified,
      verifiedAt
    };
  }

  /**
   * Lookup agent by wallet address
   */
  async lookup(wallet: string | PublicKey): Promise<AgentIdentity | null> {
    try {
      const [agentPDA] = SAID.deriveAgentPDA(wallet);
      const accountInfo = await this.connection.getAccountInfo(agentPDA);
      
      if (!accountInfo || accountInfo.data.length !== AGENT_ACCOUNT_SIZE) {
        return null;
      }

      const agent = this.parseAgentData(agentPDA.toString(), accountInfo.data);
      return agent;
    } catch (e) {
      return null;
    }
  }

  /**
   * Lookup agent by PDA directly
   */
  async lookupByPDA(pda: string | PublicKey): Promise<AgentIdentity | null> {
    try {
      const pdaKey = typeof pda === 'string' ? new PublicKey(pda) : pda;
      const accountInfo = await this.connection.getAccountInfo(pdaKey);
      
      if (!accountInfo || accountInfo.data.length !== AGENT_ACCOUNT_SIZE) {
        return null;
      }

      return this.parseAgentData(pdaKey.toString(), accountInfo.data);
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if a wallet has a verified SAID identity
   */
  async isVerified(wallet: string | PublicKey): Promise<boolean> {
    const agent = await this.lookup(wallet);
    return agent?.isVerified ?? false;
  }

  /**
   * Check if a wallet is registered on SAID (verified or not)
   */
  async isRegistered(wallet: string | PublicKey): Promise<boolean> {
    const agent = await this.lookup(wallet);
    return agent !== null;
  }

  /**
   * Fetch the AgentCard metadata for a wallet
   */
  async getCard(wallet: string | PublicKey): Promise<AgentCard | null> {
    const agent = await this.lookup(wallet);
    if (!agent || !agent.metadataUri) return null;

    try {
      // Ensure www prefix for CORS
      let uri = agent.metadataUri;
      if (uri.includes('saidprotocol.com') && !uri.includes('www.')) {
        uri = uri.replace('saidprotocol.com', 'www.saidprotocol.com');
      }
      
      const response = await fetch(uri);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  /**
   * Get full agent data including AgentCard metadata
   */
  async getAgent(wallet: string | PublicKey): Promise<AgentIdentity | null> {
    const agent = await this.lookup(wallet);
    if (!agent) return null;

    const card = await this.getCard(wallet);
    if (card) {
      agent.card = card;
    }

    return agent;
  }

  /**
   * List all registered agents
   */
  async listAgents(options: { includeCards?: boolean } = {}): Promise<AgentIdentity[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(SAID_PROGRAM_ID, {
        filters: [{ dataSize: AGENT_ACCOUNT_SIZE }]
      });

      const agents = accounts.map(({ pubkey, account }) => 
        this.parseAgentData(pubkey.toString(), account.data)
      );

      if (options.includeCards) {
        await Promise.all(
          agents.map(async (agent) => {
            try {
              let uri = agent.metadataUri;
              if (uri.includes('saidprotocol.com') && !uri.includes('www.')) {
                uri = uri.replace('saidprotocol.com', 'www.saidprotocol.com');
              }
              const res = await fetch(uri);
              if (res.ok) {
                agent.card = await res.json();
              }
            } catch (e) {
              // Skip failed card fetches
            }
          })
        );
      }

      return agents;
    } catch (e) {
      return [];
    }
  }

  /**
   * Count total registered and verified agents
   */
  async getStats(): Promise<{ total: number; verified: number }> {
    const agents = await this.listAgents();
    return {
      total: agents.length,
      verified: agents.filter(a => a.isVerified).length
    };
  }
}

// Export a default instance for quick usage
export const said = new SAID();

// Convenience functions using default instance
export const lookup = (wallet: string | PublicKey) => said.lookup(wallet);
export const isVerified = (wallet: string | PublicKey) => said.isVerified(wallet);
export const isRegistered = (wallet: string | PublicKey) => said.isRegistered(wallet);
export const getCard = (wallet: string | PublicKey) => said.getCard(wallet);
export const getAgent = (wallet: string | PublicKey) => said.getAgent(wallet);
export const listAgents = (options?: { includeCards?: boolean }) => said.listAgents(options);
export const getStats = () => said.getStats();

export default SAID;
