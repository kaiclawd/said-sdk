import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import * as bs58 from 'bs58';

// SAID Program on Solana Mainnet
export const SAID_PROGRAM_ID = new PublicKey('5dpw6KEQPn248pnkkaYyWfHwu2nfb3LUMbTucb6LaA8G');
export const TREASURY_PDA = new PublicKey('2XfHTeNWTjNwUmgoXaafYuqHcAAXj8F5Kjw2Bnzi4FxH');

// Default RPC endpoints
const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
const AGENT_ACCOUNT_SIZE = 263;

// Anchor discriminator for instructions (SHA256("global:<instruction_name>")[0..8])
const REGISTER_AGENT_DISCRIMINATOR = Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]);
const GET_VERIFIED_DISCRIMINATOR = Buffer.from([132, 231, 2, 30, 115, 74, 23, 26]);

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
  skills?: string[];
  website?: string;
  created?: string;
  verified?: boolean;
  verifiedAt?: string;
  mcpEndpoint?: string;
  a2aEndpoint?: string;
  serviceTypes?: string[];
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
 * Options for creating a new agent
 */
export interface CreateAgentOptions {
  name: string;
  description?: string;
  twitter?: string;
  website?: string;
  skills?: string[];
  capabilities?: string[];
  serviceTypes?: string[];
  mcpEndpoint?: string;
  a2aEndpoint?: string;
}

/**
 * Result from creating a new agent
 */
export interface CreateAgentResult {
  wallet: Keypair;
  walletAddress: string;
  secretKey: string; // base58 encoded
  agentPDA: string;
  metadataUri: string;
  txSignature: string;
}

