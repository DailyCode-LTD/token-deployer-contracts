// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

import "./SimpleERC20.sol";
import "./Ownable.sol";

contract MintableERC20 is SimpleERC20, Ownable {
    mapping(address => bool) private _minters;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initalSupply_
    ) SimpleERC20(name_, symbol_, decimals_, initalSupply_) {
        _minters[msg.sender] = true;
    }

    function burn(uint256 amount_) external {
        _burn(msg.sender, amount_);
    }

    function mint(address to_, uint256 amount_) external {
        require(_minters[msg.sender], "MintableERC20: caller is not a minter");
        _mint(to_, amount_);
    }

    /**
     * @dev Add a new minter
     * @param minterToAdd_ The address of the minter
     */
    function addMinter(address minterToAdd_) external onlyOwner {
        _minters[minterToAdd_] = true;
    }

    /**
     * @dev Remove a minter
     * @param minterToBeRemoved_ The address of the minter
     */
    function removeMinter(address minterToBeRemoved_) external onlyOwner {
        _minters[minterToBeRemoved_] = false;
    }

    function isMinter(address potentialMinter_) external view returns (bool) {
        return _minters[potentialMinter_];
    }

    function transferOwnership(address newOwner_) external virtual override {
        _transferOwnership(newOwner_);
    }

    function _transferOwnership(address newOwner_) internal virtual override {
        _minters[newOwner_] = true;
        _minters[owner()] = false;
        super._transferOwnership(newOwner_);
    }
}
