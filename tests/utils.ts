import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

export class TestUtils {
  constructor(
    public provider: anchor.AnchorProvider,
    public program: anchor.Program
  ) {}

  /**
   * Airdrop SOL to a keypair
   */
  async airdrop(keypair: Keypair, amount: number = 5 * LAMPORTS_PER_SOL): Promise<void> {
    await this.provider.connection.requestAirdrop(keypair.publicKey, amount);
    await this.confirmTransaction();
  }

  /**
   * Wait for transaction confirmation
   */
  async confirmTransaction(ms: number = 1000): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get payment agreement PDA
   */
  getPaymentAgreementPDA(payer: PublicKey, name: string): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("payment_agreement"),
        payer.toBuffer(),
        Buffer.from(name),
      ],
      this.program.programId
    )[0];
  }

  /**
   * Create a basic payment agreement for testing
   */
  async createBasicPaymentAgreement(
    payer: Keypair,
    receiver: PublicKey,
    name: string,
    amount: number,
    referee?: PublicKey,
    expiration?: number
  ): Promise<PublicKey> {
    const paymentAgreementPDA = this.getPaymentAgreementPDA(payer.publicKey, name);

    await this.program.methods
      .createPaymentAgreement(
        name,
        receiver,
        referee || null,
        new anchor.BN(amount),
        expiration ? new anchor.BN(expiration) : null
      )
      .accounts({
        paymentAgreement: paymentAgreementPDA,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    return paymentAgreementPDA;
  }

  /**
   * Get account balance
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    return await this.provider.connection.getBalance(publicKey);
  }

  /**
   * Assert balance change within a tolerance for transaction fees
   */
  assertBalanceChange(
    balanceBefore: number,
    balanceAfter: number,
    expectedChange: number,
    tolerance: number = 0.01 * LAMPORTS_PER_SOL // 0.01 SOL tolerance for fees
  ): void {
    const actualChange = balanceAfter - balanceBefore;
    const difference = Math.abs(actualChange - expectedChange);
    
    if (difference > tolerance) {
      throw new Error(
        `Balance change assertion failed. Expected: ${expectedChange}, Actual: ${actualChange}, Difference: ${difference}, Tolerance: ${tolerance}`
      );
    }
  }

  /**
   * Generate future timestamp
   */
  getFutureTimestamp(secondsFromNow: number): number {
    return Math.floor(Date.now() / 1000) + secondsFromNow;
  }

  /**
   * Generate past timestamp
   */
  getPastTimestamp(secondsAgo: number): number {
    return Math.floor(Date.now() / 1000) - secondsAgo;
  }

  /**
   * Create multiple test keypairs
   */
  createKeypairs(count: number): Keypair[] {
    return Array.from({ length: count }, () => Keypair.generate());
  }

  /**
   * Setup test accounts with airdrops
   */
  async setupTestAccounts(keypairs: Keypair[]): Promise<void> {
    for (const keypair of keypairs) {
      await this.airdrop(keypair);
    }
    await this.confirmTransaction(2000); // Wait a bit longer for multiple airdrops
  }

  /**
   * Expect transaction to fail with specific error
   */
  async expectError(
    transactionPromise: Promise<any>,
    expectedError: string
  ): Promise<void> {
    try {
      await transactionPromise;
      throw new Error("Transaction should have failed but succeeded");
    } catch (error) {
      if (!error.message.includes(expectedError)) {
        throw new Error(
          `Expected error "${expectedError}" but got "${error.message}"`
        );
      }
    }
  }
}

/**
 * Common test scenarios
 */
export class TestScenarios {
  constructor(private utils: TestUtils, private program: anchor.Program) {}

  /**
   * Complete a payment agreement scenario
   */
  async completePaymentAgreement(
    payer: Keypair,
    receiver: Keypair,
    name: string,
    amount: number
  ): Promise<{ pda: PublicKey, receiverBalanceChange: number }> {
    const pda = await this.utils.createBasicPaymentAgreement(
      payer,
      receiver.publicKey,
      name,
      amount
    );

    const receiverBalanceBefore = await this.utils.getBalance(receiver.publicKey);

    // Payer approves
    await this.program.methods
      .approvePaymentAgreement(name)
      .accounts({
        paymentAgreement: pda,
        signer: payer.publicKey,
        payer: payer.publicKey,
        receiver: receiver.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    // Receiver approves (completes the payment)
    await this.program.methods
      .approvePaymentAgreement(name)
      .accounts({
        paymentAgreement: pda,
        signer: receiver.publicKey,
        payer: payer.publicKey,
        receiver: receiver.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([receiver])
      .rpc();

    const receiverBalanceAfter = await this.utils.getBalance(receiver.publicKey);
    
    return {
      pda,
      receiverBalanceChange: receiverBalanceAfter - receiverBalanceBefore
    };
  }

  /**
   * Cancel a payment agreement scenario
   */
  async cancelPaymentAgreement(
    payer: Keypair,
    receiver: Keypair,
    name: string,
    amount: number
  ): Promise<{ pda: PublicKey, payerBalanceChange: number }> {
    const pda = await this.utils.createBasicPaymentAgreement(
      payer,
      receiver.publicKey,
      name,
      amount
    );

    const payerBalanceBefore = await this.utils.getBalance(payer.publicKey);

    // Payer requests cancellation
    await this.program.methods
      .cancelPaymentAgreement(name)
      .accounts({
        paymentAgreement: pda,
        signer: payer.publicKey,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    // Receiver requests cancellation (completes the cancellation)
    await this.program.methods
      .cancelPaymentAgreement(name)
      .accounts({
        paymentAgreement: pda,
        signer: receiver.publicKey,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([receiver])
      .rpc();

    const payerBalanceAfter = await this.utils.getBalance(payer.publicKey);
    
    return {
      pda,
      payerBalanceChange: payerBalanceAfter - payerBalanceBefore
    };
  }
}