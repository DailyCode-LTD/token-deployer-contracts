const { expect } = require("chai");

describe("Ownable", function () {
  it("should deploy correctly", async function () {
    const [owner] = await ethers.getSigners();

    const Ownable = await ethers.getContractFactory("Ownable");
    this.ownable = await Ownable.deploy();
    await this.ownable.deployed();
  });

  it("should have the right owner", async function () {
    const [owner] = await ethers.getSigners();
    expect(await this.ownable.owner()).to.equal(owner.address);
  });

  it("should fail to transfer ownership by non owner", async function () {
    const [owner, addr1] = await ethers.getSigners();

    await expect(
      this.ownable.connect(addr1).transferOwnership(addr1.address)
    ).to.revertedWith("Ownable: caller is not the owner");
  });

  it("should transfer ownership by owner", async function () {
    const [owner, addr1] = await ethers.getSigners();

    await expect(this.ownable.transferOwnership(addr1.address))
      .to.emit(this.ownable, "OwnershipTransferred")
      .withArgs(owner.address, addr1.address);

    expect(await this.ownable.owner()).to.equal(addr1.address);
  });
});
