const { ethers } = require("ethers");
const chalk = require("chalk");
const fs = require("fs");

// #################### KONFIGURASI ####################
const CONFIG = {
  RPC_URL: "https://carrot.megaeth.com/rpc",
  CHAIN_ID: 6342,
  ROUTER_ADDRESS: "0xa6b579684e943f7d00d616a48cf99b5147fc57a5",
  GAS_PRICE: "0.1",
  GAS_LIMIT: 300000,
  SLIPPAGE: 5,
  BRONTO_ADDRESS: "0x9a9b33227fa5d386987a5892a7f0b730c9ba3e22"
};

// #################### SETUP ABI ####################
const ABI = {
  ERC20: [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address, uint256) returns (bool)",
    "function symbol() view returns (string)"
  ],
  ROUTER: [
    "function getAmountsOut(uint256, address[] memory) view returns (uint256[] memory)",
    "function swapExactTokensForTokens(uint256, uint256, address[], address, uint256)"
  ]
};

// #################### UTILITIES ####################
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loadData = () => {
  try {
    const sc = fs.readFileSync("sc.txt", "utf8")
      .split("\n")
      .map(x => {
        const [address, name] = x.trim().split("|");
        return { 
          address: address?.toLowerCase(), 
          name: name?.trim() || "Unknown" 
        };
      })
      .filter(x => x.address && ethers.utils.isAddress(x.address));

    return {
      sc,
      pk: fs.readFileSync("pk.txt", "utf8").split("\n").filter(Boolean)
    };
  } catch (error) {
    console.error(chalk.red("Error loading files:"), error.message);
    process.exit(1);
  }
};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function shortenHash(hash, startLength = 4, endLength = 4) {
  return `${hash.substring(0, startLength)}...${hash.substring(hash.length - endLength)}`;
}

// #################### WARNA KUSTOM ####################
const colors = {
  time: chalk.hex('#FFD700'),
  swapNumber: chalk.hex('#87CEEB'),
  amount: chalk.hex('#00FF00'),
  token: chalk.hex('#00FF00'),
  hashLabel: chalk.hex('#00BFFF'),
  hash: chalk.hex('#FFFF00'),
  judul: chalk.hex('#00FFFF'),
  balanceLabel: chalk.hex('#00BFFF'),
  balanceValue: chalk.hex('#FFFF00'),
  swap: chalk.hex('#FFFF00'),
  error: chalk.hex('#FF0000')
};

// #################### CORE FUNCTIONS ####################
async function getTokenInfo(wallet, tokenAddress) {
  const contract = new ethers.Contract(tokenAddress, ABI.ERC20, wallet);
  try {
    return {
      balance: await contract.balanceOf(wallet.address),
      decimals: await contract.decimals(),
      symbol: await contract.symbol().catch(() => "UNKNOWN")
    };
  } catch (error) {
    return {
      balance: ethers.constants.Zero,
      decimals: 18,
      symbol: "UNKNOWN"
    };
  }
}

