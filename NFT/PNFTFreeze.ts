import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { isNil } from "lodash";

import {
  Metaplex,
  Nft,
  NftWithToken,
  Sft,
  SftWithToken,
  guestIdentity,
  keypairIdentity,
} from "@metaplex-foundation/js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

interface paramsProps {
  owner: PublicKey;
  nft: Sft | SftWithToken | Nft | NftWithToken;
}

const utilityDelegatePubkey = new PublicKey("public key of utility delegate");
const rules = new PublicKey("public key of rules account");

const utilityDelegate = Keypair.fromSecretKey(
  bs58.decode("private key of utility delegate")
);

const connection = new Connection("https://api.mainnet-beta.solana.com");

const mx = Metaplex.make(connection);

interface makeDelegateAndLockTransactionProps {
  owner: string;
  mint: string;
}

interface makeDelegateAndLockTransactionsProps {
  owner: string;
  mints: string[];
}

export const makeDelegateAndLockTransaction = async (
  params: makeDelegateAndLockTransactionProps
) => {
  const { owner, mint } = params;

  const ownerPublicKey = new PublicKey(owner);
  const mintPublicKey = new PublicKey(mint);

  const nft = await mx.nfts().findByMint({
    mintAddress: mintPublicKey,
  });

  const paramsToFunc: paramsProps = {
    owner: ownerPublicKey,
    nft,
  };

  const delegateTransaction = await makeDelegate(paramsToFunc);
  const lockTransaction = await makeLockTransaction(paramsToFunc);
  if (isNil(delegateTransaction) || isNil(lockTransaction))
    return { error: "Can't make delegate or lock transaction" };

  const transaction = new Transaction().add(
    ...delegateTransaction,
    ...lockTransaction
  );

  do {
    const bh = await connection.getLatestBlockhash();
    transaction.feePayer = ownerPublicKey;
    transaction.recentBlockhash = bh.blockhash;
    transaction.lastValidBlockHeight = bh.lastValidBlockHeight;
  } while (isNil(transaction.recentBlockhash));

  transaction.partialSign(utilityDelegate);

  return {
    transaction: JSON.stringify(
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: true,
      })
    ),
  };
};

export const makeUnlockAndRevokeTransaction = async (
  params: makeDelegateAndLockTransactionProps
) => {
  const { owner, mint } = params;

  const ownerPublicKey = new PublicKey(owner);
  const mintPublicKey = new PublicKey(mint);

  const nft = await mx.nfts().findByMint({
    mintAddress: mintPublicKey,
  });

  const paramsToFunc: paramsProps = {
    owner: ownerPublicKey,
    nft,
  };

  const revokeTransaction = await revokeDelegate(paramsToFunc);
  const unlockTransaction = await makeUnLockTransaction(paramsToFunc);
  if (!revokeTransaction || !unlockTransaction)
    return { error: "Can't make transaction" };

  const transaction = new Transaction().add(
    ...unlockTransaction,
    ...revokeTransaction
  );

  do {
    const bh = await connection.getLatestBlockhash();
    transaction.feePayer = ownerPublicKey;
    transaction.recentBlockhash = bh.blockhash;
    transaction.lastValidBlockHeight = bh.lastValidBlockHeight;
  } while (isNil(transaction.recentBlockhash));

  transaction.partialSign(utilityDelegate);

  return {
    transaction: JSON.stringify(
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: true,
      })
    ),
  };
};

export const makeMultipleDelegateAndLockTransactions = async (
  params: makeDelegateAndLockTransactionsProps
) => {
  try {
    const limit = 3;
    const { owner, mints } = params;
    const transactions = new Transaction();

    for (let index = 0; index < mints.length; index++) {
      if (limit === index) break;
      const element = mints[index];
      const mintPublicKey = new PublicKey(element);

      const nft = await mx.nfts().findByMint({
        mintAddress: mintPublicKey,
      });

      const paramsToFunc: paramsProps = {
        owner: new PublicKey(owner),
        nft,
      };
      const delegateTransaction = await makeDelegate(paramsToFunc);
      const lockTransaction = await makeLockTransaction(paramsToFunc);

      if (isNil(delegateTransaction) || isNil(lockTransaction))
        return { error: "Can't make delegate or lock transaction" };
      transactions.add(...delegateTransaction, ...lockTransaction);
    }

    do {
      const bh = await connection.getLatestBlockhash();
      transactions.feePayer = new PublicKey(owner);
      transactions.recentBlockhash = bh.blockhash;
      transactions.lastValidBlockHeight = bh.lastValidBlockHeight;
    } while (isNil(transactions.recentBlockhash));

    transactions.partialSign(utilityDelegate);

    return {
      transaction: JSON.stringify(
        transactions.serialize({
          requireAllSignatures: false,
          verifySignatures: true,
        })
      ),
    };
  } catch (error) {
    console.log(error);
    return { transaction: null, error: JSON.stringify(error) };
  }
};


