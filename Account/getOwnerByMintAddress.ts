/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Connection, ParsedAccountData, PublicKey } from "@solana/web3.js";

export const getOwnerByMint = async (mintAddress: string) => {
  try {
    const connection = new Connection("https://api.mainnet-beta.solana.com");

    const account = await connection.getTokenLargestAccounts(
      new PublicKey(mintAddress)
    );

    if (account && account.value) {
      //@ts-ignore
      const addr = account.value.find((x: { uiAmount: number }) => x.uiAmount === 1);
      if (addr?.address) {
        const info = await connection.getParsedAccountInfo(addr?.address);

        if (info.value) {
          const infosParsed = info.value.data as ParsedAccountData;
          const infosValues = infosParsed.parsed;
          return { owner: infosValues.info.owner as string };
        }
      }
    }
    return { cause: "Can't find any owner" };
  } catch (e: any) {
    return { cause: e.message as string };
  }
};
