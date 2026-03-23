import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { KeyRound, User, LogIn, AlertCircle, Eye, EyeOff, TrendingUp, UserPlus } from "lucide-react";

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));

      if (isSignup) {
        // LocalStorage Signup
        const usersStr = localStorage.getItem('crm_users');
        const users = usersStr ? JSON.parse(usersStr) : { admin: 'admin123' };
        
        if (users[username]) {
          throw new Error("Username already exists");
        }
        
        users[username] = password;
        localStorage.setItem('crm_users', JSON.stringify(users));
        
        setSuccess("Account created successfully! Please sign in.");
        setIsSignup(false);
        setPassword("");
      } else {
        // LocalStorage Login
        const usersStr = localStorage.getItem('crm_users');
        const users = usersStr ? JSON.parse(usersStr) : { admin: 'admin123' };
        
        if (!users[username] || users[username] !== password) {
          throw new Error("Invalid credentials");
        }

        // Generate a fake token
        const fakeToken = btoa(JSON.stringify({ username, exp: Date.now() + 86400000 }));
        login(fakeToken, username);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-4 relative overflow-hidden">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-[#111111]/80 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-8 shadow-2xl shadow-emerald-500/10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 mb-4 shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-3xl font-bold font-heading tracking-tight text-white uppercase">
              Sales Wolf CRM
            </h1>
            <p className="text-emerald-400 mt-2 text-sm font-bold tracking-widest uppercase">Always Be Closing</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 flex items-center gap-3 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl mb-6 flex items-center gap-3 text-sm"
            >
              <p>{success}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-12 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-emerald-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold uppercase tracking-wider text-black bg-emerald-500 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] focus:ring-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8 shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  {isSignup ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {isSignup ? "Sign Up" : "Sign In"}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
                setSuccess("");
              }}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {isSignup ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
          
          {!isSignup && (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500 font-mono">
                Default credentials: admin / admin123
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
