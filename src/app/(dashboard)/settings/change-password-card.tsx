"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

export function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword.length < 6) {
      setErrorMsg("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    setStatus("loading");
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("success");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="new-password" className="text-sm font-medium text-foreground">Nova senha</label>
        <div className="relative">
          <Input
            id="new-password"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            className="pr-10"
            disabled={status === "loading"}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">Confirmar nova senha</label>
        <div className="relative">
          <Input
            id="confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            className="pr-10"
            disabled={status === "loading"}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {status === "success" && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> Senha alterada com sucesso.
        </p>
      )}

      {(status === "error" || errorMsg) && (
        <p className="flex items-center gap-1.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" /> {errorMsg}
        </p>
      )}

      <Button
        type="submit"
        disabled={status === "loading" || !newPassword || !confirmPassword}
        className="bg-gold-500 hover:bg-gold-400 text-black"
      >
        {status === "loading" ? "Salvando..." : "Alterar senha"}
      </Button>
    </form>
  );
}
