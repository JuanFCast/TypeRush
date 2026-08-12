"use client";

import { useCallback } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { celo } from "viem/chains";
import { useI18n } from "@/lib/i18n/client";
import { fmtUnits } from "@/lib/format";
import {
  COPM_ADDRESS,
  COPM_DECIMALS,
  ERC20_ABI,
  USDT_ADDRESS,
  USDT_DECIMALS,
} from "@/lib/contractsV3";

export type BalancesState = "loading" | "ready" | "error";

export interface WalletBalances {
  celo: string | null;
  usdt: string | null;
  copm: string | null;
}

const EMPTY: WalletBalances = { celo: null, usdt: null, copm: null };
// Nunca se usa para leer de verdad (las dos queries están `enabled: false` sin
// wallet) — solo satisface el tipo `args` de `balanceOf` mientras no hay una
// dirección real.
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * Saldos de la wallet activa: CELO (gas) + USDT + COPm. Solo lectura — no
 * existe, ni debe existir, ninguna acción de enviar aquí.
 *
 * Mismo contrato de tres estados que `usePrizePools` (ver ese archivo para la
 * razón completa): `loading` no enseña nada, `error` lo dice y ofrece
 * reintentar sin inventar un 0, `ready` es un valor real (0 incluido, que es
 * un dato honesto). wagmi conserva el último `data` bueno mientras refetchea
 * en segundo plano, así que un tropiezo del refresco no borra un saldo que ya
 * está en pantalla — por eso "error" solo se declara cuando NO hay ningún
 * dato previo que mostrar.
 *
 * Usa los hooks idiomáticos de wagmi que ya usa `PlayV3Button.tsx`
 * (`useReadContract`/aquí `useReadContracts`, con `chainId: celo.id`), no un
 * `publicClient` manual — no hace falta ningún proveedor nuevo, la app ya
 * envuelve todo en `WagmiProvider`.
 */
export function useWalletBalances() {
  const { address } = useAccount();
  const { locale } = useI18n();

  const celoBalance = useBalance({
    address,
    chainId: celo.id,
    query: { enabled: Boolean(address) },
  });

  const tokens = useReadContracts({
    contracts: [
      {
        address: USDT_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address ?? ZERO_ADDRESS],
        chainId: celo.id,
      },
      {
        address: COPM_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address ?? ZERO_ADDRESS],
        chainId: celo.id,
      },
    ],
    query: { enabled: Boolean(address) },
  });

  const usdtResult = tokens.data?.[0];
  const copmResult = tokens.data?.[1];
  const hasAnyData =
    celoBalance.data !== undefined ||
    usdtResult?.status === "success" ||
    copmResult?.status === "success";

  let state: BalancesState;
  if (!address) {
    state = "ready"; // nada que leer: ProfileWalletBalances simplemente no renderiza
  } else if (celoBalance.isPending || tokens.isPending) {
    state = "loading";
  } else if ((celoBalance.isError || tokens.isError) && !hasAnyData) {
    state = "error";
  } else {
    state = "ready";
  }

  const balances: WalletBalances = !address
    ? EMPTY
    : {
        celo: celoBalance.data
          ? fmtUnits(celoBalance.data.value.toString(), celoBalance.data.decimals, locale)
          : null,
        usdt:
          usdtResult?.status === "success"
            ? fmtUnits((usdtResult.result as bigint).toString(), USDT_DECIMALS, locale)
            : null,
        copm:
          copmResult?.status === "success"
            ? fmtUnits((copmResult.result as bigint).toString(), COPM_DECIMALS, locale)
            : null,
      };

  const retry = useCallback(() => {
    void celoBalance.refetch();
    void tokens.refetch();
  }, [celoBalance, tokens]);

  return { state, balances, retry };
}