async function executeSwap(wallet, fromToken, toToken, amountIn, decimals) {
  let retries = 3;
  while (retries > 0) {
    try {
      const router = new ethers.Contract(CONFIG.ROUTER_ADDRESS, ABI.ROUTER, wallet);
      const tokenContract = new ethers.Contract(fromToken, ABI.ERC20, wallet);

      // Approve
      const approveTx = await tokenContract.approve(
        CONFIG.ROUTER_ADDRESS,
        amountIn,
        { gasLimit: 150000, gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei") }
      );
      await approveTx.wait();

      // Calculate min amount
      const amounts = await router.getAmountsOut(amountIn, [fromToken, toToken]);
      const minAmount = amounts[1].sub(amounts[1].mul(CONFIG.SLIPPAGE).div(100));

      // Execute swap
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const tx = await router.swapExactTokensForTokens(
        amountIn,
        minAmount,
        [fromToken, toToken],
        wallet.address,
        deadline,
        { gasLimit: CONFIG.GAS_LIMIT, gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei") }
      );

      const receipt = await tx.wait();
      return { success: true, hash: receipt.transactionHash };
    } catch (error) {
      retries--;
      if (retries === 0) return { success: false, error: error.message };
      await sleep(2000);
    }
  }
}

// #################### PROSES SWAP ####################
async function processInitialSwaps(wallet, scList) {
  let totalSwaps = 0;
  const txCount = Math.floor(Math.random() * (55 - 32 + 1)) + 32;
  console.log(colors.swap(`Memulai ${txCount} swap cUSD :`));

  const cusdToken = scList.find(t => t.name === "CUSD");
  
  for (let i = 0; i < txCount; i++) {
    const randomToken = shuffleArray(scList.filter(t => t.name !== "CUSD"))[0];
    const amount = Math.floor(Math.random() * (495 - 100 + 1)) + 100;
    
    const tokenInfo = await getTokenInfo(wallet, cusdToken.address);
    const amountIn = ethers.utils.parseUnits(amount.toString(), tokenInfo.decimals);

    if (tokenInfo.balance.lt(amountIn)) {
      console.log(colors.error(`Saldo CUSD tidak cukup! Diperlukan: ${amount}`));
      break;
    }

    const result = await executeSwap(wallet, cusdToken.address, randomToken.address, amountIn, tokenInfo.decimals);
    
    if (result.success) {
      const timeDisplay = colors.time(`[${new Date().toLocaleTimeString()}]`);
      const swapCountDisplay = colors.swapNumber(`[Swap #${i + 1}]`);
      const amountDisplay = colors.amount(`${amount} CUSD =>`);
      const tokenDisplay = colors.token(randomToken.name);
      const cusdBalance = ethers.utils.formatUnits(tokenInfo.balance.sub(amountIn), tokenInfo.decimals);
      const ethBalance = await wallet.getBalance();

      console.log(`\n${timeDisplay} ${swapCountDisplay} ${amountDisplay} ${tokenDisplay}`);
      console.log(
        colors.hashLabel(' TX Hash: ') + 
        colors.hash(shortenHash(result.hash))
      );
      console.log(
        colors.balanceLabel(' Saldo CUSD: ') +
        colors.balanceValue(Math.floor(cusdBalance))
      );
      console.log(
        colors.balanceLabel(' Saldo ETH: ') +
        colors.balanceValue(Number(ethers.utils.formatEther(ethBalance)).toFixed(4))
      );
      
      totalSwaps++;
    } else {
      console.log(colors.error(`[${new Date().toLocaleTimeString()}] Gagal: ${result.error}`));
    }
    
    await sleep(3000);
  }
  return totalSwaps;
}

async function processRandomSwaps(wallet, scList) {
  console.log(colors.swap("\nMemulai 10 random swap"));
  
  for (let i = 0; i < 10; i++) {
    const [fromToken, toToken] = shuffleArray(scList).slice(0, 2);
    const tokenInfo = await getTokenInfo(wallet, fromToken.address);
    
    if (tokenInfo.balance.isZero()) {
      console.log(colors.error(`[${fromToken.name}] Saldo kosong`));
      continue;
    }

    const amount = (Math.random() * (0.5 - 0.01) + 0.01).toFixed(3);
    const amountIn = ethers.utils.parseUnits(amount, tokenInfo.decimals);
    
    const result = await executeSwap(wallet, fromToken.address, toToken.address, amountIn, tokenInfo.decimals);
    
    if (result.success) {
      const timeDisplay = colors.time(`[${new Date().toLocaleTimeString()}]`);
      const swapCountDisplay = colors.swapNumber(`[Random #${i + 1}]`);
      const amountDisplay = colors.amount(`${amount} ${fromToken.name}`);
      const tokenDisplay = colors.token(toToken.name);

      console.log(`\n${timeDisplay} ${swapCountDisplay} ${amountDisplay} => ${tokenDisplay}`);
      console.log(
        colors.hashLabel(' TX Hash: ') + 
        colors.hash(shortenHash(result.hash))
      );
      console.log(
        colors.balanceLabel(` Saldo ${fromToken.name}: `) +
        colors.balanceValue(Number(ethers.utils.formatUnits(tokenInfo.balance.sub(amountIn), tokenInfo.decimals)).toFixed(2))
      );
    }

    await sleep(3000);
  }
}

// #################### PROSES SWAP BRONTO ####################
async function processBrontoSwaps(wallet, scList) {
  const brontoToken = scList.find(t => t.address === CONFIG.BRONTO_ADDRESS.toLowerCase());
  const cusdToken = scList.find(t => t.name === "CUSD");
  
  const numSwaps = Math.floor(Math.random() * (20 - 10 + 1)) + 10;
  console.log(colors.swap(`\nMemulai ${numSwaps} swap CUSD ke BRONTO:`));

  for(let i = 0; i < numSwaps; i++) {
    const amount = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
    const tokenInfo = await getTokenInfo(wallet, cusdToken.address);
    const amountIn = ethers.utils.parseUnits(amount.toString(), tokenInfo.decimals);

    if(tokenInfo.balance.lt(amountIn)) {
      console.log(colors.error(`Saldo CUSD tidak cukup! Diperlukan: ${amount}`));
      break;
    }

    const result = await executeSwap(wallet, cusdToken.address, brontoToken.address, amountIn, tokenInfo.decimals);
    
    if(result.success) {
      const timeDisplay = colors.time(`[${new Date().toLocaleTimeString()}]`);
      const swapCountDisplay = colors.swapNumber(`[Bronto #${i + 1}]`);
      const amountDisplay = colors.amount(`${amount} CUSD =>`);
      const tokenDisplay = colors.token("BRONTO");
      const cusdBalance = ethers.utils.formatUnits(tokenInfo.balance.sub(amountIn), tokenInfo.decimals);

      console.log(`\n${timeDisplay} ${swapCountDisplay} ${amountDisplay} ${tokenDisplay}`);
      console.log(
        colors.hashLabel(' TX Hash: ') + 
        colors.hash(shortenHash(result.hash))
      );
      console.log(
        colors.balanceLabel(' Saldo CUSD: ') +
        colors.balanceValue(Math.floor(cusdBalance))
      );
    } else {
      console.log(colors.error(`[${new Date().toLocaleTimeString()}] Gagal: ${result.error}`));
    }
    
    await sleep(3000);
  }
}

// #################### MAIN PROCESS ####################
async function runBot() {
  while(true) {
    try {
      const { sc, pk } = loadData();
      const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, CONFIG.CHAIN_ID);
      const shuffledWallets = shuffleArray(pk);

      console.log(colors.judul(`
###################################################
          GTESwap By: AJSpro - Chain ID ${CONFIG.CHAIN_ID}
###################################################`));

      for (const [index, privateKey] of shuffledWallets.entries()) {
        const wallet = new ethers.Wallet(privateKey, provider);
        console.log(colors.balanceLabel(`\n[Wallet ${index + 1}/${pk.length}] ${wallet.address}`));

        await processInitialSwaps(wallet, sc);
        await processRandomSwaps(wallet, sc);
        await processBrontoSwaps(wallet, sc);
        
        // Final Balance
        const ethBalance = await wallet.getBalance();
        console.log(colors.balanceLabel("\n=== Final Balance ==="));
        console.log(
          colors.balanceLabel(' ETH: ') +
          colors.balanceValue(Number(ethers.utils.formatEther(ethBalance)).toFixed(4))
        );
        for (const token of sc) {
          const balance = await getTokenInfo(wallet, token.address);
          console.log(
            colors.token(` ${token.name}: `) +
            colors.balanceValue(Number(ethers.utils.formatUnits(balance.balance, balance.decimals)).toFixed(2))
          );
        }
      }

      // Cooldown
      const cooldown = 10 * 3600 * 1000;
      console.log(colors.hashLabel("\n⏳ Cooldown 10 jam dimulai..."));
      
      const start = Date.now();
      const timer = setInterval(() => {
        const remaining = cooldown - (Date.now() - start);
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        process.stdout.write(colors.time(`\r⏳ Tersisa: ${hours}h ${minutes}m ${seconds}s `));
      }, 1000);

      await sleep(cooldown);
      clearInterval(timer);
      console.log(colors.token("\n🔄 Memulai ulang bot...\n"));

    } catch (error) {
      console.error(colors.error("Error utama:"), error);
      await sleep(5000);
    }
  }
}

runBot().catch(console.error);