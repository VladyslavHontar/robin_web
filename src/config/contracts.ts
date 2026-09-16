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
    factory:          '0x629b392a798a99558c55013931447a6Db35ef649',
    router:           '0x4A620A2F544A260255C396550Ed65259635bC91C',
    compliance:       '0x6E5DDd54c0a07bdD65f679c83d9FfB7dDB6d075F',
    identityRegistry: '0x4c7D837eFdBEbE4Ff3876F6F5568b16fD8a03EE1',
    weth:             '0xfeA10a4E52613F510f2A21D89794A271635b54ba',
    oracleModule:     '0x1831D5Ad7F8792e110d4710afbFC51F613E1875b',
  },
}


export function getContracts(chainId: number): ContractAddresses {
  const c = contracts[chainId]
  if (!c) throw new Error(`No contracts configured for chain ${chainId}`)
  return c
}
