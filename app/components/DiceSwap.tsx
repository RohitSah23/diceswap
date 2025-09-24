"use client";
import { useAccount, useChainId, useSendTransaction, useWalletClient, useSignTypedData, useWaitForTransactionReceipt } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { MONAD_TESTNET_TOKENS } from "@/utils/constants";
import { parseUnits, type Address, concat, numberToHex, size, type Hex } from "viem";
import qs from "qs";

export default function DiceSwap() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId() || 10143;
  const { data: walletClient } = useWalletClient();
  const { data: hash, sendTransaction } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  const { signTypedDataAsync } = useSignTypedData();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [diceFace, setDiceFace] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (hash) setTxHash(hash);
  }, [hash]);

  const diceToToken = useMemo(() => (
    {
      1: MONAD_TESTNET_TOKENS[1], // USDT
      2: MONAD_TESTNET_TOKENS[2], // USDC
      3: MONAD_TESTNET_TOKENS[3], // DAK
      4: MONAD_TESTNET_TOKENS[4], // CHOG
      5: MONAD_TESTNET_TOKENS[5], // YAKI
      6: MONAD_TESTNET_TOKENS[6], // KB
    } as const
  ), []);

  const rollDice = async () => {
    if (!isConnected || !address) return alert("Connect wallet first");
    setLoading(true);
    setResult("");
    setTxHash(null);
    setRolling(true);

    // Animate dice roll for ~800ms
    const start = Date.now();
    const interval = setInterval(() => {
      const r = Math.floor(Math.random() * 6) + 1;
      setDiceFace(r);
      if (Date.now() - start > 800) {
        clearInterval(interval);
        const finalFace = Math.floor(Math.random() * 6) + 1;
        setDiceFace(finalFace);
        setRolling(false);
        // Begin swap after showing the result
        void startSwap(finalFace);
      }
    }, 100);
  };

  const startSwap = async (face: number) => {
    try {
      const humanAmount = (Math.random() * (0.5 - 0.01) + 0.01).toFixed(4);
      // Use WMON (Wrapped MON) as the sell token to avoid native-pair issues
      const WMON = MONAD_TESTNET_TOKENS[0];
      const sellAmount = parseUnits(humanAmount, WMON.decimals).toString();
      
      // Try mapped token first, then cycle through others to find a valid pair
      const order: Array<1|2|3|4|5|6> = [1,2,3,4,5,6];
      const startIdx = face - 1;
      const tryOrder = order.slice(startIdx).concat(order.slice(0, startIdx));

      let sent = false;
      let chosenSymbol = "";
      for (const key of tryOrder) {
        const target = diceToToken[key];
        const baseParams = {
          chainId,
          sellToken: WMON.address,
          buyToken: target.address,
          sellAmount,
        };

        // 0) Try Permit2 first (signature + calldata augmentation)
        try {
          const p2Params = { ...baseParams, taker: address as Address } as Record<string, unknown>;
          const p2Res = await fetch(`/api/quote?${qs.stringify(p2Params)}`);
          const p2Quote = await p2Res.json();
          if (p2Quote?.transaction?.to && p2Quote?.transaction?.data) {
            if (p2Quote?.permit2?.eip712) {
              const signature: Hex = await signTypedDataAsync(p2Quote.permit2.eip712);
              const sigLengthHex = numberToHex(size(signature), { signed: false, size: 32 });
              p2Quote.transaction.data = concat([
                p2Quote.transaction.data as Hex,
                sigLengthHex as Hex,
                signature as Hex,
              ]);
            }

            sendTransaction?.({
              account: walletClient?.account.address,
              chainId,
              to: p2Quote.transaction.to,
              data: p2Quote.transaction.data,
              value: p2Quote?.transaction?.value ? BigInt(p2Quote.transaction.value) : undefined,
              gas: p2Quote?.transaction?.gas ? BigInt(p2Quote.transaction.gas) : undefined,
            });
            chosenSymbol = target.symbol;
            sent = true;
            break;
          }
        } catch (_) {}

        // 1) Try AllowanceHolder (auto-approve path)
        const priceRes = await fetch(`/api/allowance-holder/price?${qs.stringify(baseParams)}`);
        const price = await priceRes.json();
        if (price?.issues?.allowance) {
          // Approve spender first
          // We cannot programmatically send an approval from the frontend without user interaction,
          // so we skip explicit approval here and rely on Permitless AllowanceHolder when possible.
        }

        const quoteParams = new URLSearchParams({ ...baseParams, taker: address as string } as any);
        const ahQuoteRes = await fetch(`/api/allowance-holder/quote?${quoteParams.toString()}`);
        const ahQuote = await ahQuoteRes.json();
        if (ahQuote?.transaction?.to && ahQuote?.transaction?.data) {
          sendTransaction?.({
            account: walletClient?.account.address,
            chainId,
            to: ahQuote.transaction.to,
            data: ahQuote.transaction.data,
            value: ahQuote?.transaction?.value ? BigInt(ahQuote.transaction.value) : undefined,
            gas: ahQuote?.transaction?.gas ? BigInt(ahQuote.transaction.gas) : undefined,
          });
          chosenSymbol = target.symbol;
          sent = true;
          break;
        }

        // 2) Fallback to classic quote (non-Permit2)
        const classicParams = { ...baseParams, takerAddress: address as Address } as Record<string, unknown>;
        const res = await fetch(`/api/quote-classic?${qs.stringify(classicParams)}`);
        const quote = await res.json();
        if (quote?.to && quote?.data) {
          sendTransaction?.({
            account: walletClient?.account.address,
            chainId,
            to: quote.to,
            data: quote.data,
            value: quote?.value ? BigInt(quote.value) : undefined,
            gas: quote?.gas ? BigInt(quote.gas) : undefined,
          });
          chosenSymbol = target.symbol;
          sent = true;
          break;
        }
      }

      if (!sent) {
        throw new Error("No valid WMON pair available right now");
      }

      setResult(`🎲 Rolled ${face}. Swapped ${humanAmount} WMON → ${chosenSymbol}`);
    } catch (e) {
      console.error(e);
      setResult("❌ Swap failed: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-6xl select-none">
        {rolling ? "🎲" : diceFace ?? ""}
      </div>
      <button
        disabled={loading || rolling}
        onClick={rollDice}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? "Rolling..." : "Roll Dice"}
      </button>
      {result && (
        <div className="text-center">
          <p>{result}</p>
          {txHash && (
            <p className="text-sm mt-1">
              Tx: {txHash.slice(0, 6)}…{txHash.slice(-6)}
            </p>
          )}
          {isConfirming && <p className="text-sm">Waiting for confirmation…</p>}
          {isConfirmed && <p className="text-sm">Confirmed ✓</p>}
        </div>
      )}
    </div>
  );
}
