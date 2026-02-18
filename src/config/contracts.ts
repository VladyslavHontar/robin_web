import type { Address } from 'viem'

type ContractAddresses = {
  factory: Address
  router: Address
  compliance: Address
  identityRegistry: Address
  weth: Address
  oracleModule: Address
}

export const contracts: Record<number, ContractAddresses> = {
  46630: {
    factory:          '0x3b6579a20C30Dc35aFab2737FD13D3bb5fFF0CFE',
    router:           '0xC7c04dd814dF7bFd9Db5E5b39d4970f14139Ce45',
    compliance:       '0xde18aC9BACF03133BBEB2807ED999BB4a365a151',
    identityRegistry: '0x4Ca1BE049097df8CD44fDEfA04E02db0e1681095',
    weth:             '0x0000000000000000000000000000000000000000',
    oracleModule:     '0x24c79c663476Fc95243B62dC7a70B53360d6ec26',
  },
}

export const knownTokens: Record<number, Record<Address, { symbol: string; name: string; decimals: number }>> = {
  46630: {
    '0x4e53aE702c4D80E745F02F0BF082EcB66d3a4688': { symbol: 'USDC',  name: 'USD Coin',            decimals: 6  },
    '0x1162a28b717EbE9cb9d418798DA84Df28292F28B': { symbol: 'AAPL',  name: 'Apple Stock Token',    decimals: 18 },
    '0xb79E274cdD2a3d20B80e270566fEb6531aa2D0f6': { symbol: 'TSLA',  name: 'Tesla Stock Token',    decimals: 18 },
    '0xa9070d6cE43aC7c17625FF69b74b010016258D58': { symbol: 'MSFT',  name: 'Microsoft Stock Token',decimals: 18 },
  },
}

export function getContracts(chainId: number): ContractAddresses {
  const c = contracts[chainId]
  if (!c) throw new Error(`No contracts configured for chain ${chainId}`)
  return c
}