/**
 * SAID SDK - Query, verify, and create AI agent identities on Solana
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
    // ✅ FIX: Validate buffer length
    if (data.length !== AGENT_ACCOUNT_SIZE) {
      throw new Error(`Invalid account data size: expected ${AGENT_ACCOUNT_SIZE}, got ${data.length}`);
    }
    
    const owner = new PublicKey(data.subarray(8, 40)).toString();
    
    const uriLength = data.readUInt32LE(40);
    // ✅ FIX: Bounds check
    if (uriLength > 200 || 44 + uriLength > data.length) {
      throw new Error('Malformed metadata URI length');
    }
    const metadataUri = data.subarray(44, 44 + uriLength).toString('utf8');
    
    const offset = 44 + uriLength;
    if (offset + 17 > data.length) {
      throw new Error('Truncated account data');
    }
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
    } catch (e: any) {
      // ✅ FIX: Distinguish between expected vs unexpected errors
      if (e.message?.includes('Invalid public key')) {
        throw new Error(`Invalid wallet address: ${wallet}`);
      }
      // Network/RPC errors should bubble up
      throw new Error(`Failed to lookup agent: ${e.message}`);
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

  /**
   * Generate a new wallet keypair
   */
  generateWallet(): Keypair {
    return Keypair.generate();
  }

  /**
   * Build registerAgent instruction
   */
  private buildRegisterInstruction(
    agentPDA: PublicKey,
    owner: PublicKey,
    metadataUri: string
  ): TransactionInstruction {
    // Encode metadata URI with length prefix (Borsh string encoding)
    const uriBytes = Buffer.from(metadataUri, 'utf8');
    const uriLengthBuffer = Buffer.alloc(4);
    uriLengthBuffer.writeUInt32LE(uriBytes.length, 0);
    
    const data = Buffer.concat([
      REGISTER_AGENT_DISCRIMINATOR,
      uriLengthBuffer,
      uriBytes
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: agentPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: SAID_PROGRAM_ID,
      data
    });
  }

  /**
   * Build verifyAgent instruction
   */
  private buildVerifyInstruction(
    agentPDA: PublicKey,
    owner: PublicKey
  ): TransactionInstruction {
    return new TransactionInstruction({
      keys: [
        { pubkey: agentPDA, isSigner: false, isWritable: true },
        { pubkey: TREASURY_PDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: SAID_PROGRAM_ID,
      data: GET_VERIFIED_DISCRIMINATOR
    });
  }

  /**
   * Create a new agent with zero friction
   * 
   * This is the magic function - creates a wallet, registers the agent,
   * and optionally verifies them. The funder pays for registration rent.
   * 
   * @param options - Agent metadata (name, description, skills, etc.)
   * @param funder - Keypair that pays for registration (our treasury)
   * @param metadataUri - URL where AgentCard JSON is hosted
   * @returns CreateAgentResult with wallet, PDA, and transaction signature
   */
  async createAgent(
    options: CreateAgentOptions,
    funder: Keypair,
    metadataUri: string
  ): Promise<CreateAgentResult> {
    // Generate new wallet for the agent
    const wallet = Keypair.generate();
    const [agentPDA] = SAID.deriveAgentPDA(wallet.publicKey);

    // Build register instruction
    const registerIx = this.buildRegisterInstruction(
      agentPDA,
      wallet.publicKey,
      metadataUri
    );

    // We need to fund the new wallet with enough for rent
    // The agent account is created by the program, but owner needs to sign
    // So funder transfers rent to wallet first, then wallet signs register tx
    
    // Calculate rent (approximately 0.00285 SOL for 263 bytes)
    const rentExempt = await this.connection.getMinimumBalanceForRentExemption(AGENT_ACCOUNT_SIZE);
    
    // Build transaction: funder sends rent to wallet, then wallet registers
    const tx = new Transaction();
    
    // Transfer 2x rent to new wallet - covers PDA creation + remaining balance
    tx.add(
      SystemProgram.transfer({
        fromPubkey: funder.publicKey,
        toPubkey: wallet.publicKey,
        lamports: rentExempt * 2 // ~0.0054 SOL - plenty for PDA + fees
      })
    );
    
    // Add register instruction (signed by new wallet)
    tx.add(registerIx);

    // Send transaction (signed by both funder and new wallet)
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [funder, wallet],
      { commitment: 'confirmed' }
    );

    return {
      wallet,
      walletAddress: wallet.publicKey.toString(),
      secretKey: bs58.encode(wallet.secretKey),
      agentPDA: agentPDA.toString(),
      metadataUri,
      txSignature: signature
    };
  }

  /**
   * Register an existing wallet on SAID
   * 
   * @param wallet - The agent's existing wallet keypair
   * @param metadataUri - URL where AgentCard JSON is hosted
   * @param funder - Optional separate funder for rent (defaults to wallet)
   */
  async registerAgent(
    wallet: Keypair,
    metadataUri: string,
    funder?: Keypair
  ): Promise<{ agentPDA: string; txSignature: string }> {
    const [agentPDA] = SAID.deriveAgentPDA(wallet.publicKey);
    const payer = funder || wallet;

    const registerIx = this.buildRegisterInstruction(
      agentPDA,
      wallet.publicKey,
      metadataUri
    );

    const tx = new Transaction().add(registerIx);
    
    const signers = funder ? [funder, wallet] : [wallet];
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      signers,
      { commitment: 'confirmed' }
    );

    return {
      agentPDA: agentPDA.toString(),
      txSignature: signature
    };
  }

  /**
   * Verify an existing agent (pays 0.01 SOL verification fee)
   * 
   * @param wallet - The agent's wallet keypair
   */
  async verifyAgent(wallet: Keypair): Promise<{ txSignature: string }> {
    const [agentPDA] = SAID.deriveAgentPDA(wallet.publicKey);

    const verifyIx = this.buildVerifyInstruction(agentPDA, wallet.publicKey);
    const tx = new Transaction().add(verifyIx);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [wallet],
      { commitment: 'confirmed' }
    );

    return { txSignature: signature };
  }

  /**
   * Create and verify an agent in one transaction
   * Zero friction: agent gets wallet + registration + verification
   * Funder pays rent (~0.003 SOL), agent pays verification (0.01 SOL)
   * Net cost to funder: ~0.003 SOL, Net revenue: 0.01 SOL = +0.007 SOL profit
   */
  async createAndVerifyAgent(
    options: CreateAgentOptions,
    funder: Keypair,
    metadataUri: string
  ): Promise<CreateAgentResult & { verified: boolean }> {
    // First create the agent
    const result = await this.createAgent(options, funder, metadataUri);
    
    // Fund wallet with verification fee (0.01 SOL)
    const VERIFICATION_FEE = 10_000_000; // 0.01 SOL in lamports
    
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: funder.publicKey,
        toPubkey: result.wallet.publicKey,
        lamports: VERIFICATION_FEE + 5000 // verification fee + tx fee buffer
      })
    );
    
    await sendAndConfirmTransaction(
      this.connection,
      fundTx,
      [funder],
      { commitment: 'confirmed' }
    );

    // Now verify
    try {
      await this.verifyAgent(result.wallet);
      return { ...result, verified: true };
    } catch (e) {
      // Return result even if verification fails
      return { ...result, verified: false };
    }
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
