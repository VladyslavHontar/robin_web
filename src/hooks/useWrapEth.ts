'use client'

import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { wethAbi } from '@/config/abis/WETH'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export function useWrapEth() {
  const { address: account } = useAccount()
  const contracts = getContracts(robinhoodTestnet.id)
  const wethAddress = contracts.weth as Address

  // ETH balance
  const {
    data: ethBalance,
    refetch: refetchEth,
  } = useBalance({
    address: account,
    chainId: robinhoodTestnet.id,
    query: { enabled: !!account },
  })

  // WETH balance
  const {
    data: wethBalance,
    refetch: refetchWeth,
  } = useReadContract({
    address: wethAddress,
    abi: wethAbi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    chainId: robinhoodTestnet.id,
    query: { enabled: !!account },
  })

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Refetch balances after confirmation
  if (isSuccess) {
    refetchEth()
    refetchWeth()
  }

  function wrap(amount: bigint) {
    if (!account) return
    writeContract({
      address: wethAddress,
      abi: wethAbi,
      functionName: 'deposit',
      value: amount,
      chainId: robinhoodTestnet.id,
    })
  }

  function unwrap(amount: bigint) {
    if (!account) return
    writeContract({
      address: wethAddress,
      abi: wethAbi,
      functionName: 'withdraw',
      args: [amount],
      chainId: robinhoodTestnet.id,
    })
  }

  return {
    ethBalance: ethBalance?.value ?? 0n,
    wethBalance: (wethBalance as bigint) ?? 0n,
    wrap,
    unwrap,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    txHash,
    reset,
  }
}
