# ☕ Wanna Buy Me a Coffee?

If you'd like to support this little project, feel free to drop a coffee donation:

**EVM Wallet:** `0xa7C078f4174C0f8cfa8444e5141f8217F60CEe18`

**Solana Wallet:** `H2k5pM1xq6N7YjSfTEyhpdezcN5UX8y4mnB9yn9nDFAG`

Thank you!

---

# Auto Swap,pool GTE - MegaETH Tesnet

This repository contains a suite of JavaScript (Node.js) scripts designed to automate various DeFi operations such as managing liquidity pools and executing token swaps on EVM-compatible blockchains, specifically targeting the MegaETH Testnet for GTE. Each script serves a specific purpose and can be configured via its internal `CONFIG` object.

**Disclaimer:** *These scripts interact with smart contracts and manage private keys. Use them at your own risk. Ensure you understand the code and the potential risks involved before using them with real funds. The author is not responsible for any financial losses.*

## Table of Contents

- [General Setup](#general-setup)
- [1. Liquidity Pool Manager (`pool.js`)](#1-liquidity-pool-manager-pooljs)
  - [Features (`pool.js`)](#features-pooljs)
  - [Configuration (`pool.js`)](#configuration-pooljs)
  - [Usage (`pool.js`)](#usage-pooljs)
- [2. ETH Swap & Unwrap (`swap-eth.js`)](#2-eth-swap--unwrap-swap-ethjs)
  - [Features (`swap-eth.js`)](#features-swap-ethjs)
  - [Configuration (`swap-eth.js`)](#configuration-swap-ethjs)
  - [Usage (`swap-eth.js`)](#usage-swap-ethjs)
- [3. General Token Swapper (`swap.js`)](#3-general-token-swapper-swapjs)
  - [Features (`swap.js`)](#features-swapjs)
  - [Configuration (`swap.js`)](#configuration-swapjs)
  - [Usage (`swap.js`)](#usage-swapjs)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Contributing](#contributing)
- [License](#license)

---

## General Setup

1.  **Private Keys (`pk.txt`):** All scripts require a `pk.txt` file in the same directory. Each line in this file should be a private key for a wallet you want the script to use.
2.  **Token Lists:**
    * `pool.js` uses `pol.txt` (format: `TokenAddress|TokenName`).
    * `swap-eth.js` and `swap.js` use `sc.txt` (format: `TokenAddress|TokenName`).

---

## 1. Liquidity Pool Manager (`pool.js`)

Automates adding and withdrawing liquidity for Token/WETH pairs on a DEX, tailored for MegaETH Testnet.

### Features (`pool.js`)

* **Liquidity Operations:** Adds/withdraws liquidity for multiple wallets from `pk.txt`.
* **Token Management:** Uses `pol.txt` for token selection; adds liquidity for a configurable number of random tokens per wallet.
* **Operational Modes:**
    * `Add Liquidity`: Fixed ETH amount, calculated token amount.
    * `Withdraw Liquidity`: Withdraws a configurable percentage of LP tokens.
    * `Full Cycle`: Loops Add -> Cooldown -> Withdraw -> Cooldown.
* **Configuration:** RPC, chain, router, WETH, gas settings, slippage, cycle counts, cooldowns.
* **User Interface:** Interactive menu for mode selection and cycle configuration; colored console logs.

### Configuration (`pool.js`)

Key settings: `RPC_URL`, `CHAIN_ID` (should be set for MegaETH Testnet, e.g., 6342), `ROUTER_ADDRESS`, `WETH_ADDRESS`, `GAS_PRICE`, `FIXED_ETH_AMOUNT`, `TOKEN_LIST_FILE`, `COOLDOWN_HOURS`, `TOKENS_PER_WALLET`, `WITHDRAW_PERCENTAGE`.

### Usage (`pool.js`)

```bash
node pool.js
Follow the on-screen menu.
Follow the on-screen menu.

### 2. ETH Swap & Unwrap (swap-eth.js)
Swaps various tokens (from sc.txt) to WETH and then unwraps WETH to native ETH on the MegaETH Testnet. This script is designed for processing multiple wallets and includes a global cooldown mechanism to prevent too frequent operations.

Features (swap-eth.js)
Token to WETH Swaps: Iterates through tokens listed in sc.txt and swaps 50% of their balance to WETH for each wallet.
WETH Unwrapping: After potential swaps, it unwraps all WETH balance in each wallet to native ETH.
Operational Modes:
Swap Only: Performs only the token-to-WETH swaps.
Unwrap Only: Performs only the WETH-to-ETH unwrapping.
Swap + Unwrap: Executes both swaps and then unwraps.
Multi-Wallet Processing: Reads private keys from pk.txt and performs selected operations for each wallet sequentially.
Cooldown Management: Implements a global cooldown period (configurable, e.g., 48 hours). A cooldown.json file tracks the last execution time, preventing the script from running again until the cooldown has passed. The cooldown is only activated if an operation (swap/unwrap) was actually performed.
Configuration: Key parameters like RPC URL, Chain ID (for MegaETH Testnet), Router address, WETH address, gas settings, slippage tolerance, and cooldown duration are configurable.
User Interface: Provides an interactive command-line menu (using inquirer) for selecting the operation mode. It also uses chalk for colored console output, enhancing readability of logs and status messages.
Configuration (swap-eth.js)
Key settings: RPC_URL, CHAIN_ID (e.g., 6342 for MegaETH Testnet), ROUTER_ADDRESS, WETH_ADDRESS, GAS_PRICE, COOLDOWN_HOURS. Ensure sc.txt is populated with tokens you wish to swap.

Usage (swap-eth.js)
Bash

node swap-eth.js
Choose the desired operation mode (Swap, Unwrap, or Swap + Unwrap) from the interactive prompt.

### 3. General Token Swapper (swap.js)
Performs a variety of automated token-to-token swaps on the MegaETH Testnet. This script is designed to run in a continuous loop, processing multiple wallets with diverse swapping strategies, followed by a lengthy cooldown period before restarting.

Features (swap.js)
Multi-Stage Swap Strategy per Wallet:
Initial CUSD Swaps: Executes a random number of swaps (between 32-55) from CUSD to other random tokens listed in sc.txt. The amount of CUSD for each swap is also randomized (between 100-495 CUSD).
Random Token Swaps: Performs 10 swaps between two randomly selected tokens from sc.txt (swapping a small, randomized portion of the 'fromToken' balance).
Targeted BRONTO Swaps: Executes a random number of swaps (between 10-20) from CUSD specifically to a pre-defined BRONTO token address. The CUSD amount is randomized (between 1000-5000 CUSD).
Continuous Operation & Multi-Wallet: Processes all wallets listed in pk.txt (wallets are shuffled for each main cycle). After all wallets are processed, the script enters a long cooldown period (e.g., 10 hours) before automatically restarting the entire sequence.
Token Management: Relies on sc.txt for the list of available tokens for swapping (ensure CUSD and BRONTO, if used by name, are correctly defined).
Configuration: Critical parameters such as RPC URL, Chain ID (for MegaETH Testnet), Router address, gas settings, slippage, and the specific BRONTO token address are configurable.
User Interface & Logging: Provides detailed, colored console output for each transaction, including balances, token names, and transaction hashes. A timer displays the remaining cooldown period.
Transaction Retries: Includes a basic retry mechanism (up to 3 attempts) for swap executions in case of transient network issues.
Configuration (swap.js)
Key settings: RPC_URL, CHAIN_ID (e.g., 6342 for MegaETH Testnet), ROUTER_ADDRESS, GAS_PRICE, BRONTO_ADDRESS. Ensure sc.txt contains CUSD and other tokens for swapping.

Usage (swap.js)
Bash

node swap.js
The script will start processing wallets according to the defined strategies and will run in a continuous loop, with a 10-hour cooldown between each full cycle through all wallets.

Prerequisites
Node.js: Version 14.x or newer recommended.
NPM Packages:
ethers: (e.g., v5.7.2 or your specific version) - For interacting with Ethereum-like blockchains.
chalk: (e.g., v4.1.2 or your specific version) - For colored console output.
readline-sync: (e.g., v1.4.10 or your specific version) - Used by pool.js for synchronous user input.
inquirer: (e.g., v8.2.4 or your specific version) - Used by swap-eth.js for interactive prompts.
pk.txt file: Contains your wallet private keys, one per line.
pol.txt / sc.txt files: Contain token contract addresses and names (format: Address|Name).
Installation
Clone/Download the Repository:
Bash

git clone [https://github.com/AJSPRO/GTE-Auto-Bot.git](https://github.com/AJSPRO/GTE-Auto-Bot.git)
cd GTE-Auto-Bot
Install Dependencies: It's recommended to create a package.json file first by running npm init -y if you don't have one. Then, install the required packages with their specific versions (replace example versions with your actual target versions):
Bash

npm install ethers@5.7.2 chalk@4.1.2 readline-sync@1.4.10 inquirer@8.2.4
Note: Ensure these versions are compatible with your scripts and Node.js version.
Create Data Files:
Create pk.txt and populate it with your private keys.
Create pol.txt (for pool.js) and/or sc.txt (for swap-eth.js, swap.js) and populate them with token details.
Configure Scripts: Open pool.js, swap-eth.js, and swap.js. Modify the CONFIG object at the top of each file to match your target blockchain network (RPC URL for MegaETH Testnet, Chain ID 6342, specific contract addresses, etc.) and desired operational parameters.
Contributing
Contributions are welcome! If you have improvements or bug fixes:

Fork the repository.
Create a new branch (git checkout -b feature/AmazingFeature).
Commit your changes (git commit -m 'Add some AmazingFeature').
Push to the branch (git push origin feature/AmazingFeature).
Open a Pull Request.
