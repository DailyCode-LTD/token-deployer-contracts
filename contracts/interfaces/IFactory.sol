// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

interface IFactory {
    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair);
}
