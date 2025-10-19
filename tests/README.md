# Escrow Payment Tests

This directory contains comprehensive tests for the Solana escrow payment smart contract.

## Test Structure

### Main Test File: `escrow-payment.ts`

The tests are organized into the following suites:

1. **Create Payment Agreement**
   - ✅ Basic payment agreement creation
   - ✅ Payment agreement with referee
   - ✅ Payment agreement with expiration
   - ❌ Self-payment validation
   - ❌ Referee conflict validation
   - ❌ Past expiration validation

2. **Approve Payment Agreement**
   - ✅ Payer approval
   - ✅ Receiver approval
   - ✅ Complete payment when both approve
   - ❌ Unauthorized user attempts
   - ❌ Wrong account validation

3. **Cancel Payment Agreement**
   - ✅ Payer cancellation request
   - ✅ Complete cancellation with refund
   - ❌ Unauthorized cancellation

4. **Referee Intervention**
   - ✅ Referee completion
   - ✅ Referee cancellation
   - ❌ Non-referee intervention attempts

5. **Expired Funds Withdrawal**
   - ✅ Successful withdrawal after expiration
   - ❌ Early withdrawal attempts
   - ❌ Non-payer withdrawal attempts
   - ❌ Withdrawal from non-expiring agreements

6. **Edge Cases and Security**
   - ❌ Double completion attempts
   - ✅ Duplicate names with different payers
   - 🔐 Security validations

### Test Utilities: `utils.ts`

Helper classes for common testing operations:

- **TestUtils**: Common operations like airdrops, PDA derivation, balance checking
- **TestScenarios**: Complete workflow scenarios for testing complex flows

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start local Solana test validator:
   ```bash
   solana-test-validator
   ```

3. Build the program:
   ```bash
   anchor build
   ```

### Test Commands

Run all tests:
```bash
anchor test
```

Run tests without rebuilding/deploying:
```bash
anchor test --skip-deploy
```

Run with verbose output:
```bash
anchor test --verbose
```

## Test Coverage

The tests cover:

### ✅ Happy Path Scenarios
- Creating payment agreements with all parameter combinations
- Successful payment completion through bilateral approval
- Successful cancellation through bilateral request
- Referee intervention for completion and cancellation
- Expired fund withdrawal by original payer

### ❌ Error Conditions
- **Authorization Errors**: Unauthorized users attempting actions
- **Validation Errors**: Invalid parameters, wrong accounts, timing issues
- **State Errors**: Operations on completed/cancelled agreements
- **Security Errors**: Account spoofing, privilege escalation attempts

### 🔐 Security Validations
- Account validation (payer, receiver, referee matching stored data)
- Role-based access control (only authorized parties can perform actions)
- State transitions (preventing invalid state changes)
- Fund safety (ensuring funds go to correct recipients)

## Key Test Patterns

### Account Setup
Each test creates fresh keypairs and airdrops SOL to ensure clean state.

### PDA Derivation
Tests verify correct Program Derived Address generation for payment agreements.

### Balance Verification
Tests check balance changes to ensure correct fund transfers, accounting for transaction fees.

### Error Testing
Uses try-catch blocks to verify specific error messages for invalid operations.

### Time-based Testing
Uses short expiration times (2-3 seconds) to test expiration logic without long waits.

## Test Data

- **Payment Amount**: 1 SOL (1,000,000,000 lamports)
- **Payment Name**: "test-payment" (customizable per test)
- **Airdrop Amount**: 5 SOL per test account
- **Fee Tolerance**: 0.01 SOL for balance change assertions

## Debugging Tests

1. **Check Solana Logs**:
   ```bash
   solana logs
   ```

2. **Verbose Anchor Output**:
   ```bash
   ANCHOR_LOG=true anchor test
   ```

3. **Individual Test Execution**:
   ```bash
   anchor test --grep "Should create a payment agreement successfully"
   ```

## Common Issues

1. **Airdrop Failures**: Ensure test validator is running and has sufficient funds
2. **Type Errors**: Run `anchor build` to generate types before testing
3. **Timing Issues**: Increase wait times in time-sensitive tests if needed
4. **Account Not Found**: Ensure proper PDA derivation and account setup

## Future Test Enhancements

- Integration tests with real devnet deployment
- Stress testing with large numbers of agreements
- Gas optimization tests
- Multi-signature referee scenarios
- Complex expiration edge cases