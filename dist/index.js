"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  SAID: () => SAID,
  SAID_PROGRAM_ID: () => SAID_PROGRAM_ID,
  TREASURY_PDA: () => TREASURY_PDA,
  default: () => index_default,
  getAgent: () => getAgent,
  getCard: () => getCard,
  getStats: () => getStats,
  isRegistered: () => isRegistered,
  isVerified: () => isVerified,
  listAgents: () => listAgents,
  lookup: () => lookup,
  said: () => said
});
module.exports = __toCommonJS(index_exports);
var import_web3 = require("@solana/web3.js");
var bs58 = __toESM(require("bs58"));
var SAID_PROGRAM_ID = new import_web3.PublicKey("5dpw6KEQPn248pnkkaYyWfHwu2nfb3LUMbTucb6LaA8G");
var TREASURY_PDA = new import_web3.PublicKey("2XfHTeNWTjNwUmgoXaafYuqHcAAXj8F5Kjw2Bnzi4FxH");
var DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
var AGENT_ACCOUNT_SIZE = 263;
var REGISTER_AGENT_DISCRIMINATOR = Buffer.from([51, 10, 104, 110, 50, 83, 175, 37]);
var VERIFY_AGENT_DISCRIMINATOR = Buffer.from([26, 117, 145, 70, 163, 102, 21, 103]);
var SAID = class _SAID {
  constructor(config = {}) {
    this.config = config;
    this.connection = new import_web3.Connection(
      config.rpcUrl || DEFAULT_RPC,
      config.commitment || "confirmed"
    );
  }
  /**
   * Derive agent PDA from owner wallet
   */
  static deriveAgentPDA(owner) {
    const ownerKey = typeof owner === "string" ? new import_web3.PublicKey(owner) : owner;
    return import_web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), ownerKey.toBuffer()],
      SAID_PROGRAM_ID
    );
  }
  /**
   * Parse raw account data into AgentIdentity
   */
  parseAgentData(pubkey, data) {
    const owner = new import_web3.PublicKey(data.subarray(8, 40)).toString();
    const uriLength = data.readUInt32LE(40);
    const metadataUri = data.subarray(44, 44 + uriLength).toString("utf8");
    const offset = 44 + uriLength;
    const registeredAt = Number(data.readBigInt64LE(offset));
    const isVerified2 = data[offset + 8] === 1;
    const verifiedAt = Number(data.readBigInt64LE(offset + 9));
    return {
      pubkey,
      owner,
      metadataUri,
      registeredAt,
      isVerified: isVerified2,
      verifiedAt
    };
  }
  /**
   * Lookup agent by wallet address
   */
  async lookup(wallet) {
    try {
      const [agentPDA] = _SAID.deriveAgentPDA(wallet);
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
  async lookupByPDA(pda) {
    try {
      const pdaKey = typeof pda === "string" ? new import_web3.PublicKey(pda) : pda;
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
  async isVerified(wallet) {
    const agent = await this.lookup(wallet);
    return agent?.isVerified ?? false;
  }
  /**
   * Check if a wallet is registered on SAID (verified or not)
   */
  async isRegistered(wallet) {
    const agent = await this.lookup(wallet);
    return agent !== null;
  }
  /**
   * Fetch the AgentCard metadata for a wallet
   */
  async getCard(wallet) {
    const agent = await this.lookup(wallet);
    if (!agent || !agent.metadataUri) return null;
    try {
      let uri = agent.metadataUri;
      if (uri.includes("saidprotocol.com") && !uri.includes("www.")) {
        uri = uri.replace("saidprotocol.com", "www.saidprotocol.com");
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
  async getAgent(wallet) {
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
  async listAgents(options = {}) {
    try {
      const accounts = await this.connection.getProgramAccounts(SAID_PROGRAM_ID, {
        filters: [{ dataSize: AGENT_ACCOUNT_SIZE }]
      });
      const agents = accounts.map(
        ({ pubkey, account }) => this.parseAgentData(pubkey.toString(), account.data)
      );
      if (options.includeCards) {
        await Promise.all(
          agents.map(async (agent) => {
            try {
              let uri = agent.metadataUri;
              if (uri.includes("saidprotocol.com") && !uri.includes("www.")) {
                uri = uri.replace("saidprotocol.com", "www.saidprotocol.com");
              }
              const res = await fetch(uri);
              if (res.ok) {
                agent.card = await res.json();
              }
            } catch (e) {
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
  async getStats() {
    const agents = await this.listAgents();
    return {
      total: agents.length,
      verified: agents.filter((a) => a.isVerified).length
    };
  }
  /**
   * Generate a new wallet keypair
   */
  generateWallet() {
    return import_web3.Keypair.generate();
  }
  /**
   * Build registerAgent instruction
   */
  buildRegisterInstruction(agentPDA, owner, metadataUri) {
    const uriBytes = Buffer.from(metadataUri, "utf8");
    const uriLengthBuffer = Buffer.alloc(4);
    uriLengthBuffer.writeUInt32LE(uriBytes.length, 0);
    const data = Buffer.concat([
      REGISTER_AGENT_DISCRIMINATOR,
      uriLengthBuffer,
      uriBytes
    ]);
    return new import_web3.TransactionInstruction({
      keys: [
        { pubkey: agentPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: import_web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: SAID_PROGRAM_ID,
      data
    });
  }
  /**
   * Build verifyAgent instruction
   */
  buildVerifyInstruction(agentPDA, owner) {
    return new import_web3.TransactionInstruction({
      keys: [
        { pubkey: agentPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: TREASURY_PDA, isSigner: false, isWritable: true },
        { pubkey: import_web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: SAID_PROGRAM_ID,
      data: VERIFY_AGENT_DISCRIMINATOR
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
  async createAgent(options, funder, metadataUri) {
    const wallet = import_web3.Keypair.generate();
    const [agentPDA] = _SAID.deriveAgentPDA(wallet.publicKey);
    const registerIx = this.buildRegisterInstruction(
      agentPDA,
      wallet.publicKey,
      metadataUri
    );
    const rentExempt = await this.connection.getMinimumBalanceForRentExemption(AGENT_ACCOUNT_SIZE);
    const tx = new import_web3.Transaction();
    tx.add(
      import_web3.SystemProgram.transfer({
        fromPubkey: funder.publicKey,
        toPubkey: wallet.publicKey,
        lamports: rentExempt + 1e4
        // rent + small buffer for fees
      })
    );
    tx.add(registerIx);
    const signature = await (0, import_web3.sendAndConfirmTransaction)(
      this.connection,
      tx,
      [funder, wallet],
      { commitment: "confirmed" }
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
  async registerAgent(wallet, metadataUri, funder) {
    const [agentPDA] = _SAID.deriveAgentPDA(wallet.publicKey);
    const payer = funder || wallet;
    const registerIx = this.buildRegisterInstruction(
      agentPDA,
      wallet.publicKey,
      metadataUri
    );
    const tx = new import_web3.Transaction().add(registerIx);
    const signers = funder ? [funder, wallet] : [wallet];
    const signature = await (0, import_web3.sendAndConfirmTransaction)(
      this.connection,
      tx,
      signers,
      { commitment: "confirmed" }
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
  async verifyAgent(wallet) {
    const [agentPDA] = _SAID.deriveAgentPDA(wallet.publicKey);
    const verifyIx = this.buildVerifyInstruction(agentPDA, wallet.publicKey);
    const tx = new import_web3.Transaction().add(verifyIx);
    const signature = await (0, import_web3.sendAndConfirmTransaction)(
      this.connection,
      tx,
      [wallet],
      { commitment: "confirmed" }
    );
    return { txSignature: signature };
  }
  /**
   * Create and verify an agent in one transaction
   * Zero friction: agent gets wallet + registration + verification
   * Funder pays rent (~0.003 SOL), agent pays verification (0.01 SOL)
   * Net cost to funder: ~0.003 SOL, Net revenue: 0.01 SOL = +0.007 SOL profit
   */
  async createAndVerifyAgent(options, funder, metadataUri) {
    const result = await this.createAgent(options, funder, metadataUri);
    const VERIFICATION_FEE = 1e7;
    const fundTx = new import_web3.Transaction().add(
      import_web3.SystemProgram.transfer({
        fromPubkey: funder.publicKey,
        toPubkey: result.wallet.publicKey,
        lamports: VERIFICATION_FEE + 5e3
        // verification fee + tx fee buffer
      })
    );
    await (0, import_web3.sendAndConfirmTransaction)(
      this.connection,
      fundTx,
      [funder],
      { commitment: "confirmed" }
    );
    try {
      await this.verifyAgent(result.wallet);
      return { ...result, verified: true };
    } catch (e) {
      return { ...result, verified: false };
    }
  }
};
var said = new SAID();
var lookup = (wallet) => said.lookup(wallet);
var isVerified = (wallet) => said.isVerified(wallet);
var isRegistered = (wallet) => said.isRegistered(wallet);
var getCard = (wallet) => said.getCard(wallet);
var getAgent = (wallet) => said.getAgent(wallet);
var listAgents = (options) => said.listAgents(options);
var getStats = () => said.getStats();
var index_default = SAID;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SAID,
  SAID_PROGRAM_ID,
  TREASURY_PDA,
  getAgent,
  getCard,
  getStats,
  isRegistered,
  isVerified,
  listAgents,
  lookup,
  said
});
