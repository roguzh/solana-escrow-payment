use crate::account::{ErrorCode, PaymentAgreement};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

#[derive(Accounts)]
#[instruction(name: String, receiver: Pubkey, amount: u64, expiration_timestamp: Option<i64>)]
pub struct CreatePaymentAgreement<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + PaymentAgreement::INIT_SPACE,
        seeds = [b"payment_agreement", payer.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub payment_agreement: Account<'info, PaymentAgreement>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Optional referee account
    pub referee: Option<UncheckedAccount<'info>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct ApprovePaymentAgreement<'info> {
    #[account(
        mut,
        seeds = [b"payment_agreement", payer.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub payment_agreement: Account<'info, PaymentAgreement>,

    #[account(mut)]
    pub signer: Signer<'info>,

    /// CHECK: This account is validated against the stored payer in the payment agreement
    pub payer: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK: This account is validated against the stored receiver in the payment agreement
    pub receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CancelPaymentAgreement<'info> {
    #[account(
        mut,
        seeds = [b"payment_agreement", payer.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub payment_agreement: Account<'info, PaymentAgreement>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    /// CHECK: This account is validated against the stored payer in the payment agreement
    pub payer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct WithdrawExpiredFunds<'info> {
    #[account(
        mut,
        seeds = [b"payment_agreement", payer.key().as_ref(), name.as_bytes()],
        bump,
        close = payer
    )]
    pub payment_agreement: Account<'info, PaymentAgreement>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_payment_agreement(
    ctx: Context<CreatePaymentAgreement>,
    name: String,
    receiver: Pubkey,
    amount: u64,
    expiration_timestamp: Option<i64>,
) -> Result<()> {
    // Validate name length
    require!(name.len() > 0 && name.len() <= 32, ErrorCode::InvalidName);

    // Prevent self-payment
    require!(
        ctx.accounts.payer.key() != receiver,
        ErrorCode::PayerCannotBeReceiver
    );

    // Get referee from optional account
    let referee = match &ctx.accounts.referee {
        Some(referee_account) => Some(referee_account.key()),
        None => None,
    };

    // If referee is provided, ensure it's not the same as payer or receiver
    if let Some(referee_key) = referee {
        require!(
            referee_key != ctx.accounts.payer.key(),
            ErrorCode::RefereeCannotBePayer
        );
        require!(referee_key != receiver, ErrorCode::RefereeCannotBeReceiver);
    }

    // If expiration is provided, ensure it's in the future
    if let Some(expiration) = expiration_timestamp {
        let current_timestamp = Clock::get()?.unix_timestamp;
        require!(
            expiration > current_timestamp,
            ErrorCode::ExpirationMustBeInFuture
        );
    }

    let payment_agreement = &mut ctx.accounts.payment_agreement;

    //Check payer balance
    let payer_balance = ctx.accounts.payer.to_account_info().lamports();
    require!(payer_balance >= amount, ErrorCode::InsufficientFunds);

    payment_agreement.name = name;
    payment_agreement.payer = ctx.accounts.payer.key();
    payment_agreement.receiver = receiver;
    payment_agreement.referee = referee;
    payment_agreement.amount = amount;
    payment_agreement.expiration_timestamp = expiration_timestamp;
    payment_agreement.payer_approved = false;
    payment_agreement.receiver_approved = false;
    payment_agreement.payer_requested_cancel = false;
    payment_agreement.receiver_requested_cancel = false;
    payment_agreement.is_completed = false;
    payment_agreement.is_cancelled = false;
    payment_agreement.is_referee_intervened = false;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.payment_agreement.to_account_info(),
            },
        ),
        amount,
    )?;

    Ok(())
}

pub fn approve_payment_agreement(
    ctx: Context<ApprovePaymentAgreement>,
    _name: String,
) -> Result<()> {
    // Check if both parties have approved and get necessary data
    let (should_complete, transfer_amount) = {
        let payment_agreement = &mut ctx.accounts.payment_agreement;

        require!(
            ctx.accounts.signer.key() == payment_agreement.payer
                || ctx.accounts.signer.key() == payment_agreement.receiver,
            ErrorCode::Unauthorized
        );

        // Validate that passed accounts match stored accounts
        require!(
            ctx.accounts.payer.key() == payment_agreement.payer,
            ErrorCode::InvalidPayer
        );
        require!(
            ctx.accounts.receiver.key() == payment_agreement.receiver,
            ErrorCode::InvalidReceiver
        );

        require!(
            !payment_agreement.is_completed,
            ErrorCode::AgreementAlreadyCompleted
        );
        require!(
            !payment_agreement.is_cancelled,
            ErrorCode::AgreementAlreadyCancelled
        );

        if ctx.accounts.signer.key() == payment_agreement.payer {
            payment_agreement.payer_approved = true;
        } else if ctx.accounts.signer.key() == payment_agreement.receiver {
            payment_agreement.receiver_approved = true;
        }

        let should_complete =
            payment_agreement.payer_approved && payment_agreement.receiver_approved;

        if should_complete {
            payment_agreement.is_completed = true;
        }

        (should_complete, payment_agreement.amount)
    };

    // Now do the transfer if needed
    if should_complete {
        // Transfer lamports from PDA to receiver
        ctx.accounts
            .payment_agreement
            .sub_lamports(transfer_amount)?;
        ctx.accounts.receiver.add_lamports(transfer_amount)?;
    }

    Ok(())
}

