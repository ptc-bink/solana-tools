import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  PublicKey,
} from "@metaplex-foundation/js";
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");

const wallet = Keypair.fromSecretKey(
  // Keypair like [33, 33,33]
  new Uint8Array([])
);

const metaplex = Metaplex.make(connection)
  .use(keypairIdentity(wallet))
  .use(bundlrStorage());

const nftsToUpdate = [];

const main = async () => {
  for (const nftToUpdate of nftsToUpdate) {
    const nft = await metaplex.nfts().findByMint({
      mintAddress: new PublicKey(nftToUpdate),
    });

    try {
      // it's better to run this one each time you need before run the nfts().update() function
      await metaplex.nfts().unverifyCollection({
        mintAddress: new PublicKey(nftToUpdate),
        collectionMintAddress: new PublicKey(""),
        isSizedCollection: false,
      });

      await metaplex.nfts().update({
        nftOrSft: nft,
        collection: null,
      });

      console.log("updated", nftToUpdate);
    } catch (e) {
      console.log("error", nftToUpdate);
      continue;
    }
  }
};

main();
