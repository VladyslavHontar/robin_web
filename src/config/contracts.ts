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
    factory:          '0x10f73A2baaB77e09a7232072aD4b7D555e96E007',
    router:           '0xB7996C2Ef83DEE347eCaBFF5D91DAFe621e08d27',
    compliance:       '0x3e67F31Cb6AA5cC90eC6cC49cd0dC3466B63fefe',
    identityRegistry: '0xCDD97ff1caec48a873F2C2857D618BB037ad0309',
    weth:             '0x0000000000000000000000000000000000000000', // not deployed in this run
    oracleModule:     '0xDa699653308e9bd81F0b054C8Eae761d71d7bD75',
  },
}

export const knownTokens: Record<number, Record<Address, { symbol: string; name: string; decimals: number }>> = {
  46630: {
    '0xA330Cd21E019470F968b0a3B919Ca17f956b6046': { symbol: 'USDC',  name: 'USD Coin',            decimals: 6  },
    '0x69878eb8eb1f0395d20344eb5AA84ac3CBE7f7E3': { symbol: 'AAPL',  name: 'Apple Stock Token',    decimals: 18 },
    '0xEe18645194eF458EC0B19BE95aBc41EeAe15856E': { symbol: 'TSLA',  name: 'Tesla Stock Token',    decimals: 18 },
    '0x1FCE42667B5B0a1BAB18d58f63881FD5F1DfEAff': { symbol: 'MSFT',  name: 'Microsoft Stock Token',decimals: 18 },
  },
}

export function getContracts(chainId: number): ContractAddresses {
  const c = contracts[chainId]
  if (!c) throw new Error(`No contracts configured for chain ${chainId}`)
  return c
}
