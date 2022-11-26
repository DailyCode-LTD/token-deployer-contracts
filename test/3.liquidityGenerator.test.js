const { expect } = require("chai");

const NAME = "LiquidityGenerator";
const SYMBOL = "LGT";
const DECIMALS = 18n;
const INITIAL_SUPPLY = 1_000_000n * 10n ** DECIMALS;

const AUTO_LP_TAX = {
  onBuy: 1n,
  onSell: 2n,
  onTransfer: 3n,
};

const AUTO_LP_TAX_1 = {
  onBuy: 2n,
  onSell: 4n,
  onTransfer: 6n,
};

const MARKETING_TAX = {
  onBuy: 1n,
  onSell: 2n,
  onTransfer: 3n,
};

const MARKETING_TAX_1 = {
  onBuy: 2n,
  onSell: 4n,
  onTransfer: 6n,
};

const weth = require("@uniswap/v2-periphery/build/WETH9.json");
const uniswapFactory = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const uniswapRouter = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");
const { ethers } = require("hardhat");

describe("LiquidityGenrator ETH", function () {
  const artifacts = ["FixedSupplyLPGenerator", "MintableLPGenerator"];
  for (let i = 0; i < artifacts.length; i++) {
    it("should deploy uniswap ", async function () {
      const [owner] = await ethers.getSigners();
      const UniswapV2Factory = await ethers.getContractFactory(
        uniswapFactory.abi,
        uniswapFactory.bytecode
      );
      this.factory = await UniswapV2Factory.deploy(owner.address);
      await this.factory.deployed();

      const WETH9 = await ethers.getContractFactory(weth.abi, weth.bytecode);
      this.weth = await WETH9.deploy();
      await this.weth.deployed();

      const UniswapV2Router02 = await ethers.getContractFactory(
        uniswapRouter.abi,
        uniswapRouter.bytecode
      );

      this.router = await UniswapV2Router02.deploy(
        this.factory.address,
        this.weth.address
      );
      await this.router.deployed();
    });

    it("should deploy correctly", async function () {
      const [owner, lpReceipient, marketing] = await ethers.getSigners();

      const LiquidityGenerator = await ethers.getContractFactory(artifacts[i]);
      this.liquidityGenerator = await LiquidityGenerator.deploy(
        NAME,
        SYMBOL,
        DECIMALS,
        INITIAL_SUPPLY,
        this.router.address,
        this.weth.address,
        { ...AUTO_LP_TAX, recipient: lpReceipient.address },
        { ...MARKETING_TAX, recipient: marketing.address }
      );
      await this.liquidityGenerator.deployed();
    });

    /*  Simple erc tests */
    it("should have the right name", async function () {
      expect(await this.liquidityGenerator.name()).to.equal(NAME);
    });

    it("should have the right symbol", async function () {
      expect(await this.liquidityGenerator.symbol()).to.equal(SYMBOL);
    });

    it("should have the right decimals", async function () {
      expect(await this.liquidityGenerator.decimals()).to.equal(DECIMALS);
    });

    it("should have the right total supply", async function () {
      expect(await this.liquidityGenerator.totalSupply()).to.equal(
        INITIAL_SUPPLY
      );
    });

    it("should have the right factory address", async function () {
      expect(await this.liquidityGenerator.factory()).to.equal(
        this.factory.address
      );
    });

    it("should have the right router address", async function () {
      expect(await this.liquidityGenerator.router()).to.equal(
        this.router.address
      );
    });

    it("should have the default pair token address", async function () {
      expect(await this.liquidityGenerator.defaultPairToken()).to.equal(
        this.weth.address
      );
    });

    it("should have isWETH === true", async function () {
      expect(await this.liquidityGenerator.isWETH()).to.equal(true);
    });

    it("should set the right lpPair", async function () {
      const lpPair = await this.factory.getPair(
        this.weth.address,
        this.liquidityGenerator.address
      );

      this.lpPairAddress = lpPair;

      expect(await this.liquidityGenerator.lpPair()).to.equal(lpPair);
    });

    it("Should have the right autoLPTax", async function () {
      const [owner, lpReceipient, marketing] = await ethers.getSigners();
      const autoLpTax = await this.liquidityGenerator.autoLiquidityTax();

      expect(autoLpTax.onBuy).to.equal(AUTO_LP_TAX.onBuy);
      expect(autoLpTax.onSell).to.equal(AUTO_LP_TAX.onSell);
      expect(autoLpTax.onTransfer).to.equal(AUTO_LP_TAX.onTransfer);
      expect(autoLpTax.recipient).to.equal(lpReceipient.address);
    });

    it("should have the right marketing tax", async function () {
      const [owner, lpReceipient, marketing] = await ethers.getSigners();
      const marketingTax = await this.liquidityGenerator.marketingTax();

      expect(marketingTax.onBuy).to.equal(MARKETING_TAX.onBuy);
      expect(marketingTax.onSell).to.equal(MARKETING_TAX.onSell);
      expect(marketingTax.onTransfer).to.equal(MARKETING_TAX.onTransfer);
      expect(marketingTax.recipient).to.equal(marketing.address);
    });

    it("should fail to change autoLP Tax by non owner", async function () {
      const [owner, addr1] = await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(addr1).setAutoLiquidityTax(1n, 1n, 1n)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(
        this.liquidityGenerator.connect(addr1).setMarketingTax(1n, 1n, 1n)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should fail when onBuy is > 20", async function () {
      const [owner] = await ethers.getSigners();
      await expect(
        this.liquidityGenerator.setAutoLiquidityTax(21n, 1n, 1n)
      ).to.be.revertedWith("LiquidityGeneratorERC20: onBuy_ > 20%");
      await expect(
        this.liquidityGenerator.setMarketingTax(21n, 1n, 1n)
      ).to.be.revertedWith("LiquidityGeneratorERC20: onBuy_ > 20%");
    });

    it("should fail when onSell is > 20", async function () {
      const [owner] = await ethers.getSigners();
      await expect(
        this.liquidityGenerator.setAutoLiquidityTax(1n, 21n, 1n)
      ).to.be.revertedWith("LiquidityGeneratorERC20: onSell_ > 20%");
      await expect(
        this.liquidityGenerator.setMarketingTax(1n, 21n, 1n)
      ).to.be.revertedWith("LiquidityGeneratorERC20: onSell_ > 20%");
    });

    it("should fail when onTransfer is > 20", async function () {
      const [owner] = await ethers.getSigners();
      await expect(
        this.liquidityGenerator.setAutoLiquidityTax(1n, 1n, 21n)
      ).to.be.revertedWith("LiquidityGeneratorERC20: onTransfer_ > 20%");
      await expect(
        this.liquidityGenerator.setMarketingTax(1n, 1n, 21n)
      ).to.be.revertedWith("LiquidityGeneratorERC20: onTransfer_ > 20%");
    });

    it("should change autoLP Tax", async function () {
      const [owner] = await ethers.getSigners();
      await this.liquidityGenerator.setAutoLiquidityTax(
        AUTO_LP_TAX_1.onBuy,
        AUTO_LP_TAX_1.onSell,
        AUTO_LP_TAX_1.onTransfer
      );
      const tax = await this.liquidityGenerator.autoLiquidityTax();
      expect(tax.onSell).to.equal(AUTO_LP_TAX_1.onSell);
      expect(tax.onBuy).to.equal(AUTO_LP_TAX_1.onBuy);
      expect(tax.onTransfer).to.equal(AUTO_LP_TAX_1.onTransfer);

      await this.liquidityGenerator.setMarketingTax(
        MARKETING_TAX_1.onBuy,
        MARKETING_TAX_1.onSell,
        MARKETING_TAX_1.onTransfer
      );
      const marketingTax = await this.liquidityGenerator.marketingTax();
      expect(marketingTax.onSell).to.equal(MARKETING_TAX_1.onSell);
      expect(marketingTax.onBuy).to.equal(MARKETING_TAX_1.onBuy);
      expect(marketingTax.onTransfer).to.equal(MARKETING_TAX_1.onTransfer);
    });

    it("should fail to change autoLP Receiver if called by non owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).setAutoLpReceiver(bob.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should fail when trying to set the autoLP receiver to address zero", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.setAutoLpReceiver(ethers.constants.AddressZero)
      ).to.be.revertedWith("!zero address");
    });

    it("should change autoLP Receiver", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol] =
        await ethers.getSigners();
      await this.liquidityGenerator.setAutoLpReceiver(bob.address);
      const tax = await this.liquidityGenerator.autoLiquidityTax();
      expect(tax.recipient).to.equal(bob.address);
      await this.liquidityGenerator.setAutoLpReceiver(lpReceipient.address);
    });

    it("should fail to change marketing Receiver by non owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).setMarketingReceiver(bob.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should fail to set marketing receiver to address zero", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.setMarketingReceiver(
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("!zero address");
    });

    it("should change marketing Receiver", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol] =
        await ethers.getSigners();
      await this.liquidityGenerator.setMarketingReceiver(bob.address);
      const tax = await this.liquidityGenerator.marketingTax();
      expect(tax.recipient).to.equal(bob.address);
      await this.liquidityGenerator.setMarketingReceiver(marketing.address);
    });

    it("should fail to add a new pair by owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).addPair(fakePair.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should add a pair when called by owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await this.liquidityGenerator.addPair(fakePair.address);
      expect(await this.liquidityGenerator.isLpPair(fakePair.address)).to.equal(
        true
      );
    });

    it("should fail to remove pair by non owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).removePair(fakePair.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("shoud remove a pair when called by owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await this.liquidityGenerator.removePair(fakePair.address);
      expect(await this.liquidityGenerator.isLpPair(fakePair.address)).to.equal(
        false
      );
    });

    it("should fail to set autoLP threshold if called by non owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).setswapThreshold(1)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it(" should change the threshold if called by owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await this.liquidityGenerator.setswapThreshold(2n * 10n ** DECIMALS);
      expect(await this.liquidityGenerator.swapThreshold()).to.equal(
        2n * 10n ** DECIMALS
      );
    });

    it("should transfer and take no tax", async function () {
      const [
        owner,
        lpReceipient,
        marketing,
        alice,
        bob,
        carol,
        fakePair,
        nonExempt,
      ] = await ethers.getSigners();
      const amount = 10000n * 10n ** DECIMALS;

      await this.liquidityGenerator.transfer(nonExempt.address, amount * 2n);
      await this.liquidityGenerator
        .connect(nonExempt)
        .transfer(alice.address, amount);

      expect(await this.liquidityGenerator.balanceOf(alice.address)).to.equal(
        amount
      );

      await this.liquidityGenerator
        .connect(nonExempt)
        .approve(bob.address, amount);
      await this.liquidityGenerator
        .connect(bob)
        .transferFrom(nonExempt.address, bob.address, amount);

      expect(await this.liquidityGenerator.balanceOf(bob.address)).to.equal(
        amount
      );
    });

    it("should create LP ", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();

      await this.liquidityGenerator.approve(
        this.router.address,
        1000n * 10n ** DECIMALS
      );

      // create ETH LP
      await this.router.addLiquidityETH(
        this.liquidityGenerator.address,
        1000n * 10n ** DECIMALS,
        0,
        0,
        owner.address,
        ethers.constants.MaxUint256,
        { value: 1n * 10n ** DECIMALS }
      );

      const balanceOFLP = await this.liquidityGenerator.balanceOf(
        this.lpPairAddress
      );
      expect(balanceOFLP).to.equal(1000n * 10n ** DECIMALS);

      const ERC20Factory = await ethers.getContractFactory("SimpleERC20");

      this.lpPair = ERC20Factory.attach(this.lpPairAddress);

      const balanceOfLpPair = await this.lpPair.balanceOf(owner.address);
      expect(balanceOfLpPair).to.greaterThan(0);
    });

    it("should failt to enable tax by non owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).setTaxEnabled(true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should enable and disable tax when called by owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await this.liquidityGenerator.setTaxEnabled(true);
      expect(await this.liquidityGenerator.taxEnabled()).to.equal(true);
      await this.liquidityGenerator.setTaxEnabled(false);
      expect(await this.liquidityGenerator.taxEnabled()).to.equal(false);
    });

    it("should fail to disable swap by non owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).setSwapEnabled(true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should enable and disable swap if called by owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await this.liquidityGenerator.setSwapEnabled(true);
      expect(await this.liquidityGenerator.swapEnabled()).to.equal(true);
      await this.liquidityGenerator.setSwapEnabled(false);
      expect(await this.liquidityGenerator.swapEnabled()).to.equal(false);
    });

    it("should comply to taxes on transfer ", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      const amount = 1000n * 10n ** DECIMALS;

      // expect marketing to be the marketingTax recipient
      const mt = await this.liquidityGenerator.marketingTax();
      expect(mt.recipient).to.equal(marketing.address);

      // enable tax
      await this.liquidityGenerator.setTaxEnabled(true);
      await this.liquidityGenerator.setSwapEnabled(true);

      const ethBalanceOfMarketingBefore = await ethers.provider.getBalance(
        marketing.address
      );

      await this.liquidityGenerator
        .connect(alice)
        .transfer(carol.address, amount);

      const balanceOfCarol = await this.liquidityGenerator.balanceOf(
        carol.address
      );
      const autoLPTax = (amount * AUTO_LP_TAX_1.onTransfer) / 100n;
      const marketingTax = (amount * MARKETING_TAX_1.onTransfer) / 100n;
      expect(balanceOfCarol).to.equal(amount - autoLPTax - marketingTax);

      // get eth balance of marketing
      const ethBalanceOfMarketing = await ethers.provider.getBalance(
        marketing.address
      );

      expect(ethBalanceOfMarketing).to.be.greaterThan(
        ethBalanceOfMarketingBefore
      );
      expect(
        await this.lpPair.balanceOf(lpReceipient.address)
      ).to.be.greaterThan(0);
    });

    it("should comply to taxes on transferFrom ", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      const amount = 1000n * 10n ** DECIMALS;
      const ethBalanceOfMarketingBefore = await ethers.provider.getBalance(
        marketing.address
      );
      const carolBalanceBefore = await this.liquidityGenerator.balanceOf(
        carol.address
      );
      const lpBalanceBefore = await this.lpPair.balanceOf(lpReceipient.address);
      // approve bob to spend from alice
      await this.liquidityGenerator.connect(alice).approve(bob.address, amount);
      // tranfer from alice by bob
      await this.liquidityGenerator
        .connect(bob)
        .transferFrom(alice.address, carol.address, amount);
      const carolBalanceAfter = await this.liquidityGenerator.balanceOf(
        carol.address
      );
      const autoLPTax = (amount * AUTO_LP_TAX_1.onTransfer) / 100n;
      const marketingTax = (amount * MARKETING_TAX_1.onTransfer) / 100n;
      expect(carolBalanceAfter).to.equal(
        carolBalanceBefore.toBigInt() + amount - autoLPTax - marketingTax
      );
      // get eth balance of marketing
      const ethBalanceOfMarketing = await ethers.provider.getBalance(
        marketing.address
      );
      expect(ethBalanceOfMarketing).to.be.greaterThan(
        ethBalanceOfMarketingBefore
      );

      expect(
        await this.lpPair.balanceOf(lpReceipient.address)
      ).to.be.greaterThan(lpBalanceBefore);

      // autoLpReserve should be 0
      expect(await this.liquidityGenerator.autoLPReserves()).to.equal(0n);
      // marktingReserve should be 0
      expect(await this.liquidityGenerator.marketingReserves()).to.equal(0n);
    });

    it("should comply to taxed when buying", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();

      const balanceOFAliceBefore = await this.liquidityGenerator.balanceOf(
        alice.address
      );

      const balanceOfLpPair = await this.liquidityGenerator.balanceOf(
        this.lpPairAddress
      );

      // buy 0.1 eth worth on token
      await this.router
        .connect(alice)
        .swapExactETHForTokensSupportingFeeOnTransferTokens(
          0,
          [this.weth.address, this.liquidityGenerator.address],
          alice.address,
          ethers.constants.MaxUint256,
          {
            value: ethers.utils.parseEther("0.01"),
          }
        );
      let out = balanceOfLpPair.sub(
        await this.liquidityGenerator.balanceOf(this.lpPairAddress)
      );

      const balanceOFAliceAfter = await this.liquidityGenerator.balanceOf(
        alice.address
      );
      const lpTax = (out.toBigInt() * AUTO_LP_TAX_1.onBuy) / 100n;
      const marketingTax = (out.toBigInt() * MARKETING_TAX_1.onBuy) / 100n;
      expect(balanceOFAliceAfter).to.equal(
        balanceOFAliceBefore.toBigInt() + out.toBigInt() - lpTax - marketingTax
      );

      expect(await this.liquidityGenerator.autoLPReserves()).equal(lpTax);
      expect(await this.liquidityGenerator.marketingReserves()).equal(
        marketingTax
      );
      this.lpReservers = lpTax;
      this.marketingReservers = marketingTax;
    });

    it("should comply to taxed when selling", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      const amount = 1000n * 10n ** DECIMALS;

      const balanceOFLpPAirBefore = await this.liquidityGenerator.balanceOf(
        this.lpPairAddress
      );

      await this.liquidityGenerator
        .connect(alice)
        .approve(this.router.address, amount);

      // sell 1000 token
      await this.router
        .connect(alice)
        .swapExactTokensForETHSupportingFeeOnTransferTokens(
          amount,
          0,
          [this.liquidityGenerator.address, this.weth.address],
          alice.address,
          ethers.constants.MaxUint256
        );

      const balanceOFLpPAirAfter = await this.liquidityGenerator.balanceOf(
        this.lpPairAddress
      );
      const autoLiquidityTax = (amount * AUTO_LP_TAX_1.onSell) / 100n;
      const marketingTax = (amount * MARKETING_TAX_1.onSell) / 100n;

      expect(balanceOFLpPAirAfter).to.equal(
        balanceOFLpPAirBefore.toBigInt() +
          amount -
          autoLiquidityTax -
          marketingTax
      );

      expect(await this.liquidityGenerator.autoLPReserves()).equal(
        this.lpReservers + autoLiquidityTax
      );
      expect(await this.liquidityGenerator.marketingReserves()).equal(
        this.marketingReservers + marketingTax
      );
    });

    it("should fail to transfer ownership by non owner", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).transferOwnership(bob.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should fail to transfer ownership to zero address", async function () {
      const [owner, lpReceipient, marketing, alice, bob, carol, fakePair] =
        await ethers.getSigners();
      await expect(
        this.liquidityGenerator
          .connect(owner)
          .transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWith("Ownable: new owner is the zero address");
    });

    it("should transfer ownership to newOwner", async function () {
      const [
        owner,
        lpReceipient,
        marketing,
        alice,
        bob,
        carol,
        fakePair,
        newOwner,
      ] = await ethers.getSigners();
      await this.liquidityGenerator.transferOwnership(newOwner.address);
      expect(await this.liquidityGenerator.owner()).to.equal(newOwner.address);
      const isExemptNewOwner = await this.liquidityGenerator.isExcludedFromTax(
        newOwner.address
      );
      const isExemptOwner = await this.liquidityGenerator.isExcludedFromTax(
        owner.address
      );

      expect(isExemptNewOwner.from).to.equal(true);
      expect(isExemptNewOwner.to).to.equal(false);
      expect(isExemptOwner.to).to.equal(false);
      expect(isExemptOwner.from).to.equal(false);

      await this.liquidityGenerator
        .connect(newOwner)
        .transferOwnership(owner.address);
    });

    it("should fail tyo exempt from tax if called by non owner", async function () {
      const [
        owner,
        lpReceipient,
        marketing,
        alice,
        bob,
        carol,
        fakePair,
        newOwner,
      ] = await ethers.getSigners();
      await expect(
        this.liquidityGenerator
          .connect(alice)
          .setTaxExempt(alice.address, true, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should fail to change exempt status of the token it self", async function () {
      const [
        owner,
        lpReceipient,
        marketing,
        alice,
        bob,
        carol,
        fakePair,
        newOwner,
      ] = await ethers.getSigners();
      await expect(
        this.liquidityGenerator.setTaxExempt(
          this.liquidityGenerator.address,
          false,
          true
        )
      ).to.be.revertedWith("can't change this contract");
    });

    it("should exempt from tax if called by owner", async function () {
      const [
        owner,
        lpReceipient,
        marketing,
        alice,
        bob,
        carol,
        fakePair,
        newOwner,
      ] = await ethers.getSigners();
      await this.liquidityGenerator
        .connect(owner)
        .setTaxExempt(alice.address, true, true);
      let isExempt = await this.liquidityGenerator.isExcludedFromTax(
        alice.address
      );
      expect(isExempt.from).to.equal(true);
      expect(isExempt.to).to.equal(true);

      await this.liquidityGenerator
        .connect(owner)
        .setTaxExempt(alice.address, true, false);
      isExempt = await this.liquidityGenerator.isExcludedFromTax(alice.address);
      expect(isExempt.from).to.equal(true);
      expect(isExempt.to).to.equal(false);

      await this.liquidityGenerator
        .connect(owner)
        .setTaxExempt(alice.address, false, true);
      isExempt = await this.liquidityGenerator.isExcludedFromTax(alice.address);
      expect(isExempt.from).to.equal(false);
      expect(isExempt.to).to.equal(true);

      await this.liquidityGenerator
        .connect(owner)
        .setTaxExempt(alice.address, false, false);
      isExempt = await this.liquidityGenerator.isExcludedFromTax(alice.address);
      expect(isExempt.from).to.equal(false);
      expect(isExempt.to).to.equal(false);
    });

    it("should fail when non owner calls swap and liquify", async function () {
      const [
        owner,
        lpReceipient,
        marketing,
        alice,
        bob,
        carol,
        fakePair,
        newOwner,
      ] = await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).swapAndLiquify()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should swap and liquify when called by owner", async function () {
      const [
        owner,
        lpReceipient,
        marketing,
        alice,
        bob,
        carol,
        fakePair,
        newOwner,
      ] = await ethers.getSigners();

      await this.liquidityGenerator.swapAndLiquify();

      expect(await this.liquidityGenerator.autoLPReserves()).equal(0);
    });

    it("should fail to swap marketing by non owner", async function () {
      const [
        owner,
        lpReceipient,
        marketing,
        alice,
        bob,
        carol,
        fakePair,
        newOwner,
      ] = await ethers.getSigners();
      await expect(
        this.liquidityGenerator.connect(alice).swapMarketing()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should swap marketing by owner", async function () {
      const [
        owner,
        lpReceipient,
        marketing,
        alice,
        bob,
        carol,
        fakePair,
        newOwner,
      ] = await ethers.getSigners();
      await this.liquidityGenerator.swapMarketing();
      expect(await this.liquidityGenerator.marketingReserves()).equal(0);
    });
  }
});
