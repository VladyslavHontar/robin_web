const TOKEN_COLORS: Record<string, string> = {
  AMZN: '#ff9900',
  AMD: '#00a651',
  NFLX: '#e50914',
  WETH: '#627eea',
  ETH: '#627eea',
}

export function TokenIcon({
  symbol,
  size = 32,
}: {
  symbol: string
  size?: number
}) {
  const color = TOKEN_COLORS[symbol] ?? '#0DAB76'

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.35,
      }}
    >
      {symbol.slice(0, 2)}
    </div>
  )
}
