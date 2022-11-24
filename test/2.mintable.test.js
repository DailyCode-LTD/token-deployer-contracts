const { expect } = require("chai");

const NAME = "Mintable";
const SYMBOL = "MTK";
const DECIMALS = 18n;
const INITIAL_SUPPLY = 1_000_000n * 10n ** DECIMALS;

describe("MintableERC20", function () {
  it("should deploy correctly", async function () {
    const [owner] = await ethers.getSigners();

    const MintableERC20 = await ethers.getContractFactory("MintableERC20");
    this.mintableERC20 = await MintableERC20.deploy(
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY
    );
    await this.mintableERC20.deployed();
  });

  /*  Simple erc tests */
  it("should have the right name", async function () {
    expect(await this.mintableERC20.name()).to.equal(NAME);
  });

  it("should have the right symbol", async function () {
    expect(await this.mintableERC20.symbol()).to.equal(SYMBOL);
  });

  it("should have the right decimals", async function () {
    expect(await this.mintableERC20.decimals()).to.equal(DECIMALS);
  });

  it("should have the right total supply", async function () {
    expect(await this.mintableERC20.totalSupply()).to.equal(INITIAL_SUPPLY);
  });

  /* test the mintable functionalities */
  it("should fail to mint from non minter", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    await expect(
      this.mintableERC20.connect(alice).mint(bob.address, 1)
    ).be.revertedWith("MintableERC20: caller is not a minter");
  });

  it("owner should be a minter", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    expect(await this.mintableERC20.isMinter(owner.address)).to.equal(true);
  });

  it("should mint from minter", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    await expect(this.mintableERC20.mint(alice.address, 1n * 10n ** DECIMALS))
      .to.emit(this.mintableERC20, "Transfer")
      .withArgs(
        ethers.constants.AddressZero,
        alice.address,
        1n * 10n ** DECIMALS
      );

    expect(await this.mintableERC20.balanceOf(alice.address)).to.equal(
      1n * 10n ** DECIMALS
    );

    expect(await this.mintableERC20.totalSupply()).to.equal(
      INITIAL_SUPPLY + 1n * 10n ** DECIMALS
    );
  });

  it("should fail to add a minter by non owner", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    await expect(
      this.mintableERC20.connect(alice).addMinter(alice.address)
    ).be.revertedWith("Ownable: caller is not the owner");
  });

  it("should allow owner to add a minter", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    await this.mintableERC20.addMinter(alice.address);
    expect(await this.mintableERC20.isMinter(alice.address)).to.equal(true);
  });

  it("should fail to remove a minter by non owner", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    await expect(
      this.mintableERC20.connect(bob).removeMinter(alice.address)
    ).be.revertedWith("Ownable: caller is not the owner");
  });

  it("should allow owner to remove a minter", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    await this.mintableERC20.removeMinter(alice.address);
    expect(await this.mintableERC20.isMinter(alice.address)).to.equal(false);
  });

  it("should fail to burn more than thge balance", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    await expect(
      this.mintableERC20.connect(alice).burn(1n + 1n * 10n ** DECIMALS)
    ).be.revertedWith("SimpleERC20: burn amount exceeds balance");
  });

  it("should allow alice to burn her tokens", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    await expect(this.mintableERC20.connect(alice).burn(1n * 10n ** DECIMALS))
      .to.emit(this.mintableERC20, "Transfer")
      .withArgs(
        alice.address,
        ethers.constants.AddressZero,
        1n * 10n ** DECIMALS
      );
    expect(await this.mintableERC20.balanceOf(alice.address)).to.equal(0n);
    expect(await this.mintableERC20.totalSupply()).to.equal(INITIAL_SUPPLY);
  });

  it("should remove old owner from minter andsets the new owner as minter", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    await this.mintableERC20.transferOwnership(bob.address);
    expect(await this.mintableERC20.isMinter(owner.address)).to.equal(false);
    expect(await this.mintableERC20.isMinter(bob.address)).to.equal(true);
    expect(await this.mintableERC20.owner()).to.equal(bob.address);
  });
});