pub fn cancel_payment_agreement(ctx: Context<CancelPaymentAgreement>, _name: String) -> Result<()> {
    // Handle cancellation logic and get necessary data
    let (should_cancel, transfer_amount) = {
        let payment_agreement = &mut ctx.accounts.payment_agreement;

        require!(
            ctx.accounts.signer.key() == payment_agreement.payer
                || ctx.accounts.signer.key() == payment_agreement.receiver,
            ErrorCode::Unauthorized
        );

        // Validate that passed payer account matches stored payer
        require!(
            ctx.accounts.payer.key() == payment_agreement.payer,
            ErrorCode::InvalidPayer
        );

        require!(
            !payment_agreement.is_completed,
            ErrorCode::AgreementAlreadyCompleted
        );
        require!(
            !payment_agreement.is_cancelled,
            ErrorCode::AgreementAlreadyCancelled
        );

        if ctx.accounts.signer.key() == payment_agreement.payer {
            payment_agreement.payer_requested_cancel = true;
        } else if ctx.accounts.signer.key() == payment_agreement.receiver {
            payment_agreement.receiver_requested_cancel = true;
        }

        let should_cancel =
            payment_agreement.payer_requested_cancel && payment_agreement.receiver_requested_cancel;

        if should_cancel {
            payment_agreement.is_cancelled = true;
        }

        (should_cancel, payment_agreement.amount)
    };

    // Return funds to payer if cancelled
    if should_cancel {
        // Transfer lamports from PDA to payer
        ctx.accounts
            .payment_agreement
            .sub_lamports(transfer_amount)?;
        ctx.accounts.payer.add_lamports(transfer_amount)?;
    }

    Ok(())
}

pub fn referee_intervene_complete_payment_agreement(
    ctx: Context<ApprovePaymentAgreement>,
    _name: String,
) -> Result<()> {
    // Handle referee intervention and get necessary data
    let transfer_amount = {
        let payment_agreement = &mut ctx.accounts.payment_agreement;

        // Check if referee exists and signer is the referee
        require!(payment_agreement.referee.is_some(), ErrorCode::Unauthorized);
        require!(
            payment_agreement.referee.unwrap() == ctx.accounts.signer.key(),
            ErrorCode::Unauthorized
        );

        // Validate that passed accounts match stored accounts
        require!(
            ctx.accounts.payer.key() == payment_agreement.payer,
            ErrorCode::InvalidPayer
        );
        require!(
            ctx.accounts.receiver.key() == payment_agreement.receiver,
            ErrorCode::InvalidReceiver
        );

        require!(
            !payment_agreement.is_completed,
            ErrorCode::AgreementAlreadyCompleted
        );
        require!(
            !payment_agreement.is_cancelled,
            ErrorCode::AgreementAlreadyCancelled
        );

        payment_agreement.is_completed = true;
        payment_agreement.is_referee_intervened = true;

        payment_agreement.amount
    };

    // Transfer funds from escrow to receiver
    ctx.accounts
        .payment_agreement
        .sub_lamports(transfer_amount)?;
    ctx.accounts.receiver.add_lamports(transfer_amount)?;

    Ok(())
}

pub fn referee_intervene_cancel_payment_agreement(
    ctx: Context<CancelPaymentAgreement>,
    _name: String,
) -> Result<()> {
    // Handle referee intervention and get necessary data
    let transfer_amount = {
        let payment_agreement = &mut ctx.accounts.payment_agreement;

        // Check if referee exists and signer is the referee
        require!(payment_agreement.referee.is_some(), ErrorCode::Unauthorized);
        require!(
            payment_agreement.referee.unwrap() == ctx.accounts.signer.key(),
            ErrorCode::Unauthorized
        );

        // Validate that passed payer account matches stored payer
        require!(
            ctx.accounts.payer.key() == payment_agreement.payer,
            ErrorCode::InvalidPayer
        );

        require!(
            !payment_agreement.is_completed,
            ErrorCode::AgreementAlreadyCompleted
        );
        require!(
            !payment_agreement.is_cancelled,
            ErrorCode::AgreementAlreadyCancelled
        );

        payment_agreement.is_cancelled = true;
        payment_agreement.is_referee_intervened = true;

        payment_agreement.amount
    };

    // Return funds to payer when cancelled
    ctx.accounts
        .payment_agreement
        .sub_lamports(transfer_amount)?;
    ctx.accounts.payer.add_lamports(transfer_amount)?;

    Ok(())
}

pub fn withdraw_expired_funds(ctx: Context<WithdrawExpiredFunds>, _name: String) -> Result<()> {
    let payment_agreement = &ctx.accounts.payment_agreement;

    require!(
        ctx.accounts.payer.key() == payment_agreement.payer,
        ErrorCode::Unauthorized
    );

    require!(
        payment_agreement.expiration_timestamp.is_some(),
        ErrorCode::PaymentAgreementNotExpired
    );

    let current_timestamp = Clock::get()?.unix_timestamp;
    let expiration = payment_agreement.expiration_timestamp.unwrap();
    require!(
        current_timestamp > expiration,
        ErrorCode::PaymentAgreementNotExpired
    );

    require!(
        !payment_agreement.is_completed,
        ErrorCode::AgreementAlreadyCompleted
    );
    require!(
        !payment_agreement.is_cancelled,
        ErrorCode::AgreementAlreadyCancelled
    );

    let transfer_amount = payment_agreement.amount;
    ctx.accounts
        .payment_agreement
        .sub_lamports(transfer_amount)?;
    ctx.accounts.payer.add_lamports(transfer_amount)?;

    Ok(())
}
