'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '../app/assets/Logo-Big.png';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { usePrivy, useLogin, useCreateWallet, WalletWithMetadata } from '@privy-io/react-auth';
import { createPublicClient, http, formatEther } from 'viem';
import { monadTestnet } from 'viem/chains';

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const { ready, user, logout } = usePrivy();
  const { login } = useLogin();
  const { createWallet: createEthereumWallet } = useCreateWallet();

  const ethereumEmbeddedWallets = useMemo<WalletWithMetadata[]>(
    () =>
      (user?.linkedAccounts.filter(
        (acc) =>
          acc.type === 'wallet' &&
          acc.walletClientType === 'privy' &&
          acc.chainType === 'ethereum'
      ) as WalletWithMetadata[]) ?? [],
    [user]
  );

  const hasEthereumWallet = ethereumEmbeddedWallets.length > 0;
  const walletAddress = ethereumEmbeddedWallets[0]?.address;

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    setBalanceLoading(true);
    try {
      const balanceWei = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });
      setBalance(formatEther(balanceWei));
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) fetchBalance();
  }, [walletAddress, fetchBalance]);

  const handleCreateWallet = useCallback(async () => {
    setIsCreating(true);
    try {
      await createEthereumWallet();
    } finally {
      setIsCreating(false);
    }
  }, [createEthereumWallet]);


  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="absolute lg:top-12 top-4 w-full flex justify-center z-50 px-6"
    >
      <motion.div
        animate={{
          backgroundColor: isScrolled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.9)',
          boxShadow: isScrolled ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 6px rgba(0,0,0,0.05)',
        }}
        transition={{ duration: 0.3 }}
        className={`flex items-center max-w-7xl mx-auto justify-between w-full px-6 py-3 rounded-2xl border ${
          isScrolled ? 'border-gray-200 backdrop-blur-xl' : 'border-gray-100 backdrop-blur-md'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">

        🎲    
     
        <span
            className="text-3xl text-[#6258b1] text-bold"
            style={{ fontFamily: 'Tagesschrift, system-ui' }}
          >
            DiceSwap
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-6">
         
        </nav>

        {/* Privy Login Section */}
        <div className="hidden md:flex items-center space-x-4">
          {!ready ? (
            <span>Loading...</span>
          ) : (
            <>
                   <button
                onClick={() => login()}
                disabled={!!user}
                className={`px-4 py-2 rounded-lg font-semibold shadow-md transition ${
                  user
                    ? 'bg-gray-400 cursor-not-allowed hidden text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {user ? 'Logged In' : 'Connect'}
              </button>


{/* Logout Button */}
{/* Only show Logout Button if user is logged in */}
{user && (
  <button
    onClick={logout}
    className="px-4 py-2 rounded-2xl font-semibold shadow-lg transition backdrop-blur-md border border-white/20 bg-white/10 hover:bg-white/20 text-red-400"
  >
    Logout
  </button>
)}


{/* Create Wallet Button */}
<button
  onClick={handleCreateWallet}
  disabled={!user || isCreating || hasEthereumWallet}
  className={`px-4 py-2 rounded-2xl font-semibold shadow-lg transition backdrop-blur-md border border-white/20 bg-white/10 hover:bg-white/20 ${
    hasEthereumWallet
      ? 'text-green-400'
      : !user || isCreating
      ? 'text-gray-400 hidden'
      : 'text-blue-400 hidden'
  }`}
>
  {hasEthereumWallet
    ? '✓ Wallet Exists'
    : !user
    ? 'Login to Create'
    : isCreating
    ? 'Creating...'
    : 'Create Wallet'}
</button>


              {walletAddress && (
                <span className="ml-4 font-mono text-sm text-gray-800 dark:text-gray-100">
                  {balanceLoading ? 'Loading...' : `${parseFloat(balance || '0').toFixed(4)} ETH`}
                </span>
              )}
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-gray-800"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-20 w-[90%] bg-white shadow-lg rounded-xl py-4 flex flex-col items-center space-y-4 border border-gray-200"
          >
           
            {/* Mobile Privy Buttons */}
            {!ready ? (
              <span>Loading...</span>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <button
                  onClick={() => login()}
                  disabled={!!user}
                  className={`px-4 py-2 rounded-lg font-semibold shadow-md transition ${
                    user
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {user ? 'Logged In' : 'Login'}
                </button>
                <button
                  onClick={logout}
                  disabled={!user}
                  className={`px-4 py-2 rounded-lg font-semibold shadow-md transition ${
                    !user
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {!user ? 'Logged Out' : 'Logout'}
                </button>
                <button
                  onClick={handleCreateWallet}
                  disabled={!user || isCreating || hasEthereumWallet}
                  className={`px-4 py-2 rounded-lg font-semibold shadow-md transition ${
                    hasEthereumWallet
                      ? 'bg-green-600 text-white cursor-default'
                      : !user || isCreating
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {hasEthereumWallet
                    ? '✓ Wallet Exists'
                    : !user
                    ? 'Login to Create'
                    : isCreating
                    ? 'Creating...'
                    : 'Create Wallet'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
