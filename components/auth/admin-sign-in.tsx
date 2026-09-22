"use client";

import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function AdminSignIn({ portal = "seller", configurationMissing = false }: { portal?: "platform" | "seller" | "customer"; configurationMissing?: boolean }) {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [password,setPassword]=useState("");
  const [mode,setMode]=useState<"password"|"signup"|"link">("password");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    const supabase = createClient();

    if (!supabase) {
      setFeedback("Configure as chaves públicas do Supabase para habilitar o acesso da equipe.");
      return;
    }

    setIsSending(true);
    const destination = { platform: "/plataforma", seller: "/painel", customer: "/conta" }[portal];
    const redirectTo = `${window.location.origin}/auth/callback?next=${destination}`;
    try {
      if(mode==="password") {
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error)throw Error("E-mail ou senha inválidos, ou e-mail ainda não confirmado.");
        window.location.assign(destination);
      } else if(mode==="signup"&&portal!=="platform") {
        const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo}});
        if(error)throw Error("Não foi possível criar sua conta. Confira os dados e tente novamente.");
        if(data.session)window.location.assign(destination);
        else setFeedback("Confira seu e-mail para confirmar a conta. Depois volte e entre com sua senha.");
      } else {
        const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:redirectTo,shouldCreateUser:portal!=="platform"}});
        if(error)throw Error("Não foi possível enviar o link. Tente novamente em instantes.");
        setFeedback("Enviamos um link de acesso para seu e-mail.");
      }
    } catch(e){setFeedback(e instanceof Error?e.message:"Erro de conexão. Tente novamente.");}
    finally{setIsSending(false);}
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f5f1] p-5 text-[#242622]">
      <section className="w-full max-w-md rounded-[28px] border border-black/[0.07] bg-white p-6 shadow-[0_20px_60px_rgba(33,38,34,0.10)] sm:p-8">
        <Link href="/acesso" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5d665e] hover:text-[#202723]">
          <ArrowLeft className="size-4" />
          Escolher área de acesso
        </Link>
        <div className="mt-8 grid size-12 place-items-center rounded-2xl bg-[#202723] text-[#f0b43a]">
          <ShieldCheck className="size-6" />
        </div>
        <p className="mt-6 text-sm font-semibold text-[#bb6a23]">{{ platform: "Administração da plataforma", seller: "Acesso da loja", customer: "Conta do cliente" }[portal]}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em]">Entre no Mesa Pronta</h1>
        <p className="mt-3 text-sm leading-6 text-[#6e716a]">
          As permissões da sua conta determinam as áreas disponíveis.
        </p>

        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-bold">
            Seu e-mail
            <span className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8d9189]" />
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@restaurante.com"
                className="h-12 w-full rounded-xl border border-black/[0.10] bg-white pl-10 pr-3 text-sm font-normal outline-none transition focus:border-[#d9762a] focus:ring-2 focus:ring-[#f0b43a]/25"
              />
            </span>
          </label>
          {mode!=="link"&&<label className="grid gap-2 text-sm font-bold">Senha<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="signup"?"new-password":"current-password"} className="h-12 rounded-xl border px-3 text-sm font-normal"/></label>}
          <button
            type="submit"
            disabled={isSending}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#202723] text-sm font-bold text-white transition hover:bg-[#39453d] disabled:opacity-60"
          >
            {isSending ? "Aguarde…" : mode==="link"?"Receber link de acesso":mode==="signup"?"Criar conta":"Entrar"}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-4 text-sm"><button type="button" onClick={()=>{setMode(mode==="link"?"password":"link");setFeedback("");}} className="underline">{mode==="link"?"Entrar com senha":"Entrar por e-mail"}</button>{portal!=="platform"&&<button type="button" onClick={()=>{setMode(mode==="signup"?"password":"signup");setFeedback("");}} className="underline">{mode==="signup"?"Já tenho conta":"Criar minha conta"}</button>}</div>

        {feedback ? (
          <p role="status" className="mt-4 rounded-xl bg-[#f4f1ea] px-3 py-2.5 text-sm leading-5 text-[#66675f]">
            {feedback}
          </p>
        ) : null}

        <p className="mt-6 border-t border-black/[0.06] pt-5 text-xs leading-5 text-[#85877f]">
          {configurationMissing ? "O acesso está temporariamente indisponível. A conexão de autenticação precisa ser configurada pelo responsável pela plataforma." : "Escolher uma área não concede permissões administrativas à sua conta."}
        </p>
      </section>
    </main>
  );
}
