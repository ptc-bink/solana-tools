import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";

const address: string = "YOUR_SOLANA_ADDRESS";

(async function () {
  // Change for your RPC
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const accounts = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(address),
    {
      programId: TOKEN_PROGRAM_ID,
    }
  );

  const closeAccounts = accounts.value.filter(
    (account) => account.account.data.parsed.info.tokenAmount.amount === "0"
  );

  const pubkeystoClose = closeAccounts.map(
    (account) => account.account.data.parsed.info.mint
  );

  fs.appendFileSync("emptyAccounts.json", JSON.stringify(pubkeystoClose));
  process.exit(0);
})();
