import useSWR from "swr";
import { SDK } from "@/lib/solana";
import { useAuth } from "@/contexts/AuthContext";
import { ProgramAccount } from "@coral-xyz/anchor";
import { PaymentAgreement } from "../../../sdk/sdk";
import { PublicKey } from "@solana/web3.js";

export enum AgreementAsType {
  PAYER = "payer",
  RECEIVER = "receiver",
  REFEREE = "referee",
}

export function useAgreements(asType: AgreementAsType) {
  const { publicKey } = useAuth();
  const swrKey = `fetch-payment-agreements/${asType}`;

  let fetcher: (
    pubkey: PublicKey
  ) => Promise<ProgramAccount<PaymentAgreement>[]>;

  switch (asType) {
    case AgreementAsType.PAYER:
      fetcher = SDK.getAgreementsAsPayer;
      break;
    case AgreementAsType.RECEIVER:
      fetcher = SDK.getAgreementsAsReceiver;
      break;
    case AgreementAsType.REFEREE:
      fetcher = SDK.getAgreementsAsReferee;
      break;
    default:
      throw new Error("Invalid AgreementAsType");
  }

  const { data, error, isLoading } = useSWR(
    swrKey,
    (key) => (publicKey ? fetcher(publicKey) : Promise.resolve([])),
    {
      refreshInterval: 180000,
      revalidateOnFocus: false,
    }
  );

  return {
    data: data || [],
    isLoading,
    isError: error,
  };
}
