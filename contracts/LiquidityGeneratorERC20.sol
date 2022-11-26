// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

import "./SimpleERC20.sol";
import "./Ownable.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/IRouter.sol";
import "./interfaces/IERC20.sol";
import "hardhat/console.sol";
import "./MintableERC20.sol";

abstract contract LiquidityGeneratorERC20 is SimpleERC20, Ownable {
    struct Tax {
        uint32 onBuy;
        uint32 onSell;
        uint32 onTransfer;
        address recipient;
    }

    bool public immutable isWETH;

    IFactory public immutable factory;
    IRouter public immutable router;
    IERC20 public immutable defaultPairToken;
    IERC20 public immutable lpPair;

    modifier acceptableTax(
        uint64 onBuy_,
        uint64 onSell_,
        uint64 onTransfer_
    ) {
        require(onBuy_ <= 20, "LiquidityGeneratorERC20: onBuy_ > 20%");
        require(onSell_ <= 20, "LiquidityGeneratorERC20: onSell_ > 20%");
        require(
            onTransfer_ <= 20,
            "LiquidityGeneratorERC20: onTransfer_ > 20%"
        );
        _;
    }

    Tax public autoLiquidityTax;
    uint256 public autoLPReserves;

    uint256 public swapThreshold;

    Tax public marketingTax;
    uint256 public marketingReserves;

    mapping(address => bool) public isLpPair;

    bool public taxEnabled; // when true no taxes are applied this token will behave just like a simple ERC20
    bool public swapEnabled; // when true the tax will be applied and added to the reserves but no swaps will happen

    struct TaxExempt {
        bool from;
        bool to;
    }
    mapping(address => TaxExempt) public isExcludedFromTax;

    SwapHelper public swapHelper;

    function setTaxExempt(
        address account,
        bool from,
        bool to
    ) external onlyOwner {
        require(account != address(this), "can't change this contract");
        isExcludedFromTax[account] = TaxExempt(from, to);
    }

    constructor(
        uint8 decimals_,
        IRouter router_,
        IERC20 defaultPairToken_,
        Tax memory autoLiquidityTax_,
        Tax memory marketingTax_
    ) {
        factory = IFactory(router_.factory());
        router = router_;

        defaultPairToken = defaultPairToken_;

        isWETH = defaultPairToken_ == IERC20(router_.WETH());

        lpPair = IERC20(
            factory.createPair(address(this), address(defaultPairToken_))
        );

        autoLiquidityTax = autoLiquidityTax_;
        marketingTax = marketingTax_;
        swapThreshold = 1 * 10 ** decimals_;
        isExcludedFromTax[address(this)] = TaxExempt(true, true);
        isExcludedFromTax[msg.sender] = TaxExempt(true, false);

        if (!isWETH) swapHelper = new SwapHelper();
    }

    receive() external payable {
        require(isWETH, "LiquidityGeneratorERC20: not WETH");
        require(msg.sender == address(router), "only Router allowed");
    }

    function transferOwnership(
        address newOwner_
    ) external virtual override onlyOwner {
        _transferOwnership(newOwner_);
    }

    function _transferOwnership(address newOwner_) internal virtual override {
        isExcludedFromTax[newOwner_] = TaxExempt(true, false);
        isExcludedFromTax[owner()] = TaxExempt(false, false);
        super._transferOwnership(newOwner_);
    }

    function setAutoLpReceiver(address receiver) external onlyOwner {
        require(receiver != address(0), "!zero address");
        autoLiquidityTax.recipient = receiver;
    }

    function setMarketingReceiver(address receiver) external onlyOwner {
        require(receiver != address(0), "!zero address");
        marketingTax.recipient = receiver;
    }

    function setAutoLiquidityTax(
        uint32 onBuy_,
        uint32 onSell_,
        uint32 onTransfer_
    ) external onlyOwner acceptableTax(onBuy_, onSell_, onTransfer_) {
        autoLiquidityTax = Tax(
            onBuy_,
            onSell_,
            onTransfer_,
            autoLiquidityTax.recipient
        );
    }

    function setMarketingTax(
        uint32 onBuy_,
        uint32 onSell_,
        uint32 onTransfer_
    ) external onlyOwner acceptableTax(onBuy_, onSell_, onTransfer_) {
        // capp tax at 20%
        marketingTax = Tax(
            onBuy_,
            onSell_,
            onTransfer_,
            marketingTax.recipient
        );
    }

    function transfer(
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        bool exempt = isExcludedFromTax[msg.sender].from ||
            isExcludedFromTax[recipient].to;
        if (taxEnabled && !exempt)
            _customTransfer(msg.sender, recipient, amount);
        else return _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 amount_
    ) public virtual override returns (bool) {
        bool exempt = isExcludedFromTax[from_].from ||
            isExcludedFromTax[to_].to;
        _beforeTransferFrom(msg.sender, from_, amount_);
        if (taxEnabled && !exempt) _customTransfer(from_, to_, amount_);
        else return _transfer(from_, to_, amount_);

        return true;
    }

    function _customTransfer(
        address from_,
        address to_,
        uint256 amount_
    ) internal {
        uint256 lpTaxAmount = 0;
        uint256 mTaxAmount = 0; // marketing tax

        bool isSwaping = from_ == address(lpPair) || to_ == address(lpPair);

        if (from_ == address(lpPair) || isLpPair[from_]) {
            // this is a buy
            lpTaxAmount = (amount_ * autoLiquidityTax.onBuy) / 100;
            mTaxAmount = (amount_ * marketingTax.onBuy) / 100;
        } else if (to_ == address(lpPair) || isLpPair[to_]) {
            // this is a sell
            lpTaxAmount = (amount_ * autoLiquidityTax.onSell) / 100;
            mTaxAmount = (amount_ * marketingTax.onSell) / 100;
        } else {
            // this is a transfer
            lpTaxAmount = (amount_ * autoLiquidityTax.onTransfer) / 100;
            mTaxAmount = (amount_ * marketingTax.onTransfer) / 100;
        }

        uint256 netAmount = amount_ - lpTaxAmount - mTaxAmount;

        _transfer(from_, to_, netAmount);
        if (lpTaxAmount + mTaxAmount > 0) {
            _transfer(from_, address(this), lpTaxAmount + mTaxAmount);
            autoLPReserves += lpTaxAmount;
            marketingReserves += mTaxAmount;
        }

        // swap and liquify
        if (!isSwaping && swapEnabled) {
            // swap and liquify
            if (autoLPReserves >= swapThreshold) {
                _swapAndLiquify();
            }

            // swap and send to marketing wallet
            if (marketingReserves >= swapThreshold) {
                _swapMarketing();
            }
        }
    }

    function swapMarketing() external onlyOwner {
        _swapMarketing();
    }

    function _swapMarketing() internal {
        _swap(marketingReserves, marketingTax.recipient);
        marketingReserves = 0;
    }

    function swapAndLiquify() external onlyOwner {
        _swapAndLiquify();
    }

    function _swapAndLiquify() internal {
        uint256 amount = autoLPReserves;
        autoLPReserves = 0;

        _swap(amount / 2, isWETH ? address(this) : address(swapHelper));
        if (!isWETH)
            swapHelper.transfer(address(defaultPairToken), address(this));

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = address(defaultPairToken);

        _approve(address(this), address(router), amount - amount / 2);

        if (isWETH) {
            router.addLiquidityETH{value: address(this).balance}(
                address(this),
                amount - amount / 2,
                0,
                0,
                autoLiquidityTax.recipient,
                type(uint256).max
            );
        } else {
            uint256 balance = defaultPairToken.balanceOf(address(this));
            defaultPairToken.approve(address(router), balance);
            router.addLiquidity(
                address(this),
                address(defaultPairToken),
                amount - amount / 2,
                balance,
                0,
                0,
                autoLiquidityTax.recipient,
                type(uint256).max
            );
        }
    }

    function _swap(uint256 amount_, address to_) internal {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = address(defaultPairToken);
        _approve(address(this), address(router), amount_);
        if (isWETH) {
            router.swapExactTokensForETHSupportingFeeOnTransferTokens(
                amount_,
                0,
                path,
                to_,
                type(uint256).max
            );
        } else
            router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amount_,
                0,
                path,
                to_,
                type(uint256).max
            );
    }

    function addPair(address pair) external onlyOwner {
        isLpPair[pair] = true;
    }

    function removePair(address pair) external onlyOwner {
        isLpPair[pair] = false;
    }

    function setswapThreshold(uint256 threshold) external onlyOwner {
        swapThreshold = threshold;
    }

    /**
        @dev enable or disable taxes
        @param taxEnabled_ when true no taxes are applied this token will behave just like a simple ERC20
        
     */
    function setTaxEnabled(bool taxEnabled_) external onlyOwner {
        taxEnabled = taxEnabled_;
    }

    /**
       @dev enable or disable swaps
       @param swapEnabled_ when true the tax will be applied and added to the reserves but no swaps will happen
     */
    function setSwapEnabled(bool swapEnabled_) external onlyOwner {
        swapEnabled = swapEnabled_;
    }
}

