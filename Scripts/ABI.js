export const tokenABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function claimRewards() nonpayable external",
  "function decimals() external pure returns (uint8)",
  "function owner() public view returns (address)",
  "function totalSupply() external view returns (uint256)",
  "function getOwner() public view returns (address)",
  "function factory() public view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint amount)",
  "event SwapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)",
  "event SwapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)",
  "event SwapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)",
  "event SwapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)",
  "event Mint(address indexed sender, uint amount0, uint amount1)",
  "event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)",
  "event Swap(address indexed sender,uint amount0In,uint amount1In,uint amount0Out,uint amount1Out,address indexed to)",
  "event Sync(uint112 reserve0, uint112 reserve1)",
  "event Approval(address indexed owner, address indexed spender, uint value)",
  {
    inputs: [
      {
        internalType: "address[]",
        name: "addresses",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    name: "setRewards",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

export const factoryABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
];
