const NAME = "SimpleERC20";
const SYMBOL = "SIM";
const DECIMALS = 18n;
const INITIAL_SUPPLY = 1_000_000n * 10n ** DECIMALS;
const ADDRESS_1_TRANSFER_AMOUNT = 1n * 10n ** DECIMALS;
const ADDRESS_1_APPROVATE = 100n * 10n ** DECIMALS;

const { expect } = require("chai");

describe("SimpleERC20", function () {
  it("should deploy with the right values", async function () {
    const [owner] = await ethers.getSigners();

    const SimpleERC20 = await ethers.getContractFactory("SimpleERC20");
    this.simpleERC20 = await SimpleERC20.deploy(
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY
    );
    await this.simpleERC20.deployed();
  });

  it("should have the right name", async function () {
    expect(await this.simpleERC20.name()).to.equal(NAME);
  });

  it("should have the right symbol", async function () {
    expect(await this.simpleERC20.symbol()).to.equal(SYMBOL);
  });

  it("should have the right decimals", async function () {
    expect(await this.simpleERC20.decimals()).to.equal(DECIMALS);
  });

  it("should have the right total supply", async function () {
    expect(await this.simpleERC20.totalSupply()).to.equal(INITIAL_SUPPLY);
  });

  it("should have the right balance of the owner", async function () {
    const [owner] = await ethers.getSigners();
    expect(await this.simpleERC20.balanceOf(owner.address)).to.equal(
      INITIAL_SUPPLY
    );
  });

  it("it should fail when transsfering to address zero ", async function () {
    const [owner, addr1] = await ethers.getSigners();
    await expect(
      this.simpleERC20.transfer(ethers.constants.AddressZero, 1)
    ).be.revertedWith("no address zero");
  });

  it("it should fail when transsfering more than balance ", async function () {
    const [owner, addr1] = await ethers.getSigners();
    await expect(
      this.simpleERC20.transfer(addr1.address, INITIAL_SUPPLY + 1n)
    ).be.revertedWith("insuficient balance");
  });

  it("shoud trigger Transfer event on successful transfer", async function () {
    const [owner, addr1] = await ethers.getSigners();
    await expect(
      this.simpleERC20.transfer(addr1.address, ADDRESS_1_TRANSFER_AMOUNT)
    )
      .to.emit(this.simpleERC20, "Transfer")
      .withArgs(owner.address, addr1.address, ADDRESS_1_TRANSFER_AMOUNT);
  });

  it("should have the right balance after transfer", async function () {
    const [owner, addr1] = await ethers.getSigners();
    expect(await this.simpleERC20.balanceOf(addr1.address)).to.equal(
      ADDRESS_1_TRANSFER_AMOUNT
    );
    expect(await this.simpleERC20.balanceOf(owner.address)).to.equal(
      INITIAL_SUPPLY - ADDRESS_1_TRANSFER_AMOUNT
    );
  });

  it("should approve address1 to spend 100 tokens", async function () {
    const [owner, addr1] = await ethers.getSigners();
    await expect(this.simpleERC20.approve(addr1.address, ADDRESS_1_APPROVATE))
      .to.emit(this.simpleERC20, "Approval")
      .withArgs(owner.address, addr1.address, ADDRESS_1_APPROVATE);

    expect(
      await this.simpleERC20.allowance(owner.address, addr1.address)
    ).to.equal(ADDRESS_1_APPROVATE);
  });

  it("should fail when address1 tries to transfer more than approved", async function () {
    const [owner, addr1] = await ethers.getSigners();
    await expect(
      this.simpleERC20
        .connect(addr1)
        .transferFrom(owner.address, addr1.address, ADDRESS_1_APPROVATE + 1n)
    ).be.revertedWith("insuficient allowance");
  });

  it("should fail when address1 tries to transfer to address zero", async function () {
    const [owner, addr1] = await ethers.getSigners();
    await expect(
      this.simpleERC20
        .connect(addr1)
        .transferFrom(
          owner.address,
          ethers.constants.AddressZero,
          ADDRESS_1_APPROVATE
        )
    ).be.revertedWith("no address zero");
  });

  it("should transfer from owner to address1", async function () {
    const [owner, addr1, address2] = await ethers.getSigners();
    await expect(
      this.simpleERC20
        .connect(addr1)
        .transferFrom(owner.address, address2.address, ADDRESS_1_APPROVATE)
    )
      .to.emit(this.simpleERC20, "Transfer")
      .withArgs(owner.address, address2.address, ADDRESS_1_APPROVATE);
    // expect the balacne of address2 to be ADDRESS_1_APPROVATE
    expect(await this.simpleERC20.balanceOf(address2.address)).to.equal(
      ADDRESS_1_APPROVATE
    );
    // expect the allowance of address1 to be 0
    expect(
      await this.simpleERC20.allowance(owner.address, addr1.address)
    ).to.equal(0n);
    // expect the balance of owner to be INITIAL_SUPPLY - ADDRESS_1_APPROVATE - ADDRESS_1_TRANSFER_AMOUNT
    expect(await this.simpleERC20.balanceOf(owner.address)).to.equal(
      INITIAL_SUPPLY - ADDRESS_1_APPROVATE - ADDRESS_1_TRANSFER_AMOUNT
    );
  });

  it("should fail to transfer from more than the balance", async function () {
    const [owner, addr1, address2] = await ethers.getSigners();
    await this.simpleERC20
      .connect(addr1)
      .approve(address2.address, ADDRESS_1_TRANSFER_AMOUNT + 1n);
    await expect(
      this.simpleERC20
        .connect(address2)
        .transferFrom(
          addr1.address,
          owner.address,
          ADDRESS_1_TRANSFER_AMOUNT + 1n
        )
    ).be.revertedWith("insuficient balance");
  });

  it("should never reduce allowance when allowance is max uinbt256", async function () {
    const [owner, alice] = await ethers.getSigners();
    await this.simpleERC20.approve(alice.address, ethers.constants.MaxUint256);
    await this.simpleERC20
      .connect(alice)
      .transferFrom(owner.address, alice.address, 1n * 10n ** DECIMALS);
    expect(
      await this.simpleERC20.allowance(owner.address, alice.address)
    ).to.equal(ethers.constants.MaxUint256);
  });
});
