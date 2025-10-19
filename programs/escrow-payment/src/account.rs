use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PaymentAgreement {
    #[max_len(32)]
    pub name: String,

    pub payer: Pubkey,
    pub receiver: Pubkey,
    pub referee: Option<Pubkey>,

    pub amount: u64,

    // Optional expiration timestamp (Unix timestamp)
    pub expiration_timestamp: Option<i64>,

    // If both parties have approved, the payment can be executed
    pub payer_approved: bool,
    pub receiver_approved: bool,

    // If both parties have requested cancellation, the agreement can be cancelled
    pub payer_requested_cancel: bool,
    pub receiver_requested_cancel: bool,

    pub is_completed: bool,
    pub is_cancelled: bool,

    pub is_referee_intervened: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The payment agreement is already completed.")]
    AgreementAlreadyCompleted,

    #[msg("The payment agreement is already cancelled.")]
    AgreementAlreadyCancelled,

    #[msg("Both parties must approve before completing the payment.")]
    BothPartiesMustApprove,

    #[msg("Invalid name. Name must be between 1 and 32 characters.")]
    InvalidName,

    #[msg("Insufficient funds to create the payment agreement.")]
    InsufficientFunds,

    #[msg("Unauthorized action.")]
    Unauthorized,

    #[msg("The payment agreement is not finalized yet.")]
    AgreementIsNotCompleted,

    #[msg("Payer cannot be the same as receiver.")]
    PayerCannotBeReceiver,

    #[msg("Invalid payer account provided.")]
    InvalidPayer,

    #[msg("Invalid receiver account provided.")]
    InvalidReceiver,

    #[msg("Referee cannot be the same as payer.")]
    RefereeCannotBePayer,

    #[msg("Referee cannot be the same as receiver.")]
    RefereeCannotBeReceiver,

    #[msg("Expiration timestamp must be in the future.")]
    ExpirationMustBeInFuture,

    #[msg("Payment agreement has not expired yet.")]
    PaymentAgreementNotExpired,
}
