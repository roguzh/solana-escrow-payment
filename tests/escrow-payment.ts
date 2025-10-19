import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowPayment } from "../target/types/escrow_payment";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert } from "chai";

describe("escrow-payment", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.escrowPayment as Program<EscrowPayment>;

  // Test accounts
  let payer: Keypair;
  let receiver: Keypair;
  let referee: Keypair;
  let maliciousUser: Keypair;

  // Test data
  const paymentName = "test-payment";
  const paymentAmount = 1 * LAMPORTS_PER_SOL; // 1 SOL

  beforeEach(async () => {
    // Create fresh keypairs for each test
    payer = Keypair.generate();
    receiver = Keypair.generate();
    referee = Keypair.generate();
    maliciousUser = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(
      payer.publicKey,
      5 * LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      receiver.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      referee.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      maliciousUser.publicKey,
      2 * LAMPORTS_PER_SOL
    );

    // Wait for airdrops to confirm
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  // Helper function to get PDA
  function getPaymentAgreementPDA(payer: PublicKey, name: string) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("payment_agreement"), payer.toBuffer(), Buffer.from(name)],
      program.programId
    )[0];
  }

  // Helper function to create accounts for createPaymentAgreement instruction
  function getCreatePaymentAgreementAccounts(
    payerKey: PublicKey,
    name: string,
    refereeKey?: PublicKey
  ) {
    return {
      paymentAgreement: getPaymentAgreementPDA(payerKey, name),
      payer: payerKey,
      referee: refereeKey || null,
      systemProgram: SystemProgram.programId,
    };
  }

  // Helper function to create accounts for approvePaymentAgreement instruction
  function getApprovePaymentAgreementAccounts(
    payerKey: PublicKey,
    receiverKey: PublicKey,
    signerKey: PublicKey,
    name: string
  ) {
    return {
      paymentAgreement: getPaymentAgreementPDA(payerKey, name),
      signer: signerKey,
      payer: payerKey,
      receiver: receiverKey,
      systemProgram: SystemProgram.programId,
    };
  }

  // Helper function to create accounts for cancelPaymentAgreement instruction
  function getCancelPaymentAgreementAccounts(
    payerKey: PublicKey,
    signerKey: PublicKey,
    name: string
  ) {
    return {
      paymentAgreement: getPaymentAgreementPDA(payerKey, name),
      signer: signerKey,
      payer: payerKey,
      systemProgram: SystemProgram.programId,
    };
  }

  // Helper function to create accounts for withdrawExpiredFunds instruction
  function getWithdrawExpiredFundsAccounts(payerKey: PublicKey, name: string) {
    return {
      paymentAgreement: getPaymentAgreementPDA(payerKey, name),
      payer: payerKey,
      systemProgram: SystemProgram.programId,
    };
  }

  describe("Create Payment Agreement", () => {
    it("Should create a payment agreement successfully", async () => {
      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );

      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          null // no expiration
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();

      // Verify the payment agreement was created correctly
      const paymentAgreement = await program.account.paymentAgreement.fetch(
        accounts.paymentAgreement
      );

      assert.equal(paymentAgreement.name, paymentName);
      assert.equal(
        paymentAgreement.payer.toString(),
        payer.publicKey.toString()
      );
      assert.equal(
        paymentAgreement.receiver.toString(),
        receiver.publicKey.toString()
      );
      assert.equal(
        paymentAgreement.amount.toString(),
        paymentAmount.toString()
      );
      assert.equal(paymentAgreement.payerApproved, false);
      assert.equal(paymentAgreement.receiverApproved, false);
      assert.equal(paymentAgreement.isCompleted, false);
      assert.equal(paymentAgreement.isCancelled, false);
      assert.equal(paymentAgreement.referee, null);
    });

    it("Should create a payment agreement with referee", async () => {
      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName,
        referee.publicKey
      );

      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          null
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();

      const paymentAgreement = await program.account.paymentAgreement.fetch(
        accounts.paymentAgreement
      );
      assert.equal(
        paymentAgreement.referee.toString(),
        referee.publicKey.toString()
      );
    });

    it("Should create a payment agreement with expiration", async () => {
      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          new anchor.BN(futureTimestamp)
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();

      const paymentAgreement = await program.account.paymentAgreement.fetch(
        accounts.paymentAgreement
      );
      assert.equal(
        paymentAgreement.expirationTimestamp.toString(),
        futureTimestamp.toString()
      );
    });

    it("Should fail when payer is same as receiver", async () => {
      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );

      try {
        await program.methods
          .createPaymentAgreement(
            paymentName,
            payer.publicKey, // Same as payer
            new anchor.BN(paymentAmount),
            null
          )
          .accounts(accounts)
          .signers([payer])
          .rpc();

        assert.fail("Should have failed");
      } catch (error) {
        assert.include(error.message, "PayerCannotBeReceiver");
      }
    });

    it("Should fail when referee is same as payer", async () => {
      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName,
        payer.publicKey
      );

      try {
        await program.methods
          .createPaymentAgreement(
            paymentName,
            receiver.publicKey,
            new anchor.BN(paymentAmount),
            null
          )
          .accounts(accounts)
          .signers([payer])
          .rpc();

        assert.fail("Should have failed");
      } catch (error) {
        assert.include(error.message, "RefereeCannotBePayer");
      }
    });

    it("Should fail when referee is same as receiver", async () => {
      const paymentAgreementPDA = getPaymentAgreementPDA(
        payer.publicKey,
        paymentName
      );
      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName,
        receiver.publicKey
      );

      try {
        await program.methods
          .createPaymentAgreement(
            paymentName,
            receiver.publicKey, // Same as receiver
            new anchor.BN(paymentAmount),
            null
          )
          .accounts(accounts)
          .signers([payer])
          .rpc();

        assert.fail("Should have failed");
      } catch (error) {
        assert.include(error.message, "RefereeCannotBeReceiver");
      }
    });

    it("Should fail when expiration is in the past", async () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );

      try {
        await program.methods
          .createPaymentAgreement(
            paymentName,
            receiver.publicKey,
            new anchor.BN(paymentAmount),
            new anchor.BN(pastTimestamp)
          )
          .accounts(accounts)
          .signers([payer])
          .rpc();

        assert.fail("Should have failed");
      } catch (error) {
        assert.include(error.message, "ExpirationMustBeInFuture");
      }
    });
  });

  describe("Approve Payment Agreement", () => {
    let paymentAgreementPDA: PublicKey;

    beforeEach(async () => {
      paymentAgreementPDA = getPaymentAgreementPDA(
        payer.publicKey,
        paymentName
      );

      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );

      // Create a payment agreement first
      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          null
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();
    });

    it("Should allow payer to approve", async () => {
      const accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: payer.publicKey,
        payer: payer.publicKey,
        receiver: receiver.publicKey,
        systemProgram: SystemProgram.programId,
      };

      await program.methods
        .approvePaymentAgreement(paymentName)
        .accounts(accounts)
        .signers([payer])
        .rpc();

      const paymentAgreement = await program.account.paymentAgreement.fetch(
        paymentAgreementPDA
      );
      assert.equal(paymentAgreement.payerApproved, true);
      assert.equal(paymentAgreement.receiverApproved, false);
      assert.equal(paymentAgreement.isCompleted, false);
    });

    it("Should allow receiver to approve", async () => {
      const accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: receiver.publicKey,
        payer: payer.publicKey,
        receiver: receiver.publicKey,
        systemProgram: SystemProgram.programId,
      };

      await program.methods
        .approvePaymentAgreement(paymentName)
        .accounts(accounts)
        .signers([receiver])
        .rpc();

      const paymentAgreement = await program.account.paymentAgreement.fetch(
        paymentAgreementPDA
      );
      assert.equal(paymentAgreement.payerApproved, false);
      assert.equal(paymentAgreement.receiverApproved, true);
      assert.equal(paymentAgreement.isCompleted, false);
    });

    it("Should complete payment when both parties approve", async () => {
      const receiverBalanceBefore = await provider.connection.getBalance(
        receiver.publicKey
      );

      const payer_accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: payer.publicKey,
        payer: payer.publicKey,
        receiver: receiver.publicKey,
        systemProgram: SystemProgram.programId,
      };

      // Payer approves
      await program.methods
        .approvePaymentAgreement(paymentName)
        .accounts(payer_accounts)
        .signers([payer])
        .rpc();

      const receiver_accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: receiver.publicKey,
        payer: payer.publicKey,
        receiver: receiver.publicKey,
        systemProgram: SystemProgram.programId,
      };

      // Receiver approves (this should trigger completion)
      await program.methods
        .approvePaymentAgreement(paymentName)
        .accounts(receiver_accounts)
        .signers([receiver])
        .rpc();

      const paymentAgreement = await program.account.paymentAgreement.fetch(
        paymentAgreementPDA
      );
      const receiverBalanceAfter = await provider.connection.getBalance(
        receiver.publicKey
      );

      assert.equal(paymentAgreement.payerApproved, true);
      assert.equal(paymentAgreement.receiverApproved, true);
      assert.equal(paymentAgreement.isCompleted, true);
      assert.equal(receiverBalanceAfter - receiverBalanceBefore, paymentAmount);
    });

    it("Should fail when unauthorized user tries to approve", async () => {
      try {
        const accounts = {
          paymentAgreement: paymentAgreementPDA,
          signer: maliciousUser.publicKey,
          payer: payer.publicKey,
          receiver: receiver.publicKey,
          systemProgram: SystemProgram.programId,
        };

        await program.methods
          .approvePaymentAgreement(paymentName)
          .accounts(accounts)
          .signers([maliciousUser])
          .rpc();

        assert.fail("Should have failed");
      } catch (error) {
        assert.include(error.message, "Unauthorized");
      }
    });

    //Unnecessary test case | Already fails due to violated seed constraint
    // it("Should fail when wrong accounts are provided", async () => {
    //   const accounts = {
    //     paymentAgreement: paymentAgreementPDA,
    //     signer: payer.publicKey,
    //     payer: maliciousUser.publicKey, // Wrong payer account
    //     receiver: receiver.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   };

    //   try {
    //     await program.methods
    //       .approvePaymentAgreement(paymentName)
    //       .accounts(accounts)
    //       .signers([payer])
    //       .rpc();

    //     assert.fail("Should have failed");
    //   } catch (error) {
    //     console.log("Error message:", error.message);
    //     assert.include(error.message, "InvalidPayer");
    //   }
    // });
  });

  // Add more test suites for cancel, referee intervention, and expired withdrawal...

  describe("Cancel Payment Agreement", () => {
    let paymentAgreementPDA: PublicKey;

    beforeEach(async () => {
      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );
      paymentAgreementPDA = accounts.paymentAgreement;

      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          null
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();
    });

    it("Should allow payer to request cancellation", async () => {
      const accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: payer.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      };

      await program.methods
        .cancelPaymentAgreement(paymentName)
        .accounts(accounts)
        .signers([payer])
        .rpc();

      const paymentAgreement = await program.account.paymentAgreement.fetch(
        paymentAgreementPDA
      );
      assert.equal(paymentAgreement.payerRequestedCancel, true);
      assert.equal(paymentAgreement.receiverRequestedCancel, false);
      assert.equal(paymentAgreement.isCancelled, false);
    });

    it("Should cancel and refund when both parties request cancellation", async () => {
      const payerBalanceBefore = await provider.connection.getBalance(
        payer.publicKey
      );

      const payer_accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: payer.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      };

      // Payer requests cancellation
      await program.methods
        .cancelPaymentAgreement(paymentName)
        .accounts(payer_accounts)
        .signers([payer])
        .rpc();

      const receiver_accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: receiver.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      };

      // Receiver requests cancellation (this should trigger refund)
      await program.methods
        .cancelPaymentAgreement(paymentName)
        .accounts(receiver_accounts)
        .signers([receiver])
        .rpc();

      const paymentAgreement = await program.account.paymentAgreement.fetch(
        paymentAgreementPDA
      );
      const payerBalanceAfter = await provider.connection.getBalance(
        payer.publicKey
      );

      assert.equal(paymentAgreement.payerRequestedCancel, true);
      assert.equal(paymentAgreement.receiverRequestedCancel, true);
      assert.equal(paymentAgreement.isCancelled, true);
      // Note: Balance check would need to account for transaction fees
    });
  });

  describe("Referee Intervention", () => {
    let paymentAgreementPDA: PublicKey;

    beforeEach(async () => {
      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName,
        referee.publicKey
      );
      paymentAgreementPDA = accounts.paymentAgreement;

      // Create payment agreement with referee
      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          null
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();
    });

    it("Should allow referee to complete payment", async () => {
      const receiverBalanceBefore = await provider.connection.getBalance(
        receiver.publicKey
      );

      const accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: referee.publicKey,
        payer: payer.publicKey,
        receiver: receiver.publicKey,
        systemProgram: SystemProgram.programId,
      };

      await program.methods
        .refereeInterveneCompletePaymentAgreement(paymentName)
        .accounts(accounts)
        .signers([referee])
        .rpc();

      const paymentAgreement = await program.account.paymentAgreement.fetch(
        paymentAgreementPDA
      );
      const receiverBalanceAfter = await provider.connection.getBalance(
        receiver.publicKey
      );

      assert.equal(paymentAgreement.isCompleted, true);
      assert.equal(paymentAgreement.isRefereeIntervened, true);
      assert.equal(receiverBalanceAfter - receiverBalanceBefore, paymentAmount);
    });

    it("Should allow referee to cancel payment", async () => {
      const payerBalanceBefore = await provider.connection.getBalance(
        payer.publicKey
      );

      const accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: referee.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      };

      await program.methods
        .refereeInterveneCancelPaymentAgreement(paymentName)
        .accounts(accounts)
        .signers([referee])
        .rpc();

      const paymentAgreement = await program.account.paymentAgreement.fetch(
        paymentAgreementPDA
      );
      const payerBalanceAfter = await provider.connection.getBalance(
        payer.publicKey
      );

      assert.equal(paymentAgreement.isCancelled, true);
      assert.equal(paymentAgreement.isRefereeIntervened, true);
      // Note: Balance check would need to account for transaction fees
    });

    it("Should fail when non-referee tries to intervene", async () => {
      try {
        const accounts = {
          paymentAgreement: paymentAgreementPDA,
          signer: maliciousUser.publicKey,
          payer: payer.publicKey,
          receiver: receiver.publicKey,
          systemProgram: SystemProgram.programId,
        };
        await program.methods
          .refereeInterveneCompletePaymentAgreement(paymentName)
          .accounts(accounts)
          .signers([maliciousUser])
          .rpc();

        assert.fail("Should have failed");
      } catch (error) {
        assert.include(error.message, "Unauthorized");
      }
    });
  });

  describe("Expired Funds Withdrawal", () => {
    let paymentAgreementPDA: PublicKey;

    it("Should allow payer to withdraw expired funds", async () => {
      const shortExpirationTime = Math.floor(Date.now() / 1000) + 2; // 2 seconds from now
      
      paymentAgreementPDA = getPaymentAgreementPDA(
        payer.publicKey,
        paymentName
      );

      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );

      // Create payment agreement with short expiration
      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          new anchor.BN(shortExpirationTime)
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds to ensure expiration

      const payerBalanceBefore = await provider.connection.getBalance(
        payer.publicKey
      );

      await program.methods
        .withdrawExpiredFunds(paymentName)
        .accounts(accounts)
        .signers([payer])
        .rpc();

      const payerBalanceAfter = await provider.connection.getBalance(
        payer.publicKey
      );

      // Verify account is closed and funds returned
      try {
        await program.account.paymentAgreement.fetch(paymentAgreementPDA);
        assert.fail("Account should be closed");
      } catch (error) {
        // Account should not exist anymore
        assert.include(error.message, "Account does not exist");
      }

      // Payer should have received funds back (minus transaction fees)
      assert.isTrue(payerBalanceAfter > payerBalanceBefore);
    });

    it("Should fail when trying to withdraw before expiration", async () => {
      const futureExpirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      paymentAgreementPDA = getPaymentAgreementPDA(
        payer.publicKey,
        paymentName
      );

      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );

      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          new anchor.BN(futureExpirationTime)
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();

      try {
        const accounts = {
          paymentAgreement: paymentAgreementPDA,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
        };

        await program.methods
          .withdrawExpiredFunds(paymentName)
          .accounts(accounts)
          .signers([payer])
          .rpc();

        assert.fail("Should have failed");
      } catch (error) {
        assert.include(error.message, "PaymentAgreementNotExpired");
      }
    });

    // it("Should fail when non-payer tries to withdraw expired funds", async () => {
    //   const shortExpirationTime = Math.floor(Date.now() / 1000) + 2; // 2 seconds from now
      
    //   paymentAgreementPDA = getPaymentAgreementPDA(
    //     payer.publicKey,
    //     paymentName
    //   );

    //   const accounts = getCreatePaymentAgreementAccounts(
    //     payer.publicKey,
    //     paymentName
    //   );

    //   await program.methods
    //     .createPaymentAgreement(
    //       paymentName,
    //       receiver.publicKey,
    //       new anchor.BN(paymentAmount),
    //       new anchor.BN(shortExpirationTime)
    //     )
    //     .accounts(accounts)
    //     .signers([payer])
    //     .rpc();

    //   // Wait for expiration
    //   await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds to ensure expiration

    //   try {
    //     const withdrawAccounts = getWithdrawExpiredFundsAccounts(
    //       payer.publicKey,
    //       paymentName
    //     );
        
    //     await program.methods
    //       .withdrawExpiredFunds(paymentName)
    //       .accounts(withdrawAccounts)
    //       .signers([maliciousUser])
    //       .rpc();

    //     assert.fail("Should have failed");
    //   } catch (error) {
    //     assert.include(error.message, "Unauthorized");
    //   }
    // });

    it("Should fail when trying to withdraw from agreement without expiration", async () => {
      paymentAgreementPDA = getPaymentAgreementPDA(
        payer.publicKey,
        paymentName
      );

      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );

      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          null // No expiration
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();

      try {
        const accounts = {
          paymentAgreement: paymentAgreementPDA,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
        };

        await program.methods
          .withdrawExpiredFunds(paymentName)
          .accounts(accounts)
          .signers([payer])
          .rpc();

        assert.fail("Should have failed");
      } catch (error) {
        assert.include(error.message, "PaymentAgreementNotExpired");
      }
    });
  });

  describe("Edge Cases and Security", () => {
    let paymentAgreementPDA: PublicKey;

    beforeEach(async () => {
      paymentAgreementPDA = getPaymentAgreementPDA(
        payer.publicKey,
        paymentName
      );

      const accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        paymentName
      );

      await program.methods
        .createPaymentAgreement(
          paymentName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          null
        )
        .accounts(accounts)
        .signers([payer])
        .rpc();
    });

    it("Should fail to approve already completed agreement", async () => {
      const payer_accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: payer.publicKey,
        payer: payer.publicKey,
        receiver: receiver.publicKey,
        systemProgram: SystemProgram.programId,
      };

      const receiver_accounts = {
        paymentAgreement: paymentAgreementPDA,
        signer: receiver.publicKey,
        payer: payer.publicKey,
        receiver: receiver.publicKey,
        systemProgram: SystemProgram.programId,
      };
      // Complete the agreement first
      await program.methods
        .approvePaymentAgreement(paymentName)
        .accounts(payer_accounts)
        .signers([payer])
        .rpc();

      await program.methods
        .approvePaymentAgreement(paymentName)
        .accounts(receiver_accounts)
        .signers([receiver])
        .rpc();

      // Try to approve again
      try {
        await program.methods
          .approvePaymentAgreement(paymentName)
          .accounts(payer_accounts)
          .signers([payer])
          .rpc();

        assert.fail("Should have failed");
      } catch (error) {
        assert.include(error.message, "AgreementAlreadyCompleted");
      }
    });

    it("Should handle duplicate payment agreement names with different parameters", async () => {
      const sameName = "duplicate-name";
      const pda1 = getPaymentAgreementPDA(payer.publicKey, sameName);
      const pda2 = getPaymentAgreementPDA(receiver.publicKey, sameName);

      const payer_create_accounts = getCreatePaymentAgreementAccounts(
        payer.publicKey,
        sameName
      );

      const receiver_create_accounts = getCreatePaymentAgreementAccounts(
        receiver.publicKey,
        sameName
      );

      // Create agreement with payer
      await program.methods
        .createPaymentAgreement(
          sameName,
          receiver.publicKey,
          new anchor.BN(paymentAmount),
          null
        )
        .accounts(payer_create_accounts)
        .signers([payer])
        .rpc();

      // Create agreement with different payer (should work since PDA is different)
      await program.methods
        .createPaymentAgreement(
          sameName,
          payer.publicKey,
          new anchor.BN(paymentAmount),
          null
        )
        .accounts(receiver_create_accounts)
        .signers([receiver])
        .rpc();

      const agreement1 = await program.account.paymentAgreement.fetch(pda1);
      const agreement2 = await program.account.paymentAgreement.fetch(pda2);

      assert.equal(agreement1.payer.toString(), payer.publicKey.toString());
      assert.equal(agreement2.payer.toString(), receiver.publicKey.toString());
    });
  });
});
