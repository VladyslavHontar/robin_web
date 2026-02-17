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
    factory: '0x30f8819710611d80Ce22d57947223F33C2fe8C9E',
    router: '0x7A112f26C32763B1b774899668EEfd3E0DF06447',
    compliance: '0xEFb56C901723c03DcddC8Bf38e2737d58D71c26B',
    identityRegistry: '0x40e9724795d9E14668e76455622017a5a3Ffb745',
    weth: '0xD01e5E257ea5014E92BDD5b746eD63815Ee8ffD4',
    oracleModule: '0x0000000000000000000000000000000000000000', // resolved dynamically from factory
  },
}

export const knownTokens: Record<number, Record<Address, { symbol: string; name: string; decimals: number }>> = {
  46630: {
    '0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02': { symbol: 'AMZN', name: 'Amazon', decimals: 18 },
    '0x71178BAc73cBeb415514eB542a8995b82669778d': { symbol: 'AMD', name: 'AMD', decimals: 18 },
    '0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93': { symbol: 'NFLX', name: 'Netflix', decimals: 18 },
    '0xD01e5E257ea5014E92BDD5b746eD63815Ee8ffD4': { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  },
}

export function getContracts(chainId: number): ContractAddresses {
  const c = contracts[chainId]
  if (!c) throw new Error(`No contracts configured for chain ${chainId}`)
  return c
}
