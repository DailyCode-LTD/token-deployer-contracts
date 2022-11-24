// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

import "./interfaces/IERC173.sol";

contract Ownable is IERC173 {
    address private _owner;

    constructor() {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function transferOwnership(address newOwner_) external virtual {
        _transferOwnership(newOwner_);
    }

    function _transferOwnership(address newOwner_) internal onlyOwner {
        emit OwnershipTransferred(_owner, newOwner_);
        _owner = newOwner_;
    }
}
