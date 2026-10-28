import { useUsage } from "@/hooks/useUsage";
import { ProRequired } from "@/components/ProRequired";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Copy,
  DoorOpen,
  Loader2,
  Mic,
  Send,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthScreen } from "@/components/AuthScreen";
import { translate } from "@/lib/translate.functions";
import { useRecognition, speak, cancelSpeak } from "@/hooks/useSpeech";
import { VoiceSelector } from "@/components/VoiceSelector";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { ShareMenu } from "@/components/ShareMenu";

export const Route = createFileRoute("/room")({
  head: () => ({
    meta: [
      { title: "Conference Room — Neural Duplex AI Lite" },
      {
        name: "description",
        content:
          "Host a multilingual conference room: up to 10 people join from their own devices and hear everything in their own language.",
      },
      { property: "og:title", content: "Conference Room — Neural Duplex" },
      {
        property: "og:description",
        content: "Up to 10 people, each in their own language, in one live translated room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

const MAX_PARTICIPANTS = 10;

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
  lang: string;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  source_lang: string;
  text: string;
  created_at: string;
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function RoomPage() {
  const { user, loading } = useAuth();
  const { usage } = useUsage(!!user);
  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }
  if (!user) return <AuthScreen />;
  if (usage && !usage.pro) return <ProRequired />;
  if (!usage) return null;
  return <Room userId={user.id} email={user.email ?? ""} />;
}

function Room({ userId, email }: { userId: string; email: string }) {
  const translateFn = useServerFn(translate);

  const [name, setName] = useState(email.split("@")[0] || "Guest");
  const [myLang, setMyLang] = useState("en-US");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [room, setRoom] = useState<{ id: string; code: string } | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const myLangRef = useRef(myLang);
  myLangRef.current = myLang;
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;
  const bottomRef = useRef<HTMLDivElement>(null);
  const pending = useRef<Set<string>>(new Set());

  /* ---------------- translation of incoming messages ---------------- */

  const ensureTranslation = useCallback(
    async (m: Message) => {
      if (m.sender_id === userId) return;
      if (pending.current.has(m.id)) return;
      const target = myLangRef.current;
      if (getLanguage(m.source_lang).base === getLanguage(target).base) return;
      pending.current.add(m.id);
      try {
        const res = await translateFn({
          data: {
            text: m.text,
            sourceLang: getLanguage(m.source_lang).name,
            targetLang: getLanguage(target).name,
          },
        });
        setTranslations((t) => ({ ...t, [m.id]: res.translated }));
        if (autoSpeakRef.current) speak(res.translated, target);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        pending.current.delete(m.id);
      }
    },
    [translateFn, userId],
  );

  /* ---------------- room data ---------------- */

  const loadParticipants = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("room_participants")
      .select("id, user_id, display_name, lang")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    setParticipants((data ?? []) as Participant[]);
  }, []);

  const loadMessages = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("room_messages")
      .select("id, sender_id, sender_name, source_lang, text, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages((data ?? []) as Message[]);
  }, []);

  useEffect(() => {
    if (!room) return;
    void loadParticipants(room.id);
    void loadMessages(room.id);

    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          void ensureTranslation(m);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${room.id}` },
        () => void loadParticipants(room.id),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room, loadParticipants, loadMessages, ensureTranslation]);

  // Re-translate everything when the listener changes their own language.
  useEffect(() => {
    setTranslations({});
    messages.forEach((m) => void ensureTranslation(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, translations]);

  /* ---------------- create / join / leave ---------------- */

  const createRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = randomCode();
      const { data, error: e } = await supabase
        .from("rooms")
        .insert({ code, host_id: userId })
        .select("id, code")
        .single();
      if (e) throw new Error(e.message);
      const { error: pe } = await supabase
        .from("room_participants")
        .insert({ room_id: data.id, user_id: userId, display_name: name, lang: myLang });
      if (pe) throw new Error(pe.message);
      setRoom({ id: data.id, code: data.code });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter the room code you were given.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: rows, error: e } = await supabase.rpc("lookup_room_by_code", { _code: code });
      if (e) throw new Error(e.message);
      const r = rows?.[0];
      if (!r) throw new Error("No room found with that code.");

      const { count } = await supabase
        .from("room_participants")
        .select("id", { count: "exact", head: true })
        .eq("room_id", r.id);

      const { error: pe } = await supabase.from("room_participants").upsert(
        { room_id: r.id, user_id: userId, display_name: name, lang: myLang },
        { onConflict: "room_id,user_id" },
      );
      if (pe) {
        if ((count ?? 0) >= MAX_PARTICIPANTS) {
          throw new Error(`This room is full (${MAX_PARTICIPANTS} people).`);
        }
        throw new Error(pe.message);
      }
      setRoom({ id: r.id, code: r.code });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const leaveRoom = async () => {
    cancelSpeak();
    if (room) {
      await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", userId);
    }
    setRoom(null);
    setMessages([]);
    setParticipants([]);
    setTranslations({});
  };

  /* ---------------- speaking ---------------- */

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !room) return;
      const optimistic: Message = {
        id: `local-${Date.now()}`,
        sender_id: userId,
        sender_name: name,
        source_lang: myLangRef.current,
        text: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      const { data, error: e } = await supabase
        .from("room_messages")
        .insert({
          room_id: room.id,
          sender_id: userId,
          sender_name: name,
          source_lang: myLangRef.current,
          text: trimmed,
        })
        .select("id")
        .single();
      if (e) {
        setError(e.message);
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, id: data.id } : m)),
      );
    },
    [room, userId, name],
  );

  const rec = useRecognition({
    lang: myLang,
    onFinal: (t) => void sendText(t),
  });

  const updateLang = async (code: string) => {
    setMyLang(code);
    if (room) {
      await supabase
        .from("room_participants")
        .update({ lang: code })
        .eq("room_id", room.id)
        .eq("user_id", userId);
    }
  };

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  /* ---------------- lobby ---------------- */

  if (!room) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-5 px-4 py-6">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to interpreter
        </Link>

        <div>
          <h1 className="font-display text-2xl font-semibold">Conference room</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Up to {MAX_PARTICIPANTS} people join from their own devices with a room code.
            Everyone speaks and reads in their own language.
          </p>
        </div>

        <div className="panel-surface space-y-4 p-5">
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Your name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm"
              placeholder="Your name"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Your language
            </span>
            <select
              value={myLang}
              onChange={(e) => setMyLang(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </label>

          <VoiceSelector lang={myLang} />

          <button
            type="button"
            onClick={() => void createRoom()}
            disabled={busy || !name.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Start a new room
          </button>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or join <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={8}
              className="w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-center font-display text-lg tracking-[0.3em] uppercase"
            />
            <button
              type="button"
              onClick={() => void joinRoom()}
              disabled={busy || !name.trim()}
              className="shrink-0 rounded-xl border border-border bg-secondary/60 px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
          >
            {error}
          </p>
        )}
      </main>
    );
  }

  /* ---------------- in-room ---------------- */

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Room code
          </p>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="inline-flex items-center gap-2 font-display text-xl tracking-[0.25em]"
            title="Copy room code"
          >
            {room.code}
            <Copy className="h-4 w-4 text-muted-foreground" />
          </button>
          {copied && <span className="ml-2 text-[11px] text-muted-foreground">Copied</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Your language"
            value={myLang}
            onChange={(e) => void updateLang(e.target.value)}
            className="max-w-[10rem] rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5 text-xs"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setAutoSpeak((v) => !v);
              cancelSpeak();
            }}
            aria-pressed={autoSpeak}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5 text-xs hover:bg-secondary"
          >
            {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {autoSpeak ? "Voice on" : "Voice off"}
          </button>
          <button
            type="button"
            onClick={() => void leaveRoom()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5 text-xs hover:bg-secondary"
          >
            <DoorOpen className="h-3.5 w-3.5" /> Leave
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2">
        {participants.map((p) => (
          <span
            key={p.id}
            className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-foreground/80"
          >
            {getLanguage(p.lang).flag} {p.display_name}
            {p.user_id === userId ? " (you)" : ""}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {participants.length}/{MAX_PARTICIPANTS}
        </span>
      </div>

      <div className="border-b border-border px-4 py-2">
        <VoiceSelector lang={myLang} />
      </div>


      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet. Share the room code so others can join, then tap the mic or type—everyone sees your words in their own language.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          const translated = translations[m.id];
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5",
                  mine ? "bg-primary text-primary-foreground" : "bg-secondary/70",
                )}
              >
                <p className="mb-1 text-[10px] uppercase tracking-widest opacity-70">
                  {mine ? "You" : m.sender_name} · {getLanguage(m.source_lang).flag}
                </p>
                <p className="break-words font-display text-base leading-snug">
                  {translated ?? m.text}
                </p>
                {translated && (
                  <p className="mt-1 break-words text-xs opacity-70">{m.text}</p>
                )}
                {!mine && !translated && pending.current.has(m.id) && (
                  <p className="mt-1 text-[11px] opacity-70">Translating…</p>
                )}
                {!mine && translated && (
                  <button
                    type="button"
                    onClick={() => speak(translated, myLang)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100"
                  >
                    <Volume2 className="h-3 w-3" /> Replay
                  </button>
                )}
                <ShareMenu
                  size="xs"
                  className="mt-1.5 inline-block text-foreground"
                  text={m.text}
                  translation={translated ?? m.text}
                  lang={translated ? myLang : m.source_lang}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p
          role="alert"
          className="mx-4 mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
        >
          {error}
        </p>
      )}

      <form
        className="flex items-center gap-2 border-t border-border px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void sendText(draft);
          setDraft("");
        }}
      >
        <button
          type="button"
          onClick={() => (rec.listening ? rec.stop() : rec.start())}
          aria-pressed={rec.listening}
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full text-primary-foreground",
            rec.listening ? "mic-pulse bg-destructive" : "bg-primary",
          )}
          aria-label={rec.listening ? "Stop listening" : "Start listening"}
        >
          <Mic className="h-5 w-5" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={rec.listening ? "Listening…" : "Or type a message"}
          className="w-full rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/60 disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </main>
  );
}
