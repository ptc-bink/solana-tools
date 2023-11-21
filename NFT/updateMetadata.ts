import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";

const rules = new PublicKey("public key of rules account");
const connection = new Connection("https://api.mainnet-beta.solana.com");

const mx = Metaplex.make(connection);

export const instructionForUpdateMetadata = async (
  mint: string,
  url: string,
  owner: string
) => {
  try {
    const authKey = Keypair.fromSecretKey(
      bs58.decode("private key of utility delegate")
    );

    const nft = await mx
      .nfts()
      .findByMint({ mintAddress: new PublicKey(mint) });

    if (!nft.collection)
      return new Error(
        "Error during the update of the NFT, the collection is not defined"
      );

    mx.use(keypairIdentity(authKey));

    const trx = await mx.nfts().update({
      nftOrSft: nft,
      ruleSet: rules,
      authority: {
        __kind: "tokenDelegate",
        type: "UtilityV1",
        delegate: authKey,
        owner: new PublicKey(owner),
      },
      updateAuthority: authKey,
      authorizationDetails: nft.programmableConfig?.ruleSet
        ? {
            rules: nft.programmableConfig?.ruleSet,
          }
        : undefined,
      uri: url,
    });

    return trx;
  } catch (error) {
    console.error(error);
    return new Error("Error creating instruction for the update NFT");
  }
};
