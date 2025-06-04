const { ethers } = require("ethers");
const chalk = require("chalk");
const inquirer = require("inquirer");
const fs = require("fs");
const path = require("path");

// #################### KONFIGURASI ####################
const CONFIG = {
  RPC_URL: "https://carrot.megaeth.com/rpc",
  CHAIN_ID: 6342,
  ROUTER_ADDRESS: "0xa6b579684e943f7d00d616a48cf99b5147fc57a5",
  WETH_ADDRESS: "0x776401b9bc8aae31a685731b7147d4445fd9fb19",
  GAS_PRICE: "0.01",
  GAS_LIMIT: 300000,
  SLIPPAGE: 5,
  COOLDOWN_HOURS: 48 // Cooldown setelah semua operasi selesai
};

// #################### SETUP ABI ####################
const ABI = {
  ERC20: [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
    "function symbol() view returns (string)"
  ],
  ROUTER: [
    "function getAmountsOut(uint256, address[] memory) view returns (uint256[] memory)",
    "function swapExactTokensForTokens(uint256, uint256, address[], address, uint256) returns (uint256[] memory)"
  ],
  WETH: [
    "function balanceOf(address) view returns (uint256)",
    "function withdraw(uint256)"
  ]
};

// #################### UTILITIES ####################
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function loadData() {
  try {
    const pk = fs.readFileSync("pk.txt", "utf8").split("\n").filter(Boolean);
    const tokens = [];
    
    // Load token contracts from sc11.txt
    if (fs.existsSync("sc.txt")) {
      const scData = fs.readFileSync("sc.txt", "utf8").split("\n");
      for (const line of scData) {
        if (line.trim() === "") continue;
        const [address, name] = line.split("|").map(item => item.trim());
        if (ethers.utils.isAddress(address)) {
          tokens.push({
            address: address.toLowerCase(),
            name: name || "UNKNOWN"
          });
        }
      }
    }
    
    return { pk, tokens };
  } catch (error) {
    console.error(chalk.red("Error loading files:"), error.message);
    process.exit(1);
  }
}

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

async function unwrapWETH(wallet) {
  try {
    const wethContract = new ethers.Contract(CONFIG.WETH_ADDRESS, ABI.WETH, wallet);
    const wethBalance = await wethContract.balanceOf(wallet.address);

    if (wethBalance.gt(0)) {
      console.log(chalk.yellow(`\nUnwrapping ${ethers.utils.formatEther(wethBalance)} WETH...`));
      
      const tx = await wethContract.withdraw(wethBalance, {
        gasLimit: 250000,
        gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei")
      });

      const receipt = await tx.wait();
      console.log(chalk.green(`Unwrap berhasil! TX: ${receipt.transactionHash}`));
      
      // Check ETH balance after unwrap
      const ethBalance = await wallet.getBalance();
      console.log(chalk.grey(`Saldo ETH: ${ethers.utils.formatEther(ethBalance)}`));
      return wethBalance;
    }
    return ethers.constants.Zero;
  } catch (error) {
    console.log(chalk.red(`Gagal unwrap: ${error.message}`));
    console.log(chalk.yellow("Coba ulang dalam 5 detik..."));
    await sleep(5000);
    return await unwrapWETH(wallet);
  }
}

async function unwrapAllExistingWETH(wallet) {
  try {
    console.log(chalk.yellow("\nMemeriksa WETH yang sudah ada..."));
    const wethContract = new ethers.Contract(CONFIG.WETH_ADDRESS, ABI.WETH, wallet);
    const wethBalance = await wethContract.balanceOf(wallet.address);
    
    if (wethBalance.gt(0)) {
      console.log(chalk.yellow(`Ditemukan WETH existing: ${ethers.utils.formatEther(wethBalance)}`));
      return await unwrapWETH(wallet);
    }
    return ethers.constants.Zero;
  } catch (error) {
    console.log(chalk.red(`Gagal unwrap existing WETH: ${error.message}`));
    return ethers.constants.Zero;
  }
}

async function executeSwap(wallet, fromTokenAddress, toTokenAddress, amountIn, decimals) {
  try {
    const router = new ethers.Contract(CONFIG.ROUTER_ADDRESS, ABI.ROUTER, wallet);
    const tokenContract = new ethers.Contract(fromTokenAddress, ABI.ERC20, wallet);

    // Approve
    const allowance = await tokenContract.allowance(wallet.address, CONFIG.ROUTER_ADDRESS);
    if (allowance.lt(amountIn)) {
      console.log(chalk.yellow("Melakukan approve..."));
      const approveTx = await tokenContract.approve(
        CONFIG.ROUTER_ADDRESS,
        ethers.constants.MaxUint256,
        { gasLimit: 200000, gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei") }
      );
      await approveTx.wait();
    }

    // Proses swap
    const path = [fromTokenAddress, toTokenAddress];
    const amounts = await router.getAmountsOut(amountIn, path);
    const minAmount = amounts[1].sub(amounts[1].mul(CONFIG.SLIPPAGE).div(100));

    const deadline = Math.floor(Date.now() / 1000) + 600;
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      minAmount,
      path,
      wallet.address,
      deadline,
      {
        gasLimit: CONFIG.GAS_LIMIT,
        gasPrice: ethers.utils.parseUnits(CONFIG.GAS_PRICE, "gwei")
      }
    );

    const receipt = await tx.wait();
    return { success: true, hash: receipt.transactionHash, amount: amountIn };
  } catch (error) {
    console.log(chalk.red(`Error: ${error.message}`));
    return { success: false, amount: ethers.constants.Zero };
  }
}