export const makeMultipleUnLockAndRevokeTransaction = async (
  params: makeDelegateAndLockTransactionsProps
) => {
  const limit = 10;
  const { owner, mints } = params;
  const transactions = new Transaction();

  for (let index = 0; index < mints.length; index++) {
    if (limit === index) break;
    const element = mints[index];
    const mintPublicKey = new PublicKey(element);

    const nft = await mx.nfts().findByMint({
      mintAddress: mintPublicKey,
    });

    const paramsToFunc: paramsProps = {
      owner: new PublicKey(owner),
      nft,
    };
    const revokeTransaction = await revokeDelegate(paramsToFunc);
    const unlockTransaction = await makeUnLockTransaction(paramsToFunc);

    if (isNil(revokeTransaction) || isNil(unlockTransaction))
      return { error: "Can't make transaction" };
    transactions.add(...unlockTransaction, ...revokeTransaction);
  }

  do {
    const bh = await connection.getLatestBlockhash();
    transactions.feePayer = new PublicKey(owner);
    transactions.recentBlockhash = bh.blockhash;
    transactions.lastValidBlockHeight = bh.lastValidBlockHeight;
  } while (isNil(transactions.recentBlockhash));

  transactions.partialSign(utilityDelegate);

  return {
    transaction: JSON.stringify(
      transactions.serialize({
        requireAllSignatures: false,
        verifySignatures: true,
      })
    ),
  };
};

export const makeLockTransaction = async (params: paramsProps) => {
  const { owner, nft } = params;

  mx.use(keypairIdentity(utilityDelegate));

  const lockTransaction = mx
    .nfts()
    .builders()
    .lock({
      nftOrSft: nft,
      authority: {
        __kind: "tokenDelegate",
        type: "UtilityV1",
        delegate: utilityDelegate,
        owner: owner,
      },
    });

  const lockTransactions = lockTransaction.getInstructions();

  return lockTransactions;
};

export const makeUnLockTransaction = async (params: paramsProps) => {
  const { owner, nft } = params;

  mx.use(keypairIdentity(utilityDelegate));

  const unLockTransaction = mx
    .nfts()
    .builders()
    .unlock({
      nftOrSft: nft,
      authority: {
        __kind: "tokenDelegate",
        type: "UtilityV1",
        delegate: utilityDelegate,
        owner: owner,
      },
    });

  const unLockTransactions = unLockTransaction.getInstructions();

  return unLockTransactions;
};

export const makeDelegate = async (params: paramsProps) => {
  const { owner, nft } = params;

  mx.use(guestIdentity(owner));

  const token = await getAssociatedTokenAddress(nft.address, owner);

  const delegateTransaction = mx
    .nfts()
    .builders()
    .delegate({
      nftOrSft: nft,
      authorizationDetails: {
        rules,
      },
      delegate: {
        type: "StakingV1",
        delegate: utilityDelegatePubkey,
        owner: owner,
        data: { amount: 1 },
        token,
      },
    });

  const delegateTransactions = delegateTransaction.getInstructions();

  return delegateTransactions;
};

export const revokeDelegate = async (params: paramsProps) => {
  const { owner, nft } = params;
  const ownerPublicKey = new PublicKey(owner);

  mx.use(guestIdentity(owner));

  const delegateTransaction = mx
    .nfts()
    .builders()
    .revoke({
      nftOrSft: nft,
      delegate: {
        type: "StakingV1",
        delegate: utilityDelegatePubkey,
        owner: ownerPublicKey,
      },
    });

  const delegateTransactions = delegateTransaction.getInstructions();

  return delegateTransactions;
};
