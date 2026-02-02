import { PublicKey } from '@solana/web3.js';

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
    website?: string;
    created?: string;
    verified?: boolean;
    verifiedAt?: string;
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
 * SAID SDK - Query and verify AI agent identities on Solana
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

export { type AgentCard, type AgentIdentity, SAID, type SAIDConfig, SAID_PROGRAM_ID, TREASURY_PDA, SAID as default, getAgent, getCard, getStats, isRegistered, isVerified, listAgents, lookup, said };
