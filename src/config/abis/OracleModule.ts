export const oracleModuleAbi = [
  {
    type: 'function',
    name: 'getOraclePrice',
    inputs: [{ name: 'pair', type: 'address' }],
    outputs: [
      { name: 'price', type: 'int256' },
      { name: 'decimals', type: 'uint8' },
      { name: 'updatedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDeviationParams',
    inputs: [{ name: 'pair', type: 'address' }],
    outputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'deadzoneBins', type: 'uint24' },
          { name: 'tier1MaxBins', type: 'uint24' },
          { name: 'tier1RatePerBin', type: 'uint16' },
          { name: 'tier2MaxBins', type: 'uint24' },
          { name: 'tier2RatePerBin', type: 'uint16' },
          { name: 'maxDeviationFee', type: 'uint16' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const
