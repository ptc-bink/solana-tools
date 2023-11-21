/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { PublicKey, Connection, Transaction, Keypair } from "@solana/web3.js";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { Metaplex, guestIdentity, token } from "@metaplex-foundation/js";
import { closeAccounts } from "../Account/closeAccount";
import { isNil } from "lodash";

const connection = new Connection("SOLANA_ENDPOINT", "confirmed");
const mx = new Metaplex(connection);

// If toWallet is not provided, the tokens will be sent to the defaultWallet
export const sendSplTokens = async (
  mintsData: { amount: number; mint: string }[],
  wallet: string,
  toWallet?: string
) => {
  try {
    const toCustomWallet = toWallet ? new PublicKey(toWallet) : null;

    const defaultWallet = Keypair.fromSecretKey(
      bs58.decode("private key of the wallet that will send the tokens")
    );

    const fromWallet = new PublicKey(wallet);
    mx.use(guestIdentity(fromWallet));
    const transactionsBase64: string[] = [];

    const mintsArray: { mint: string; amount: number }[][] = mintsData.reduce(
      (
        acc: { mint: string; amount: number }[][],
        curr: { mint: string; amount: number },
        i: number
      ) => {
        const index = Math.floor(i / 2);
        if (!acc[index]) acc[index] = [];
        acc[index].push(curr);
        return acc;
      },
      []
    );

    for (const mints of mintsArray) {
      const transaction = new Transaction();

      for (const mint of mints) {
        // const tokenAccount = await getMint(connection, new PublicKey(mint.mint));
        const nft = await getNftByMint(mint.mint);
        const tokenAccount = await getMint(
          connection,
          new PublicKey(mint.mint)
        );

        if (nft && nft.tokenStandard === 4) {
          const tx = new Transaction();
          const builders = mx
            .nfts()
            .builders()
            .transfer({
              fromOwner: fromWallet,
              toOwner: toCustomWallet
                ? toCustomWallet
                : defaultWallet.publicKey,
              nftOrSft: nft,
              amount: token(
                Math.floor(mint.amount * 10 ** tokenAccount.decimals)
              ),
            })
            .getInstructions();

          tx.add(...builders);

          if (!tx) continue;
          transaction.add(tx);
        } else {
          const tx = await sendToken(
            fromWallet,
            toCustomWallet ? toCustomWallet : defaultWallet.publicKey,
            tokenAccount.address,
            Math.floor(mint.amount * 10 ** tokenAccount.decimals),
            tokenAccount.decimals,
            toCustomWallet ? true : false
          );
          if (!tx) continue;
          transaction.add(tx);
        }
      }

      const closeAccountsTransactionBase64 = await closeAccounts(
        mints.map((m) => m.mint),
        wallet
      );

      const closeAccountsTransaction = Transaction.from(
        Buffer.from(closeAccountsTransactionBase64, "base64")
      );

      transaction.add(closeAccountsTransaction);

      do {
        const bh = await connection.getLatestBlockhash();
        transaction.recentBlockhash = bh.blockhash;
        transaction.lastValidBlockHeight = bh.lastValidBlockHeight;
      } while (!transaction.recentBlockhash);

      if (!toCustomWallet) {
        transaction.feePayer = defaultWallet.publicKey;
        transaction.partialSign(defaultWallet);
      } else {
        transaction.feePayer = fromWallet;
      }

      const simulate = await connection.simulateTransaction(transaction);

      const failedWords = [
        "InstructionError",
        "AccountNotFound",
        "InvalidProgramId",
        "Error",
        "failed",
        "Token is locked",
      ];

      const error = simulate?.value?.logs?.some((log) =>
        failedWords.some((word) => log.includes(word))
      );
      // what error is it ?
      const messageWord = simulate?.value?.logs?.find((log) =>
        failedWords.some((word) => log.includes(word))
      );

      if (error) {
        return {
          error: true,
          message: messageWord || "Error",
          log: simulate.value.logs,
          transactions: null,
        };
      }

      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: true,
      });

      const txBase64 = serializedTransaction.toString("base64");
      transactionsBase64.push(txBase64);
    }

    return {
      transactions: transactionsBase64,
      error: null,
      message: undefined,
    };
  } catch (error) {
    console.log(error);
    return { transactions: null, error: null, message: undefined };
  }
};

const getNftByMint = async (mint: string) => {
  try {
    const nft = await mx
      .nfts()
      .findByMint({ mintAddress: new PublicKey(mint) });
    return nft;
  } catch (error) {
    return null;
  }
};

const sendToken = async (
  from: PublicKey,
  to: PublicKey,
  token: PublicKey,
  amount: number,
  decimals: number,
  isFromPayer?: boolean
): Promise<Transaction | null> => {
  const source = await getAssociatedTokenAddress(token, from);

  if ((await connection.getParsedAccountInfo(from)).value === null) {
    console.error("can't debit from an account that doesn't exist");
    return null;
  }

  const dest = await getAssociatedTokenAddress(token, to);

  const txs = new Transaction();

  if ((await connection.getParsedAccountInfo(dest)).value == null) {
    if (!isFromPayer) {
      txs.add(createAssociatedTokenAccountInstruction(to, dest, to, token));
    } else {
      txs.add(createAssociatedTokenAccountInstruction(from, dest, to, token));
    }
  }

  const instructions = createTransferCheckedInstruction(
    source,
    token,
    dest,
    from,
    amount,
    decimals
  );

  while (isNil(txs.recentBlockhash)) {
    const bh = await connection.getLatestBlockhash();
    txs.feePayer = to;
    txs.recentBlockhash = bh.blockhash;
    txs.lastValidBlockHeight = bh.lastValidBlockHeight;
  }

  txs.add(instructions);

  return txs;
};
