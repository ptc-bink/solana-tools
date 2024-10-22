import {
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { isNil } from "lodash";
// This first function
export async function closeAccounts(mints: string[], wallet: string) {
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const tx = new Transaction();
  const sender = new PublicKey(wallet);
  const tokens = await Promise.all(
    mints.map((mint) => getTokenAccount(mint, wallet))
  );
//The second function
  tokens.forEach((token) =>
    tx.add(createCloseAccountInstruction(token, sender, sender))
  );

  while (isNil(tx.recentBlockhash)) {
    const bh = await connection.getLatestBlockhash();
    tx.feePayer = sender;
    tx.recentBlockhash = bh.blockhash;
    tx.lastValidBlockHeight = bh.lastValidBlockHeight;
  }
// const serilizedTransaction from api
  const serializedTransaction = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: true,
  });
// third
  const txBase64 = serializedTransaction.toString("base64");

  return txBase64;
}
// fourth
async function getTokenAccount(mintAddress: string, userWallet: string) {
  const tokenAccountPubkey = await getAssociatedTokenAddress(
    new PublicKey(mintAddress),
    new PublicKey(userWallet)
  );
  return tokenAccountPubkey;
}
