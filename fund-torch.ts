import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';

async function main() {
  const connection = new Connection('https://newest-restless-mansion.solana-mainnet.quiknode.pro/af7d979a4ef8558eb0da3166819eac8af0d3dd2b', 'confirmed');
  
  const myWallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync('/root/clawd/.solana/kai-wallet.json', 'utf-8'))));
  console.log('From:', myWallet.publicKey.toString());
  
  const torchWallet = new PublicKey('8cpWmV4kGdvxVYYNBEMPNwsJSRVQw5MQ9NXn4t293nMa');
  console.log('To:', torchWallet.toString());
  
  const amount = 0.005 * LAMPORTS_PER_SOL;
  console.log('Amount:', amount / LAMPORTS_PER_SOL, 'SOL');
  
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: myWallet.publicKey,
      toPubkey: torchWallet,
      lamports: amount,
    })
  );
  
  const sig = await sendAndConfirmTransaction(connection, tx, [myWallet]);
  console.log('✅ Funded!');
  console.log('Transaction:', sig);
  console.log('Explorer: https://solscan.io/tx/' + sig);
}

main().catch(console.error);