contract FixedSupplyLPGenerator is LiquidityGeneratorERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initalSupply,
        IRouter router_,
        IERC20 defaultPairToken_,
        Tax memory autoLiquidityTax_,
        Tax memory marketingTax_
    )
        LiquidityGeneratorERC20(
            decimals_,
            router_,
            defaultPairToken_,
            autoLiquidityTax_,
            marketingTax_
        )
        SimpleERC20(name_, symbol_, decimals_, initalSupply)
    {}
}

contract MintableLPGenerator is LiquidityGeneratorERC20, MintableERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initalSupply_,
        IRouter router_,
        IERC20 defaultPairToken_,
        Tax memory autoLiquidityTax_,
        Tax memory marketingTax_
    )
        LiquidityGeneratorERC20(
            decimals_,
            router_,
            defaultPairToken_,
            autoLiquidityTax_,
            marketingTax_
        )
        MintableERC20(name_, symbol_, decimals_, initalSupply_)
    {}

    function transfer(
        address recipient,
        uint256 amount
    ) public override(LiquidityGeneratorERC20, SimpleERC20) returns (bool) {
        bool exempt = isExcludedFromTax[msg.sender].from ||
            isExcludedFromTax[recipient].to;
        if (taxEnabled && !exempt)
            _customTransfer(msg.sender, recipient, amount);
        else return _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 amount_
    ) public override(LiquidityGeneratorERC20, SimpleERC20) returns (bool) {
        bool exempt = isExcludedFromTax[from_].from ||
            isExcludedFromTax[to_].to;
        _beforeTransferFrom(msg.sender, from_, amount_);
        if (taxEnabled && !exempt) _customTransfer(from_, to_, amount_);
        else return _transfer(from_, to_, amount_);

        return true;
    }

    function transferOwnership(
        address newOwner_
    ) external override(LiquidityGeneratorERC20, MintableERC20) onlyOwner {
        _transferOwnership(newOwner_);
    }

    function _transferOwnership(
        address newOwner_
    ) internal virtual override(LiquidityGeneratorERC20, MintableERC20) {
        isExcludedFromTax[newOwner_] = TaxExempt(true, false);
        isExcludedFromTax[owner()] = TaxExempt(false, false);
        super._transferOwnership(newOwner_);
    }
}

contract SwapHelper is Ownable {
    function transfer(address token_, address to_) external onlyOwner {
        IERC20(token_).transfer(to_, IERC20(token_).balanceOf(address(this)));
    }
}
