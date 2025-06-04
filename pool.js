const { ethers } = require("ethers");
const chalk = require("chalk");
const fs = require("fs");
const readline = require('readline-sync');

// #################### KONFIGURASI ####################
const CONFIG = {
  RPC_URL: "https://carrot.megaeth.com/rpc",
  CHAIN_ID: 6342,
  ROUTER_ADDRESS: "0xa6b579684e943f7d00d616a48cf99b5147fc57a5",
  WETH_ADDRESS: "0x776401b9bc8aae31a685731b7147d4445fd9fb19",
  GAS_PRICE: "0.01",
  GAS_LIMIT: 400000,
  WITHDRAW_GAS_LIMIT: 600000,
  SLIPPAGE: 10,
  FIXED_ETH_AMOUNT: "0.000001",
  TOKEN_LIST_FILE: "pol.txt",
  COOLDOWN_HOURS: 6,
  MAX_RETRIES: 3,
  TOKENS_PER_WALLET: 5,
  WITHDRAW_PERCENTAGE: 80,
  ADD_CYCLES: 1,
  WITHDRAW_CYCLES: 1
};

// #################### SETUP ABI ####################
const ABI = {
  ERC20: [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)"
  ],
  ROUTER: [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)",
    "function removeLiquidityETHSupportingFeeOnTransferTokens(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountETH)",
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    "function factory() external pure returns (address)",
    "function WETH() external pure returns (address)"
  ],
  FACTORY: [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)"
  ],
  PAIR: [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function totalSupply() external view returns (uint)",
    "function balanceOf(address) external view returns (uint)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)"
  ]
};

// #################### UTILITIES ####################
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loadData = () => {
  try {
    const tokenData = fs.readFileSync(CONFIG.TOKEN_LIST_FILE, "utf8")
      .split("\n")
      .filter(Boolean)
      .map(line => {
        const [address, name] = line.split("|");
        return { address: address.trim(), name: name?.trim() || "" };
      });

    return {
      pk: fs.readFileSync("pk.txt", "utf8").split("\n").filter(Boolean),
      tokens: tokenData
    };
  } catch (error) {
    console.error(chalk.red("Error loading files:"), error.message);
    process.exit(1);
  }
};

function shortenHash(hash) {
  return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
}

function shortenAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

async function getActualWethAddress(router) {
  try {
    return await router.WETH();
  } catch (error) {
    return CONFIG.WETH_ADDRESS;
  }
}

// #################### WARNA KUSTOM ####################
const colors = {
  time: chalk.hex('#FFD700'),
  wallet: chalk.hex('#00FF00'),
  action: chalk.hex('#FFFF00'),
  amount: chalk.hex('#87CEEB'),
  token: chalk.hex('#00FF00'),
  hash: chalk.hex('#FFFF00'),
  label: chalk.hex('#00BFFF'),
  error: chalk.hex('#FF0000'),
  success: chalk.hex('#00FF00'),
  title: chalk.hex('#00FFFF'),
  pair: chalk.hex('#FFA07A'),
  withdraw: chalk.hex('#FF69B4'),
  author: chalk.hex('#FF6347').bold
};

// #################### TAMPILAN SIMPEL ####################
function showTitle() {
  console.log(colors.title(`\n══════════════════════════════════════════════════`));
  console.log(colors.title(`          Auto Liquidity GTE - Chain ID ${CONFIG.CHAIN_ID}`));
  console.log(colors.title(`                 By : AJSpro`));
  console.log(colors.title(`══════════════════════════════════════════════════\n`));
}

function showWalletHeader(wallet, mode) {
  console.log(colors.wallet(`\n▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄`));
  console.log(colors.wallet(` Wallet: ${shortenAddress(wallet.address)}`));
  console.log(colors.wallet(` Mode  : ${mode === 'add' ? 'ADD LIQUIDITY' : 'WITHDRAW LIQUIDITY'}`));
  console.log(colors.wallet(`▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀`));
}

function showTokenHeader(tokenSymbol, tokenAddress, mode) {
  const modeText = mode === 'add' ? 'ADDING' : 'WITHDRAWING';
  console.log(colors.pair(`\n► ${modeText} WETH/${tokenSymbol} (${shortenAddress(tokenAddress)})`));
}

