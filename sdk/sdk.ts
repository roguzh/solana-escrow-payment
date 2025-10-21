import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowPayment } from "../target/types/escrow_payment";
import Idl from "../target/idl/escrow_payment.json";

export type PaymentAgreement = Awaited<
  ReturnType<Program<EscrowPayment>["account"]["paymentAgreement"]["fetch"]>
>;

export class EscrowPaymentSDK {
  private program: Program<EscrowPayment>;
  private connection: anchor.web3.Connection;

  constructor(rpcUrl: string) {
    this.connection = new anchor.web3.Connection(rpcUrl, "confirmed");
    this.program = new Program(Idl as EscrowPayment, {
      connection: this.connection,
    });
  }

  async getAgreementsAsPayer(payerPublicKey: anchor.web3.PublicKey) {
    const agreements = await this.program.account.paymentAgreement.all([
      {
        memcmp: {
          offset: 44, // Payer public key starts at byte 44
          bytes: payerPublicKey.toBase58(),
        },
      },
    ]);
    return agreements;
  }

  async getAgreementsAsReceiver(receiverPublicKey: anchor.web3.PublicKey) {
    const agreements = await this.program.account.paymentAgreement.all([
      {
        memcmp: {
          offset: 76, // Receiver public key starts at byte 76
          bytes: receiverPublicKey.toBase58(),
        },
      },
    ]);
    return agreements;
  }

  async getAgreementsAsReferee(refereePublicKey: anchor.web3.PublicKey) {
    const agreements = await this.program.account.paymentAgreement.all([
      {
        memcmp: {
          offset: 108, // Referee public key starts at byte 108
          bytes: refereePublicKey.toBase58(),
        },
      },
    ]);
    return agreements;
  }

  createPaymentAgreementTransaction({
    name,
    payer,
    receiver,
    referee,
    amount,
    expirationTimestamp,
  }: {
    name: string;
    payer: anchor.web3.PublicKey;
    receiver: anchor.web3.PublicKey;
    referee?: anchor.web3.PublicKey;
    amount: anchor.BN;
    expirationTimestamp?: anchor.BN;
  }) {
    const accounts = {
      paymentAgreement: this.getPaymentAgreementPDA(payer, name),
      payer: payer,
      referee: referee || null,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    return {
      transaction: this.program.methods
        .createPaymentAgreement(
          name,
          receiver,
          amount,
          expirationTimestamp || null
        )
        .accounts(accounts)
        .transaction(),
      agreementPda: accounts.paymentAgreement,
    };
  }

  async approvePaymentAgreementTransaction({
    approver,
    paymentAgreement,
  }: {
    approver: anchor.web3.PublicKey;
    paymentAgreement: PaymentAgreement;
  }) {
    const paymentAgreementPDA = this.getPaymentAgreementPDA(
      paymentAgreement.payer,
      paymentAgreement.name
    );

    const accounts = {
      paymentAgreement: paymentAgreementPDA,
      signer: approver,
      payer: paymentAgreement.payer,
      receiver: paymentAgreement.receiver,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    return {
      transaction: this.program.methods
        .approvePaymentAgreement(paymentAgreement.name)
        .accounts(accounts)
        .transaction(),
    };
  }

  async cancelPaymentAgreementTransaction({
    canceller,
    paymentAgreement,
  }: {
    canceller: anchor.web3.PublicKey;
    paymentAgreement: PaymentAgreement;
  }) {
    const paymentAgreementPDA = this.getPaymentAgreementPDA(
      paymentAgreement.payer,
      paymentAgreement.name
    );

    const accounts = {
      paymentAgreement: paymentAgreementPDA,
      signer: canceller,
      payer: paymentAgreement.payer,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    return {
      transaction: this.program.methods
        .cancelPaymentAgreement(paymentAgreement.name)
        .accounts(accounts)
        .transaction(),
    };
  }

  async completePaymentAgreementTransactionAsReferee({
    paymentAgreement,
  }: {
    paymentAgreement: PaymentAgreement;
  }) {
    const paymentAgreementPDA = this.getPaymentAgreementPDA(
      paymentAgreement.payer,
      paymentAgreement.name
    );

    const accounts = {
      paymentAgreement: paymentAgreementPDA,
      signer: paymentAgreement.referee,
      payer: paymentAgreement.payer,
      receiver: paymentAgreement.receiver,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    return {
      transaction: this.program.methods
        .refereeInterveneCompletePaymentAgreement(paymentAgreement.name)
        .accounts(accounts)
        .transaction(),
    };
  }

  async cancelPaymentAgreementTransactionAsReferee({
    paymentAgreement,
  }: {
    paymentAgreement: PaymentAgreement;
  }) {
    const paymentAgreementPDA = this.getPaymentAgreementPDA(
      paymentAgreement.payer,
      paymentAgreement.name
    );

    const accounts = {
      paymentAgreement: paymentAgreementPDA,
      signer: paymentAgreement.referee,
      payer: paymentAgreement.payer,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    return {
      transaction: this.program.methods
        .refereeInterveneCancelPaymentAgreement(paymentAgreement.name)
        .accounts(accounts)
        .transaction(),
    };
  }

  async cancelExpiredPaymentAgreement({
    paymentAgreement,
  }: {
    paymentAgreement: PaymentAgreement;
  }) {
    const paymentAgreementPDA = this.getPaymentAgreementPDA(
      paymentAgreement.payer,
      paymentAgreement.name
    );

    const accounts = {
      paymentAgreement: paymentAgreementPDA,
      payer: paymentAgreement.payer,
      referee: paymentAgreement.referee || null,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    return {
      transaction: this.program.methods
        .withdrawExpiredFunds(paymentAgreement.name)
        .accounts(accounts)
        .transaction(),
    };
  }

  private getPaymentAgreementPDA(payer: anchor.web3.PublicKey, name: string) {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("payment_agreement"), payer.toBuffer(), Buffer.from(name)],
      this.program.programId
    )[0];
  }
}
