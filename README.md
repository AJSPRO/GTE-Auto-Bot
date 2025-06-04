```markdown
# ⚙️ GTE Auto Bot – MegaETH Testnet

A complete suite of MegaETH Testnet automation tools for:

- 🔁 Swapping CUSD/GTE/WETH tokens
- 💧 Adding/withdrawing liquidity
- 🪙 Unwrapping WETH to ETH

> ⚠️ **Use at your own risk.** These scripts interact with private keys and real smart contracts on the MegaETH Testnet.

---

## ☕ Support This Project

If you find this project helpful, feel free to donate:

- **EVM Wallet:** `0xa7C078f4174C0f8cfa8444e5141f8217F60CEe18`  
- **Solana Wallet:** `H2k5pM1xq6N7YjSfTEyhpdezcN5UX8y4mnB9yn9nDFAG`

---

## 📦 Project Structure

```text
📁 gte-auto-bot/
├── pool.js          # Add / withdraw liquidity
├── swap-eth.js      # Swap token to WETH and unwrap WETH to ETH
├── swap.js          # Main swap bot for CUSD <-> Token swapping
├── pk.txt           # Private keys (1 per line)
├── sc.txt           # Smart contract token list (address|name)
├── pol.txt          # Token list for liquidity (address|name)
├── package.json     # Dependencies
└── README.md        # You're reading it
```

---

🧰 Prerequisites

- Node.js >=18.x
- NPM or Yarn
- Funded wallets on MegaETH Testnet
- Token balances of GTE, WETH, or other supported tokens

---

🔧 Installation

```bash
git clone https://github.com/AJSPRO/GTE-Auto-Bot
cd GTE-Auto-Bot
npm install ethers@5 axios chalk@4 delay readline-sync
```

Add your private keys to `pk.txt` (one per line) and your token list to `sc.txt` or `pol.txt` depending on the script.

---

## 1️⃣ Liquidity Pool Bot – pool.js

✅ Features  
- Add & withdraw liquidity to/from token-WETH pairs  
- Select token pairs from pol.txt  
- Cooldown support between liquidity cycles  
- Colorful logs and automatic loop control  

📝 File: pol.txt  
```
0xabc123456...|TOKEN1  
0xdef456789...|TOKEN2  
```

⚙️ Usage  
```bash
node pool.js
```  
Follow the interactive prompts:  
- ➕ Add liquidity only  
- ➖ Withdraw only  
- 🔁 Add → Wait → Withdraw cycle  

---

## 2️⃣ Swap + Unwrap Bot – swap-eth.js

✅ Features  
- Swap GTE (or any token in sc.txt) → WETH  
- Automatically unwrap WETH → ETH  
- Interactive terminal  
- Logs all TXs with colors  
- Cooldown system after full run  

📝 File: sc.txt  
```
0xabc123456...|CUSD  
0xdef456789...|OTHER  
```

⚙️ Usage  
```bash
node swap-eth.js
```  
You will be asked:  
- Swap only  
- Unwrap only  
- Both in one flow  

---

## 3️⃣ GTE Swap Bot – swap.js

✅ Features  
- Phase 1: Swap CUSD → random tokens  
- Phase 2: Token ↔ Token (random swaps)  
- Phase 3: All tokens → GTE (exit strategy)  
- Logs show shortened hash, wallet name  
- Full loop system with 2-minute wallet delay and 6–7 hour cooldown  

📝 File: sc.txt  
Same format as above.  

⚙️ Usage  
```bash
node swap.js
```  
No user input needed — the bot runs automatically and loops forever after cooldown.  

---

📁 File Formats

**pk.txt**  
```
0xPRIVATEKEY1
0xPRIVATEKEY2
```

**sc.txt / pol.txt**  
```
0xTOKENADDRESS|TOKENNAME
```

---

🕓 Cooldown System  
All bots implement cooldowns to avoid rate limits.  
Example: 6–7 hours after a full wallet run in swap.js.

---

🤝 Contributing  
Contributions, suggestions, or improvements are welcome via pull request.

---

📜 License  
MIT © 2025
```
