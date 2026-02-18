export const lbFactoryAbi = [
  // ── View: enumeration ─────────────────────────────────────────
  {
    type: 'function',
    name: 'allPairsLength',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allPairs',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPair',
    inputs: [
      { name: 'tokenX', type: 'address' },
      { name: 'tokenY', type: 'address' },
      { name: 'binStep', type: 'uint16' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
  },
  // ── View: address derivation (Solana PDA equivalent) ──────────
  {
    type: 'function',
    name: 'computePairAddress',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'binStep', type: 'uint16' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
  },
  // ── View: admin state ─────────────────────────────────────────
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'oracleModule',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'beacon',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pairImplementation',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isBinStepSupported',
    inputs: [{ name: 'binStep', type: 'uint16' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // ── Write: pair creation ──────────────────────────────────────
  {
    type: 'function',
    name: 'createPair',
    inputs: [
      { name: 'tokenX', type: 'address' },
      { name: 'tokenY', type: 'address' },
      { name: 'binStep', type: 'uint16' },
      { name: 'activeId', type: 'uint24' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  // ── Events ────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'PairCreated',
    inputs: [
      { name: 'tokenX',    type: 'address', indexed: true  },
      { name: 'tokenY',    type: 'address', indexed: true  },
      { name: 'binStep',   type: 'uint16',  indexed: true  },
      { name: 'pair',      type: 'address', indexed: false },
      { name: 'pairCount', type: 'uint256', indexed: false },
    ],
  },
] as const
