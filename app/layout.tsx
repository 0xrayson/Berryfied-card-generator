import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import SuppressSenderWallet from "@/components/suppress-sender-wallet"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Profile Card Generator",
  description: "Create stunning profile cards with background removal",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SuppressSenderWallet />
        {children}
      </body>
    </html>
  )
}