// #################### COOLDOWN MANAGEMENT ####################
function getCooldownFilePath() {
  return path.join(__dirname, "cooldown.json");
}

function checkCooldown() {
  const cooldownFile = getCooldownFilePath();
  if (fs.existsSync(cooldownFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(cooldownFile, "utf8"));
      const lastRunTime = new Date(data.timestamp);
      const currentTime = new Date();
      const hoursPassed = (currentTime - lastRunTime) / (1000 * 60 * 60);
      
      if (hoursPassed < CONFIG.COOLDOWN_HOURS) {
        const hoursLeft = CONFIG.COOLDOWN_HOURS - hoursPassed;
        console.log(chalk.yellow(
          `\n[COOLDOWN AKTIF] Terakhir dijalankan: ${lastRunTime.toLocaleString()}`
        ));
        console.log(chalk.yellow(
          `Silakan tunggu ${hoursLeft.toFixed(2)} jam lagi sebelum menjalankan lagi.`
        ));
        return true;
      }
    } catch (e) {
      console.error(chalk.red("Error reading cooldown file:"), e.message);
    }
  }
  return false;
}

function updateCooldown() {
  const cooldownFile = getCooldownFilePath();
  const data = {
    timestamp: new Date().toISOString(),
    message: `Cooldown ${CONFIG.COOLDOWN_HOURS} jam setelah operasi`
  };
  fs.writeFileSync(cooldownFile, JSON.stringify(data, null, 2));
  console.log(chalk.green(
    `\nCooldown 48 jam dimulai sekarang. Script tidak dapat dijalankan lagi sampai cooldown selesai.`
  ));
}

// #################### MAIN EXECUTION ####################
async function main() {
  console.clear();
  console.log(chalk.green(`
###################################################
     AJSPRO Auto-Swap + Unwrap (ETH ONLY)
###################################################`));

  // Cek cooldown untuk semua mode
  if (checkCooldown()) {
    return;
  }

  const { pk, tokens } = await loadData();
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, CONFIG.CHAIN_ID);

  // Pilihan mode
  const modeAnswer = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: "Pilih mode operasi:",
      choices: [
        { name: "Swap (swap token ke WETH)", value: "swap" },
        { name: "Unwrap (unwrap WETH ke ETH)", value: "unwrap" },
        { name: "Swap + Unwrap (swap+Unwarp WETH to ETH)", value: "swap+unwrap" }
      ]
    }
  ]);

  let operationPerformed = false;

  for (const [index, privateKey] of pk.entries()) {
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(chalk.blue(`\n[Wallet ${index + 1}/${pk.length}] ${wallet.address}`));

    try {
      switch (modeAnswer.mode) {
        case "swap":
          // Hanya swap token ke WETH
          for (const token of tokens) {
            const tokenInfo = await getTokenInfo(wallet, token.address);
            if (tokenInfo.balance.isZero()) {
              console.log(chalk.yellow(`Saldo ${token.name} kosong, dilewati.`));
              continue;
            }
            
            const amountIn = tokenInfo.balance.div(2);
            console.log(chalk.cyan(`Swap 50% ${token.name} ke WETH...`));
            
            const result = await executeSwap(
              wallet,
              token.address,
              CONFIG.WETH_ADDRESS,
              amountIn,
              tokenInfo.decimals
            );
            
            if (result.success) {
              console.log(chalk.green(`Swap berhasil! TX: ${result.hash}`));
              operationPerformed = true;
            }
            await sleep(5000);
          }
          break;
          
        case "unwrap":
          // Hanya unwrap WETH ke ETH
          const unwrappedAmount = await unwrapAllExistingWETH(wallet);
          if (!unwrappedAmount.isZero()) {
            operationPerformed = true;
          }
          break;
          
        case "swap+unwrap":
          // Swap token ke WETH
          for (const token of tokens) {
            const tokenInfo = await getTokenInfo(wallet, token.address);
            if (tokenInfo.balance.isZero()) {
              console.log(chalk.yellow(`Saldo ${token.name} kosong, dilewati.`));
              continue;
            }
            
            const amountIn = tokenInfo.balance.div(2);
            console.log(chalk.cyan(`Swap 50% ${token.name} ke WETH...`));
            
            const result = await executeSwap(
              wallet,
              token.address,
              CONFIG.WETH_ADDRESS,
              amountIn,
              tokenInfo.decimals
            );
            
            if (result.success) {
              console.log(chalk.green(`Swap berhasil! TX: ${result.hash}`));
              operationPerformed = true;
            }
            await sleep(5000);
          }
          
          // Unwrap semua WETH (termasuk yang baru di-swap)
          const unwrappedAfterSwap = await unwrapAllExistingWETH(wallet);
          if (!unwrappedAfterSwap.isZero()) {
            operationPerformed = true;
          }
          break;
      }
    } catch (error) {
      console.log(chalk.red(`Error utama: ${error.message}`));
    }
  }

  // Update cooldown hanya jika ada operasi yang dilakukan
  if (operationPerformed) {
    updateCooldown();
  } else {
    console.log(chalk.yellow("\nTidak ada operasi yang dilakukan. Cooldown tidak diaktifkan."));
  }
}

main().catch(console.error);