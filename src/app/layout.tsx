import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DailyLog',
  description: 'A beautiful daily activity tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-slate-50 min-h-screen text-slate-800`}>
        <div className="max-w-3xl mx-auto min-h-screen bg-white shadow-2xl overflow-hidden flex flex-col md:flex-row-reverse border-x border-slate-100 relative">
          <main className="flex-1 w-full pb-20 md:pb-0 h-screen overflow-y-auto">
            {children}
          </main>
          <Navigation />
        </div>
      </body>
    </html>
  )
}
