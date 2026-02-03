import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';

async function main() {
  const connection = new Connection('https://newest-restless-mansion.solana-mainnet.quiknode.pro/af7d979a4ef8558eb0da3166819eac8af0d3dd2b', 'confirmed');
  
  // Load my wallet
  const myWallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync('/root/clawd/.solana/kai-wallet.json', 'utf-8'))));
  console.log('From:', myWallet.publicKey.toString());
  
  // Test wallet to fund
  const testWallet = new PublicKey('8sFaTCYhKdAtB3pfGmcKr96KGr3YwuKbRYfxhfvd3oPs');
  console.log('To:', testWallet.toString());
  
  // Send 0.005 SOL (enough for rent + verify fee)
  const amount = 0.015 * LAMPORTS_PER_SOL; // 0.015 SOL
  console.log('Amount:', amount / LAMPORTS_PER_SOL, 'SOL');
  
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: myWallet.publicKey,
      toPubkey: testWallet,
      lamports: amount,
    })
  );
  
  const sig = await sendAndConfirmTransaction(connection, tx, [myWallet]);
  console.log('Transaction:', sig);
  console.log('Explorer: https://solscan.io/tx/' + sig);
}

main().catch(console.error);
