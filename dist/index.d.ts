import { Keypair, PublicKey } from '@solana/web3.js';

declare const SAID_PROGRAM_ID: PublicKey;
declare const TREASURY_PDA: PublicKey;
/**
 * AgentCard metadata structure (hosted JSON)
 */
interface AgentCard {
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
interface AgentIdentity {
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
interface SAIDConfig {
    rpcUrl?: string;
    commitment?: 'processed' | 'confirmed' | 'finalized';
}
/**
 * Options for creating a new agent
 */
interface CreateAgentOptions {
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
interface CreateAgentResult {
    wallet: Keypair;
    walletAddress: string;
    secretKey: string;
    agentPDA: string;
    metadataUri: string;
    txSignature: string;
}
/**
 * SAID SDK - Query, verify, and create AI agent identities on Solana
 */
declare class SAID {
    private connection;
    private config;
    constructor(config?: SAIDConfig);
    /**
     * Derive agent PDA from owner wallet
     */
    static deriveAgentPDA(owner: PublicKey | string): [PublicKey, number];
    /**
     * Parse raw account data into AgentIdentity
     */
    private parseAgentData;
    /**
     * Lookup agent by wallet address
     */
    lookup(wallet: string | PublicKey): Promise<AgentIdentity | null>;
    /**
     * Lookup agent by PDA directly
     */
    lookupByPDA(pda: string | PublicKey): Promise<AgentIdentity | null>;
    /**
     * Check if a wallet has a verified SAID identity
     */
    isVerified(wallet: string | PublicKey): Promise<boolean>;
    /**
     * Check if a wallet is registered on SAID (verified or not)
     */
    isRegistered(wallet: string | PublicKey): Promise<boolean>;
    /**
     * Fetch the AgentCard metadata for a wallet
     */
    getCard(wallet: string | PublicKey): Promise<AgentCard | null>;
    /**
     * Get full agent data including AgentCard metadata
     */
    getAgent(wallet: string | PublicKey): Promise<AgentIdentity | null>;
    /**
     * List all registered agents
     */
    listAgents(options?: {
        includeCards?: boolean;
    }): Promise<AgentIdentity[]>;
    /**
     * Count total registered and verified agents
     */
    getStats(): Promise<{
        total: number;
        verified: number;
    }>;
    /**
     * Generate a new wallet keypair
     */
    generateWallet(): Keypair;
    /**
     * Build registerAgent instruction
     */
    private buildRegisterInstruction;
    /**
     * Build verifyAgent instruction
     */
    private buildVerifyInstruction;
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
    createAgent(options: CreateAgentOptions, funder: Keypair, metadataUri: string): Promise<CreateAgentResult>;
    /**
     * Register an existing wallet on SAID
     *
     * @param wallet - The agent's existing wallet keypair
     * @param metadataUri - URL where AgentCard JSON is hosted
     * @param funder - Optional separate funder for rent (defaults to wallet)
     */
    registerAgent(wallet: Keypair, metadataUri: string, funder?: Keypair): Promise<{
        agentPDA: string;
        txSignature: string;
    }>;
    /**
     * Verify an existing agent (pays 0.01 SOL verification fee)
     *
     * @param wallet - The agent's wallet keypair
     */
    verifyAgent(wallet: Keypair): Promise<{
        txSignature: string;
    }>;
    /**
     * Create and verify an agent in one transaction
     * Zero friction: agent gets wallet + registration + verification
     * Funder pays rent (~0.003 SOL), agent pays verification (0.01 SOL)
     * Net cost to funder: ~0.003 SOL, Net revenue: 0.01 SOL = +0.007 SOL profit
     */
    createAndVerifyAgent(options: CreateAgentOptions, funder: Keypair, metadataUri: string): Promise<CreateAgentResult & {
        verified: boolean;
    }>;
}
declare const said: SAID;
declare const lookup: (wallet: string | PublicKey) => Promise<AgentIdentity | null>;
declare const isVerified: (wallet: string | PublicKey) => Promise<boolean>;
declare const isRegistered: (wallet: string | PublicKey) => Promise<boolean>;
declare const getCard: (wallet: string | PublicKey) => Promise<AgentCard | null>;
declare const getAgent: (wallet: string | PublicKey) => Promise<AgentIdentity | null>;
declare const listAgents: (options?: {
    includeCards?: boolean;
}) => Promise<AgentIdentity[]>;
declare const getStats: () => Promise<{
    total: number;
    verified: number;
}>;

export { type AgentCard, type AgentIdentity, type CreateAgentOptions, type CreateAgentResult, SAID, type SAIDConfig, SAID_PROGRAM_ID, TREASURY_PDA, SAID as default, getAgent, getCard, getStats, isRegistered, isVerified, listAgents, lookup, said };
