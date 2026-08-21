"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const [isLogin, setIsLogin] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    data: session,
    isPending: sessionLoading,
  } = authClient.useSession();

  useEffect(() => {
    if (session) {
      console.log("Logged in user:", session.user);
    }
  }, [session]);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    await authClient.signUp.email(
      {
        name,
        email,
        password,
        callbackURL: "/dashboard",
      },
      {
        onRequest: () => {
          setLoading(true);
        },

        onSuccess: () => {
          setLoading(false);
          window.location.href = "/dashboard";
        },

        onError: (ctx) => {
          setLoading(false);
          setError(ctx.error.message);
        },
      }
    );
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");

    await authClient.signIn.email(
      {
        email,
        password,
        callbackURL: "/dashboard",
      },
      {
        onRequest: () => {
          setLoading(true);
        },

        onSuccess: () => {
          setLoading(false);
          window.location.href = "/dashboard";
        },

        onError: (ctx) => {
          setLoading(false);
          setError(ctx.error.message);
        },
      }
    );
  };

  const handleLogout = async () => {
    setLoading(true);
    setError("");

    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          setLoading(false);
          window.location.reload();
        },

        onError: (ctx) => {
          setLoading(false);
          setError(ctx.error.message);
        },
      },
    });
  };

  if (sessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  if (session) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome, {session.user.name}
            </h1>

            <p className="text-muted-foreground">
              {session.user.email}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm">
              <strong>User ID:</strong>
            </p>

            <p className="break-all text-sm text-muted-foreground">
              {session.user.id}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={isLogin ? handleLogin : handleSignup}
        className="flex w-full max-w-md flex-col gap-4"
      >
        <div className="mb-4">
          <h1 className="text-3xl font-bold">
            {isLogin ? "Welcome back" : "Create an account"}
          </h1>

          <p className="text-muted-foreground">
            {isLogin
              ? "Login to continue to Meet AI."
              : "Sign up to get started with Meet AI."}
          </p>
        </div>

        {!isLogin && (
          <Input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}

        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />

        {error && (
          <p className="text-sm text-red-500">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading}>
          {loading
            ? isLogin
              ? "Logging in..."
              : "Creating account..."
            : isLogin
              ? "Login"
              : "Sign Up"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setIsLogin(!isLogin);
            setError("");
          }}
        >
          {isLogin
            ? "Don't have an account? Sign Up"
            : "Already have an account? Login"}
        </Button>
      </form>
    </main>
  );
}