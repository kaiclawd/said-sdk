"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var SAID_PROGRAM_ID = new import_web3.PublicKey("5dpw6KEQPn248pnkkaYyWfHwu2nfb3LUMbTucb6LaA8G");
var TREASURY_PDA = new import_web3.PublicKey("2XfHTeNWTjNwUmgoXaafYuqHcAAXj8F5Kjw2Bnzi4FxH");
var DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
var AGENT_ACCOUNT_SIZE = 263;
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
