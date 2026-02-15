/**
 * Multi-wallet support for SAID Protocol
 * Allows agents to link multiple wallets to a single identity
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { SAID_PROGRAM_ID } from './index';

// Instruction discriminators (Anchor: SHA256("global:<instruction_name>")[0..8])
// TODO: Generate these from the IDL or calculate using proper Anchor method
const LINK_WALLET_DISCRIMINATOR = Buffer.from([/* placeholder */]);
const UNLINK_WALLET_DISCRIMINATOR = Buffer.from([/* placeholder */]);
const TRANSFER_AUTHORITY_DISCRIMINATOR = Buffer.from([/* placeholder */]);

/**
 * Derive wallet link PDA for a given wallet
 */
export function deriveWalletLinkPDA(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('wallet'), wallet.toBuffer()],
    SAID_PROGRAM_ID
  );
}

/**
 * Derive agent PDA for a given owner wallet
 */
export function deriveAgentPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), owner.toBuffer()],
    SAID_PROGRAM_ID
  );
}

/**
 * Link an additional wallet to an existing identity
 * Both the authority (current identity owner) and the new wallet must sign
 * 
 * @param connection - Solana connection
 * @param authority - Current authority keypair (must match identity.authority)
 * @param newWallet - New wallet keypair to link
 * @returns Transaction signature and wallet link PDA
 */
export async function linkWallet(
  connection: Connection,
  authority: Keypair,
  newWallet: Keypair
): Promise<{ walletLinkPDA: string; txSignature: string }> {
  const [agentPDA] = deriveAgentPDA(authority.publicKey);
  const [walletLinkPDA] = deriveWalletLinkPDA(newWallet.publicKey);

  // Build link_wallet instruction
  const keys = [
    { pubkey: agentPDA, isSigner: false, isWritable: false },
    { pubkey: walletLinkPDA, isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: newWallet.publicKey, isSigner: true, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  ];

  const linkIx = new TransactionInstruction({
    keys,
    programId: SAID_PROGRAM_ID,
    data: LINK_WALLET_DISCRIMINATOR
  });

  const tx = new Transaction().add(linkIx);
  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [authority, newWallet],
    { commitment: 'confirmed' }
  );

  return {
    walletLinkPDA: walletLinkPDA.toString(),
    txSignature: signature
  };
}

/**
 * Unlink a wallet from an identity
 * Can be called by authority (to remove any wallet) or by the wallet itself
 * 
 * @param connection - Solana connection
 * @param caller - Either the authority or the linked wallet keypair
 * @param walletToUnlink - The wallet address to unlink
 * @returns Transaction signature
 */
export async function unlinkWallet(
  connection: Connection,
  caller: Keypair,
  walletToUnlink: PublicKey
): Promise<{ txSignature: string }> {
  const [walletLinkPDA] = deriveWalletLinkPDA(walletToUnlink);

  // Build unlink_wallet instruction
  const keys = [
    { pubkey: walletLinkPDA, isSigner: false, isWritable: true },
    { pubkey: caller.publicKey, isSigner: true, isWritable: true }
  ];

  const unlinkIx = new TransactionInstruction({
    keys,
    programId: SAID_PROGRAM_ID,
    data: UNLINK_WALLET_DISCRIMINATOR
  });

  const tx = new Transaction().add(unlinkIx);
  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [caller],
    { commitment: 'confirmed' }
  );

  return { txSignature: signature };
}

/**
 * Transfer authority to a linked wallet (recovery mechanism)
 * 
 * @param connection - Solana connection
 * @param currentAuthority - Current authority keypair
 * @param newAuthority - Linked wallet to become new authority
 * @returns Transaction signature
 */
export async function transferAuthority(
  connection: Connection,
  currentAuthority: Keypair,
  newAuthority: PublicKey
): Promise<{ txSignature: string }> {
  const [agentPDA] = deriveAgentPDA(currentAuthority.publicKey);

  // Build transfer_authority instruction
  const keys = [
    { pubkey: agentPDA, isSigner: false, isWritable: true },
    { pubkey: currentAuthority.publicKey, isSigner: true, isWritable: false },
    { pubkey: newAuthority, isSigner: false, isWritable: false }
  ];

  const transferIx = new TransactionInstruction({
    keys,
    programId: SAID_PROGRAM_ID,
    data: TRANSFER_AUTHORITY_DISCRIMINATOR
  });

  const tx = new Transaction().add(transferIx);
  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [currentAuthority],
    { commitment: 'confirmed' }
  );

  return { txSignature: signature };
}

/**
 * Get all wallets linked to an identity
 * Note: This requires querying all WalletLink accounts - may be slow for large datasets
 * 
 * @param connection - Solana connection
 * @param ownerWallet - The primary owner wallet
 * @returns Array of linked wallet public keys
 */
export async function getLinkedWallets(
  connection: Connection,
  ownerWallet: PublicKey
): Promise<PublicKey[]> {
  const [agentPDA] = deriveAgentPDA(ownerWallet);
  
  // Query all WalletLink accounts that point to this agent_id
  // Using getProgramAccounts with memcmp filter
  const accounts = await connection.getProgramAccounts(SAID_PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: agentPDA.toBase58()
        }
      }
    ]
  });

  return accounts.map(account => {
    // Parse wallet from account data (offset 8 + 32 for agent_id = 40)
    const walletBytes = account.account.data.slice(40, 72);
    return new PublicKey(walletBytes);
  });
}
