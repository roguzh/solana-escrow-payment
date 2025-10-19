use anchor_lang::prelude::*;

pub mod account;
pub mod instructions;

use instructions::*;

declare_id!("9phLBf73k3dpX1BhLVWMLGcZEQ1cV3KCFCQV7MkkSwYQ");

#[program]
pub mod escrow_payment {
    use super::*;

    pub fn create_payment_agreement(
        ctx: Context<CreatePaymentAgreement>,
        name: String,
        receiver: Pubkey,
        amount: u64,
        expiration_timestamp: Option<i64>,
    ) -> Result<()> {
        instructions::create_payment_agreement(ctx, name, receiver, amount, expiration_timestamp)
    }

    pub fn approve_payment_agreement(
        ctx: Context<ApprovePaymentAgreement>,
        name: String,
    ) -> Result<()> {
        instructions::approve_payment_agreement(ctx, name)
    }

    pub fn cancel_payment_agreement(
        ctx: Context<CancelPaymentAgreement>,
        name: String,
    ) -> Result<()> {
        instructions::cancel_payment_agreement(ctx, name)
    }

    pub fn referee_intervene_cancel_payment_agreement(
        ctx: Context<CancelPaymentAgreement>,
        name: String,
    ) -> Result<()> {
        instructions::referee_intervene_cancel_payment_agreement(ctx, name)
    }

    pub fn referee_intervene_complete_payment_agreement(
        ctx: Context<ApprovePaymentAgreement>,
        name: String,
    ) -> Result<()> {
        instructions::referee_intervene_complete_payment_agreement(ctx, name)
    }

    pub fn withdraw_expired_funds(
        ctx: Context<WithdrawExpiredFunds>,
        name: String,
    ) -> Result<()> {
        instructions::withdraw_expired_funds(ctx, name)
    }
}
