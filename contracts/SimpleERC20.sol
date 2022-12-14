// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

contract SimpleERC20 {
    string private _name;
    string private _symbol;

    uint8 public immutable decimals;

    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    // user => spender => amountAllowed
    mapping(address => mapping(address => uint256)) _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(
        address indexed owner,
        address indexed pender,
        uint256 value
    );

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_
    ) {
        _name = name_;
        _symbol = symbol_;
        decimals = decimals_;
        _mint(msg.sender, initialSupply_);
    }

    function _burn(address user_, uint256 amount_) internal {
        require(
            _balances[user_] >= amount_,
            "SimpleERC20: burn amount exceeds balance"
        );
        unchecked {
            _balances[user_] -= amount_;
            _totalSupply -= amount_;
        }
        emit Transfer(user_, address(0), amount_);
    }

    function _mint(address to_, uint256 value_) internal {
        _totalSupply += value_;
        unchecked {
            _balances[to_] += value_;
        }
        emit Transfer(address(0), to_, value_);
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address owner_) public view returns (uint256) {
        return _balances[owner_];
    }

    function transfer(
        address to_,
        uint256 value_
    ) external virtual returns (bool) {
        return _transfer(msg.sender, to_, value_);
    }

    function _transfer(
        address from_,
        address to_,
        uint256 value_
    ) internal returns (bool) {
        require(_balances[from_] >= value_, "insuficient balance");
        require(to_ != address(0), "no address zero");

        unchecked {
            _balances[from_] -= value_;
        }
        _balances[to_] += value_;

        emit Transfer(from_, to_, value_);

        return true;
    }

    function approve(address spender_, uint256 value_) external returns (bool) {
        return _approve(msg.sender, spender_, value_);
    }

    function _approve(
        address owner_,
        address spender_,
        uint256 value_
    ) internal returns (bool) {
        _allowances[owner_][spender_] = value_;
        emit Approval(owner_, spender_, value_);
        return true;
    }

    function allowance(
        address owner_,
        address spender_
    ) external view returns (uint256) {
        return _allowances[owner_][spender_];
    }

    function _beforeTransferFrom(
        address spender_,
        address from_,
        uint256 value_
    ) internal {
        require(
            _allowances[from_][spender_] >= value_,
            "insuficient allowance"
        );
        unchecked {
            if (_allowances[from_][spender_] != type(uint256).max) {
                _allowances[from_][spender_] -= value_;
            }
        }
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 value_
    ) external virtual returns (bool) {
        // we check if sender is allowed to spend from_
        _beforeTransferFrom(msg.sender, from_, value_);

        return _transfer(from_, to_, value_);
    }
}