function showSuccess(message, hash) {
  console.log(colors.success(`  ✓ ${message}`));
  console.log(colors.hash(`  TX: ${shortenHash(hash)}`));
}

function showError(message) {
  console.log(colors.error(`  ✗ ${message}`));
}

function showInfo(message) {
  console.log(colors.label(`  ℹ ${message}`));
}

function showCooldown(timeLeft, totalTime) {
  const percent = Math.floor((1 - timeLeft / totalTime) * 100);
  const progressBar = `[${'='.repeat(Math.floor(percent/5))}${' '.repeat(20 - Math.floor(percent/5))}]`;
  
  const hours = Math.floor(timeLeft / 3600000);
  const minutes = Math.floor((timeLeft % 3600000) / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  
  console.log(colors.time(`\r⏳ ${progressBar} ${hours}h ${minutes}m ${seconds}s `));
}

function showFinalCooldown() {
  console.log(colors.title(`\n══════════════════════════════════════════════════`));
  console.log(colors.author(`                Script By : AJSpro`));
  console.log(colors.title(`══════════════════════════════════════════════════\n`));
}

// #################### CORE FUNCTIONS ####################

async function addLiquidityETH(wallet, tokenAddress, tokenName = "") {
  const router = new ethers.Contract(CONFIG.ROUTER_ADDRESS, ABI.ROUTER, wallet);
  const token = new ethers.Contract(tokenAddress, ABI.ERC20, wallet);
  
  try {
    const tokenSymbol = tokenName || await token.symbol();
    const tokenDecimals = await token.decimals();
    const tokenAmountDesired = await calculateTokenAmount(wallet, tokenAddress, CONFIG.FIXED_ETH_AMOUNT);
    const ethAmount = ethers.utils.parseEther(CONFIG.FIXED_ETH_AMOUNT);
    const minTokenAmount = tokenAmountDesired.mul(100 - CONFIG.SLIPPAGE).div(100);
    const minETHAmount = ethAmount.mul(100 - CONFIG.SLIPPAGE).div(100);
    
    showTokenHeader(tokenSymbol, tokenAddress, 'add');
    showInfo(`ETH: ${CONFIG.FIXED_ETH_AMOUNT} | ${tokenSymbol}: ${ethers.utils.formatUnits(tokenAmountDesired, tokenDecimals)}`);
    
    const tokenBalance = await token.balanceOf(wallet.address);
    showInfo(`Balance: ${ethers.utils.formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol}`);
    
    if (tokenBalance.lt(tokenAmountDesired)) {
      throw new Error(`Insufficient ${tokenSymbol} balance`);
    }
    
    let allowance = await token.allowance(wallet.address, router.address);
    if (allowance.lt(tokenAmountDesired)) {
      for (let i = 0; i < CONFIG.MAX_RETRIES; i++) {
        try {
          const approveTx = await token.approve(
            router.address, 
            tokenAmountDesired,
            { 
              gasLimit: 200000, 
              gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei") 
            }
          );
          
          await approveTx.wait();
          break;
        } catch (approveError) {
          if (i === CONFIG.MAX_RETRIES - 1) throw approveError;
          await sleep(3000);
        }
      }
    }
    
    for (let i = 0; i < CONFIG.MAX_RETRIES; i++) {
      try {
        const deadline = Math.floor(Date.now() / 1000) + 600;
        const tx = await router.addLiquidityETH(
          tokenAddress,
          tokenAmountDesired,
          minTokenAmount,
          minETHAmount,
          wallet.address,
          deadline,
          {
            value: ethAmount,
            gasLimit: CONFIG.GAS_LIMIT,
            gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei")
          }
        );
        
        const receipt = await tx.wait();
        return { 
          success: true, 
          hash: receipt.transactionHash,
          tokenSymbol: tokenSymbol
        };
      } catch (txError) {
        if (i === CONFIG.MAX_RETRIES - 1) throw txError;
        await sleep(3000);
      }
    }
  } catch (error) {
    showError(`Failed: ${error.message}`);
    return { success: false };
  }
}

async function withdrawLiquidity(wallet, tokenAddress, tokenName = "") {
  const router = new ethers.Contract(CONFIG.ROUTER_ADDRESS, ABI.ROUTER, wallet);
  
  // Dapatkan alamat WETH yang sebenarnya
  const actualWethAddress = await getActualWethAddress(router);
  
  const token = new ethers.Contract(tokenAddress, ABI.ERC20, wallet);
  
  try {
    const tokenSymbol = tokenName || await token.symbol();
    const tokenDecimals = await token.decimals();
    const pairAddress = await getPairAddress(wallet, tokenAddress);
    
    if (pairAddress === ethers.constants.AddressZero) {
      throw new Error('Pair not found');
    }
    
    const pair = new ethers.Contract(pairAddress, ABI.PAIR, wallet);
    const lpBalance = await pair.balanceOf(wallet.address);
    
    if (lpBalance.isZero()) {
      throw new Error('No LP tokens');
    }
    
    const lpAmountToWithdraw = lpBalance.mul(CONFIG.WITHDRAW_PERCENTAGE).div(100);
    
    showTokenHeader(tokenSymbol, tokenAddress, 'withdraw');
    showInfo(`LP Amount: ${ethers.utils.formatEther(lpAmountToWithdraw)}`);
    
    // Dapatkan cadangan pasangan
    const [reserve0, reserve1] = await pair.getReserves();
    const totalSupply = await pair.totalSupply();
    
    // Tentukan token mana yang WETH
    const token0 = await pair.token0();
    const token1 = await pair.token1();
    
    const isToken0WETH = token0 === actualWethAddress;
    const isToken1WETH = token1 === actualWethAddress;
    
    if (!isToken0WETH && !isToken1WETH) {
      throw new Error('WETH not in pair');
    }
    
    // Hitung jumlah token dan ETH yang akan diterima
    const reserveToken = isToken0WETH ? reserve1 : reserve0;
    const reserveWETH = isToken0WETH ? reserve0 : reserve1;
    
    const amountToken = lpAmountToWithdraw.mul(reserveToken).div(totalSupply);
    const amountETH = lpAmountToWithdraw.mul(reserveWETH).div(totalSupply);
    
    // Hitung minimal dengan slippage (10%)
    const minTokenAmount = amountToken.mul(100 - CONFIG.SLIPPAGE).div(100);
    const minETHAmount = amountETH.mul(100 - CONFIG.SLIPPAGE).div(100);
    
    showInfo(`Expected: ${ethers.utils.formatUnits(amountToken, tokenDecimals)} ${tokenSymbol} + ${ethers.utils.formatEther(amountETH)} ETH`);
    
    // Approve LP token
    const allowance = await pair.allowance(wallet.address, router.address);
    if (allowance.lt(lpAmountToWithdraw)) {
      showInfo("Approving LP tokens...");
      for (let i = 0; i < CONFIG.MAX_RETRIES; i++) {
        try {
          const approveTx = await pair.approve(
            router.address, 
            lpAmountToWithdraw,
            { 
              gasLimit: 300000, 
              gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei") 
            }
          );
          await approveTx.wait();
          break;
        } catch (approveError) {
          if (i === CONFIG.MAX_RETRIES - 1) throw approveError;
          await sleep(3000);
        }
      }
    }

    // Gunakan parameter seperti transaksi sukses
    const gasLimit = CONFIG.WITHDRAW_GAS_LIMIT;
    
    // Coba fungsi standard terlebih dahulu
    try {
      const tx = await router.removeLiquidityETH(
        tokenAddress,
        lpAmountToWithdraw,
        minTokenAmount,
        minETHAmount,
        wallet.address,
        Math.floor(Date.now() / 1000) + 600,
        {
          gasLimit,
          gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei")
        }
      );
      
      const receipt = await tx.wait();
      return { 
        success: true, 
        hash: receipt.transactionHash,
        tokenSymbol: tokenSymbol
      };
    } catch (standardError) {
      showInfo(`Standard withdraw failed, trying fee-supporting version...`);
      
      // Jika gagal, coba fungsi supporting fee
      const tx = await router.removeLiquidityETHSupportingFeeOnTransferTokens(
        tokenAddress,
        lpAmountToWithdraw,
        minTokenAmount,
        minETHAmount,
        wallet.address,
        Math.floor(Date.now() / 1000) + 600,
        {
          gasLimit: gasLimit + 100000,
          gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei")
        }
      );
      
      const receipt = await tx.wait();
      return { 
        success: true, 
        hash: receipt.transactionHash,
        tokenSymbol: tokenSymbol
      };
    }
    
  } catch (error) {
    showError(`Failed: ${error.reason || error.message}`);
    return { success: false };
  }
}

async function calculateTokenAmount(wallet, tokenAddress, ethAmount) {
  const router = new ethers.Contract(CONFIG.ROUTER_ADDRESS, ABI.ROUTER, wallet);
  
  try {
    const path = [CONFIG.WETH_ADDRESS, tokenAddress];
    const amounts = await router.getAmountsOut(
      ethers.utils.parseEther(ethAmount),
      path
    );
    return amounts[1];
  } catch (error) {
    return ethers.utils.parseUnits("1000", 18);
  }
}

async function getPairAddress(wallet, tokenAddress) {
  const router = new ethers.Contract(CONFIG.ROUTER_ADDRESS, ABI.ROUTER, wallet);
  const factoryAddress = await router.factory();
  const factory = new ethers.Contract(factoryAddress, ABI.FACTORY, wallet);
  return factory.getPair(tokenAddress, CONFIG.WETH_ADDRESS);
}

async function processWallet(wallet, mode, selectedTokens) {
  showWalletHeader(wallet, mode);
  
  const ethBalance = await wallet.getBalance();
  showInfo(`ETH Balance: ${ethers.utils.formatEther(ethBalance)}`);
  
  if (mode === 'add') {
    const requiredEth = ethers.utils.parseEther(CONFIG.FIXED_ETH_AMOUNT).mul(selectedTokens.length);
    if (ethBalance.lt(requiredEth)) {
      showError(`Insufficient ETH! Required: ${ethers.utils.formatEther(requiredEth)}`);
      return;
    }
  }
  
  for (const token of selectedTokens) {
    let result;
    
    if (mode === 'add') {
      result = await addLiquidityETH(wallet, token.address, token.name);
    } else {
      result = await withdrawLiquidity(wallet, token.address, token.name);
    }
    
    if (result && result.success) {
      const action = mode === 'add' ? 'Added liquidity' : 'Withdrawn liquidity';
      showSuccess(`${action} for ${result.tokenSymbol}`, result.hash);
    } else if (!result) {
      showError(`Operation failed for ${token.name || token.address}`);
    }
    
    const newEthBalance = await wallet.getBalance();
    showInfo(`New ETH Balance: ${ethers.utils.formatEther(newEthBalance)}`);
    
    await sleep(3000);
  }
}

async function runAddMode(provider, pk, tokens, cycles = CONFIG.ADD_CYCLES) {
  for (let cycle = 1; cycle <= cycles; cycle++) {
    showTitle();
    console.log(colors.title(`► ADD CYCLE ${cycle}/${cycles} ◄`));
    
    for (const [index, privateKey] of pk.entries()) {
      const wallet = new ethers.Wallet(privateKey, provider);
      
      try {
        // Pilih token acak
        const selectedTokens = [...tokens]
          .sort(() => 0.5 - Math.random())
          .slice(0, CONFIG.TOKENS_PER_WALLET);
        
        await processWallet(wallet, 'add', selectedTokens);
      } catch (error) {
        showError(`Wallet error: ${error.message}`);
      }
      
      await sleep(5000);
    }
    
    if (cycle < cycles) {
      const cooldownMs = 10 * 60 * 1000;
      console.log(colors.title(`\n► COOLDOWN 10 MINUTES ◄`));
      
      const start = Date.now();
      while (Date.now() - start < cooldownMs) {
        const timeLeft = cooldownMs - (Date.now() - start);
        showCooldown(timeLeft, cooldownMs);
        await sleep(1000);
      }
      showFinalCooldown();
    }
  }
}

async function runWithdrawMode(provider, pk, tokens, cycles = CONFIG.WITHDRAW_CYCLES) {
  for (let cycle = 1; cycle <= cycles; cycle++) {
    showTitle();
    console.log(colors.title(`► WITHDRAW CYCLE ${cycle}/${cycles} ◄`));
    
    for (const [index, privateKey] of pk.entries()) {
      const wallet = new ethers.Wallet(privateKey, provider);
      
      try {
        // Ambil semua token untuk withdraw
        await processWallet(wallet, 'withdraw', tokens);
      } catch (error) {
        showError(`Wallet error: ${error.message}`);
      }
      
      await sleep(5000);
    }
    
    if (cycle < cycles) {
      const cooldownMs = 10 * 60 * 1000;
      console.log(colors.title(`\n► COOLDOWN 10 MINUTES ◄`));
      
      const start = Date.now();
      while (Date.now() - start < cooldownMs) {
        const timeLeft = cooldownMs - (Date.now() - start);
        showCooldown(timeLeft, cooldownMs);
        await sleep(1000);
      }
      showFinalCooldown();
    }
  }
}

// #################### MAIN PROCESS ####################
async function main() {
  showTitle();
  
  // Pilih mode
  console.log(colors.title("SELECT OPERATION MODE:"));
  console.log("1. Add Liquidity Only");
  console.log("2. Withdraw Liquidity Only");
  console.log("3. Full Cycle (Add + Withdraw) - Loop Forever");
  console.log("4. Exit");
  
  const choice = readline.question('Your choice (1-4): ');
  
  if (choice === '4') {
    console.log(colors.success("Exiting..."));
    return;
  }
  
  // Load data
  const { pk, tokens } = loadData();
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    chainId: CONFIG.CHAIN_ID,
    name: 'custom-chain'
  });
  
  console.log(colors.title(`\nLoaded: ${pk.length} wallets, ${tokens.length} tokens`));
  
  let addCycles = CONFIG.ADD_CYCLES;
  let withdrawCycles = CONFIG.WITHDRAW_CYCLES;
  
  // Hanya tanya sekali di awal untuk semua mode
  if (choice === '1' || choice === '3') {
    addCycles = parseInt(readline.question('How many ADD cycles? (1-5): ') || CONFIG.ADD_CYCLES);
  }
  
  if (choice === '2' || choice === '3') {
    withdrawCycles = parseInt(readline.question('How many WITHDRAW cycles? (1-5): ') || CONFIG.WITHDRAW_CYCLES);
  }
  
  switch(choice) {
    case '1':
      await runAddMode(provider, pk, tokens, addCycles);
      break;
    case '2':
      await runWithdrawMode(provider, pk, tokens, withdrawCycles);
      break;
    case '3':
      // Loop forever for Full Cycle
      let cycleCount = 1;
      while (true) {
        console.log(colors.title(`\n══════════════════════════════════════════════════`));
        console.log(colors.title(`            STARTING FULL CYCLE #${cycleCount}`));
        console.log(colors.title(`══════════════════════════════════════════════════`));
        
        // Run ADD cycles
        await runAddMode(provider, pk, tokens, addCycles);
        
        // Main Cooldown after ADD
        const mainCooldownMs = CONFIG.COOLDOWN_HOURS * 3600 * 1000;
        console.log(colors.title(`\n► MAIN COOLDOWN ${CONFIG.COOLDOWN_HOURS} HOURS BEFORE WITHDRAW ◄`));
        
        const start = Date.now();
        while (Date.now() - start < mainCooldownMs) {
          const timeLeft = mainCooldownMs - (Date.now() - start);
          showCooldown(timeLeft, mainCooldownMs);
          await sleep(1000);
        }
        showFinalCooldown();
        
        // Run WITHDRAW cycles
        await runWithdrawMode(provider, pk, tokens, withdrawCycles);
        
        // Cooldown after WITHDRAW before restarting
        console.log(colors.title(`\n► COOLDOWN ${CONFIG.COOLDOWN_HOURS} HOURS BEFORE RESTARTING ◄`));
        
        const restartStart = Date.now();
        while (Date.now() - restartStart < mainCooldownMs) {
          const timeLeft = mainCooldownMs - (Date.now() - restartStart);
          showCooldown(timeLeft, mainCooldownMs);
          await sleep(1000);
        }
        
        cycleCount++;
      }
      break;
    default:
      showError("Invalid choice");
  }
  
  console.log(colors.title("\n► OPERATION COMPLETED ◄"));
  showFinalCooldown();
}

// Jalankan aplikasi
main().catch(error => {
  showError(`Fatal error: ${error.message}`);
  process.exit(1);
});