"use client"

/**
 * Silences the noisy “Sender wallet” console error that appears on
 * every page load when the Sender browser extension is installed.
 *
 * It intercepts the offending `postMessage` and stops propagation.
 */
import { useEffect } from "react"

export default function SuppressSenderWallet() {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "sender-wallet-providerResult" && event.data?.method === "sender_getProviderState") {
        /* Prevent the message from reaching the extension’s listener,
           which logs “No account exist” to the console. */
        event.stopImmediatePropagation?.()
      }
    }

    window.addEventListener("message", handler, true)
    return () => window.removeEventListener("message", handler, true)
  }, [])

  return null // nothing to render
}
